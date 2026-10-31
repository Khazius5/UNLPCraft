const DEFAULT_RECIPIENT_ID = '317050947622928384';
const MAX_ALERT_LENGTH = 1800;

async function sendAdminAlert(client, { title, playerName, uuid, discordUserId, details }) {
  const recipientId = process.env.ALERT_DISCORD_USER_ID || DEFAULT_RECIPIENT_ID;
  if (!/^\d{15,25}$/.test(recipientId)) {
    console.error('Admin alert was not sent: ALERT_DISCORD_USER_ID is invalid.');
    return false;
  }

  const content = [
    `UNLPCraft — ${title}`,
    `Hora: ${new Date().toISOString()}`,
    playerName && `Jugador: ${playerName}`,
    uuid && `UUID: ${uuid}`,
    discordUserId && `Discord ID: ${discordUserId}`,
    details && `Detalle: ${details}`,
  ].filter(Boolean).join('\n').slice(0, MAX_ALERT_LENGTH);

  try {
    const recipient = await client.users.fetch(recipientId);
    await recipient.send({ content, allowedMentions: { parse: [] } });
    return true;
  } catch (error) {
    console.error('Could not send admin alert by Discord DM:', error.message);
    return false;
  }
}

module.exports = { sendAdminAlert };
