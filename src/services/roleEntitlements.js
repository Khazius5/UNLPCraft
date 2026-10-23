const { db, save } = require('./store');
const {
  addGrant,
  deleteRoleGrants,
  ensureLedger,
  getGrant,
  getGrants,
  hasActiveGrant,
  latestExpiry,
  pruneExpiredGrants,
  supersedeNonBoosterGrants,
} = require('./roleLedger');

const roleQueues = new Map();

if (ensureLedger(db)) save();

function withRoleLock(userId, roleId, operation) {
  const key = `${userId}:${roleId}`;
  const previous = roleQueues.get(key) || Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  roleQueues.set(key, current);
  return current.finally(() => {
    if (roleQueues.get(key) === current) roleQueues.delete(key);
  });
}

async function grantRole(member, { userId, roleId, grantId, source, expiresAt = null }) {
  return withRoleLock(userId, roleId, async () => {
    const existingGrants = getGrants(db, userId, roleId);
    let changed = false;

    if (expiresAt !== null && member.roles.cache.has(roleId) && Object.keys(existingGrants).length === 0) {
      changed = addGrant(db, userId, roleId, 'legacy:existing-role', 'permanent') || changed;
    }

    changed = addGrant(db, userId, roleId, grantId, source, expiresAt) || changed;
    if (changed) save();
    if (!member.roles.cache.has(roleId)) await member.roles.add(roleId);
  });
}

async function supersedeRole(member, userId, roleId) {
  return withRoleLock(userId, roleId, async () => {
    const result = supersedeNonBoosterGrants(db, userId, roleId);
    if (result.hasActive) {
      if (result.changed) save();
      return;
    }

    if (member.roles.cache.has(roleId)) await member.roles.remove(roleId);
    const deleted = deleteRoleGrants(db, userId, roleId);
    if (result.changed || deleted) save();
  });
}

async function reconcileExpiredRoles(client) {
  const guild = await client.guilds.fetch(process.env.GUILD_ID);

  for (const [userId, userRoles] of Object.entries(db.roleEntitlements || {})) {
    for (const [roleId] of Object.entries(userRoles)) {
      await withRoleLock(userId, roleId, async () => {
        const grants = getGrants(db, userId, roleId);
        const hasExpired = Object.values(grants)
          .some((grant) => grant.expiresAt !== null && grant.expiresAt <= Date.now());
        if (!hasExpired) return;

        if (hasActiveGrant(db, userId, roleId)) {
          pruneExpiredGrants(db, userId, roleId);
          save();
          return;
        }

        let member;
        try {
          member = await guild.members.fetch(userId);
        } catch (error) {
          if (error.code === 10007 || error.code === 10013) {
            deleteRoleGrants(db, userId, roleId);
            save();
            return;
          }
          console.error(`[Expiración] No se pudo consultar el miembro ${userId}; se reintentará:`, error.message);
          return;
        }

        if (hasActiveGrant(db, userId, roleId)) {
          pruneExpiredGrants(db, userId, roleId);
          save();
          return;
        }

        try {
          if (member.roles.cache.has(roleId)) await member.roles.remove(roleId);
        } catch (error) {
          console.error(`[Expiración] No se pudo quitar el rol ${roleId}; se reintentará:`, error.message);
          return;
        }
        deleteRoleGrants(db, userId, roleId);
        save();
      });
    }
  }
}

function getGrantExpiration(userId, roleId, grantId) {
  return getGrant(db, userId, roleId, grantId)?.expiresAt ?? null;
}

function getLatestExpiration(userId, roleId, source) {
  return latestExpiry(db, userId, roleId, source);
}

module.exports = {
  db,
  getGrantExpiration,
  getLatestExpiration,
  grantRole,
  reconcileExpiredRoles,
  save,
  supersedeRole,
};
