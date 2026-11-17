const express = require('express');
const voucherController = require('../controllers/voucherController');
const excelController = require('../controllers/excelController');
const authMiddleware = require('../middleware/auth');
const roleAuth = require('../middleware/roleAuth');

const router = express.Router();

// All voucher routes require authentication
router.use(authMiddleware);

router.get('/export', excelController.exportVouchers);
router.get('/', voucherController.getVouchers);
router.post('/', roleAuth(['ADMIN', 'ACCOUNTANT']), voucherController.createVoucher);
router.delete('/:id', roleAuth(['ADMIN', 'ACCOUNTANT']), voucherController.deleteVoucher);

module.exports = router;
