const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/summary', requireRole(['CMO', 'ADMIN']), reportController.getReportSummary);
router.get('/export-pdf', requireRole(['CMO', 'ADMIN']), reportController.exportAttendancePDF);

module.exports = router;
