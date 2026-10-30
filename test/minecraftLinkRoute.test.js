const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { AccountLinkStore } = require('../src/services/accountLinks');
const registerMinecraftLinkRoute = require('../src/routes/minecraftLink');

function setupRoute(t, existingRoleIds = []) {
  const previousKey = process.env.MINECRAFT_LINK_API_KEY;
  const previousGuild = process.env.GUILD_ID;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'unlpcraft-route-'));
  const links = new AccountLinkStore(path.join(directory, 'links.json'));
  const roles = new Set(existingRoleIds);
  const member = {
    roles: {
      cache: { has: (roleId) => roles.has(roleId) },
      add: async (roleId) => roles.add(roleId),
      remove: async (roleId) => roles.delete(roleId),
    },
  };
  const client = {
    guilds: {
      fetch: async () => ({ members: { fetch: async () => member } }),
    },
  };
  const routes = new Map();
  registerMinecraftLinkRoute(
    { post: (url, handler) => routes.set(url, handler) },
    client,
    links,
    () => ({
      oro: '11111111111111111',
      diamante: '22222222222222222',
      netherite: '33333333333333333',
      vip: '98765432109876543',
      'netherite+': '87654321098765432',
      fac_informatica: '44444444444444444',
    }),
  );
  t.after(() => {
    if (previousKey === undefined) delete process.env.MINECRAFT_LINK_API_KEY;
    else process.env.MINECRAFT_LINK_API_KEY = previousKey;
    if (previousGuild === undefined) delete process.env.GUILD_ID;
    else process.env.GUILD_ID = previousGuild;
    fs.rmSync(directory, { recursive: true, force: true });
  });
  process.env.MINECRAFT_LINK_API_KEY = 'test-secret';
  process.env.GUILD_ID = '12345678901234567';

  const handler = routes.get('/api/minecraft/link');
  const invoke = async (body, apiKey = 'test-secret') => {
    const result = {
      statusCode: 200,
      body: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(value) {
        this.body = value;
        return this;
      },
    };
    await handler({ body, get: (name) => name.toLowerCase() === 'x-api-key' ? apiKey : undefined }, result);
    return result;
  };

  return { invoke, links, roles };
}

test('Minecraft link endpoint authenticates the plugin and applies configured roles', async (t) => {
  const { invoke, links, roles } = setupRoute(t);
  const { code } = links.createCode('12345678901234567');
  const body = {
    code,
    player: { uuid: '123e4567-e89b-12d3-a456-426614174000', name: 'PlayerOne' },
    groups: ['default', 'vip', 'netherite+'],
  };

  const unauthorized = await invoke(body, 'wrong-secret');
  assert.equal(unauthorized.statusCode, 401);

  const response = await invoke(body);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.deepEqual([...roles], ['98765432109876543', '87654321098765432']);
  assert.equal(response.body.synchronizedRoles, 2);
  assert.deepEqual(
    links.data.linksByUuid['123e4567-e89b-12d3-a456-426614174000'].managedRoleIds,
    ['98765432109876543', '87654321098765432'],
  );
});

test('Minecraft link endpoint rejects malformed requests without consuming a code', async (t) => {
  const { invoke, links } = setupRoute(t);
  const { code } = links.createCode('12345678901234567');

  const response = await invoke({
    code,
    player: { uuid: 'not-a-uuid', name: 'PlayerOne' },
    groups: [],
  });

  assert.equal(response.statusCode, 400);
  assert.equal(Object.keys(links.data.pendingCodes).length, 1);
});

test('role synchronization does not take ownership of an already assigned role', async (t) => {
  const roleId = '98765432109876543';
  const { invoke, links, roles } = setupRoute(t, [roleId]);
  const { code } = links.createCode('12345678901234567');
  const uuid = '123e4567-e89b-12d3-a456-426614174000';

  const linked = await invoke({
    code,
    player: { uuid, name: 'PlayerOne' },
    groups: ['vip'],
  });
  assert.equal(linked.statusCode, 200);
  assert.deepEqual(links.data.linksByUuid[uuid].managedRoleIds, []);

  const refreshCode = links.createCode('12345678901234567').code;
  const refreshed = await invoke({
    code: refreshCode,
    player: { uuid, name: 'PlayerOne' },
    groups: [],
  });
  assert.equal(refreshed.statusCode, 200);
  assert.deepEqual([...roles], [roleId]);
});

test('sync action updates current groups and roles for an already linked UUID', async (t) => {
  const { invoke, links, roles } = setupRoute(t);
  const uuid = '123e4567-e89b-12d3-a456-426614174000';
  const { code } = links.createCode('12345678901234567');

  const linked = await invoke({
    action: 'link',
    code,
    player: { uuid, name: 'PlayerOne' },
    groups: ['vip'],
  });
  assert.equal(linked.statusCode, 200);
  assert.deepEqual([...roles], ['98765432109876543']);

  const synced = await invoke({
    action: 'sync',
    player: { uuid, name: 'PlayerOne' },
    groups: ['netherite+'],
  });

  assert.equal(synced.statusCode, 200);
  assert.deepEqual([...roles], ['87654321098765432']);
  assert.deepEqual(links.data.linksByUuid[uuid].groups, ['netherite+']);
});

test('sync action rejects unlinked UUIDs without creating a link', async (t) => {
  const { invoke, links } = setupRoute(t);
  const response = await invoke({
    action: 'sync',
    player: {
      uuid: '123e4567-e89b-12d3-a456-426614174000',
      name: 'PlayerOne',
    },
    groups: ['vip'],
  });

  assert.equal(response.statusCode, 404);
  assert.equal(Object.keys(links.data.linksByUuid).length, 0);
});

test('role synchronization assigns only the highest inherited VIP rank and keeps faculty roles', async (t) => {
  const { invoke, links, roles } = setupRoute(t);
  const uuid = '123e4567-e89b-12d3-a456-426614174000';
  const { code } = links.createCode('12345678901234567');

  const response = await invoke({
    code,
    player: { uuid, name: 'PlayerOne' },
    groups: ['oro', 'diamante', 'netherite+', 'fac_informatica'],
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual([...roles], ['87654321098765432', '44444444444444444']);
});
