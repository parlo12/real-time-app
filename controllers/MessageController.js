const Message = require('../models/Message');

// // Send a new message
// exports.sendMessage = async (req, res) => {
//     try {
//         const { sender, receiver, content, userId, deviceId } = req.body;
        
//         // Create a new message with both the userId and deviceId included
//         const message = new Message({ sender, receiver, content, userId, deviceId });
//         await message.save();
        
//         res.status(201).json({ message: 'Message sent successfully', data: message });
//     } catch (error) {
//         console.error('Error in sendMessage:', error);
//         res.status(500).json({ error: 'Failed to send message', details: error.message });
//     }
// };

// Get all messages
exports.getAllMessages = async (req, res) => {
    try {
        const { userId, role } = req.body;

        let messages;

        if (role === 'super_admin') {
            // Super Admin can access all messages
            messages = await Message.find({});
        } else if (role === 'sub_admin') {
            // Sub Admin can access messages from all users under their account
            const usersUnderSubAdmin = await User.find({ subAdminId: userId });
            const userIds = usersUnderSubAdmin.map(user => user._id);

            messages = await Message.find({ userId: { $in: userIds } });
        } else {
            // Regular user: access only their messages for assigned devices
            const userDevices = await Device.find({ userId: userId });
            const deviceIds = userDevices.map(device => device._id);

            messages = await Message.find({
                userId: userId,            // Only messages initiated by this user
                deviceId: { $in: deviceIds } // Only messages sent or received on their assigned devices
            });
        }

        res.json({ data: messages });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve messages', details: error.message });
    }
};



// Send a new message
exports.sendMessage = async (req, res) => {
    try {
        const { sender, receiver, content, userId, deviceId } = req.body;

        // Create message with initial status 'pending'
        const message = new Message({
            sender,
            receiver,
            content,
            status: 'pending', // Initial status is 'pending'
            userId,
            deviceId
        });

        await message.save();

        // Simulate message sending; if it fails, set status to 'failed'
        const sendResult = await simulateSendMessage(message); // Assume this function sends the message

        if (sendResult.success) {
            // Update status to 'sent' upon successful send
            message.status = 'sent';
            await message.save();
        } else {
            // Update status to 'failed' if sending fails
            message.status = 'failed';
            await message.save();
        }

        req.io.emit('messageStatusUpdate', { messageId: message._id, status: message.status });

        res.status(201).json({ message: 'Message processed', data: message });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send message', details: error.message });
    }
};

// Helper function to simulate sending a message (replace with actual sending logic)
const simulateSendMessage = async (message) => {
    // Simulate success or failure with a random outcome for demonstration
    const isSuccess = Math.random() > 0.3; // 70% chance of success
    return { success: isSuccess };
};

// Set message status to 'delivered'
exports.setMessageDelivered = async (req, res) => {
    try {
        const { messageId } = req.params;
        const message = await Message.findByIdAndUpdate(messageId, { status: 'delivered' }, { new: true });

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        req.io.emit('messageStatusUpdate', { messageId, status: 'delivered' });
        res.json({ message: 'Message status updated to delivered', data: message });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update message status', details: error.message });
    }
};

// Set message status to 'read'
exports.setMessageRead = async (req, res) => {
    try {
        const { messageId } = req.params;
        const message = await Message.findByIdAndUpdate(messageId, { status: 'read' }, { new: true });

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        req.io.emit('messageStatusUpdate', { messageId, status: 'read' });
        res.json({ message: 'Message status updated to read', data: message });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update message status', details: error.message });
    }
};

// Explicitly set message status to 'failed'
exports.setMessageFailed = async (req, res) => {
    try {
        const { messageId } = req.params;
        const message = await Message.findByIdAndUpdate(messageId, { status: 'failed' }, { new: true });

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        req.io.emit('messageStatusUpdate', { messageId, status: 'failed' });
        res.json({ message: 'Message status updated to failed', data: message });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update message status', details: error.message });
    }
};