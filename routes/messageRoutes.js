const express = require('express');
const router = express.Router();
const MessageController = require('../controllers/MessageController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/send', authMiddleware.isAuthenticated, MessageController.sendMessage); // Send message
router.get('/all', authMiddleware.isAuthenticated, MessageController.getAllMessages); // Get all messages
router.patch('/:messageId/delivered', authMiddleware.isAuthenticated, MessageController.setMessageDelivered); // Set to delivered
router.patch('/:messageId/read', authMiddleware.isAuthenticated, MessageController.setMessageRead); // Set to read
router.patch('/:messageId/failed', authMiddleware.isAuthenticated, MessageController.setMessageFailed); // Explicitly set to failed

module.exports = router;