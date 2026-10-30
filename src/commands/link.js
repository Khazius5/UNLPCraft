const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const accountLinks = require('../services/accountLinksStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Genera un código para vincular o actualizar tu cuenta de Minecraft'),
  async execute(interaction) {
    if (!interaction.inGuild() || interaction.guildId !== process.env.GUILD_ID) {
      await interaction.reply({
        content: 'Usá este comando en el servidor oficial.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.guild.members.fetch(interaction.user.id);
    const { code, expiresAt } = accountLinks.createCode(interaction.user.id);
    const expiresInMinutes = Math.ceil((expiresAt - Date.now()) / 60_000);
    await interaction.reply({
      content: `En Minecraft ejecutá \`/discord link ${code}\`. El código vence en ${expiresInMinutes} minutos y solo se puede usar una vez. Podés repetir este proceso más adelante para actualizar tus roles. No lo compartas.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
