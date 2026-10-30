const test = require('node:test');
const assert = require('node:assert/strict');

const command = require('../src/commands/reclamarBoost');

test('boost claim fetches the GuildMember using the interaction user ID', async () => {
  let fetchedUserId;
  let reply;
  const userId = `test-${Date.now()}`;

  await command.execute({
    deferReply: async () => {},
    inGuild: () => true,
    guild: {
      members: {
        fetch: async (id) => {
          fetchedUserId = id;
          return { id };
        },
      },
    },
    user: { id: userId },
    options: { getString: () => 'MinecraftNick' },
    editReply: async (message) => {
      reply = message;
    },
  });

  assert.equal(fetchedUserId, userId);
  assert.equal(reply, 'No tenés recompensas de boost pendientes.');
});
