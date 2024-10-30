// Import necessary modules
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const Device = require('./models/Device'); // Update with the correct path
const messageRoutes = require('./routes/messageRoutes');
const userRoutes = require('./routes/userRoutes');
const deviceRoutes = require('./routes/deviceRoutes');

// Load environment variables from .env file
dotenv.config();

// Initialize Express app
const app = express();

// Enable CORS
app.use(cors());

// Enable JSON body parsing (this line should come before routes)
app.use(express.json());

// Set up routes
app.use('/messages', messageRoutes);
app.use('/users', userRoutes);
app.use('/devices', deviceRoutes);

// Set up a basic HTTP server using the Express app
const server = http.createServer(app);

// Initialize Socket.IO with the server
const io = socketIo(server, {
    cors: {
        origin: "*",           // Allow all origins; modify based on your needs
        methods: ["GET", "POST"]
    }
});

// Middleware to attach io to the req object for access in controllers
app.use((req, res, next) => {
    req.io = io;
    next();
});

// WebSocket event for new connections
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    socket.emit('message', 'Welcome to the chat!');

    // Handle incoming messages and broadcast to all clients
    socket.on('message', (message) => {
        console.log('Message received on server:', message);
        io.emit('message', message); // Broadcast the message to all clients
    });

    // Handle private messages
    socket.on('private message', (message) => {
        console.log('Private message received on server:', message);
        io.to(message.to).emit('message', message); // Send message to specific client
    });

    // Device activity handling with validation
   // Device activity handling with validation
socket.on('deviceActivity', async (activity) => {
    try {
        // Check if `deviceId` is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(activity.deviceId)) {
            console.log('Invalid deviceId format:', activity.deviceId);
            socket.emit('error', { message: 'Invalid device ID format.' });
            return;
        }

        const device = await Device.findById(activity.deviceId);

        if (!device) {
            console.log('Device not registered:', activity.deviceId);
            socket.emit('error', { message: 'Device not registered in the system.' });
            return;
        }

        console.log('Device activity:', activity);
        io.emit('deviceActivity', activity); // Broadcast if device exists
    } catch (error) {
        console.error('Error checking device activity:', error.message);
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