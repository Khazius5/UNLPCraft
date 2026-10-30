require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const loadEvents = require('./handlers/loadEvents');
const express = require('express');

const app = express();
app.use(express.json({ limit: '8kb', type: 'application/json' }));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

require('./routes/dev')(app, client);
require('./routes/minecraftLink')(app, client);

loadEvents(client);
client.login(process.env.DISCORD_TOKEN);

app.listen(process.env.PORT || 3000, () => console.log('Servidor HTTP escuchando'));