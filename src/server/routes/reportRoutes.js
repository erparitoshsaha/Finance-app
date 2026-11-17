const express = require('express');
const reportController = require('../controllers/reportController');
const excelController = require('../controllers/excelController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All report routes require authentication
router.use(authMiddleware);

router.get('/profit-loss', reportController.getProfitAndLoss);
router.get('/profit-loss/excel', excelController.exportPLReport);
router.get('/gst', reportController.getGSTReport);
router.get('/gst/excel', excelController.exportGSTReport);
router.get('/tds-tcs', reportController.getTDSTCSReport);
router.get('/tds-tcs/excel', excelController.exportTDSTCSReport);
router.get('/bookkeeping', reportController.getBookkeepingReports);
router.get('/bookkeeping/excel', excelController.exportBookkeepingReport);

module.exports = router;
