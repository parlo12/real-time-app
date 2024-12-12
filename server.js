// Import necessary modules
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const dotenv = require('dotenv');
const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser');
const Message = require('./models/Message'); // Message model
const User = require('./models/User'); // User model

// Load environment variables from .env file
dotenv.config();

// Initialize Express app for HTTP endpoints
const app = express();
app.use(bodyParser.json());

// Set up a basic HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with the server
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Map to track connected devices by API key
const connectedDevices = {};

// WebSocket connection handler
io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id} at ${new Date().toISOString()}`);

    // Authenticate using API key during connection
    socket.on('authenticate', async ({ apiKey, clientType }) => {
        try {
            const user = await User.findOne({ apiKey });
            if (!user) {
                console.error(`Authentication failed for client ${socket.id} with API key: ${apiKey}`);
                socket.emit('error', { message: 'Invalid API key' });
                socket.disconnect();
                return;
            }
            console.log(`User authenticated: ${user.email} (Client ID: ${socket.id}, Type: ${clientType})`);

            socket.user = user;
            socket.clientType = clientType;

            // Register device if client is an Android device
            if (clientType === 'device') {
                if (!connectedDevices[apiKey]) {
                    connectedDevices[apiKey] = [];
                }
                connectedDevices[apiKey].push(socket);
                console.log(`Device registered for API key: ${apiKey}`);
            }

            // Join the user's room for personalized messaging
            socket.join(user._id.toString());
        } catch (error) {
            console.error(`Authentication error for client ${socket.id}: ${error.message}`);
            socket.emit('error', { message: 'Authentication failed' });
        }
    });

    // Register device with phone number
    socket.on('registerDevice', async ({ phoneNumber }) => {
        if (!socket.user || socket.clientType !== 'device') {
            console.error(`Registration failed: Invalid client type (Client ID: ${socket.id})`);
            socket.emit('error', { message: 'Only devices can register phone numbers' });
            return;
        }

        try {
            console.log(`Device registered with phone number: ${phoneNumber} for user: ${socket.user.email}`);
            socket.devicePhoneNumber = phoneNumber; // Store it in the socket object
        } catch (error) {
            console.error(`Error registering device for client ${socket.id}: ${error.message}`);
            socket.emit('error', { message: 'Failed to register device' });
        }
    });

    // Handle message sending
    socket.on('sendMessage', async (messageData) => {
        try {
            if (!socket.user || socket.clientType !== 'crm') {
                socket.emit('error', { message: 'Only CRM clients can send messages' });
                return;
            }

            const deviceSockets = connectedDevices[socket.user.apiKey];
            if (!deviceSockets || deviceSockets.length === 0) {
                socket.emit('error', { message: 'No devices registered for this API key' });
                return;
            }

            // Forward the message to the first connected device
            const targetDevice = deviceSockets[0];
            targetDevice.emit('sendSms', messageData);

            console.log(`Message from CRM forwarded to device:`, messageData);
        } catch (error) {
            console.error(`Error sending message for client ${socket.id}: ${error.message}`);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Handle message replies
    socket.on('replyMessage', async (replyData) => {
        try {
            if (!socket.user || socket.clientType !== 'crm') {
                socket.emit('error', { message: 'Only CRM clients can send replies' });
                return;
            }

            const deviceSockets = connectedDevices[socket.user.apiKey];
            if (!deviceSockets || deviceSockets.length === 0) {
                socket.emit('error', { message: 'No devices registered for this API key' });
                return;
            }

            // Forward the reply to the device
            const targetDevice = deviceSockets[0];
            targetDevice.emit('replySms', replyData);

            console.log(`Reply from CRM forwarded to device:`, replyData);
        } catch (error) {
            console.error(`Error sending reply for client ${socket.id}: ${error.message}`);
            socket.emit('error', { message: 'Failed to send reply' });
        }
    });

    // Handle fetching pending messages
    socket.on('getPendingMessages', async () => {
        try {
            if (!socket.user) {
                socket.emit('error', { message: 'User not authenticated' });
                return;
            }

            const pendingMessages = await Message.find({ status: 'pending', receiver: socket.user._id });
            socket.emit('pendingMessages', pendingMessages);
            console.log(`Pending messages sent to user ${socket.user.email}`);
        } catch (error) {
            console.error(`Error retrieving pending messages for client ${socket.id}: ${error.message}`);
            socket.emit('error', { message: 'Failed to retrieve pending messages' });
        }
    });

    // Handle getAllMessages event
    socket.on('getAllMessages', async () => {
        try {
            if (!socket.user) {
                socket.emit('error', { message: 'User not authenticated' });
                return;
            }

            const messages = await Message.find({
                $or: [
                    { sender: socket.devicePhoneNumber }, // Messages sent by the device
                    { receiver: socket.devicePhoneNumber } // Messages received by the device
                ]
            });

            socket.emit('allMessages', messages);
            console.log(`All messages sent to user ${socket.user.email}`);
        } catch (error) {
            console.error(`Error retrieving all messages for client ${socket.id}: ${error.message}`);
            socket.emit('error', { message: 'Failed to retrieve all messages' });
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        if (socket.clientType === 'device' && socket.user) {
            const deviceSockets = connectedDevices[socket.user.apiKey];
            if (deviceSockets) {
                connectedDevices[socket.user.apiKey] = deviceSockets.filter((s) => s.id !== socket.id);
                console.log(`Device disconnected for API key: ${socket.user.apiKey}`);
            }
        }
    });
});

// HTTP Endpoint for user registration
app.post('/register', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Email already registered' });
        }

        const apiKey = crypto.randomBytes(32).toString('hex');

        const user = new User({ email, password, apiKey });
        await user.save();

        console.log(`User registered: ${email} with API key: ${apiKey}`);
        res.status(201).json({ message: 'User registered successfully', apiKey });
    } catch (error) {
        console.error('Error registering user:', error.message);
        res.status(500).json({ message: 'Failed to register user' });
    }
});

// Basic server route
app.get('/', (req, res) => {
    res.send('WebSocket API server is running');
});

// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`WebSocket server is running on port ${PORT}`);
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch((error) => {
        console.error('Error connecting to MongoDB:', error.message);
    });
