const express = require('express');
const clientController = require('../controllers/clientController');
const excelController = require('../controllers/excelController');
const authMiddleware = require('../middleware/auth');
const roleAuth = require('../middleware/roleAuth');

const router = express.Router();

// Protect client routes
router.use(authMiddleware);

router.get('/export', excelController.exportClients);
router.get('/', clientController.getClients);
router.get('/:id', clientController.getClientById);
router.post('/', roleAuth(['ADMIN', 'ACCOUNTANT']), clientController.createClient);
router.put('/:id', roleAuth(['ADMIN', 'ACCOUNTANT']), clientController.updateClient);
router.delete('/:id', roleAuth(['ADMIN', 'ACCOUNTANT']), clientController.deleteClient);
router.get('/:id/statement', clientController.getClientStatement);
router.get('/:id/statement/pdf', clientController.getClientStatementPDF);
router.get('/:id/statement/excel', excelController.exportClientStatement);

module.exports = router;
