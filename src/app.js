const express = require('express');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const integrityRoutes = require('./routes/integrity');
const logger = require('./utils/logger');

dotenv.config();

const app = express();

// CORS
app.use(cors({ origin: process.env.ALLOWED_ORIGINS || '*' }));

// Parse JSON com limite de 64kb
app.use(express.json({ limit: '64kb' }));

// Rate limit: máx 30 requisições por IP em 1 minuto
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Muitas requisições. Tente novamente em instantes.',
      requestId: null,
      timestamp: new Date().toISOString(),
    });
  }
});
app.use('/validate-integrity-token', limiter);

// Logging de requisições
app.use((req, res, next) => {
  logger.info(`IN ${req.method} ${req.url} | ip=${req.ip}`);
  next();
});

// Rotas de integridade
app.use('/validate-integrity-token', integrityRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  logger.error(`Erro não tratado: ${err.message}`);
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Erro interno do servidor',
    requestId: null,
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`API rodando na porta ${PORT}`);
});

module.exports = app;
