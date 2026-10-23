const { MessageFlags } = require('discord.js');
const reclamarBoost = require('../commands/reclamarBoost');

const commands = new Map([[reclamarBoost.data.name, reclamarBoost]]);

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    const cmd = commands.get(interaction.commandName);
    if (!cmd) return;
    try {
      await cmd.execute(interaction);
    } catch (e) {
      console.error(e);
      const msg = 'Ocurrió un error.';
      if (interaction.deferred || interaction.replied) await interaction.editReply(msg).catch(() => {});
      else await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  },
};