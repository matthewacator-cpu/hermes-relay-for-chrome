import assert from 'node:assert/strict';
import test from 'node:test';

import { createHermesClient, extractOutputText } from '../extension/lib/background/hermes-client.js';

test('extractOutputText flattens response message blocks', () => {
  const text = extractOutputText({
    output: [
      {
        type: 'message',
        content: [
          { type: 'output_text', text: 'First block' },
          { type: 'output_text', text: 'Second block' },
        ],
      },
    ],
  });

  assert.equal(text, 'First block\n\nSecond block');
});

test('checkHealth reports offline when fetch fails', async () => {
  const client = createHermesClient({
    fetchImpl: async () => {
      throw new Error('connect ECONNREFUSED');
    },
  });

  const status = await client.checkHealth({
    baseUrl: 'http://127.0.0.1:8642',
    apiKey: 'local-key',
  });

  assert.equal(status.ok, false);
  assert.match(status.message, /ECONNREFUSED/);
});

test('callResponse returns parsed output text', async () => {
  const client = createHermesClient({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          output: [
            {
              type: 'message',
              content: [
                { type: 'output_text', text: 'Hermes says hi' },
              ],
            },
          ],
        };
      },
    }),
  });

  const response = await client.callResponse({
    baseUrl: 'http://127.0.0.1:8642',
    apiKey: 'local-key',
    model: 'hermes-agent',
  }, {
    prompt: 'hello',
    instructions: 'be helpful',
    conversation: 'relay-test',
  });

  assert.equal(response.text, 'Hermes says hi');
});
