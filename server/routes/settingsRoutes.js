const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/', settingsController.getSettings);
router.put('/', requireRole(['CMO', 'ADMIN']), settingsController.updateSettings);

module.exports = router;
