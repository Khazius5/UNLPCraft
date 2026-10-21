require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const loadEvents = require('./handlers/loadEvents');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

loadEvents(client);
client.login(process.env.DISCORD_TOKEN);