const crypto = require('crypto');

const states = new Map(); // state -> { returnTo, exp }
const TTL = 10 * 60 * 1000;
const TOKEN_TTL = 30 * 60 * 1000;
const ALLOWED = (process.env.FRONT_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);

function cleanup() {
  const now = Date.now();
  for (const [k, v] of states) if (v.exp < now) states.delete(k);
}

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.DISCORD_LINK_SECRET)
    .update(body).digest('base64url');
  return `${body}.${sig}`;
}

module.exports = (app) => {
  app.get('/auth/discord', (req, res) => {
    let returnTo;
    try {
      const url = new URL(req.query.returnTo);
      if (!ALLOWED.includes(url.origin)) return res.status(400).send('returnTo no permitido');
      returnTo = url.toString();
    } catch {
      return res.status(400).send('returnTo inválido');
    }

    cleanup();
    const state = crypto.randomBytes(16).toString('hex');
    states.set(state, { returnTo, exp: Date.now() + TTL });

    const params = new URLSearchParams({
      client_id: process.env.CLIENT_ID,
      redirect_uri: `${process.env.PUBLIC_URL}/auth/discord/callback`,
      response_type: 'code',
      scope: 'identify',
      state,
    });
    res.redirect(`https://discord.com/oauth2/authorize?${params}`);
  });

  app.get('/auth/discord/callback', async (req, res) => {
    const { code, state } = req.query;
    const saved = states.get(state);
    states.delete(state);
    if (!code || !saved || saved.exp < Date.now()) {
      return res.status(400).send('Sesión vencida, volvé a intentar');
    }

    try {
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: `${process.env.PUBLIC_URL}/auth/discord/callback`,
        }),
      });
      if (!tokenRes.ok) throw new Error(`token ${tokenRes.status} ${await tokenRes.text()}`);
      const { access_token } = await tokenRes.json();

      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (!userRes.ok) throw new Error(`user ${userRes.status} ${await userRes.text()}`);
      const user = await userRes.json();

      const token = signToken({
        did: user.id,
        name: user.global_name || user.username,
        exp: Date.now() + TOKEN_TTL,
      });

      const back = new URL(saved.returnTo);
      back.hash = `discord_token=${token}`;
      res.redirect(back.toString());
    } catch (e) {
      console.error(e);
      res.status(500).send('Error al conectar con Discord');
    }
  });
};