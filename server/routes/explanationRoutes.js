const express = require('express');
const router = express.Router();
const explanationController = require('../controllers/explanationController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(authenticateToken);

router.post('/submit', requireRole(['DOCTOR']), upload.single('proofFile'), explanationController.submitExplanation);
router.get('/pending', requireRole(['CMO', 'ADMIN']), explanationController.getPendingExplanations);
router.patch('/:id/review', requireRole(['CMO', 'ADMIN']), explanationController.reviewExplanation);

module.exports = router;
