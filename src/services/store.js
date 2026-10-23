const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../../data/boosts.json');
let db = { pending: {}, roles: {}, processed: {}, roleEntitlements: {}, boostEvents: {} };

try {
  db = { ...db, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(db, null, 2));
  fs.renameSync(`${FILE}.tmp`, FILE);
}

module.exports = { db, save };