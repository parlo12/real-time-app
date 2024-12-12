const User = require('../models/User.js');

// Middleware to validate API key
module.exports.validateApiKey = async (req, res, next) => {
    const apiKey = req.headers['x-api-key']; // Extract API key from request headers
    if (!apiKey) {
        return res.status(401).json({ error: 'API key is required' });
    }

    try {
        const user = await User.findOne({ apiKey });
        if (!user) {
            return res.status(403).json({ error: 'Invalid API key' });
        }

        req.user = user; // Attach user to the request object
        next();
    } catch (error) {
        console.error('Error validating API key:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
