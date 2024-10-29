const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true, required: true },
    role: { type: String, enum: ['super_admin', 'sub_admin', 'user'], default: 'user' },
    subAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Reference to the Sub Admin
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);