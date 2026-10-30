const crypto = require('crypto');
const { AccountLinkError } = require('../services/accountLinks');
const accountLinks = require('../services/accountLinksStore');
const {
  getHighestRankGroup,
  loadRoleMap,
  RANK_GROUPS_BY_PRIORITY,
} = require('../services/luckpermsRoleMap');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GROUP_PATTERN = /^[A-Za-z0-9_.+-]{1,64}$/;

module.exports = (app, client, links = accountLinks, getRoleMap = loadRoleMap) => {
  app.post('/api/minecraft/link', async (req, res) => {
    const expectedKey = process.env.MINECRAFT_LINK_API_KEY;
    if (!expectedKey || !process.env.GUILD_ID) {
      return res.status(503).json({ error: 'Minecraft link endpoint is not configured.' });
    }
    if (!safeEqual(expectedKey, req.get('x-api-key') || '')) {
      return res.status(401).json({ error: 'Invalid API key.' });
    }

    const { action = 'link', code, player, groups } = req.body || {};
    if (
      !['link', 'sync'].includes(action)
      || (action === 'link' && (typeof code !== 'string' || !/^[a-f0-9]{48}$/i.test(code)))
      || (action === 'sync' && code !== undefined)
      || !player
      || typeof player !== 'object'
      || typeof player.uuid !== 'string'
      || !UUID_PATTERN.test(player.uuid)
      || typeof player.name !== 'string'
      || !/^[A-Za-z0-9_]{3,16}$/.test(player.name)
      || !Array.isArray(groups)
      || groups.length > 100
      || groups.some((group) => typeof group !== 'string' || !GROUP_PATTERN.test(group))
    ) {
      return res.status(400).json({ error: 'Invalid link request.' });
    }

    let roleMap;
    try {
      roleMap = getRoleMap();
    } catch (error) {
      console.error('Minecraft link role mapping is invalid:', error.message);
      return res.status(503).json({ error: 'Minecraft role mapping is not configured correctly.' });
    }
    if (Object.keys(roleMap).length === 0) {
      return res.status(503).json({ error: 'Minecraft role mapping is not configured.' });
    }

    let link;
    try {
      const request = {
        uuid: player.uuid.toLowerCase(),
        playerName: player.name,
        groups: [...new Set(groups)],
      };
      link = action === 'link'
        ? links.linkPlayer({ ...request, code })
        : links.updateLinkedPlayer(request);
    } catch (error) {
      if (error instanceof AccountLinkError && error.code === 'INVALID_CODE') {
        return res.status(400).json({ error: 'The link code is invalid or expired.' });
      }
      if (error instanceof AccountLinkError && error.code === 'NOT_LINKED') {
        return res.status(404).json({ error: 'This Minecraft account is not linked yet.' });
      }
      if (error instanceof AccountLinkError && error.code === 'CONFLICT') {
        return res.status(409).json({ error: error.message });
      }
      console.error('Could not persist Minecraft account link:', error.message);
      return res.status(500).json({ error: 'Could not save the account link.' });
    }

    try {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      const member = await guild.members.fetch(link.discordUserId);
      const highestRankGroup = getHighestRankGroup(link.groups);
      const groupsToSync = link.groups.filter(
        (group) => !RANK_GROUPS_BY_PRIORITY.includes(group)
          || group === highestRankGroup,
      );
      const targetRoleIds = [...new Set(
        groupsToSync
          .filter((group) => Object.hasOwn(roleMap, group))
          .map((group) => roleMap[group]),
      )];
      const previousRoleIds = link.managedRoleIds || [];
      const managedRoleIds = targetRoleIds.filter(
        (roleId) => previousRoleIds.includes(roleId) || !member.roles.cache.has(roleId),
      );

      for (const roleId of targetRoleIds) {
        if (!member.roles.cache.has(roleId)) await member.roles.add(roleId);
      }
      for (const roleId of previousRoleIds) {
        if (!targetRoleIds.includes(roleId) && member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId);
        }
      }

      links.updateManagedRoles(player.uuid.toLowerCase(), managedRoleIds);
      return res.status(200).json({
        ok: true,
        linked: true,
        synchronized: true,
        synchronizedRoles: targetRoleIds.length,
      });
    } catch (error) {
      console.error('Minecraft link saved, but Discord role synchronization failed:', error.message);
      return res.status(503).json({ error: 'Account link saved, but Discord roles could not be synchronized. Retry the request.' });
    }
  });
};

function safeEqual(expected, presented) {
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const presentedBuffer = Buffer.from(presented, 'utf8');
  return expectedBuffer.length === presentedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, presentedBuffer);
}
