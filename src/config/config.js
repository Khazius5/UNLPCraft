require('dotenv').config();

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.warn(`⚠️  Falta la variable de entorno ${name} en tu .env`);
  }
  return value;
}

module.exports = {
  token: requireEnv('DISCORD_TOKEN'),
  clientId: requireEnv('CLIENT_ID'),
};

