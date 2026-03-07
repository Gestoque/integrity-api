const express = require('express');
const dotenv = require('dotenv');
const integrityRoutes = require('./routes/integrity');
const logger = require('./utils/logger');

// Carrega variáveis de ambiente
dotenv.config();

const app = express();
app.use(express.json());

// Middleware de logging
app.use((req, res, next) => {
  logger.info(`Requisição: ${req.method} ${req.url}`);
  next();
});

// Rotas de integridade
app.use('/validate-integrity-token', integrityRoutes);

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  logger.error(err.message);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`API rodando na porta ${PORT}`);
});
