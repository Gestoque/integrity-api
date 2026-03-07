const express = require('express');
const router = express.Router();
const integrityController = require('../controllers/integrityController');

router.post('/', integrityController.validateToken);

module.exports = router;
