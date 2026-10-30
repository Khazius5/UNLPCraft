const { loadRoleMap } = require('../services/luckpermsRoleMap');
const roleMap = loadRoleMap();

function requiredRole(group) {
  const roleId = roleMap[group];
  if (!roleId) {
    throw new Error(`Falta configurar un ID de rol válido para "${group}" en src/config/luckperms-role-map.json.`);
  }
  return roleId;
}

module.exports = {
  oro: {
    title: 'Rango Oro',
    price: 5000,
    discordRoleId: requiredRole('oro'),
  },
  diamante: {
    title: 'Rango Diamante',
    price: 10000,
    discordRoleId: requiredRole('diamante'),
  },
  netherite: {
    title: 'Rango Netherite',
    price: 20000,
    discordRoleId: requiredRole('netherite'),
  },
  netheriteplus: {
    title: 'Rango Netherite+',
    price: 125000,
    discordRoleId: requiredRole('netherite+'),
    requiresRank: 'netherite', // Requisito previo
    durationDays: 30,          // Duración temporal
  },
};