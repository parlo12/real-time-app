const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    phoneNumber: { type: String, unique: true },
    address: String,
    city: String,
    state: String,
    zip: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('Contact', ContactSchema);