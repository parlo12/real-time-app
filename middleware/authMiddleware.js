const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.isAuthenticated = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Failed to authenticate token' });
        }

        // Attach user information to req.user
        req.user = { userId: decoded.userId, role: decoded.role };

        // Log decoded token info for debugging
        console.log('Decoded JWT:', decoded);

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized: Invalid user' });
        }

        next();
    });
};


// Middleware to check if the user is a Sub Admin
exports.isSubAdmin = async (req, res, next) => {
    if (req.user && req.user.role === 'sub_admin') {
        next(); // Proceed if the role is Sub Admin
    } else {
        res.status(403).json({ error: 'Access denied: Requires Sub Admin role' });
    }
};

// Middleware to check if the user is a Super Admin
exports.isSuperAdmin = async (req, res, next) => {
    if (req.user && req.user.role === 'super_admin') {
        next(); // Proceed if the role is Super Admin
    } else {
        res.status(403).json({ error: 'Access denied: Requires Super Admin role' });
    }
};