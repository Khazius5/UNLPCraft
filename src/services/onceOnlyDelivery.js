async function deliverOnce(record, statusKey, command, send, save) {
  const status = record[statusKey];
  if (status === 'done') return;
  if (status) {
    const error = new Error('Esta entrega requiere revisión manual para evitar duplicarla.');
    error.manualReview = true;
    throw error;
  }

  record[statusKey] = 'processing';
  save();

  try {
    await send(command);
  } catch (cause) {
    record[statusKey] = 'manual_review';
    save();
    const error = new Error('RCON no confirmó la entrega. Revisá el estado en Minecraft antes de modificarla.');
    error.manualReview = true;
    error.cause = cause;
    throw error;
  }

  record[statusKey] = 'done';
  save();
}

module.exports = { deliverOnce };
