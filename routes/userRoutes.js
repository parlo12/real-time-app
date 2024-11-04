const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');

router.post('/register', UserController.registerUser); // Register user endpoint
router.post('/login', UserController.loginUser);       // Login endpoint
router.post('/refresh-token', UserController.refreshToken); // Token refresh endpoint

module.exports = router;