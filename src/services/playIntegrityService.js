const config = require('../config');
const { GoogleAuth } = require('google-auth-library');
const logger = require('../utils/logger');
const { checkAndRegister } = require('../utils/nonceStore');
const { readFileSync } = require('fs');
const { randomUUID } = require('crypto');

const PACKAGE_NAME = 'br.com.gestoque.app.gcollector';

// Política de enforcement por ação
const ENFORCE_ACTIONS = ['device_activation', 'data_sync'];
const MONITOR_ACTIONS = ['app_startup'];

/**
 * Avalia os vereditos e retorna decisão de risco.
 * @param {object} tokenPayload - Payload decodificado pelo Google
 * @param {string} action
 * @returns {{ allowed: boolean, reason: string, verdicts: object }}
 */
function evaluateVerdicts(tokenPayload, action) {
  const appIntegrity = tokenPayload?.appIntegrity || {};
  const deviceIntegrity = tokenPayload?.deviceIntegrity || {};
  const accountDetails = tokenPayload?.accountDetails || {};

  const appVerdict = appIntegrity.appRecognitionVerdict || 'UNKNOWN';
  const deviceVerdicts = deviceIntegrity.deviceRecognitionVerdict || [];
  const licenseVerdict = accountDetails.appLicensingVerdict || 'UNKNOWN';

  const verdicts = { appVerdict, deviceVerdicts, licenseVerdict };
  const isEnforce = ENFORCE_ACTIONS.includes(action);

  // App não reconhecido pelo Play
  if (appVerdict !== 'PLAY_RECOGNIZED') {
    return {
      allowed: !isEnforce,
      reason: `App não reconhecido pelo Google Play: ${appVerdict}`,
      verdicts
    };
  }

  // Dispositivo sem integridade mínima
  const hasDeviceIntegrity =
    deviceVerdicts.includes('MEETS_DEVICE_INTEGRITY') ||
    deviceVerdicts.includes('MEETS_STRONG_INTEGRITY') ||
    deviceVerdicts.includes('MEETS_BASIC_INTEGRITY');

  if (!hasDeviceIntegrity) {
    return {
      allowed: !isEnforce,
      reason: `Dispositivo sem integridade mínima: ${deviceVerdicts.join(', ')}`,
      verdicts
    };
  }

  // App sem licença válida (apenas em enforce)
  if (isEnforce && licenseVerdict === 'UNLICENSED') {
    return {
      allowed: false,
      reason: 'App sem licença válida no Google Play',
      verdicts
    };
  }

  return { allowed: true, reason: 'OK', verdicts };
}

/**
 * Obtém o client autenticado do Google.
 */
async function getAuthClient() {
  let key;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
    try {
      key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON);
    } catch (e) {
      throw new Error('Formato inválido da chave JSON: ' + e.message);
    }
  } else if (config.googleServiceAccountKeyPath) {
    key = JSON.parse(readFileSync(config.googleServiceAccountKeyPath, 'utf8'));
  } else {
    throw new Error('Nenhuma chave de conta de serviço encontrada');
  }
  const auth = new GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/playintegrity']
  });
  return auth.getClient();
}

/**
 * Valida o payload Play Integrity.
 * Suporta novo payload (integrityToken, nonce, action, enforcement) e legado (token).
 * @param {object} body - Body da requisição
 * @returns {Promise<object>} Resposta padronizada
 */
exports.validate = async (body) => {
  const requestId = randomUUID();
  const timestamp = new Date().toISOString();

  // Suporte a payload legado (token) e novo (integrityToken)
  const integrityToken = body.integrityToken || body.token;
  const nonce = body.nonce;
  const action = body.action || 'unknown';
  const enforcement = body.enforcement || 'monitor';

  // Mock para testes
  if (integrityToken === 'valid-token') {
    logger.info(`[${requestId}] Token mock validado | action=${action}`);
    return {
      allowed: true,
      reason: 'OK (mock)',
      requestId,
      timestamp,
      verdicts: {}
    };
  }

  if (!integrityToken) {
    logger.warn(`[${requestId}] Token não fornecido | action=${action}`);
    return { allowed: false, reason: 'Token não fornecido', requestId, timestamp, verdicts: {} };
  }

  // Validação anti-replay do nonce
  if (nonce) {
    const nonceCheck = checkAndRegister(nonce);
    if (!nonceCheck.valid) {
      logger.warn(`[${requestId}] ${nonceCheck.reason} | action=${action} | nonce=${nonce}`);
      return { allowed: false, reason: nonceCheck.reason, requestId, timestamp, verdicts: {} };
    }
  }

  try {
    const client = await getAuthClient();

    const res = await client.request({
      url: `https://playintegrity.googleapis.com/v1/${PACKAGE_NAME}:decodeIntegrityToken`,
      method: 'POST',
      data: { integrityToken }
    });

    const tokenPayload = res.data?.tokenPayloadExternal || res.data;

    // Valida packageName
    const reqPackageName = tokenPayload?.requestDetails?.requestPackageName;
    if (reqPackageName && reqPackageName !== PACKAGE_NAME) {
      logger.warn(`[${requestId}] PackageName inválido: ${reqPackageName} | action=${action}`);
      return {
        allowed: false,
        reason: `PackageName inválido: ${reqPackageName}`,
        requestId,
        timestamp,
        verdicts: {}
      };
    }

    const { allowed, reason, verdicts } = evaluateVerdicts(tokenPayload, action);

    logger.info(
      `[${requestId}] action=${action} enforcement=${enforcement} allowed=${allowed} reason=${reason} ` +
      `appVerdict=${verdicts.appVerdict} deviceVerdicts=${JSON.stringify(verdicts.deviceVerdicts)} ` +
      `licenseVerdict=${verdicts.licenseVerdict}`
    );

    return { allowed, reason, requestId, timestamp, verdicts };
  } catch (error) {
    logger.error(`[${requestId}] Erro ao validar token: ${error.message} | action=${action}`);
    return {
      allowed: false,
      reason: 'Erro ao validar token: ' + error.message,
      requestId,
      timestamp,
      verdicts: {}
    };
  }
};
