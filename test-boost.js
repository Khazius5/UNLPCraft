require('dotenv').config();

// Uso: node test-boost.js [userId] [cantidad 1|2] [modo multi|single]
//   node test-boost.js                              -> 1 boost para tu usuario
//   node test-boost.js 317050947622928384 2         -> 2 boosts (2 mensajes)
//   node test-boost.js 317050947622928384 2 single  -> 2 boosts (1 mensaje con "2")
const [userId = '317050947622928384', count = '1', mode = 'multi'] = process.argv.slice(2);

(async () => {
  if (!process.env.DEV_TOOLS_KEY) {
    throw new Error('Falta DEV_TOOLS_KEY en el .env del bot.');
  }
  if (!/^\d{15,25}$/.test(userId)) throw new Error('El userId debe ser el ID numérico de Discord.');
  if (!['1', '2'].includes(count)) throw new Error('La cantidad debe ser 1 o 2.');
  if (!['multi', 'single'].includes(mode)) throw new Error('El modo debe ser multi o single.');

  const url = `http://127.0.0.1:${process.env.PORT || 3000}/dev/fake-boost?`
    + new URLSearchParams({ userId, count, mode });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'x-dev-key': process.env.DEV_TOOLS_KEY },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body}`);

  console.log(body);
  console.log(`Ejecutá /reclamar-boost desde la cuenta de Discord ${userId}.`);
})().catch((error) => {
  console.error('No se pudo completar la prueba:', error.cause?.code || error.message);
  process.exitCode = 1;
});