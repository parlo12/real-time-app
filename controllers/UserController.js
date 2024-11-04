const User = require('../models/User');
const jwt = require('jsonwebtoken');

exports.registerUser = async (req, res) => {
    try {
        const { name, email, role, subAdminId } = req.body;

        // Check if a regular user is being created without a subAdminId
        if (role === 'user' && !subAdminId) {
            return res.status(400).json({ error: 'A subAdminId is required to create a regular user account' });
        }

        const user = new User({ name, email, role, subAdminId });
        await user.save();
        
        res.status(201).json({ message: 'User registered successfully', data: user });
    } catch (error) {
        console.error('Error in registerUser:', error);
        res.status(500).json({ error: 'Failed to register user', details: error.message });
    }
};

exports.loginUser = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (user) {
            const token = jwt.sign(
                { userId: user._id, role: user.role },
                process.env.JWT_SECRET,  
                { expiresIn: '1h' } // Access token expires in 1 hour
            );

            // Generate refresh token (with a longer expiry, e.g., 7 days)
            const refreshToken = jwt.sign(
                { userId: user._id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '7d' } 
            );

            res.json({ message: 'Login successful', token, refreshToken, data: user });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to login', details: error.message });
    }
};

// Refresh token endpoint
exports.refreshToken = async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(403).json({ error: 'No refresh token provided' });
    }

    // Verify the refresh token
    jwt.verify(refreshToken, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired refresh token' });
        }

        // Generate a new access token
        const newToken = jwt.sign(
            { userId: decoded.userId, role: decoded.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // Set new access token expiry
        );

        res.json({ message: 'Token refreshed', token: newToken });
    });
};