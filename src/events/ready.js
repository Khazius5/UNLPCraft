const { REST, Routes } = require('discord.js');
const config = require('../config/config');
const { getAllGuildIds, getGuildConfig } = require('../config/guilds');
const setupRolesCommand = require('../commands/setupRoles');
const anuncioCommand = require('../commands/anuncio');

module.exports = async (readyClient) => {
  console.log(`✅ Bot conectado como ${readyClient.user.tag}`);

  const rest = new REST().setToken(config.token);

  for (const guildId of getAllGuildIds()) {
    const guildConfig = getGuildConfig(guildId);
    const commandsData = [];

    if (guildConfig.rolesMenu) {
      commandsData.push(setupRolesCommand.data.toJSON());
    }

    // /anuncio solo se registra si el server tiene anuncios Y un menú de roles
    // (de ahí sale la lista de "juegos" para el selector del comando).
    if (guildConfig.announcements && guildConfig.rolesMenu) {
      commandsData.push(anuncioCommand.buildData(guildConfig.rolesMenu.roles).toJSON());
    }

    try {
      await rest.put(Routes.applicationGuildCommands(config.clientId, guildId), {
        body: commandsData,
      });
      console.log(`🔧 Slash commands registrados en el server ${guildId}`);
    } catch (err) {
      console.error(`❌ No se pudieron registrar los comandos en ${guildId}:`, err);
    }
  }
};
