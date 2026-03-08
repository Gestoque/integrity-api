const playIntegrityService = require('../services/playIntegrityService');
const logger = require('../utils/logger');

exports.validateToken = async (req, res) => {
  try {
    const resultado = await playIntegrityService.validate(req.body);
    const status = resultado.allowed ? 200 : 403;
    logger.info(
      `[${resultado.requestId}] HTTP ${status} | allowed=${resultado.allowed} | reason=${resultado.reason}`
    );
    res.status(status).json(resultado);
  } catch (error) {
    logger.error(`Erro inesperado na validação: ${error.message}`);
    res.status(500).json({
      allowed: false,
      reason: 'Erro interno do servidor',
      requestId: null,
      timestamp: new Date().toISOString(),
      verdicts: {}
    });
  }
};
