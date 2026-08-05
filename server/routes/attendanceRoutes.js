const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/shift-status', requireRole(['DOCTOR']), attendanceController.getDoctorShiftStatus);
router.post('/mark', requireRole(['DOCTOR']), attendanceController.markAttendance);
router.get('/history', attendanceController.getDoctorAttendanceLogs);
router.get('/all', requireRole(['CMO', 'ADMIN']), attendanceController.getAllAttendanceRecords);

module.exports = router;
