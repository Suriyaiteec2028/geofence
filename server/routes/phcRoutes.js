const express = require('express');
const router = express.Router();
const phcController = require('../controllers/phcController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/', phcController.getAllPHCs);
router.get('/:id', phcController.getPHCById);
router.post('/', requireRole(['CMO']), phcController.createPHC);
router.put('/:id', requireRole(['CMO', 'ADMIN']), phcController.updatePHC);
router.patch('/:id/toggle-status', requireRole(['CMO']), phcController.togglePHCStatus);
router.delete('/:id', requireRole(['CMO']), phcController.deletePHC);

module.exports = router;
