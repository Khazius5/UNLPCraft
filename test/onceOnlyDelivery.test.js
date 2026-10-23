const test = require('node:test');
const assert = require('node:assert/strict');
const { deliverOnce } = require('../src/services/onceOnlyDelivery');

test('delivery state is persisted before sending and completed after success', async () => {
  const record = {};
  const snapshots = [];

  await deliverOnce(record, 'moneyDelivery', 'eco give player 100', async () => {
    assert.equal(record.moneyDelivery, 'processing');
  }, () => snapshots.push(record.moneyDelivery));

  assert.deepEqual(snapshots, ['processing', 'done']);
});

test('an ambiguous failure is marked for manual review and is never resent', async () => {
  const record = {};
  let sends = 0;

  await assert.rejects(
    deliverOnce(record, 'moneyDelivery', 'eco give player 100', async () => {
      sends += 1;
      throw new Error('connection lost');
    }, () => {}),
    { manualReview: true },
  );
  await assert.rejects(
    deliverOnce(record, 'moneyDelivery', 'eco give player 100', async () => {
      sends += 1;
    }, () => {}),
    { manualReview: true },
  );

  assert.equal(record.moneyDelivery, 'manual_review');
  assert.equal(sends, 1);
});
