const express = require('express');
const supplierController = require('../controllers/supplierController');
const excelController = require('../controllers/excelController');
const authMiddleware = require('../middleware/auth');
const roleAuth = require('../middleware/roleAuth');

const router = express.Router();

// All supplier routes require authentication
router.use(authMiddleware);

router.get('/export', excelController.exportSuppliers);
router.get('/', supplierController.getSuppliers);
router.get('/:id', supplierController.getSupplierById);
router.post('/', roleAuth(['ADMIN', 'ACCOUNTANT']), supplierController.createSupplier);
router.put('/:id', roleAuth(['ADMIN', 'ACCOUNTANT']), supplierController.updateSupplier);
router.delete('/:id', roleAuth(['ADMIN', 'ACCOUNTANT']), supplierController.deleteSupplier);

module.exports = router;
