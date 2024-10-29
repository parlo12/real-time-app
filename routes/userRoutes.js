const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');

router.post('/register', UserController.registerUser); // Register user endpoint
router.post('/login', UserController.loginUser);       // Login endpoint

module.exports = router;