const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const auditController = require('../controllers/auditController');

router.use(authenticateToken);
router.get('/', requireRole(['ADMIN', 'CMO']), auditController.getAuditLogs);

module.exports = router;
