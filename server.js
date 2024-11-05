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
    socket.emit('message', 'Welcome to the chat!');

    // Handle incoming messages and broadcast to all clients
    socket.on('message', async (messageData) => {
        console.log('Message received on server:', messageData);

        // Save the message to the database with an initial status of 'sent'
        const message = new Message({
            sender: messageData.sender,
            receiver: messageData.receiver,
            content: messageData.content,
            status: 'sent',
            userId: messageData.userId,
            deviceId: messageData.deviceId
        });

        await message.save();

        // Emit the `messageSent` event to all clients
        io.emit('messageSent', { messageId: message._id, status: 'sent' });
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
                io.emit('messageStatusUpdate', { messageId, status: 'delivered' });
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
                io.emit('messageStatusUpdate', { messageId, status: 'read' });
            }
        } catch (error) {
            console.error('Error updating message to read:', error.message);
        }
    });

    // Device activity handling with validation
    socket.on('deviceActivity', async (activity) => {
        try {
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
            io.emit('deviceActivity', activity);
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