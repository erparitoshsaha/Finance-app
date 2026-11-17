const express = require('express');
const excelController = require('../controllers/excelController');
const authMiddleware = require('../middleware/auth');
const roleAuth = require('../middleware/roleAuth');

const router = express.Router();

// Require authentication for all Excel operations
router.use(authMiddleware);

// -------------------------------------------------------------
// TEMPLATES (Downloadable Excel templates for all modules)
// -------------------------------------------------------------
router.get('/template/:module', excelController.downloadTemplate);

// -------------------------------------------------------------
// IMPORTS (Preview, Commit, Error Report)
// Restricted to ADMIN & ACCOUNTANT roles
// -------------------------------------------------------------
router.post('/preview/:module', roleAuth(['ADMIN', 'ACCOUNTANT']), excelController.previewImport);
router.post('/commit/:module', roleAuth(['ADMIN', 'ACCOUNTANT']), excelController.commitImport);
router.post('/error-report/:module', roleAuth(['ADMIN', 'ACCOUNTANT']), excelController.downloadErrorReport);

// -------------------------------------------------------------
// EXPORTS (Genuine .xlsx files for all modules & reports)
// -------------------------------------------------------------
router.get('/export/clients', excelController.exportClients);
router.get('/export/statement/:id', excelController.exportClientStatement);
router.get('/export/suppliers', excelController.exportSuppliers);
router.get('/export/products', excelController.exportProducts);
router.get('/export/transactions', excelController.exportStockTransactions);
router.get('/export/invoices', excelController.exportInvoices);
router.get('/export/invoices/:id', excelController.exportSingleInvoice);
router.get('/export/expenses', excelController.exportExpenses);
router.get('/export/vouchers', excelController.exportVouchers);
router.get('/export/employees', excelController.exportEmployees);
router.get('/export/payslips', excelController.exportPayslips);
router.get('/export/pl', excelController.exportPLReport);
router.get('/export/gst', excelController.exportGSTReport);
router.get('/export/tds-tcs', excelController.exportTDSTCSReport);
router.get('/export/bookkeeping', excelController.exportBookkeepingReport);

module.exports = router;
