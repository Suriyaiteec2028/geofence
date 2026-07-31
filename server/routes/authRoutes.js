const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/login', authController.login);
router.post('/verify-doctor', authController.verifyDoctorCredentials);
router.post('/doctor-face-login', authController.doctorFaceLogin);

// Admin / User Forgot Password OTP Flow
router.post('/request-otp', authController.requestPasswordResetOTP);
router.post('/verify-otp', authController.verifyPasswordResetOTP);
router.post('/reset-password', authController.resetPasswordWithOTP);

router.get('/me', authenticateToken, authController.getProfile);

module.exports = router;
