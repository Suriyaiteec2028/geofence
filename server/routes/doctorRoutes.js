const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(authenticateToken);

// Doctors
router.get('/', requireRole(['CMO', 'ADMIN']), doctorController.getAllDoctors);
router.post('/', requireRole(['CMO', 'ADMIN']), upload.single('profilePhoto'), doctorController.createDoctor);
router.post('/:id/request-otp', requireRole(['CMO', 'ADMIN']), doctorController.requestDoctorEditOTP);
router.put('/:id', requireRole(['CMO', 'ADMIN']), upload.single('profilePhoto'), doctorController.updateDoctor);
router.post('/:id/send-email', requireRole(['CMO', 'ADMIN']), doctorController.sendTestDoctorEmail);
router.post('/:id/send-report', requireRole(['CMO', 'ADMIN']), doctorController.sendDoctorAttendanceReport);
router.delete('/:id', requireRole(['CMO', 'ADMIN']), doctorController.deleteDoctor);

// General Custom Notice Email (Warning / Message)
router.post('/send-notice', requireRole(['CMO', 'ADMIN']), doctorController.sendCustomNoticeEmail);

// Admins (managed by CMO)
router.get('/admins/list', requireRole(['CMO']), doctorController.getAllAdmins);
router.post('/admins/create', requireRole(['CMO']), doctorController.createAdmin);
router.post('/admins/:id/request-otp', requireRole(['CMO']), doctorController.requestAdminEditOTP);
router.put('/admins/:id', requireRole(['CMO']), doctorController.updateAdmin);
router.delete('/admins/:id', requireRole(['CMO']), doctorController.deleteAdmin);

module.exports = router;
