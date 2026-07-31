const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.use(authenticateToken);
router.get('/analytics', requireRole(['CMO', 'ADMIN']), aiController.getAIAnalytics);

module.exports = router;
