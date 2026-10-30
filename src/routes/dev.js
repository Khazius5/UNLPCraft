const { MessageType } = require('discord.js');
const { db } = require('../services/store');

const SETTLEMENT_TIMEOUT_MS = 30 * 1000;

// Herramienta SOLO para pruebas locales: simula el mensaje de sistema que Discord
// publica cuando alguien boostea el server. Queda desactivada salvo que exista
// DEV_TOOLS_KEY y nunca se registra con NODE_ENV=production.
module.exports = (app, client) => {
  const key = process.env.DEV_TOOLS_KEY;
  if (!key || process.env.NODE_ENV === 'production') return;

  app.post('/dev/fake-boost', async (req, res) => {
    if (req.get('x-dev-key') !== key) return res.sendStatus(403);

    const userId = String(req.query.userId || '');
    if (!/^\d{15,25}$/.test(userId)) return res.status(400).send('userId inválido');
    const count = Number(req.query.count || 1);
    if (!Number.isInteger(count) || count < 1 || count > 2) {
      return res.status(400).send('count debe ser 1 o 2');
    }
    const mode = req.query.mode === 'single' ? 'single' : 'multi';
    const existingClaims = db.pending?.[userId] || [];
    if (existingClaims.length > 0) {
      const existingBoosts = existingClaims.reduce((total, claim) => total + claim.boosts, 0);
      return res.status(409).send(
        `Ya hay ${existingClaims.length} recompensa(s) pendiente(s), por ${existingBoosts} boost(s), para Discord ${userId}. No se creó otra para evitar duplicarla.`,
      );
    }
    if (db.boostEvents?.[userId]) {
      return res.status(409).send('Ya hay boosts agrupándose para ese usuario; esperá a que se asienten y volvé a probar.');
    }

    // El agradecimiento que el bot publicaría en el canal se muestra en consola
    const channel = {
      send: async (text) => console.log('[fake-boost] mensaje al canal:', text),
    };

    // Cada mensaje simulado tiene su propio id y fecha, como los reales de Discord.
    // Sin esto, el segundo boost parece un duplicado del primero y se descarta.
    let sequence = 0;
    const fake = (content) => {
      const now = Date.now();
      return {
        id: `${now}${String(++sequence).padStart(3, '0')}${Math.floor(Math.random() * 1000)}`,
        createdTimestamp: now,
        createdAt: new Date(now),
        type: MessageType.GuildBoost,
        system: true,
        author: { id: userId, bot: false },
        content,
        channel,
        guild: { id: process.env.GUILD_ID },
      };
    };

    if (mode === 'single') {
      // Un solo mensaje con el número de boosts en el contenido
      client.emit('messageCreate', fake(count > 1 ? String(count) : ''));
    } else {
      // Un mensaje por cada boost
      for (let i = 0; i < count; i++) client.emit('messageCreate', fake(''));
    }

    const deadline = Date.now() + SETTLEMENT_TIMEOUT_MS;
    let claim;
    while (Date.now() < deadline) {
      claim = (db.pending?.[userId] || [])[0];
      if (claim) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!claim) {
      return res.status(504).send(
        `Se simularon ${count} boost(s), pero el bot no creó una recompensa pendiente en ${SETTLEMENT_TIMEOUT_MS / 1000} segundos. Revisá los logs de Boost detectado y el asentamiento.`,
      );
    }
    if (claim.boosts !== count) {
      return res.status(500).send(
        `La recompensa quedó pendiente con ${claim.boosts} boost(s), pero se habían simulado ${count}. Revisá el estado antes de reclamar.`,
      );
    }

    console.log(`[fake-boost] ${count} boost(s) simulados para ${userId} (modo ${mode})`);
    res.send(`OK: recompensa de ${count} boost(s) asentada para Discord ${userId}; ya podés reclamarla.`);
  });
};