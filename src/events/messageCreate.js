const { MessageType } = require('discord.js');
const { registerBoost } = require('../services/boostTracking');

const BOOST_TYPES = new Set([
  MessageType.GuildBoost,
  MessageType.GuildBoostTier1,
  MessageType.GuildBoostTier2,
  MessageType.GuildBoostTier3,
]);

module.exports = {
  name: 'messageCreate',
  execute(message, client) {
    if (!BOOST_TYPES.has(message.type)) return;
    try {
      registerBoost(message, client);
    } catch (error) {
      console.error('No se pudo registrar el boost:', error.message);
    }
  },
};