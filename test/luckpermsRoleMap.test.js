const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { loadRoleMap } = require('../src/services/luckpermsRoleMap');
const ranks = require('../src/config/ranks');

test('LuckPerms role map contains the provided groups and does not map Discord booster role', () => {
  const map = loadRoleMap();

  assert.equal(map.oro, '1403748269749960724');
  assert.equal(map['netherite+'], '1539732504955719871');
  assert.equal(map.fac_laburante, '1491848925500412085');
  assert.equal(map.fac_trabajosocial, '1408551608257876069');
  assert.equal(Object.hasOwn(map, 'booster'), false);
});

test('boost rank roles use the same IDs from the JSON role map', () => {
  const map = loadRoleMap();

  assert.equal(ranks.oro.discordRoleId, map.oro);
  assert.equal(ranks.diamante.discordRoleId, map.diamante);
  assert.equal(ranks.netherite.discordRoleId, map.netherite);
  assert.equal(ranks.netheriteplus.discordRoleId, map['netherite+']);
});

test('role map loader rejects invalid or missing Discord role IDs', (t) => {
  const file = path.join(__dirname, 'invalid-role-map.tmp.json');
  t.after(() => {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });
  fs.writeFileSync(file, JSON.stringify({ vip: null }));

  assert.throws(() => loadRoleMap(file), /Invalid Discord role mapping/);
});
