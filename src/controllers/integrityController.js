const playIntegrityService = require('../services/playIntegrityService');
const logger = require('../utils/logger');

exports.validateToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      logger.warn('Token não fornecido');
      return res.status(400).json({ status: 'inválido', detalhes: 'Token não fornecido' });
    }
    const resultado = await playIntegrityService.validate(token);
    logger.info(`Resultado da validação: ${JSON.stringify(resultado)}`);
    res.status(200).json(resultado);
  } catch (error) {
    logger.error(`Erro na validação: ${error.message}`);
    res.status(500).json({ status: 'inválido', detalhes: 'Erro interno do servidor' });
  }
};
