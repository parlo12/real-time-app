const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema({
    model: String,
    sim: String,
    phoneNumber: { type: String, unique: true, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Owner sub-admin
    userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Assigned users
    registeredAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Device', DeviceSchema);