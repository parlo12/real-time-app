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
            // Generate a JWT with the userId and role as the payload
            const token = jwt.sign(
                { userId: user._id, role: user.role },
                process.env.JWT_SECRET,  // Secret key for signing the token
                { expiresIn: '1h' }      // Token expires in 1 hour
            );

            res.json({ message: 'Login successful', token });
            console.log('JWT_SECRET:', process.env.JWT_SECRET);
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to login', details: error.message });
    }
};