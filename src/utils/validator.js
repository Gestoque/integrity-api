const VALID_ACTIONS = ['app_startup', 'device_activation', 'data_sync'];
const VALID_ENFORCEMENTS = ['monitor', 'enforce'];
const EXPECTED_PACKAGE = 'br.com.gestoque.app.gcollector';
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Valida o schema do request de integridade.
 * @param {object} body
 * @returns {{ valid: boolean, reason?: string, httpStatus?: number }}
 */
function validateRequestSchema(body) {
  const {
    integrityToken,
    token, // suporte legado
    nonce,
    nonceIssuedAt,
    clientTimestamp,
    action,
    enforcement,
    platform,
    packageName,
  } = body || {};

  const resolvedToken = integrityToken || token;

  if (!resolvedToken || typeof resolvedToken !== 'string') {
    return { valid: false, reason: 'invalid_payload', detail: 'integrityToken é obrigatório', httpStatus: 400 };
  }

  if (!nonce || typeof nonce !== 'string' || nonce.length < 8) {
    return { valid: false, reason: 'invalid_payload', detail: 'nonce é obrigatório e deve ter ao menos 8 caracteres', httpStatus: 400 };
  }

  if (!action || !VALID_ACTIONS.includes(action)) {
    return { valid: false, reason: 'invalid_payload', detail: `action deve ser um de: ${VALID_ACTIONS.join(', ')}`, httpStatus: 400 };
  }

  if (!enforcement || !VALID_ENFORCEMENTS.includes(enforcement)) {
    return { valid: false, reason: 'invalid_payload', detail: `enforcement deve ser: monitor | enforce`, httpStatus: 400 };
  }

  // Campos opcionais com validação se presentes
  if (platform && platform !== 'android') {
    return { valid: false, reason: 'invalid_payload', detail: 'platform deve ser android', httpStatus: 400 };
  }

  if (packageName && packageName !== EXPECTED_PACKAGE) {
    return { valid: false, reason: 'invalid_payload', detail: `packageName inválido: ${packageName}`, httpStatus: 400 };
  }

  // Validação de janela de tempo
  if (nonceIssuedAt) {
    const issuedAt = new Date(nonceIssuedAt).getTime();
    if (isNaN(issuedAt)) {
      return { valid: false, reason: 'invalid_payload', detail: 'nonceIssuedAt inválido (ISO-8601 esperado)', httpStatus: 400 };
    }
    const now = Date.now();
    if (now - issuedAt > MAX_CLOCK_SKEW_MS) {
      return { valid: false, reason: 'nonce_expired', detail: 'nonceIssuedAt fora da janela de tempo permitida (máx 5 min)', httpStatus: 409 };
    }
    if (issuedAt - now > MAX_CLOCK_SKEW_MS) {
      return { valid: false, reason: 'invalid_payload', detail: 'nonceIssuedAt no futuro', httpStatus: 400 };
    }
  }

  if (clientTimestamp) {
    const clientTs = new Date(clientTimestamp).getTime();
    if (isNaN(clientTs)) {
      return { valid: false, reason: 'invalid_payload', detail: 'clientTimestamp inválido (ISO-8601 esperado)', httpStatus: 400 };
    }
  }

  return { valid: true };
}

module.exports = { validateRequestSchema };
