const express = require('express');
const expenseController = require('../controllers/expenseController');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), 'uploads/receipts');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|webp|pdf/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (JPEG/PNG/WEBP) and PDF files are allowed.'));
    }
  }
});

// All expense routes require authentication
router.use(authMiddleware);

const roleAuth = require('../middleware/roleAuth');
const excelController = require('../controllers/excelController');

router.get('/export', excelController.exportExpenses);
router.get('/', expenseController.getExpenses);
router.get('/pl-summary', expenseController.getPLSummary);
router.get('/:id', expenseController.getExpenseById);
router.post('/', roleAuth(['ADMIN', 'ACCOUNTANT']), upload.single('receipt'), expenseController.createExpense);
router.put('/:id', roleAuth(['ADMIN', 'ACCOUNTANT']), upload.single('receipt'), expenseController.updateExpense);
router.delete('/:id', roleAuth(['ADMIN', 'ACCOUNTANT']), expenseController.deleteExpense);

module.exports = router;
