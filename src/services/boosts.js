const crypto = require('crypto');
const mc = require('./minecraft');
const RANKS = require('../config/ranks');
const REWARDS = require('../config/boosts');
const { db, save } = require('./store');
const { settleBoost } = require('./boostQueue');
const { deliverOnce } = require('./onceOnlyDelivery');
const { getGrantExpiration, getLatestExpiration, grantRole, reconcileExpiredRoles } = require('./roleEntitlements');

const DAY = 24 * 60 * 60 * 1000;
const NICK_RE = /^[A-Za-z0-9_]{3,16}$/;
const busy = new Set();

db.pending ||= {};
db.boostEvents ||= {};

async function settlePendingBoost(userId, client) {
    const previousEvent = db.boostEvents[userId] && { ...db.boostEvents[userId] };
    const settled = settleBoost(db, userId, Date.now(), crypto.randomUUID());
    if (!settled) return false;
    try {
        save();
    } catch (error) {
        db.boostEvents[userId] = previousEvent;
        db.pending[userId] = db.pending[userId].filter((claim) => claim.id !== settled.claim.id);
        if (db.pending[userId].length === 0) delete db.pending[userId];
        throw error;
    }

    if (settled.channelId) {
        try {
            const channel = await client.channels.fetch(settled.channelId);
            await channel.send(`¡Gracias por el boost, <@${userId}>! Usá \`/reclamar-boost\` con tu nick de Minecraft para recibir tu recompensa.`);
        } catch (error) {
            console.error('No se pudo notificar el boost asentado:', error.message);
        }
    }
    return true;
}

async function claimBoost(member, nick) {
    if (!NICK_RE.test(nick)) return { msg: 'Nickname inválido.' };
    const claim = (db.pending[member.id] || [])[0];
    if (!claim) return { msg: 'No tenés recompensas de boost pendientes.' };
    if (busy.has(member.id)) return { msg: 'Tu reclamo ya se está procesando.' };

    const reward = REWARDS[claim.boosts];
    if (!reward) throw new Error(`No hay recompensa configurada para ${claim.boosts} boost(s).`);
    const rank = RANKS[reward.rank];
    if (!rank) throw new Error(`El rango de booster "${reward.rank}" no está configurado.`);
    busy.add(member.id);
    try {
        if (claim.minecraftNick && claim.minecraftNick !== nick) {
            return { msg: `Este reclamo ya está asociado al nick ${claim.minecraftNick}. Usá ese mismo nick para continuar.` };
        }
        claim.minecraftNick ||= nick;
        claim.id ||= crypto.randomUUID();
        if (claim.moneyGiven && !claim.moneyDelivery) claim.moneyDelivery = 'done';
        if (claim.rankGiven && !claim.rankDelivery) claim.rankDelivery = 'done';
        if (claim.tagGiven && !claim.tagDelivery) claim.tagDelivery = 'done';
        save();

        try {
            await deliverOnce(
                claim,
                'moneyDelivery',
                `eco give ${claim.minecraftNick} ${reward.money}`,
                (command) => mc.run(command, 0),
                save,
            );
            await deliverOnce(
                claim,
                'rankDelivery',
                `lp user ${claim.minecraftNick} parent addtemp ${reward.minecraftGroup} ${reward.days}d accumulate`,
                (command) => mc.run(command, 0),
                save,
            );
            if (reward.tagPermission) {
                await deliverOnce(
                    claim,
                    'tagDelivery',
                    `lp user ${claim.minecraftNick} permission settemp ${reward.tagPermission} true ${reward.days}d accumulate`,
                    (command) => mc.run(command, 0),
                    save,
                );
            }
        } catch (error) {
            if (error.manualReview) {
                console.error('Entrega de recompensa en revisión manual:', error.cause?.message || error.message);
                return {
                    msg: `La entrega de ${rank.title} requiere revisión manual. No vuelvas a reclamarla hasta verificar el estado en Minecraft.`,
                };
            }
            throw error;
        }

        const grantId = `booster:${claim.id}`;
        const existingExpiration = getGrantExpiration(member.id, rank.discordRoleId, grantId);
        const expiresAt = existingExpiration
            ?? Math.max(Date.now(), getLatestExpiration(member.id, rank.discordRoleId, 'booster')) + reward.days * DAY;
        await grantRole(member, {
            userId: member.id,
            roleId: rank.discordRoleId,
            grantId,
            source: 'booster',
            expiresAt,
        });

        db.pending[member.id].shift();
        save();
    } catch (e) {
        console.error(e);
        return { msg: 'No se pudo entregar ahora, probá de nuevo en un rato.' };
    } finally {
        busy.delete(member.id);
    }

    return {
        msg: `¡Listo! Recibiste $${reward.money.toLocaleString('es-AR')} y el rango ${rank.title} por ${reward.days} días en ${nick}.`,
    };
}

function startExpiryJob(client) {
    let running = false;
    const tick = async () => {
        if (running) return;
        running = true;
        try {
            await reconcileExpiredRoles(client);
        } catch (error) {
            console.error('[Expiración] No se pudieron revisar los roles:', error.message);
        } finally {
            running = false;
        }
    };
    void tick();
    setInterval(() => void tick(), 10 * 60 * 1000);
}

module.exports = { claimBoost, settlePendingBoost, startExpiryJob };