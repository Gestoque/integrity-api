/**
 * Store in-memory de nonces com TTL para anti-replay.
 * Em produção, substitua por Redis ou banco com expiração.
 * TTL: 3 minutos (180.000ms)
 */
const NONCE_TTL_MS = 3 * 60 * 1000;
const store = new Map();

// Limpeza periódica de nonces expirados
setInterval(() => {
  const now = Date.now();
  for (const [nonce, ts] of store.entries()) {
    if (now - ts > NONCE_TTL_MS) store.delete(nonce);
  }
}, 60 * 1000);

/**
 * Verifica se o nonce é válido (não reutilizado e não expirado).
 * Registra o nonce ao validar.
 * @param {string} nonce
 * @returns {{ valid: boolean, reason?: string }}
 */
function checkAndRegister(nonce) {
  if (!nonce || typeof nonce !== 'string' || nonce.length < 8) {
    return { valid: false, reason: 'Nonce ausente ou muito curto' };
  }
  const now = Date.now();
  if (store.has(nonce)) {
    const ts = store.get(nonce);
    if (now - ts <= NONCE_TTL_MS) {
      return { valid: false, reason: 'Nonce reutilizado (replay detectado)' };
    }
    // Expirou e está sendo reutilizado após janela — rejeita por segurança
    return { valid: false, reason: 'Nonce reutilizado' };
  }
  store.set(nonce, now);
  return { valid: true };
}

module.exports = { checkAndRegister };
