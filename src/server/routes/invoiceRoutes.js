const express = require('express');
const invoiceController = require('../controllers/invoiceController');
const excelController = require('../controllers/excelController');
const authMiddleware = require('../middleware/auth');
const roleAuth = require('../middleware/roleAuth');

const router = express.Router();

// Protect invoice routes
router.use(authMiddleware);

router.get('/export', excelController.exportInvoices);
router.get('/', invoiceController.getInvoices);
router.get('/:id', invoiceController.getInvoiceById);
router.post('/', roleAuth(['ADMIN', 'ACCOUNTANT']), invoiceController.createInvoice);
router.patch('/:id/status', roleAuth(['ADMIN', 'ACCOUNTANT']), invoiceController.updateInvoiceStatus);
router.delete('/:id', roleAuth(['ADMIN', 'ACCOUNTANT']), invoiceController.deleteInvoice);
router.get('/:id/pdf', invoiceController.downloadInvoicePDF);
router.post('/:id/email', roleAuth(['ADMIN', 'ACCOUNTANT']), invoiceController.emailInvoice);
router.get('/:id/excel', excelController.exportSingleInvoice);

module.exports = router;
