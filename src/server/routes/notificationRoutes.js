const express = require('express');
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/auth');
const roleAuth = require('../middleware/roleAuth');

const router = express.Router();

// All notification routes require authentication and Admin/Accountant role
router.use(authMiddleware);
router.use(roleAuth(['ADMIN', 'ACCOUNTANT']));

router.get('/settings', notificationController.getSettings);
router.put('/settings', notificationController.updateSettings);
router.post('/trigger-reminders', notificationController.triggerReminders);

module.exports = router;
