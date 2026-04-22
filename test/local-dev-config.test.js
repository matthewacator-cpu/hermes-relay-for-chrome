import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLocalDevConfigPatch,
  loadLocalDevConfig,
  parseLocalDevConfig,
} from '../extension/lib/background/local-dev-config.js';

test('parseLocalDevConfig normalizes usable config values', () => {
  const parsed = parseLocalDevConfig({
    baseUrl: 'http://localhost:8642/',
    apiKey: ' local-key ',
    source: '/Users/example/.hermes/.env',
    generatedAt: '2026-04-22T00:00:00.000Z',
  });

  assert.deepEqual(parsed, {
    baseUrl: 'http://localhost:8642',
    apiKey: 'local-key',
    source: '/Users/example/.hermes/.env',
    generatedAt: '2026-04-22T00:00:00.000Z',
  });
});

test('buildLocalDevConfigPatch only syncs changed local dev values', () => {
  const patch = buildLocalDevConfigPatch(
    {
      baseUrl: 'http://127.0.0.1:8642',
      apiKey: 'old-key',
    },
    {
      baseUrl: 'http://localhost:8642',
      apiKey: 'new-key',
    },
  );

  assert.deepEqual(patch, {
    baseUrl: 'http://localhost:8642',
    apiKey: 'new-key',
  });
});

test('loadLocalDevConfig returns null when the local file is unavailable', async () => {
  const localConfig = await loadLocalDevConfig({
    runtime: {
      getURL(path) {
        return `chrome-extension://test/${path}`;
      },
    },
    fetchImpl: async () => ({
      ok: false,
    }),
  });

  assert.equal(localConfig, null);
});
