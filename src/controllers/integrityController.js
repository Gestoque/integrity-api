const playIntegrityService = require('../services/playIntegrityService');
const { validateRequestSchema } = require('../utils/validator');
const logger = require('../utils/logger');

exports.validateToken = async (req, res) => {
  // 1. Validação de schema
  const schemaCheck = validateRequestSchema(req.body);
  if (!schemaCheck.valid) {
    logger.warn(`Schema inválido | reason=${schemaCheck.reason} | detail=${schemaCheck.detail}`);
    return res.status(schemaCheck.httpStatus).json({
      allowed: false,
      decision: 'deny',
      reason: schemaCheck.reason,
      detail: schemaCheck.detail,
      requestId: null,
      validatedAt: new Date().toISOString(),
      enforcement: req.body?.enforcement || 'monitor',
      action: req.body?.action || 'unknown',
      verdicts: { appRecognitionVerdict: 'UNEVALUATED', deviceRecognitionVerdict: [], appLicensingVerdict: 'UNEVALUATED' },
      risk: { level: 'high', flags: ['INVALID_PAYLOAD'] },
      nonce: { accepted: false, replayDetected: false, expiresAt: null }
    });
  }

  // 2. Validação de integridade
  try {
    const resultado = await playIntegrityService.validate(req.body);
    const { httpStatus, body } = resultado;

    logger.info(
      `[${body.requestId}] HTTP ${httpStatus} | action=${body.action} enforcement=${body.enforcement} ` +
      `allowed=${body.allowed} reason=${body.reason} risk=${body.risk?.level}`
    );

    return res.status(httpStatus).json(body);
  } catch (error) {
    logger.error(`Erro inesperado: ${error.message}`);
    return res.status(500).json({
      allowed: false,
      decision: 'deny',
      reason: 'provider_error',
      requestId: null,
      validatedAt: new Date().toISOString(),
      enforcement: req.body?.enforcement || 'monitor',
      action: req.body?.action || 'unknown',
      verdicts: { appRecognitionVerdict: 'UNEVALUATED', deviceRecognitionVerdict: [], appLicensingVerdict: 'UNEVALUATED' },
      risk: { level: 'high', flags: [] },
      nonce: { accepted: false, replayDetected: false, expiresAt: null }
    });
  }
};
