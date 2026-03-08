const VALID_ACTIONS = ['app_startup', 'device_activation', 'data_sync'];
const VALID_ENFORCEMENTS = ['monitor', 'enforce'];
const EXPECTED_PACKAGE = 'br.com.gestoque.app.gcollector';
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 minutos

function validateRequestSchema(body) {
  const {
    integrityToken,
    nonce,
    nonceIssuedAt,
    clientTimestamp,
    action,
    enforcement,
    platform,
    packageName,
  } = body || {};

  // integrityToken: required, minLength 20
  if (!integrityToken || typeof integrityToken !== 'string' || integrityToken.length < 20) {
    return { valid: false, reason: 'invalid_payload', detail: 'integrityToken é obrigatório e deve ter ao menos 20 caracteres', httpStatus: 400 };
  }

  // nonce: required, minLength 16
  if (!nonce || typeof nonce !== 'string' || nonce.length < 16) {
    return { valid: false, reason: 'invalid_payload', detail: 'nonce é obrigatório e deve ter ao menos 16 caracteres', httpStatus: 400 };
  }

  // action: required
  if (!action || !VALID_ACTIONS.includes(action)) {
    return { valid: false, reason: 'invalid_payload', detail: `action deve ser um de: ${VALID_ACTIONS.join(', ')}`, httpStatus: 400 };
  }

  // enforcement: required
  if (!enforcement || !VALID_ENFORCEMENTS.includes(enforcement)) {
    return { valid: false, reason: 'invalid_payload', detail: 'enforcement deve ser: monitor | enforce', httpStatus: 400 };
  }

  // platform: required, must be android
  if (!platform) {
    return { valid: false, reason: 'invalid_payload', detail: 'platform é obrigatório', httpStatus: 400 };
  }
  if (platform !== 'android') {
    return { valid: false, reason: 'invalid_payload', detail: 'platform deve ser android', httpStatus: 400 };
  }

  // packageName: required, must match
  if (!packageName) {
    return { valid: false, reason: 'invalid_payload', detail: 'packageName é obrigatório', httpStatus: 400 };
  }
  if (packageName !== EXPECTED_PACKAGE) {
    return { valid: false, reason: 'invalid_payload', detail: `packageName inválido: ${packageName}`, httpStatus: 400 };
  }

  // nonceIssuedAt: required, ISO-8601, within 5 min window
  if (!nonceIssuedAt) {
    return { valid: false, reason: 'invalid_payload', detail: 'nonceIssuedAt é obrigatório (ISO-8601)', httpStatus: 400 };
  }
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

  // clientTimestamp: required, ISO-8601
  if (!clientTimestamp) {
    return { valid: false, reason: 'invalid_payload', detail: 'clientTimestamp é obrigatório (ISO-8601)', httpStatus: 400 };
  }
  const clientTs = new Date(clientTimestamp).getTime();
  if (isNaN(clientTs)) {
    return { valid: false, reason: 'invalid_payload', detail: 'clientTimestamp inválido (ISO-8601 esperado)', httpStatus: 400 };
  }

  return { valid: true };
}

module.exports = { validateRequestSchema };
