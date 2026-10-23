const RANKS = require('../config/ranks');
const { db, save } = require('./store');
const {
  getGrantExpiration,
  getLatestExpiration,
  grantRole,
  reconcileExpiredRoles,
  supersedeRole,
} = require('./roleEntitlements');

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
  const boughtNetheriteInSameCart = keys.includes('netherite');

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
    if (!hasNetheriteInDiscord && !boughtNetheriteInSameCart) {
      db.processed[p.orderId] = true;
      save();
      return 'rechazado: requiere tener rol Netherite previo en Discord';
    }
  }

  if (best === 'netheriteplus' && boughtNetheriteInSameCart) {
    await grantRole(member, {
      userId: member.id,
      roleId: RANKS.netherite.discordRoleId,
      grantId: `purchase:${p.orderId}`,
      source: 'purchase',
    });
  }

  const grantId = `purchase:${p.orderId}`;
  const existingExpiration = getGrantExpiration(member.id, rank.discordRoleId, grantId);
  const expiresAt = best === 'netheriteplus'
    ? existingExpiration ?? Math.max(Date.now(), getLatestExpiration(member.id, rank.discordRoleId, 'purchase')) + PLUS_DAYS * DAY
    : null;
  await grantRole(member, {
    userId: member.id,
    roleId: rank.discordRoleId,
    grantId,
    source: 'purchase',
    expiresAt,
  });

  for (const [key, oldRank] of Object.entries(RANKS)) {
    if (key === best || (best === 'netheriteplus' && key === 'netherite')) continue;
    await supersedeRole(member, member.id, oldRank.discordRoleId);
  }

  db.processed[p.orderId] = true;
  save();
  return `rol ${rank.title} asignado en Discord`;
}

// Revisa cada 1 minuto si algún rol de Netherite+ cumplió los 30 días y lo quita de Discord
async function checkExpiredRoles(client) {
  await reconcileExpiredRoles(client);
}

function startPurchaseConsumer(client) {
  const consumerId = process.env.CONSUMER_ID || 'unlp-craft-dsbot';
  let lastReconcile = 0;
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
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
    } finally {
      running = false;
    }
  };

  tick();
  setInterval(tick, 15 * 1000);
}

module.exports = { startPurchaseConsumer };