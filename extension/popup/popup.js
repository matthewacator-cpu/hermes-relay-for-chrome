'use strict';

const $ = (id) => document.getElementById(id);

function setOutput(text) {
  $('output').textContent = text || 'No output yet.';
}

function setPageActionAvailability(enabled) {
  ['summarize-page', 'ask-page', 'build-context'].forEach((id) => {
    const button = $(id);
    if (button) {
      button.disabled = !enabled;
    }
  });
  $('ask-prompt').disabled = !enabled;
}

function relativeTime(iso) {
  if (!iso) return 'just now';
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.round(delta / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function setBusy(buttonId, label, busy) {
  const button = $(buttonId);
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = label;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

function renderStatus(payload) {
  const health = payload.health || {};
  const config = payload.config || {};

  $('base-url').value = config.baseUrl || '';
  $('api-key').value = config.apiKey || '';
  $('conversation-prefix').value = config.conversationPrefix || 'hermes-relay';

  const dot = $('status-dot');
  dot.classList.remove('ok', 'offline');
  dot.classList.add(health.ok ? 'ok' : 'offline');
  $('status-label').textContent = health.ok ? 'Connected to Hermes' : 'Not connected yet';
  $('status-meta').textContent = health.ok
    ? `Ready at ${health.baseUrl || config.baseUrl}`
    : (config.apiKey
      ? 'Hermes was not reachable on your machine. Start Hermes, then refresh.'
      : 'Paste your Hermes API key once, then connect.');
}

function renderPage(response) {
  if (!response?.ok) {
    setPageActionAvailability(false);
    $('page-title').textContent = 'No active page found';
    $('page-meta').textContent = 'Open a normal website tab to use Hermes Relay.';
    $('page-continuity').textContent = response?.error || 'Hermes could not inspect the active tab.';
    $('page-continuity').classList.remove('seen');
    $('page-continuity').classList.add('new');
    return;
  }

  setPageActionAvailability(true);
  const { page, tab, continuity } = response;
  $('page-title').textContent = page?.title || tab?.title || 'Untitled page';
  $('page-meta').textContent = [page?.hostname, page?.pageType, page?.url].filter(Boolean).join(' · ');
  $('page-continuity').innerHTML = escapeHtml(continuity?.message || 'Hermes has not seen this page yet.');
  $('page-continuity').classList.toggle('seen', Boolean(continuity?.seenBefore));
  $('page-continuity').classList.toggle('new', !continuity?.seenBefore);
}

function renderHandoff(response) {
  const handoff = response?.handoff || {};
  const insertButton = $('insert-latest');
  const canInsert = Boolean(handoff.available && handoff.canInsertHere);
  if (insertButton) {
    insertButton.disabled = !canInsert;
  }

  if (!handoff.available) {
    $('handoff-status').textContent = 'Build context from a page before inserting it into a chat.';
    return;
  }

  if (!handoff.canInsertHere) {
    $('handoff-status').textContent = `Latest context ready from ${handoff.title || 'a recent page'}. Switch to Claude, ChatGPT, or Gemini to insert it.`;
    return;
  }

  $('handoff-status').textContent = `Latest context ready from ${handoff.title || 'a recent page'} · ${relativeTime(handoff.timestamp)}`;
}

async function refreshAll() {
  const [status, page, handoff] = await Promise.all([
    sendMessage({ type: 'GET_STATUS' }),
    sendMessage({ type: 'GET_ACTIVE_PAGE_CONTEXT' }),
    sendMessage({ type: 'GET_HANDOFF_STATUS' }),
  ]);
  const workspace = await sendMessage({
    type: 'GET_WORKSPACE_STATE',
    url: page?.page?.url || page?.tab?.url || '',
    useActivePage: !page?.page?.url && !page?.tab?.url,
  });
  renderStatus(status);
  renderPage(page);
  renderHandoff(handoff);
  $('ask-prompt').value = workspace.workspaceState?.prompt || '';
  setOutput(workspace.workspaceState?.output || 'Hermes responses will appear here.');
}

async function openWorkspace() {
  await sendMessage({ type: 'OPEN_SIDE_PANEL' });
}

async function saveWorkspacePatch(patch) {
  await sendMessage({
    type: 'SAVE_WORKSPACE_STATE',
    patch,
    useActivePage: true,
  });
}

async function runAction(buttonId, busyLabel, fn) {
  setBusy(buttonId, busyLabel, true);
  try {
    const result = await fn();
    if (!result.ok) {
      throw new Error(result.error || 'Hermes request failed.');
    }
    return result;
  } catch (error) {
    setOutput(error.message || String(error));
    await saveWorkspacePatch({ output: error.message || String(error), lastAction: 'error' });
    return null;
  } finally {
    setBusy(buttonId, busyLabel, false);
  }
}

$('save-config').addEventListener('click', async () => {
  const response = await sendMessage({
    type: 'SAVE_CONFIG',
    config: {
      baseUrl: $('base-url').value.trim(),
      apiKey: $('api-key').value.trim(),
      conversationPrefix: $('conversation-prefix').value.trim() || 'hermes-relay',
    },
  });

  if (!response.ok) {
    setOutput(response.error || 'Could not save config.');
    return;
  }

  setOutput('Saved. Trying Hermes now…');
  await refreshAll();
});

$('refresh-status').addEventListener('click', refreshAll);
$('open-workspace').addEventListener('click', openWorkspace);
$('open-workspace-cta').addEventListener('click', openWorkspace);

$('ask-prompt').addEventListener('input', async () => {
  await saveWorkspacePatch({ prompt: $('ask-prompt').value });
});

$('summarize-page').addEventListener('click', async () => {
  const prompt = $('ask-prompt').value.trim();
  const result = await runAction('summarize-page', 'Summarizing…', () => sendMessage({
    type: 'RUN_WORKFLOW',
    mode: 'summarize',
    prompt,
    target: 'generic',
  }));
  if (!result) return;
  setOutput(result.text || 'Done.');
  await saveWorkspacePatch({
    prompt,
    output: result.text || '',
    mode: 'summarize',
    lastAction: 'popup-summarize',
    source: 'popup',
  });
  await openWorkspace();
});

$('ask-page').addEventListener('click', async () => {
  const prompt = $('ask-prompt').value.trim();
  const result = await runAction('ask-page', 'Asking…', () => sendMessage({
    type: 'RUN_WORKFLOW',
    mode: 'ask',
    prompt,
    target: 'generic',
  }));
  if (!result) return;
  setOutput(result.text || 'Done.');
  await saveWorkspacePatch({
    prompt,
    output: result.text || '',
    mode: 'ask',
    lastAction: 'popup-ask',
    source: 'popup',
  });
  await openWorkspace();
});

$('build-context').addEventListener('click', async () => {
  const prompt = $('ask-prompt').value.trim();
  const built = await runAction('build-context', 'Building…', () => sendMessage({
    type: 'BUILD_CONTEXT',
    prompt,
    target: 'auto',
  }));
  if (!built) return;
  setOutput(built.text || 'Done.');
  await saveWorkspacePatch({
    prompt,
    output: built.text || '',
    mode: 'inject',
    target: built.target || 'auto',
    lastAction: 'popup-build-context',
    source: 'popup',
  });
  await refreshAll();
});

$('insert-latest').addEventListener('click', async () => {
  const inserted = await runAction('insert-latest', 'Inserting…', () => sendMessage({
    type: 'INSERT_LATEST_CONTEXT',
  }));
  if (!inserted) return;

  const finalText = `${inserted.text || ''}\n\n[Inserted latest context into active chat]`;
  setOutput(finalText);
  await saveWorkspacePatch({
    prompt: $('ask-prompt').value.trim(),
    output: finalText,
    mode: 'inject',
    lastAction: 'popup-insert-latest-context',
    source: 'popup',
  });
  await refreshAll();
});

$('copy-output').addEventListener('click', async () => {
  const text = $('output').textContent || '';
  await navigator.clipboard.writeText(text);
  setOutput(`${text}\n\n[Copied to clipboard]`);
});

refreshAll().catch((error) => {
  setOutput(error.message || String(error));
});
