const Device = require('../models/Device');
const User = require('../models/User');

// Register a new device - only allowed for sub_admins
exports.registerDevice = async (req, res) => {
    try {
        const { subAdminId, phoneNumber, model, sim } = req.body;

        // Verify that the requester is a sub_admin
        const user = await User.findById(subAdminId);
        if (!user || user.role !== 'sub_admin') {
            return res.status(403).json({ error: 'Only sub_admins can register devices' });
        }

        // Check if the device with the same phone number already exists
        const existingDevice = await Device.findOne({ phoneNumber });
        if (existingDevice) {
            return res.status(400).json({ error: 'Device with this phone number already exists' });
        }

        // Create the device associated with the sub_admin
        const device = new Device({
            phoneNumber,
            model,
            sim,
            userId: subAdminId, // Assign the sub_admin ID as the owner
            userIds: [] // Initialize with an empty array for user assignment
        });

        await device.save();
        res.status(201).json({ message: 'Device registered successfully', data: device });
    } catch (error) {
        console.error('Error in registerDevice:', error);
        res.status(500).json({ error: 'Failed to register device', details: error.message });
    }
};

// Assign device to one or multiple users under the same sub_admin
exports.assignDeviceToUser = async (req, res) => {
    try {
        const { subAdminId, deviceId, userIds } = req.body;

        // Verify that each user is under the specified sub_admin's account
        const users = await User.find({ _id: { $in: userIds }, subAdminId: subAdminId });
        if (users.length !== userIds.length) {
            return res.status(400).json({ error: 'Some users are not under the specified Sub Admin account' });
        }

        // Ensure the device belongs to the sub_admin
        const device = await Device.findOne({ _id: deviceId, userId: subAdminId });
        if (!device) {
            return res.status(400).json({ error: 'Device not found or not associated with the specified Sub Admin' });
        }

        // Add unique users to the device's userIds array
        userIds.forEach(userId => {
            if (!device.userIds.includes(userId)) {
                device.userIds.push(userId);
            }
        });

        await device.save();
        res.status(200).json({ message: 'Device assigned to users successfully', data: device });
    } catch (error) {
        console.error('Error in assignDeviceToUser:', error);
        res.status(500).json({ error: 'Failed to assign device to user(s)', details: error.message });
    }
};