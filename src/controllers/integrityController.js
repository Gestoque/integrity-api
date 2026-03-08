const playIntegrityService = require('../services/playIntegrityService');
const { validateRequestSchema } = require('../utils/validator');
const logger = require('../utils/logger');

const REASON_TO_CODE = {
  invalid_payload: 'INVALID_PAYLOAD',
  nonce_replay: 'NONCE_REPLAY',
  nonce_expired: 'NONCE_EXPIRED',
  invalid_token: 'TOKEN_INVALID',
  provider_error: 'PROVIDER_ERROR',
  app_not_recognized: 'POLICY_DENIED',
  device_integrity_failed: 'POLICY_DENIED',
  unlicensed: 'POLICY_DENIED',
};

function toErrorResponse(reason, message, requestId = null) {
  return {
    code: REASON_TO_CODE[reason] || 'INTERNAL_ERROR',
    message: message || reason,
    requestId,
    timestamp: new Date().toISOString(),
  };
}

exports.validateToken = async (req, res) => {
  // 1. Validação de schema
  const schemaCheck = validateRequestSchema(req.body);
  if (!schemaCheck.valid) {
    logger.warn(`Schema inválido | reason=${schemaCheck.reason} | detail=${schemaCheck.detail}`);
    return res.status(schemaCheck.httpStatus).json(
      toErrorResponse(schemaCheck.reason, schemaCheck.detail)
    );
  }

  // 2. Validação de integridade
  try {
    const resultado = await playIntegrityService.validate(req.body);
    const { httpStatus, body } = resultado;

    logger.info(
      `[${body.requestId}] HTTP ${httpStatus} | action=${body.action} enforcement=${body.enforcement} ` +
      `allowed=${body.allowed} reason=${body.reason} risk=${body.risk?.level}`
    );

    if (httpStatus === 200) {
      return res.status(200).json(body);
    }

    return res.status(httpStatus).json(
      toErrorResponse(body.reason, body.reason, body.requestId)
    );
  } catch (error) {
    logger.error(`Erro inesperado: ${error.message}`);
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Erro interno do servidor',
      requestId: null,
      timestamp: new Date().toISOString(),
    });
  }
};
