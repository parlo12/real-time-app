const express = require('express');
const router = express.Router();
const DeviceController = require('../controllers/DeviceController');
const authMiddleware = require('../middleware/authMiddleware');

// Route for authenticated Sub Admin to assign a device to a user
router.post('/assign', authMiddleware.isAuthenticated, authMiddleware.isSubAdmin, DeviceController.assignDeviceToUser);

module.exports = router;