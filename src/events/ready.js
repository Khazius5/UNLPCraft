const { startExpiryJob } = require('../services/boosts');
const { resumeBoostTracking } = require('../services/boostTracking');
const reclamarBoost = require('../commands/reclamarBoost');
const { startPurchaseConsumer } = require('../services/purchases');
module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
    try {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      await guild.commands.set([reclamarBoost.data.toJSON()]);
      console.log('Slash commands registrados');
    } catch (e) {
      console.error('No se pudieron registrar los comandos:', e);
    }
    if (process.env.BACKEND_URL) startPurchaseConsumer(client);
    startExpiryJob(client);
    resumeBoostTracking(client);
  },
};