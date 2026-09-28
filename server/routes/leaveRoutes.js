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

// Doctor: Apply for own leave
router.post('/apply', requireRole(['DOCTOR']), upload.single('proofFile'), leaveController.applyForLeave);

// Doctor: View own leave applications
router.get('/my-applications', requireRole(['DOCTOR']), leaveController.getMyLeaveApplications);

// Admin/CMO: View all doctor leave applications
router.get('/applications', requireRole(['ADMIN', 'CMO']), leaveController.getAllLeaveApplications);

// Admin/CMO: Review (approve/reject) a doctor leave application
router.patch('/applications/:id/review', requireRole(['ADMIN', 'CMO']), leaveController.reviewLeaveApplication);

// Admin/CMO: Edit/revoke an existing granted leave
router.patch('/:id/edit', requireRole(['ADMIN', 'CMO']), leaveController.editGrantedLeave);

module.exports = router;
