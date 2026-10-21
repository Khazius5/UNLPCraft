const { Rcon } = require('rcon-client');

async function run(cmd) {
  const rcon = await Rcon.connect({
    host: process.env.RCON_HOST,
    port: Number(process.env.RCON_PORT),
    password: process.env.RCON_PASSWORD,
  });
  try { return await rcon.send(cmd); } finally { rcon.end(); }
}

module.exports = { run };