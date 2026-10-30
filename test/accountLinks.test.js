const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { AccountLinkStore, CODE_TTL_MS } = require('../src/services/accountLinks');

function createStore(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'unlpcraft-links-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return new AccountLinkStore(path.join(directory, 'links.json'));
}

test('link codes use a plugin-compatible format, expire, and can only be redeemed once', (t) => {
  const store = createStore(t);
  const now = 1_700_000_000_000;
  const { code, expiresAt } = store.createCode('12345678901234567', now);
  assert.match(code, /^[a-f0-9]{48}$/i);
  assert.equal(expiresAt, now + CODE_TTL_MS);

  const link = store.linkPlayer({
    code,
    uuid: '123e4567-e89b-12d3-a456-426614174000',
    playerName: 'PlayerOne',
    groups: ['default'],
  }, now + 1);
  assert.equal(link.discordUserId, '12345678901234567');

  assert.throws(() => store.linkPlayer({
    code,
    uuid: '223e4567-e89b-12d3-a456-426614174000',
    playerName: 'PlayerTwo',
    groups: [],
  }, now + 2), { code: 'INVALID_CODE' });
});

test('link code expires and the same completed request is safe to retry', (t) => {
  const store = createStore(t);
  const now = 1_700_000_000_000;
  const expired = store.createCode('12345678901234567', now);
  assert.throws(() => store.linkPlayer({
    code: expired.code,
    uuid: '123e4567-e89b-12d3-a456-426614174000',
    playerName: 'PlayerOne',
    groups: [],
  }, expired.expiresAt), { code: 'INVALID_CODE' });

  const current = store.createCode('12345678901234567', expired.expiresAt + 1);
  const request = {
    code: current.code,
    uuid: '123e4567-e89b-12d3-a456-426614174000',
    playerName: 'PlayerOne',
    groups: ['vip'],
  };
  store.linkPlayer(request, current.expiresAt - 1);
  const retry = store.linkPlayer(request, current.expiresAt + 100);
  assert.equal(retry.discordUserId, '12345678901234567');
  assert.deepEqual(retry.groups, ['vip']);
});

test('a Discord account cannot request another code or link a second Minecraft UUID', (t) => {
  const store = createStore(t);
  const firstCode = store.createCode('12345678901234567');
  store.linkPlayer({
    code: firstCode.code,
    uuid: '123e4567-e89b-12d3-a456-426614174000',
    playerName: 'PlayerOne',
    groups: [],
  });
  assert.throws(() => store.createCode('12345678901234567'), { code: 'ALREADY_LINKED' });

  assert.throws(() => store.linkPlayer({
    code: firstCode.code,
    uuid: '223e4567-e89b-12d3-a456-426614174000',
    playerName: 'PlayerTwo',
    groups: [],
  }), { code: 'INVALID_CODE' });
});

test('a Minecraft UUID cannot be linked to a different Discord account', (t) => {
  const store = createStore(t);
  const firstCode = store.createCode('12345678901234567');
  store.linkPlayer({
    code: firstCode.code,
    uuid: '123e4567-e89b-12d3-a456-426614174000',
    playerName: 'PlayerOne',
    groups: [],
  });
  const secondCode = store.createCode('22345678901234567');

  assert.throws(() => store.linkPlayer({
    code: secondCode.code,
    uuid: '123e4567-e89b-12d3-a456-426614174000',
    playerName: 'PlayerOne',
    groups: [],
  }), { code: 'CONFLICT' });
});
