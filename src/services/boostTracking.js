const { db, save } = require('./store');
const { recordBoost } = require('./boostQueue');
const { settlePendingBoost } = require('./boosts');

const WINDOW_MS = 2 * 60 * 1000;
const timers = new Map();

db.boostEvents ||= {};

function scheduleSettlement(userId, client) {
  clearTimeout(timers.get(userId));
  const event = db.boostEvents[userId];
  if (!event) {
    timers.delete(userId);
    return;
  }

  const delay = Math.max(0, event.settleAt - Date.now());
  const timer = setTimeout(async () => {
    timers.delete(userId);
    try {
      await settlePendingBoost(userId, client);
      scheduleSettlement(userId, client);
    } catch (error) {
      console.error('No se pudo asentar el boost; se reintentará:', error.message);
      scheduleSettlement(userId, client);
    }
  }, delay);
  timers.set(userId, timer);
}

function registerBoost(message, client) {
  const userId = message.author.id;
  const count = Number(message.content) > 0 ? Number(message.content) : 1;
  recordBoost(db, userId, count, message.channelId, Date.now() + WINDOW_MS);
  save();
  scheduleSettlement(userId, client);
  console.log('Boost detectado:', userId, 'content:', JSON.stringify(message.content));
}

function resumeBoostTracking(client) {
  for (const userId of Object.keys(db.boostEvents)) {
    scheduleSettlement(userId, client);
  }
}

module.exports = { registerBoost, resumeBoostTracking };
