const fs = require('fs');
const path = require('path');

const DEFAULT_FILE = path.join(__dirname, '../config/luckperms-role-map.json');
const GROUP_PATTERN = /^[A-Za-z0-9_.+-]{1,64}$/;
const RANK_GROUPS_BY_PRIORITY = ['netherite+', 'netherite', 'diamante', 'oro'];

function loadRoleMap(file = DEFAULT_FILE) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Expected a JSON object mapping LuckPerms groups to Discord role IDs.');
  }
  for (const [group, roleId] of Object.entries(parsed)) {
    if (
      !GROUP_PATTERN.test(group)
      || typeof roleId !== 'string'
      || !/^\d{15,25}$/.test(roleId)
    ) {
      throw new Error(`Invalid Discord role mapping for LuckPerms group "${group}".`);
    }
  }
  return parsed;
}

function getHighestRankGroup(groups) {
  return RANK_GROUPS_BY_PRIORITY.find((group) => groups.includes(group)) || null;
}

module.exports = { getHighestRankGroup, loadRoleMap, RANK_GROUPS_BY_PRIORITY };
