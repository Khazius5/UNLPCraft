const mc = require('./minecraft');
const RANKS = require('../config/ranks');
const REWARDS = require('../config/boosts');
const { db, save } = require('./store');

const DAY = 24 * 60 * 60 * 1000;
const NICK_RE = /^[A-Za-z0-9_]{3,16}$/;
const busy = new Set();

async function onBoostSettled(userId, count, channel) {
    const boosts = Math.min(count, 2); // más de 2 se trata como 2
    (db.pending[userId] ||= []).push({ boosts, createdAt: Date.now() });
    save();
    await channel
        ?.send(`¡Gracias por el boost, <@${userId}>! Usá \`/reclamar-boost\` con tu nick de Minecraft para recibir tu recompensa.`)
        .catch(() => { });
}

async function claimBoost(member, nick) {
    if (!NICK_RE.test(nick)) return { msg: 'Nickname inválido.' };
    const claim = (db.pending[member.id] || [])[0];
    if (!claim) return { msg: 'No tenés recompensas de boost pendientes.' };
    if (busy.has(member.id)) return { msg: 'Tu reclamo ya se está procesando.' };

    const reward = REWARDS[claim.boosts];
    const rank = RANKS[reward.rank];
    busy.add(member.id);
    try {
        if (!claim.moneyGiven) {
            const r = await mc.run(`eco give ${nick} ${reward.money}`);
            console.log('eco give →', JSON.stringify(r));
            claim.moneyGiven = true; save();
        }
        if (!claim.rankGiven) {
            const r = await mc.run(`lp user ${nick} parent addtemp ${reward.minecraftGroup} ${reward.days}d accumulate`);
            console.log('lp addtemp →', JSON.stringify(r));
            claim.rankGiven = true; save();
        }
        if (reward.tagPermission && !claim.tagGiven) {
            const r = await mc.run(
                `lp user ${nick} permission settemp ${reward.tagPermission} true ${reward.days}d accumulate`
            );
            console.log('tag permission →', JSON.stringify(r));
            claim.tagGiven = true; save();
        }

        if (!claim.roleGiven) {
            await member.roles.add(rank.discordRoleId);
            const cur = db.roles[member.id];
            const base = cur && cur.expiresAt > Date.now() ? cur.expiresAt : Date.now();
            db.roles[member.id] = { roleId: rank.discordRoleId, expiresAt: base + reward.days * DAY };
            claim.roleGiven = true; save();
        }
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
    const tick = async () => {
        const now = Date.now();
        for (const [key, r] of Object.entries(db.roles)) {
            const userId = r.userId || key;
            if (r.expiresAt > now) continue;
            try {
                const guild = await client.guilds.fetch(process.env.GUILD_ID);
                const member = await guild.members.fetch(userId);
                await member.roles.remove(r.roleId);
            } catch (e) {
                if (e.code !== 10007 && e.code !== 10013) { console.error(e); continue; }
            }
            delete db.roles[key];
            save();
        }
    };
    tick();
    setInterval(tick, 10 * 60 * 1000);
}

module.exports = { onBoostSettled, claimBoost, startExpiryJob };