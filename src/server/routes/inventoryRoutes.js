const express = require('express');
const inventoryController = require('../controllers/inventoryController');
const excelController = require('../controllers/excelController');
const authMiddleware = require('../middleware/auth');
const roleAuth = require('../middleware/roleAuth');

const router = express.Router();

// Protect all inventory routes
router.use(authMiddleware);

router.get('/products/export', excelController.exportProducts);
router.get('/products', inventoryController.getProducts);
router.get('/products/barcode/:code', inventoryController.getProductByBarcode);
router.post('/products', roleAuth(['ADMIN', 'ACCOUNTANT']), inventoryController.createProduct);
router.post('/products/restock', roleAuth(['ADMIN', 'ACCOUNTANT']), inventoryController.restockProduct);
router.post('/products/import', roleAuth(['ADMIN', 'ACCOUNTANT']), inventoryController.bulkImportProducts);
router.get('/valuation', inventoryController.getInventoryValuation);
router.get('/transactions/export', excelController.exportStockTransactions);
router.get('/transactions', inventoryController.getStockTransactions);

module.exports = router;
