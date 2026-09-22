const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const leaveController = require('../controllers/leaveController');

// All leave routes require authentication
router.use(authenticateToken);

// Admin/CMO: Grant official leave (with optional evidence file upload)
router.post('/', requireRole(['ADMIN', 'CMO']), upload.single('evidenceFile'), leaveController.grantOfficialLeave);

// Admin/CMO: Cancel a leave record
router.patch('/:id/cancel', requireRole(['ADMIN', 'CMO']), leaveController.cancelOfficialLeave);

// Doctor: Get own leaves
router.get('/my', requireRole(['DOCTOR']), leaveController.getDoctorLeaves);

// Admin/CMO: Get all leaves
router.get('/', requireRole(['ADMIN', 'CMO']), leaveController.getAllLeaves);

// Admin/CMO or Doctor (own): Get leaves for a specific doctor
router.get('/doctor/:doctorId', leaveController.getDoctorLeaves);

module.exports = router;
