const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEFAULT_FILE = path.join(__dirname, '../../data/account-links.json');
const CODE_TTL_MS = 5 * 60 * 1000;

class AccountLinkError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AccountLinkError';
    this.code = code;
  }
}

class AccountLinkStore {
  constructor(file = DEFAULT_FILE) {
    this.file = file;
    this.data = { pendingCodes: {}, linksByUuid: {} };

    try {
      this.data = { ...this.data, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  createCode(discordUserId, now = Date.now()) {
    this.cleanupExpiredCodes(now);

    for (const [hash, pending] of Object.entries(this.data.pendingCodes)) {
      if (pending.discordUserId === discordUserId) delete this.data.pendingCodes[hash];
    }

    const code = crypto.randomBytes(24).toString('hex');
    const codeHash = hashCode(code);
    this.data.pendingCodes[codeHash] = {
      discordUserId,
      expiresAt: now + CODE_TTL_MS,
    };
    this.save();
    return { code, expiresAt: now + CODE_TTL_MS };
  }

  linkPlayer({ code, uuid, playerName, groups }, now = Date.now()) {
    this.cleanupExpiredCodes(now);
    const codeHash = hashCode(code);
    const existing = this.data.linksByUuid[uuid];
    let discordUserId;

    if (existing?.lastCodeHash === codeHash) {
      discordUserId = existing.discordUserId;
    } else {
      const pending = this.data.pendingCodes[codeHash];
      if (!pending || pending.expiresAt <= now) {
        throw new AccountLinkError('INVALID_CODE', 'El código no existe o venció.');
      }

      discordUserId = pending.discordUserId;
      const discordLink = Object.entries(this.data.linksByUuid)
        .find(([linkedUuid, link]) => link.discordUserId === discordUserId && linkedUuid !== uuid);
      if (discordLink) {
        throw new AccountLinkError('CONFLICT', 'La cuenta de Discord ya está vinculada a otro jugador.');
      }
      if (existing && existing.discordUserId !== discordUserId) {
        throw new AccountLinkError('CONFLICT', 'Este jugador ya está vinculado a otra cuenta de Discord.');
      }
      delete this.data.pendingCodes[codeHash];
    }

    const link = {
      discordUserId,
      playerName,
      groups,
      managedRoleIds: existing?.managedRoleIds || [],
      lastCodeHash: codeHash,
      linkedAt: existing?.linkedAt || now,
      updatedAt: now,
    };
    this.data.linksByUuid[uuid] = link;
    this.save();
    return { uuid, ...link };
  }

  updateManagedRoles(uuid, roleIds) {
    const link = this.data.linksByUuid[uuid];
    if (!link) throw new AccountLinkError('NOT_LINKED', 'El jugador no está vinculado.');
    link.managedRoleIds = [...new Set(roleIds)];
    link.updatedAt = Date.now();
    this.save();
  }

  cleanupExpiredCodes(now = Date.now()) {
    let changed = false;
    for (const [hash, pending] of Object.entries(this.data.pendingCodes)) {
      if (pending.expiresAt <= now) {
        delete this.data.pendingCodes[hash];
        changed = true;
      }
    }
    if (changed) this.save();
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temporaryFile = `${this.file}.tmp`;
    fs.writeFileSync(temporaryFile, JSON.stringify(this.data, null, 2));
    fs.renameSync(temporaryFile, this.file);
  }
}

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

module.exports = { AccountLinkError, AccountLinkStore, CODE_TTL_MS };
