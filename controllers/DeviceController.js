const Device = require('../models/Device');
const User = require('../models/User');

exports.assignDeviceToUser = async (req, res) => {
    try {
        const { subAdminId, deviceId, userId } = req.body;

        // Check that the user being assigned is under the Sub Admin’s account
        const user = await User.findOne({ _id: userId, subAdminId: subAdminId });
        if (!user) {
            return res.status(400).json({ error: 'User not found or not under the specified Sub Admin account' });
        }

        // Find the device and ensure it belongs to the Sub Admin
        const device = await Device.findOne({ _id: deviceId, userId: subAdminId });
        if (!device) {
            return res.status(400).json({ error: 'Device not found or not associated with the specified Sub Admin' });
        }

        // Add the user to the device's userIds array if not already assigned
        if (!device.userIds.includes(userId)) {
            device.userIds.push(userId);
            await device.save();
        }

        res.status(200).json({ message: 'Device assigned to user successfully', data: device });
    } catch (error) {
        console.error('Error in assignDeviceToUser:', error);
        res.status(500).json({ error: 'Failed to assign device to user', details: error.message });
    }
};