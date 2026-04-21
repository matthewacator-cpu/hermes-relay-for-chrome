import assert from 'node:assert/strict';
import test from 'node:test';

import { describeLatestContext, findLatestContextAction } from '../extension/lib/background/handoff.js';

test('findLatestContextAction returns the newest saved handoff action', () => {
  const action = findLatestContextAction([
    { type: 'page-ask', output: 'ignore me' },
    { type: 'build-context', output: 'context bundle', timestamp: '2026-04-21T01:00:00.000Z' },
    { type: 'workflow-inject', output: 'older bundle', timestamp: '2026-04-20T01:00:00.000Z' },
  ]);

  assert.equal(action?.type, 'build-context');
  assert.equal(action?.output, 'context bundle');
});

test('describeLatestContext returns an explicit unavailable state', () => {
  assert.deepEqual(describeLatestContext(null), {
    available: false,
    title: '',
    timestamp: '',
    target: 'generic',
    type: '',
  });
});
