const { MessageType } = require('discord.js');
const { onBoostSettled } = require('../services/boosts');

const BOOST_TYPES = new Set([
  MessageType.GuildBoost,
  MessageType.GuildBoostTier1,
  MessageType.GuildBoostTier2,
  MessageType.GuildBoostTier3,
]);
const WINDOW_MS = 2 * 60 * 1000;
const pending = new Map(); // userId -> { count, timer }

module.exports = {
  name: 'messageCreate',
  execute(message) {
    if (!BOOST_TYPES.has(message.type)) return;

    const id = message.author.id;
    const n = Number(message.content) > 0 ? Number(message.content) : 1;
    console.log('Boost detectado:', id, 'content:', JSON.stringify(message.content));

    const entry = pending.get(id) || { count: 0 };
    entry.count += n;
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      pending.delete(id);
      console.log(`Boost asentado: ${id} dio ${entry.count} boost(s)`);
      onBoostSettled(id, entry.count, message.channel).catch(console.error);
    }, WINDOW_MS);
    pending.set(id, entry);
  },
};