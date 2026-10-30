const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { AccountLinkError } = require('../services/accountLinks');
const accountLinks = require('../services/accountLinksStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Genera un código para vincular tu cuenta de Minecraft'),
  async execute(interaction) {
    if (!interaction.inGuild() || interaction.guildId !== process.env.GUILD_ID) {
      await interaction.reply({
        content: 'Usá este comando en el servidor oficial.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.guild.members.fetch(interaction.user.id);
    let codeData;
    try {
      codeData = accountLinks.createCode(interaction.user.id);
    } catch (error) {
      if (error instanceof AccountLinkError && error.code === 'ALREADY_LINKED') {
        await interaction.reply({
          content: 'Tu cuenta ya está vinculada. Para actualizar tus roles después de cambios en LuckPerms, usá `/unlpcraftlink:discord sync` en Minecraft.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      throw error;
    }
    const { code, expiresAt } = codeData;
    const expiresInMinutes = Math.ceil((expiresAt - Date.now()) / 60_000);
    await interaction.reply({
      content: `En Minecraft ejecutá \`/unlpcraftlink:discord link ${code}\`. El código vence en ${expiresInMinutes} minutos y solo se puede usar una vez. No lo compartas.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
