import { DEFAULT_CONFIG } from './constants.js';

export function canonicalizeUrl(url) {
  try {
    const parsed = new URL(String(url || ''));
    parsed.hash = '';
    return parsed.toString();
  } catch (_) {
    return String(url || '').split('#')[0];
  }
}

export function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeBaseUrl(baseUrl) {
  return (baseUrl || DEFAULT_CONFIG.baseUrl).replace(/\/+$/, '');
}

export function hashString(input) {
  let hash = 0;
  const text = String(input || '');
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

export function parseIsoTime(value) {
  const stamp = Date.parse(value || '');
  return Number.isFinite(stamp) ? stamp : 0;
}

export function summarizeNote(text, limit = 160) {
  const compact = String(text || '').replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  return compact.length > limit ? `${compact.slice(0, limit - 1)}...` : compact;
}

export function inferAssistantTarget(url) {
  const raw = String(url || '').toLowerCase();
  if (raw.includes('claude.ai')) return 'claude';
  if (raw.includes('chatgpt.com') || raw.includes('chat.openai.com')) return 'chatgpt';
  if (raw.includes('gemini.google.com')) return 'gemini';
  return 'generic';
}

export function isSupportedChatUrl(url) {
  return inferAssistantTarget(url) !== 'generic';
}

export function buildConversationId(config, suffix) {
  const safeSuffix = String(suffix || 'general')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'general';
  return `${config.conversationPrefix}-${safeSuffix}`;
}
