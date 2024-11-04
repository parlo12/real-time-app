const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema({
    model: String,
    sim: String,
    phoneNumber: { type: String, unique: true, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Owner sub-admin
    userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Assigned users
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    registeredAt: { type: Date, default: Date.now }
});

// Optional: Add index for improved query performance
DeviceSchema.index({ userId: 1 });
DeviceSchema.index({ phoneNumber: 1, userId: 1 }, { unique: true }); 

module.exports = mongoose.model('Device', DeviceSchema);