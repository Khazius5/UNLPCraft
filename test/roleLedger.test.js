const test = require('node:test');
const assert = require('node:assert/strict');
const {
  addGrant,
  ensureLedger,
  getGrants,
  hasActiveGrant,
  removeExpiredGrants,
  supersedeNonBoosterGrants,
} = require('../src/services/roleLedger');

test('a booster expiration does not remove an independently purchased role', () => {
  const db = { roleEntitlements: {}, roles: {} };
  addGrant(db, 'user', 'diamond', 'purchase:1', 'purchase');
  addGrant(db, 'user', 'diamond', 'booster:1', 'booster', 200);

  const result = removeExpiredGrants(db, 'user', 'diamond', 201);

  assert.equal(result.hasActive, true);
  assert.equal(getGrants(db, 'user', 'diamond')['purchase:1'].expiresAt, null);
  assert.equal(getGrants(db, 'user', 'diamond')['booster:1'], undefined);
});

test('superseding a purchased rank preserves an active booster grant', () => {
  const db = { roleEntitlements: {}, roles: {} };
  addGrant(db, 'user', 'diamond', 'purchase:1', 'purchase');
  addGrant(db, 'user', 'diamond', 'booster:1', 'booster', 300);

  const result = supersedeNonBoosterGrants(db, 'user', 'diamond', 200);

  assert.equal(result.changed, true);
  assert.equal(result.hasActive, true);
  assert.equal(getGrants(db, 'user', 'diamond')['purchase:1'], undefined);
  assert.ok(getGrants(db, 'user', 'diamond')['booster:1']);
  assert.equal(hasActiveGrant(db, 'user', 'diamond', 200), true);
});

test('legacy purchase and booster expiration entries migrate to separate grants', () => {
  const db = {
    roleEntitlements: {},
    roles: {
      user: { roleId: 'diamond', expiresAt: 300 },
      'user:plus': { userId: 'user', roleId: 'plus', expiresAt: 400 },
    },
  };

  assert.equal(ensureLedger(db), true);
  assert.equal(db.roles.user, undefined);
  assert.equal(db.roles['user:plus'], undefined);
  assert.equal(getGrants(db, 'user', 'diamond')['legacy:user'].source, 'booster');
  assert.equal(getGrants(db, 'user', 'plus')['legacy:user:plus'].source, 'purchase');
});

test('replaying the same purchase grant does not extend its expiration', () => {
  const db = { roleEntitlements: {}, roles: {} };
  const firstExpiration = 500;
  const retryExpiration = 900;

  assert.equal(addGrant(db, 'user', 'plus', 'purchase:order-1', 'purchase', firstExpiration), true);
  assert.equal(addGrant(db, 'user', 'plus', 'purchase:order-1', 'purchase', retryExpiration), false);
  assert.equal(getGrants(db, 'user', 'plus')['purchase:order-1'].expiresAt, firstExpiration);
});
