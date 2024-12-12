const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    receiver: { type: String, required: true },
    content: { type: String, required: true },
    status: { type: String, enum: ['sent', 'failed', 'pending', 'delivered'], default: 'pending' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: false },
    origin: { type: String, enum: ['CRM', 'API', 'Web', 'Android', 'WebSocket'], default: 'CRM' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema);
