const express = require('express');
const employeeController = require('../controllers/employeeController');
const excelController = require('../controllers/excelController');
const authMiddleware = require('../middleware/auth');
const roleAuth = require('../middleware/roleAuth');

const router = express.Router();

// Protect all employee routes
router.use(authMiddleware);

router.get('/export', roleAuth('ADMIN'), excelController.exportEmployees);
router.get('/', roleAuth('ADMIN'), employeeController.getEmployees);
router.get('/:id', roleAuth('ADMIN'), employeeController.getEmployeeById);
router.post('/', roleAuth('ADMIN'), employeeController.createEmployee);
router.put('/:id', roleAuth('ADMIN'), employeeController.updateEmployee);
router.delete('/:id', roleAuth('ADMIN'), employeeController.deleteEmployee);

module.exports = router;
