const Message = require('../models/Message');
const User = require('../models/User');
const Device = require('../models/Device');

// Queue to hold pending messages
const queue = []; // Queue to manage message processing
this.processing = false; // Flag to track if processing is ongoing

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
            messageId: message._id,
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

        // req.io.emit('messageStatusUpdate', { messageId, status: 'failed' });
        req.io.emit('messageStatusUpdate', { messageId: message._id, status: message.status });
        res.json({ message: 'Message status updated to failed', data: message });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update message status', details: error.message });
    }
};

// Process pending messages

// Process pending messages
exports.processPendingMessages = async (req, res) => {
    try {
        const { io } = req; // Capture io from req

        // Retrieve all messages with a "pending" status
        const pendingMessages = await Message.find({ status: 'pending' }).limit(10);

        if (pendingMessages.length === 0) {
            return res.json({ message: 'No pending messages to process' });
        }

        // Add messages to the queue
        queue.push(...pendingMessages);

        // Start processing if not already started
        if (!processing) {
            processMessages(io); // Pass io to the internal function
        }

        res.json({ message: 'Processing pending messages', data: pendingMessages });
    } catch (error) {
        res.status(500).json({ error: 'Failed to process pending messages', details: error.message });
    }
};

// Function to process messages from the queue
function processMessages(io) {
    if (queue.length === 0) {
        processing = false; // Stop processing if the queue is empty
        return;
    }

    processing = true; // Set processing flag

    const message = queue.shift(); // Get the next message

    // Simulate message sending and set status
    simulateSendMessage(message)
        .then(async (sendResult) => {
            if (sendResult.success) {
                message.status = 'delivered';
            } else {
                message.status = 'failed'; // Leave as failed if unsuccessful
            }
            await message.save();

            io.emit('messageStatusUpdate', { messageId: message._id, status: message.status });

            // Process the next message after a 5-second delay
            setTimeout(() => {
                processMessages(io);
            }, 5000);
        })
        .catch(async (error) => {
            console.error('Error processing message:', error.message);
            message.status = 'failed';
            await message.save();
            processMessages(io); // Continue to next even if an error occurs
        });
}

// Helper function to simulate sending a message (replace with actual sending logic)
const simulateSendMessage = async (message) => {
    const isSuccess = Math.random() > 0.3; // 70% chance of success
    return { success: isSuccess };
};