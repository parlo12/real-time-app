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
        // Join a room based on the user's ID
        const roomId = userId.toString();
        socket.join(roomId);
        console.log(`User ${userId} with role ${role} joined room ${roomId}`);
    });

    // Handle incoming messages and broadcast only to relevant clients
    socket.on('message', async (messageData) => {
        console.log('Message received on server:', messageData);

        const message = new Message({
            sender: messageData.sender,
            receiver: messageData.receiver,
            content: messageData.content,
            status: 'sent',
            userId: messageData.userId,
            deviceId: messageData.deviceId
        });

        await message.save();

        try {
            // Find the associated user and populate subAdminId
            const user = await User.findById(messageData.userId).populate('subAdminId');
    
            if (user && user.subAdminId) {
                const subAdminId = user.subAdminId._id;
    
                // Notify the specific user and the associated sub-admin only
                io.to(messageData.userId.toString()).emit('messageSent', { messageId: message._id, status: 'sent' });
                io.to(subAdminId.toString()).emit('messageSent', { messageId: message._id, status: 'sent' });
            } else {
                console.error('Sub-admin not found for user:', messageData.userId);
            }
        } catch (error) {
            console.error('Error retrieving sub-admin for user:', error.message);
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
                // Notify only the relevant user and sub-admin
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

    // Handle 'getPendingMessages' event, respond only to the requesting client
    socket.on('getPendingMessages', async () => {
        try {
            const pendingMessages = await Message.find({ status: 'pending' });
            socket.emit('pendingMessages', pendingMessages);  // Emit only to the requesting client
        } catch (error) {
            console.error('Error retrieving pending messages:', error.message);
            socket.emit('error', { message: 'Failed to retrieve pending messages' });
        }
    });

    // Handle disconnection
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