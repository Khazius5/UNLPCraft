const { Rcon } = require('rcon-client');

let chain = Promise.resolve();

async function send(cmd) {
  const rcon = await Rcon.connect({
    host: process.env.RCON_HOST,
    port: Number(process.env.RCON_PORT),
    password: process.env.RCON_PASSWORD,
    timeout: 10000,
  });
  try {
    return await rcon.send(cmd);
  } finally {
    rcon.end();
  }
}

// Los comandos salen de a uno, con hasta 2 reintentos
function run(cmd, retries = 2) {
  const task = chain.then(async () => {
    for (let i = 0; ; i++) {
      try {
        return await send(cmd);
      } catch (e) {
        if (i >= retries) throw e;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  });
  chain = task.catch(() => {});
  return task;
}

module.exports = { run };