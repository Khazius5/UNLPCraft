const RANKS = require('../config/ranks');

async function grant(client, { rank, discordId }) {
  const r = RANKS[rank];
  if (!r) throw new Error('Rango inválido');

  const otherRanks = Object.entries(RANKS)
    .filter(([key]) => key !== rank)
    .map(([, value]) => value);

  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  const member = await guild.members.fetch(discordId);

  const rolesToRemove = otherRanks
    .map((oldRank) => oldRank.discordRoleId)
    .filter((roleId) => roleId && member.roles.cache.has(roleId));

  if (rolesToRemove.length > 0) {
    await member.roles.remove(rolesToRemove);
  }

  await member.roles.add(r.discordRoleId);
}

module.exports = { grant };