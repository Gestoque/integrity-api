const config = require('../config');
const { GoogleAuth } = require('google-auth-library');
const logger = require('../utils/logger');
const { checkAndRegister } = require('../utils/nonceStore');
const { readFileSync } = require('fs');
const { randomUUID } = require('crypto');

const PACKAGE_NAME = 'br.com.gestoque.app.gcollector';
const ENFORCE_ACTIONS = ['device_activation', 'data_sync'];

// ─── Auth Client ──────────────────────────────────────────────────────────────

async function getAuthClient() {
  let key;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
    try {
      key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON);
    } catch (e) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_JSON inválido: ' + e.message);
    }
  } else if (config.googleServiceAccountKeyPath) {
    key = JSON.parse(readFileSync(config.googleServiceAccountKeyPath, 'utf8'));
  } else {
    throw new Error('Nenhuma chave de conta de serviço encontrada');
  }
  const auth = new GoogleAuth({ credentials: key, scopes: ['https://www.googleapis.com/auth/playintegrity'] });
  return auth.getClient();
}

// ─── Risk Evaluation ─────────────────────────────────────────────────────────

function evaluateRisk(appVerdict, deviceVerdicts, licenseVerdict) {
  const flags = [];
  let level = 'low';

  if (appVerdict !== 'PLAY_RECOGNIZED') {
    flags.push('APP_NOT_RECOGNIZED');
    level = 'high';
  }
  const hasDeviceIntegrity =
    deviceVerdicts.includes('MEETS_STRONG_INTEGRITY') ||
    deviceVerdicts.includes('MEETS_DEVICE_INTEGRITY') ||
    deviceVerdicts.includes('MEETS_BASIC_INTEGRITY');
  if (!hasDeviceIntegrity) {
    flags.push('DEVICE_NOT_TRUSTED');
    level = level === 'high' ? 'high' : 'high';
  }
  if (licenseVerdict === 'UNLICENSED') {
    flags.push('UNLICENSED_APP');
    level = level === 'high' ? 'high' : 'medium';
  }

  return { level, flags };
}

// ─── Policy Decision ─────────────────────────────────────────────────────────

function applyPolicy({ appVerdict, deviceVerdicts, licenseVerdict, action, enforcement }) {
  const isEnforce = enforcement === 'enforce' || ENFORCE_ACTIONS.includes(action);

  if (appVerdict !== 'PLAY_RECOGNIZED') {
    return { allowed: !isEnforce, reason: 'app_not_recognized' };
  }
  const hasDeviceIntegrity =
    deviceVerdicts.includes('MEETS_STRONG_INTEGRITY') ||
    deviceVerdicts.includes('MEETS_DEVICE_INTEGRITY') ||
    deviceVerdicts.includes('MEETS_BASIC_INTEGRITY');
  if (!hasDeviceIntegrity) {
    return { allowed: !isEnforce, reason: 'device_integrity_failed' };
  }
  if (isEnforce && licenseVerdict === 'UNLICENSED') {
    return { allowed: false, reason: 'unlicensed' };
  }
  return { allowed: true, reason: 'validated' };
}

// ─── Response Builder ─────────────────────────────────────────────────────────

function buildResponse({ requestId, action, enforcement, allowed, reason, verdicts, nonceResult }) {
  const validatedAt = new Date().toISOString();
  const { appRecognitionVerdict, deviceRecognitionVerdict, appLicensingVerdict } = verdicts;
  const risk = evaluateRisk(appRecognitionVerdict, deviceRecognitionVerdict, appLicensingVerdict);

  // Adiciona flags de nonce se houver
  if (nonceResult?.replayDetected) risk.flags.push('NONCE_REPLAY');

  const httpStatus = (() => {
    if (reason === 'invalid_payload') return 400;
    if (reason === 'nonce_replay') return 409;
    if (reason === 'nonce_expired') return 409;
    if (reason === 'provider_error') return 502;
    if (reason === 'invalid_token') return 422;
    return 200;
  })();

  return {
    httpStatus,
    body: {
      allowed,
      decision: allowed ? 'allow' : 'deny',
      reason,
      requestId,
      validatedAt,
      enforcement,
      action,
      verdicts: {
        appRecognitionVerdict: appRecognitionVerdict || 'UNEVALUATED',
        deviceRecognitionVerdict: deviceRecognitionVerdict || [],
        appLicensingVerdict: appLicensingVerdict || 'UNEVALUATED'
      },
      risk,
      nonce: {
        accepted: nonceResult?.valid ?? false,
        replayDetected: nonceResult?.replayDetected ?? false,
        expiresAt: nonceResult?.expiresAt || null
      }
    }
  };
}

// ─── Main Validate ────────────────────────────────────────────────────────────

exports.validate = async (body) => {
  const requestId = randomUUID();
  const integrityToken = body.integrityToken || body.token;
  const { nonce, action = 'unknown', enforcement = 'monitor' } = body;

  const emptyVerdicts = { appRecognitionVerdict: 'UNEVALUATED', deviceRecognitionVerdict: [], appLicensingVerdict: 'UNEVALUATED' };

  // Mock para testes locais
  if (integrityToken === 'valid-token') {
    logger.info(`[${requestId}] mock | action=${action} enforcement=${enforcement}`);
    const nonceResult = nonce ? checkAndRegister(nonce) : { valid: true, replayDetected: false, expiresAt: null };
    const mockVerdicts = {
      appRecognitionVerdict: 'PLAY_RECOGNIZED',
      deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'],
      appLicensingVerdict: 'LICENSED'
    };
    if (!nonceResult.valid) {
      return buildResponse({
        requestId, action, enforcement,
        allowed: false,
        reason: nonceResult.reason || 'nonce_replay',
        verdicts: mockVerdicts,
        nonceResult
      });
    }
    const policy = applyPolicy({
      appVerdict: mockVerdicts.appRecognitionVerdict,
      deviceVerdicts: mockVerdicts.deviceRecognitionVerdict,
      licenseVerdict: mockVerdicts.appLicensingVerdict,
      action,
      enforcement
    });
    return buildResponse({ requestId, action, enforcement, ...policy, verdicts: mockVerdicts, nonceResult });
  }

  // Anti-replay
  const nonceResult = nonce
    ? checkAndRegister(nonce)
    : { valid: false, replayDetected: false, reason: 'invalid_payload', expiresAt: null };

  if (!nonceResult.valid) {
    logger.warn(`[${requestId}] nonce inválido | reason=${nonceResult.reason} | action=${action}`);
    return buildResponse({
      requestId, action, enforcement,
      allowed: false,
      reason: nonceResult.reason || 'nonce_replay',
      verdicts: emptyVerdicts,
      nonceResult
    });
  }

  // Chamada à API Google Play Integrity
  try {
    const client = await getAuthClient();
    const res = await client.request({
      url: `https://playintegrity.googleapis.com/v1/${PACKAGE_NAME}:decodeIntegrityToken`,
      method: 'POST',
      data: { integrityToken }
    });

    const payload = res.data?.tokenPayloadExternal || res.data || {};
    const appIntegrity = payload.appIntegrity || {};
    const deviceIntegrity = payload.deviceIntegrity || {};
    const accountDetails = payload.accountDetails || {};

    // Valida packageName do token
    const reqPackageName = payload.requestDetails?.requestPackageName;
    if (reqPackageName && reqPackageName !== PACKAGE_NAME) {
      logger.warn(`[${requestId}] packageName inválido: ${reqPackageName}`);
      return buildResponse({
        requestId, action, enforcement,
        allowed: false, reason: 'invalid_payload',
        verdicts: emptyVerdicts, nonceResult
      });
    }

    const verdicts = {
      appRecognitionVerdict: appIntegrity.appRecognitionVerdict || 'UNEVALUATED',
      deviceRecognitionVerdict: deviceIntegrity.deviceRecognitionVerdict || [],
      appLicensingVerdict: accountDetails.appLicensingVerdict || 'UNEVALUATED'
    };

    const policy = applyPolicy({ ...verdicts, action, enforcement });

    logger.info(
      `[${requestId}] action=${action} enforcement=${enforcement} allowed=${policy.allowed} ` +
      `reason=${policy.reason} app=${verdicts.appRecognitionVerdict} ` +
      `device=${JSON.stringify(verdicts.deviceRecognitionVerdict)} license=${verdicts.appLicensingVerdict}`
    );

    return buildResponse({ requestId, action, enforcement, ...policy, verdicts, nonceResult });

  } catch (error) {
    const isProviderError = error.code >= 500 || error.message.includes('GOOGLE') || error.message.includes('googleapis');
    const reason = isProviderError ? 'provider_error' : 'invalid_token';
    logger.error(`[${requestId}] ${reason}: ${error.message} | action=${action}`);
    return buildResponse({
      requestId, action, enforcement,
      allowed: false, reason,
      verdicts: emptyVerdicts, nonceResult
    });
  }
};
