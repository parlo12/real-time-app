const express = require('express');
const router = express.Router();
const DeviceController = require('../controllers/DeviceController');
const authMiddleware = require('../middleware/authMiddleware');

// Register a new device (only sub_admins)
router.post('/register', authMiddleware.isAuthenticated, authMiddleware.isSubAdmin, DeviceController.registerDevice);

// Assign device to users
router.post('/assign', authMiddleware.isAuthenticated, authMiddleware.isSubAdmin, DeviceController.assignDeviceToUser);

module.exports = router;