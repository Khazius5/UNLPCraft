function recordBoost(db, userId, count, channelId, settleAt) {
  db.boostEvents ||= {};
  const current = db.boostEvents[userId] || { count: 0 };
  const event = {
    count: current.count + count,
    channelId,
    settleAt,
  };
  db.boostEvents[userId] = event;
  return event;
}

function settleBoost(db, userId, now, claimId) {
  const event = db.boostEvents?.[userId];
  if (!event || event.settleAt > now) return null;

  delete db.boostEvents[userId];
  db.pending[userId] ||= [];
  const claim = {
    id: claimId,
    boosts: Math.min(event.count, 2),
    createdAt: now,
  };
  db.pending[userId].push(claim);
  return { claim, channelId: event.channelId };
}

module.exports = { recordBoost, settleBoost };
