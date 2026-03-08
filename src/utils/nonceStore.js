/**
 * Store in-memory de nonces com TTL para anti-replay.
 * Em produção, substitua por Redis ou banco com expiração.
 * TTL: 5 minutos (300.000ms)
 */
const NONCE_TTL_MS = 5 * 60 * 1000;
const store = new Map(); // nonce -> { registeredAt, expiresAt }

// Limpeza periódica de nonces expirados
setInterval(() => {
  const now = Date.now();
  for (const [nonce, entry] of store.entries()) {
    if (now > entry.expiresAt) store.delete(nonce);
  }
}, 60 * 1000);

/**
 * Verifica se o nonce é válido (não reutilizado e não expirado).
 * Registra o nonce ao validar.
 * @param {string} nonce
 * @returns {{ valid: boolean, replayDetected: boolean, reason?: string, expiresAt?: string }}
 */
function checkAndRegister(nonce) {
  if (!nonce || typeof nonce !== 'string' || nonce.length < 8) {
    return { valid: false, replayDetected: false, reason: 'nonce_expired' };
  }
  const now = Date.now();
  if (store.has(nonce)) {
    const entry = store.get(nonce);
    return {
      valid: false,
      replayDetected: true,
      reason: 'nonce_replay',
      expiresAt: new Date(entry.expiresAt).toISOString()
    };
  }
  const expiresAt = now + NONCE_TTL_MS;
  store.set(nonce, { registeredAt: now, expiresAt });
  return {
    valid: true,
    replayDetected: false,
    expiresAt: new Date(expiresAt).toISOString()
  };
}

module.exports = { checkAndRegister, NONCE_TTL_MS };
