const test = require('node:test');
const assert = require('node:assert/strict');
const { recordBoost, settleBoost } = require('../src/services/boostQueue');

test('boost window accumulates counts and persists enough data to resume after restart', () => {
  const db = { pending: {}, boostEvents: {} };
  recordBoost(db, 'user', 1, 'channel', 100);
  recordBoost(db, 'user', 2, 'channel', 200);

  const restored = JSON.parse(JSON.stringify(db));
  assert.equal(settleBoost(restored, 'user', 199, 'claim-id'), null);
  const result = settleBoost(restored, 'user', 200, 'claim-id');

  assert.deepEqual(result, {
    claim: { id: 'claim-id', boosts: 2, createdAt: 200 },
    channelId: 'channel',
  });
  assert.equal(restored.boostEvents.user, undefined);
  assert.equal(restored.pending.user.length, 1);
});
