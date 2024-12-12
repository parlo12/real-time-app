const crypto = require('crypto');
const User = require('./models/User');

// Register a new user
exports.register = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Generate a unique API key
        const apiKey = crypto.randomBytes(32).toString('hex');

        // Create a new user
        const newUser = new User({ email, password, apiKey });

        // Save the user to the database
        await newUser.save();

        // Return the API key to the user
        res.status(201).json({
            message: 'User registered successfully',
            apiKey,
        });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
