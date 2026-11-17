const express = require('express');
const payrollController = require('../controllers/payrollController');
const excelController = require('../controllers/excelController');
const authMiddleware = require('../middleware/auth');
const roleAuth = require('../middleware/roleAuth');

const router = express.Router();

// Protect all payroll routes
router.use(authMiddleware);

router.post('/generate', roleAuth('ADMIN'), payrollController.generatePayslip);
router.get('/payslips/export', roleAuth('ADMIN'), excelController.exportPayslips);
router.get('/payslips', roleAuth('ADMIN'), payrollController.getPayslips);
router.put('/:id/status', roleAuth('ADMIN'), payrollController.updatePayslipStatus);
router.delete('/:id', roleAuth('ADMIN'), payrollController.deletePayslip);
router.get('/:id/pdf', roleAuth('ADMIN'), payrollController.downloadPayslipPDF);

module.exports = router;
