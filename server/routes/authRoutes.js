const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/login', authController.login);
router.post('/verify-doctor', authController.verifyDoctorCredentials);
router.post('/doctor-face-login', authController.doctorFaceLogin);

// Master CMO Registration with Live OTP Flow
router.post('/cmo-request-otp', authController.cmoRequestOTP);
router.post('/cmo-verify-otp', authController.cmoVerifyOTP);
router.post('/cmo-register', authController.cmoCompleteRegistration);

// Admin / User Forgot Password OTP Flow
router.post('/request-otp', authController.requestPasswordResetOTP);
router.post('/verify-otp', authController.verifyPasswordResetOTP);
router.post('/reset-password', authController.resetPasswordWithOTP);

router.get('/me', authenticateToken, authController.getProfile);

module.exports = router;
