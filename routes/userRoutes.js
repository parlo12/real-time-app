const express = require('express');
const router = express.Router();
const { validateApiKey } = require('./authMiddleware');
const UserController = require('./UserController');

// Example protected route
router.get('/profile', validateApiKey, (req, res) => {
    res.json({
        message: 'User profile data',
        user: {
            email: req.user.email,
            apiKey: req.user.apiKey,
        },
    });
});

router.post('/register', UserController.register);

module.exports = router;
