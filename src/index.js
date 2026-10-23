require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const loadEvents = require('./handlers/loadEvents');
const express = require('express');
const app = express();
const path = require('path');

app.use(express.static(path.join(__dirname, '../public')));

require('./routes/auth')(app);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

loadEvents(client);
client.login(process.env.DISCORD_TOKEN);

app.listen(process.env.PORT || 3000, () => console.log('Servidor HTTP escuchando'));