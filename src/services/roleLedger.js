function ensureLedger(db) {
  db.roleEntitlements ||= {};
  db.roles ||= {};
  let changed = false;

  for (const [legacyKey, role] of Object.entries(db.roles)) {
    if (!role || typeof role !== 'object' || !Number.isFinite(Number(role.expiresAt))) continue;

    const separator = legacyKey.indexOf(':');
    const userId = role.userId || (separator === -1 ? legacyKey : legacyKey.slice(0, separator));
    const roleId = role.roleId || (separator === -1 ? null : legacyKey.slice(separator + 1));
    if (!userId || !roleId) continue;

    const source = role.userId ? 'purchase' : 'booster';
    addGrant(db, userId, roleId, `legacy:${legacyKey}`, source, Number(role.expiresAt));
    delete db.roles[legacyKey];
    changed = true;
  }

  return changed;
}

function getGrants(db, userId, roleId) {
  return db.roleEntitlements?.[userId]?.[roleId]?.grants || {};
}

function getGrant(db, userId, roleId, grantId) {
  return getGrants(db, userId, roleId)[grantId];
}

function addGrant(db, userId, roleId, grantId, source, expiresAt = null) {
  db.roleEntitlements ||= {};
  const userGrants = db.roleEntitlements[userId] ||= {};
  const roleEntry = userGrants[roleId] ||= { grants: {} };
  if (roleEntry.grants[grantId]) return false;
  roleEntry.grants[grantId] = { source, expiresAt };
  return true;
}

function latestExpiry(db, userId, roleId, source, now = Date.now()) {
  return Object.values(getGrants(db, userId, roleId))
    .filter((grant) => grant.source === source && grant.expiresAt > now)
    .reduce((latest, grant) => Math.max(latest, grant.expiresAt), now);
}

function hasActiveGrant(db, userId, roleId, now = Date.now()) {
  return Object.values(getGrants(db, userId, roleId))
    .some((grant) => grant.expiresAt === null || grant.expiresAt > now);
}

function removeExpiredGrants(db, userId, roleId, now = Date.now()) {
  const grants = getGrants(db, userId, roleId);
  let changed = false;
  for (const [grantId, grant] of Object.entries(grants)) {
    if (grant.expiresAt !== null && grant.expiresAt <= now) {
      delete grants[grantId];
      changed = true;
    }
  }
  return { changed, hasActive: hasActiveGrant(db, userId, roleId, now) };
}

function pruneExpiredGrants(db, userId, roleId, now = Date.now()) {
  const grants = getGrants(db, userId, roleId);
  let changed = false;
  for (const [grantId, grant] of Object.entries(grants)) {
    if (grant.expiresAt !== null && grant.expiresAt <= now) {
      delete grants[grantId];
      changed = true;
    }
  }
  return changed;
}

function supersedeNonBoosterGrants(db, userId, roleId, now = Date.now()) {
  const grants = getGrants(db, userId, roleId);
  let changed = false;
  for (const [grantId, grant] of Object.entries(grants)) {
    if (grant.source !== 'booster') {
      delete grants[grantId];
      changed = true;
    } else if (grant.expiresAt !== null && grant.expiresAt <= now) {
      delete grants[grantId];
      changed = true;
    }
  }
  return { changed, hasActive: hasActiveGrant(db, userId, roleId, now) };
}

function deleteRoleGrants(db, userId, roleId) {
  const userGrants = db.roleEntitlements?.[userId];
  if (!userGrants || !userGrants[roleId]) return false;
  delete userGrants[roleId];
  if (Object.keys(userGrants).length === 0) delete db.roleEntitlements[userId];
  return true;
}

module.exports = {
  addGrant,
  deleteRoleGrants,
  ensureLedger,
  getGrant,
  getGrants,
  hasActiveGrant,
  latestExpiry,
  pruneExpiredGrants,
  removeExpiredGrants,
  supersedeNonBoosterGrants,
};
