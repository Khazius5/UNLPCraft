const assert = require('node:assert/strict');
const test = require('node:test');
const { sendAdminAlert } = require('../src/services/adminAlerts');

test('admin alerts DM the configured administrator without allowing mentions', async (t) => {
  const previousRecipient = process.env.ALERT_DISCORD_USER_ID;
  delete process.env.ALERT_DISCORD_USER_ID;
  t.after(() => {
    if (previousRecipient === undefined) delete process.env.ALERT_DISCORD_USER_ID;
    else process.env.ALERT_DISCORD_USER_ID = previousRecipient;
  });

  let fetchedId;
  let sentMessage;
  const client = {
    users: {
      fetch: async (id) => {
        fetchedId = id;
        return {
          send: async (message) => {
            sentMessage = message;
          },
        };
      },
    },
  };

  const sent = await sendAdminAlert(client, {
    title: 'Revisión manual',
    playerName: 'PlayerOne',
    uuid: '123e4567-e89b-12d3-a456-426614174000',
    discordUserId: '22345678901234567',
    details: 'Verificar saldo.',
  });

  assert.equal(sent, true);
  assert.equal(fetchedId, '317050947622928384');
  assert.match(sentMessage.content, /PlayerOne/);
  assert.match(sentMessage.content, /Verificar saldo/);
  assert.deepEqual(sentMessage.allowedMentions, { parse: [] });
});

test('admin alerts allow overriding the recipient and report delivery failures', async (t) => {
  const previousRecipient = process.env.ALERT_DISCORD_USER_ID;
  process.env.ALERT_DISCORD_USER_ID = '12345678901234567';
  t.after(() => {
    if (previousRecipient === undefined) delete process.env.ALERT_DISCORD_USER_ID;
    else process.env.ALERT_DISCORD_USER_ID = previousRecipient;
  });

  let fetchedId;
  const client = {
    users: {
      fetch: async (id) => {
        fetchedId = id;
        throw new Error('DMs disabled');
      },
    },
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(await sendAdminAlert(client, { title: 'Fallo' }), false);
  } finally {
    console.error = originalError;
  }
  assert.equal(fetchedId, '12345678901234567');
});
