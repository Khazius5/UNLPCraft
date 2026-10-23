const RANKS = require('../config/ranks');
const { db, save } = require('./store');

const DAY = 24 * 60 * 60 * 1000;
const PLUS_DAYS = 30;
const ORDER = ['oro', 'diamante', 'netherite', 'netheriteplus'];
const BY_PRODUCT = {
  rango_oro: 'oro',
  rango_diamante: 'diamante',
  rango_netherita: 'netherite',
  rango_netherite_plus: 'netheriteplus',
};

// Asegurarnos de que las estructuras existan en el store
db.processed = db.processed || {};
db.roles = db.roles || {};

async function api(path, body) {
  const res = await fetch(`${process.env.BACKEND_URL}/api/${path}`, {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.BACKEND_INTERNAL_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

async function handlePurchase(client, p) {
  if (db.processed[p.orderId]) return 'ya procesada';

  const keys = (p.lines || [])
    .filter((l) => l.type === 'rank' && BY_PRODUCT[l.productId])
    .map((l) => BY_PRODUCT[l.productId]);
  if (!keys.length) return 'sin rangos';
  if (!p.discordUserId) return 'sin Discord conectado';

  const best = keys.sort((a, b) => ORDER.indexOf(b) - ORDER.indexOf(a))[0];
  const rank = RANKS[best];

  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  let member;
  try {
    member = await guild.members.fetch(p.discordUserId);
  } catch (e) {
    if (e.code === 10007) { // El comprador no está en el server de Discord
      db.processed[p.orderId] = true;
      save();
      return 'el comprador no está en el servidor de Discord';
    }
    throw e;
  }

  // --- VALIDACIÓN REQUISITO NETHERITE+ ---
  // Si compra Netherite+, verificamos que ya tenga el rol Netherite en Discord o que lo haya comprado en el mismo carrito
  if (best === 'netheriteplus') {
    const netheriteRoleId = RANKS.netherite?.discordRoleId;
    const hasNetheriteInDiscord = netheriteRoleId && member.roles.cache.has(netheriteRoleId);
    const boughtNetheriteInSameCart = keys.includes('netherite');

    if (!hasNetheriteInDiscord && !boughtNetheriteInSameCart) {
      db.processed[p.orderId] = true;
      save();
      return 'rechazado: requiere tener rol Netherite previo en Discord';
    }

    // Si compró Netherite y Netherite+ juntos en el mismo carrito, nos aseguramos de darle también el rol base Netherite
    if (boughtNetheriteInSameCart && netheriteRoleId && !hasNetheriteInDiscord) {
      await member.roles.add(netheriteRoleId);
    }
  }

  // --- QUITAR RANGOS INFERIORES DE DISCORD ---
  // Si sube de rango (ej: de Oro a Diamante), le sacamos el rol anterior.
  // Excepción: si compra Netherite+, NO le sacamos el rol de Netherite base (así cuando vencen los 30 días sigue teniendo su rol Netherite).
  const rolesToRemove = Object.entries(RANKS)
    .filter(([key]) => {
      if (key === best) return false;
      if (best === 'netheriteplus' && key === 'netherite') return false;
      return true;
    })
    .map(([, val]) => val.discordRoleId)
    .filter((roleId) => roleId && member.roles.cache.has(roleId));

  if (rolesToRemove.length > 0) {
    await member.roles.remove(rolesToRemove);
  }

  // --- DAR EL NUEVO ROL EN DISCORD ---
  await member.roles.add(rank.discordRoleId);

  // --- VENCIMIENTO DE 30 DÍAS PARA NETHERITE+ ---
  if (best === 'netheriteplus') {
    const key = `${member.id}:${rank.discordRoleId}`;
    const cur = db.roles[key];
    const base = cur && cur.expiresAt > Date.now() ? cur.expiresAt : Date.now();
    db.roles[key] = {
      userId: member.id,
      roleId: rank.discordRoleId,
      expiresAt: base + PLUS_DAYS * DAY,
    };
  }

  db.processed[p.orderId] = true;
  save();
  return `rol ${rank.title} asignado en Discord`;
}

// Revisa cada 1 minuto si algún rol de Netherite+ cumplió los 30 días y lo quita de Discord
async function checkExpiredRoles(client) {
  const now = Date.now();
  let changed = false;

  for (const [key, data] of Object.entries(db.roles || {})) {
    if (data.expiresAt <= now) {
      try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        const member = await guild.members.fetch(data.userId).catch(() => null);
        if (member && member.roles.cache.has(data.roleId)) {
          await member.roles.remove(data.roleId);
          console.log(`[Expiración] Rol Netherite+ removido a ${member.user.tag}`);
        }
      } catch (e) {
        console.error(`[Expiración] Error al remover rol (${key}):`, e.message);
      }
      delete db.roles[key];
      changed = true;
    }
  }

  if (changed) save();
}

function startPurchaseConsumer(client) {
  const consumerId = process.env.CONSUMER_ID || 'unlp-craft-dsbot';
  let lastReconcile = 0;

  const tick = async () => {
    try {
      if (Date.now() - lastReconcile > 60 * 1000) {
        lastReconcile = Date.now();
        await api('payments/reconcile-pending').catch((e) => console.warn('reconcile:', e.message));
        await checkExpiredRoles(client);
      }
      const { purchases } = await api('purchase-notifications/claim', { consumerId, limit: 5 });
      for (const p of purchases) {
        let success = true;
        let message = '';
        try {
          message = await handlePurchase(client, p);
          console.log(`Compra ${p.orderId}: ${message}`);
        } catch (e) {
          success = false;
          message = e.message;
          console.error(e);
        }
        await api(`purchase-notifications/${encodeURIComponent(p.orderId)}/complete`, {
          consumerId, success, message: String(message).slice(0, 500),
        }).catch((e) => console.error('complete:', e.message));
      }
    } catch (e) {
      console.error('consumidor de compras:', e.message);
    }
  };

  tick();
  setInterval(tick, 15 * 1000);
}

module.exports = { startPurchaseConsumer };