// Import necessary modules
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const Device = require('./models/Device');
const Message = require('./models/Message'); // <-- Import Message model
const messageRoutes = require('./routes/messageRoutes');
const userRoutes = require('./routes/userRoutes');
const User = require('./models/User'); // <-- Import User model
const deviceRoutes = require('./routes/deviceRoutes');

// Load environment variables from .env file
dotenv.config();

// Initialize Express app
const app = express();

// Enable CORS
app.use(cors());

// Enable JSON body parsing
app.use(express.json());

// Set up a basic HTTP server using the Express app
const server = http.createServer(app);

// Initialize Socket.IO with the server
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware to attach io to the req object (before routes)
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Set up routes
app.use('/messages', messageRoutes);
app.use('/users', userRoutes);
app.use('/devices', deviceRoutes);

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Handle joining a room when the user connects and identifies themselves
    socket.on('joinRoom', ({ userId, role }) => {
        const roomId = userId.toString();
        socket.join(roomId);
        console.log(`User ${userId} with role ${role} joined room ${roomId}`);
    });

    // Ensure `getAllMessages` receives `userId` and `role`
    socket.on('getAllMessages', async (data = {}) => {
        const { userId, role } = data;

        if (!userId || !role) {
            console.error("User ID or role missing for 'getAllMessages' event");
            socket.emit('error', { message: 'User ID and role are required to fetch messages' });
            return;
        }

        try {
            let messages;
            if (role === 'super_admin') {
                messages = await Message.find(); // Fetch all messages for super admin
            } else {
                messages = await Message.find({
                    $or: [{ userId: userId }, { receiver: userId }]
                });
            }
            socket.emit('allMessages', messages);
        } catch (error) {
            console.error('Error fetching all messages:', error.message);
            socket.emit('error', { message: 'Failed to retrieve all messages' });
        }
    });

    // Handle the 'message' event with default handling for `deviceId`
    socket.on('message', async (messageData) => {
        console.log('Message received on server:', messageData);

        // Check if deviceId is valid or use a default value (e.g., `null` if optional)
        const deviceId = mongoose.isValidObjectId(messageData.deviceId) ? messageData.deviceId : null;

        const message = new Message({
            sender: messageData.sender,
            receiver: messageData.receiver || 'Unknown', // Use "Unknown" if receiver is not provided
            content: messageData.content,
            status: 'sent',
            userId: messageData.userId,
            deviceId: deviceId, // Apply default or valid deviceId
            threadId: messageData.threadId || null, // Use existing threadId if provided
            origin: messageData.origin || 'CRM' // Assume CRM as the origin if not provided
        });

    

        try {
            await message.save();

            // need to know which service is sending message is it CRM or Android
           //event emit to userID
        io.emit(messageData.userId.toString, { 
                
                ...message, 
                messageId: message._id,
            
        });
        console.log('Message sent to user:', messageData.userId);

            const user = await User.findById(messageData.userId).populate('subAdminId');
            if (user && user.subAdminId) {
                const subAdminId = user.subAdminId._id;
                io.to(messageData.userId.toString()).emit('messageSent', { messageId: message._id, status: 'sent' });
                io.to(subAdminId.toString()).emit('messageSent', { messageId: message._id, status: 'sent' });
            } else if (user.role === 'sub_admin' && !user.subAdminId) {
                console.warn(`User ${user._id} is a sub_admin but has no subAdminId.`);
                io.to(messageData.userId.toString()).emit('messageSent', { messageId: message._id, status: 'sent' });
            } else {
                console.error('Sub-admin not found for user:', messageData.userId);
            }
        } catch (error) {
            console.error('Error saving message:', error.message);
            socket.emit('error', { message: 'Failed to save message' });
        }
    });

    // Handle 'replyMessage' event to handle replies
    socket.on('replyMessage', async (replyData) => {
        const { originalMessageId, content, userId, origin } = replyData;

        try {
            const originalMessage = await Message.findById(originalMessageId);
            if (!originalMessage) {
                console.error('Original message not found.');
                return;
            }

            const replyMessage = new Message({
                sender: userId,
                receiver: originalMessage.sender,
                content: content,
                status: 'sent',
                userId: userId,
                deviceId: originalMessage.deviceId,
                threadId: originalMessage.threadId || originalMessage._id, // Link to the original message's thread
                origin: origin || 'CRM' // Default to CRM if origin not specified
            });

            await replyMessage.save();

            // Emit to both the original sender's and receiver's rooms
            io.to(originalMessage.sender.toString()).emit('newReply', replyMessage);
            io.to(userId.toString()).emit('newReply', replyMessage);

        } catch (error) {
            console.error('Error handling reply message:', error.message);
        }
    });

    // Handle 'messageDelivered' event
    socket.on('messageDelivered', async (data) => {
        const { messageId } = data;
        try {
            const message = await Message.findByIdAndUpdate(
                messageId,
                { status: 'delivered' },
                { new: true }
            );
            if (message) {
                io.to(message.userId.toString()).emit('messageStatusUpdate', { messageId, status: 'delivered' });
                io.to(message.userId.subAdminId.toString()).emit('messageStatusUpdate', { messageId, status: 'delivered' });
            }
        } catch (error) {
            console.error('Error updating message to delivered:', error.message);
        }
    });

    // Handle 'messageRead' event
    socket.on('messageRead', async (data) => {
        const { messageId } = data;
        try {
            const message = await Message.findByIdAndUpdate(
                messageId,
                { status: 'read' },
                { new: true }
            );
            if (message) {
                io.to(message.userId.toString()).emit('messageStatusUpdate', { messageId, status: 'read' });
                io.to(message.userId.subAdminId.toString()).emit('messageStatusUpdate', { messageId, status: 'read' });
            }
        } catch (error) {
            console.error('Error updating message to read:', error.message);
        }
    });

    // Fetch pending messages specifically
    socket.on('getPendingMessages', async () => {
        try {
            const pendingMessages = await Message.find({ status: 'pending' });
            socket.emit('pendingMessages', pendingMessages);
        } catch (error) {
            console.error('Error retrieving pending messages:', error.message);
            socket.emit('error', { message: 'Failed to retrieve pending messages' });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Define a basic route to verify server is running
app.get('/', (req, res) => {
    res.send('WebSocket API server is running');
});

// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch((error) => {
        console.error('Error connecting to MongoDB:', error.message);
    });