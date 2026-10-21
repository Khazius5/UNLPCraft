const fs = require('fs');
const path = require('path');

module.exports = (client) => {
  const dir = path.join(__dirname, '../events');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const event = require(path.join(dir, file));
    const run = (...args) => event.execute(...args, client);
    event.once ? client.once(event.name, run) : client.on(event.name, run);
  }
};