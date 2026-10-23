const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { claimBoost } = require('../services/boosts');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reclamar-boost')
    .setDescription('Reclamá tu recompensa por boostear el server')
    .addStringOption((o) =>
      o.setName('nick').setDescription('Tu nickname de Minecraft')
        .setRequired(true).setMinLength(3).setMaxLength(16)),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const res = await claimBoost(interaction.member, interaction.options.getString('nick', true));
    await interaction.editReply(res.msg);
  },
};