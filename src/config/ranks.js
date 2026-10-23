function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta configurar ${name} en el archivo .env`);
  return value;
}

module.exports = {
  oro: {
    title: 'Rango Oro',
    price: 5000,
    discordRoleId: requiredEnv('ROLE_ID_ORO'),
  },
  diamante: {
    title: 'Rango Diamante',
    price: 10000,
    discordRoleId: requiredEnv('ROLE_ID_DIAMANTE'),
  },
  netherite: {
    title: 'Rango Netherite',
    price: 20000,
    discordRoleId: requiredEnv('ROLE_ID_NETHERITE'),
  },
  netheriteplus: {
    title: 'Rango Netherite+',
    price: 125000,
    discordRoleId: requiredEnv('ROLE_ID_NETHERITE_PLUS'),
    requiresRank: 'netherite', // Requisito previo
    durationDays: 30,          // Duración temporal
  },
};