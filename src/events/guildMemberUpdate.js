const mc = require('../services/minecraft');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    const started = !oldMember.premiumSince && newMember.premiumSince;
    const ended = oldMember.premiumSince && !newMember.premiumSince;
    if (!started && !ended) return;

    const mcName = null; // TODO: buscar el usuario vinculado a newMember.id
    if (!mcName) return;

    await mc.run(started
      ? `lp user ${mcName} parent add booster`
      : `lp user ${mcName} parent remove booster`);
  },
};