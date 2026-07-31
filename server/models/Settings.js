const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  checkpointIntervalMinutes: { type: Number, default: 60 },
  windowDurationMinutes: { type: Number, default: 5 },
  requireProofForExplanation: { type: Boolean, default: true },
  systemName: { type: String, default: 'Hospital Geofence Attendance System' },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Settings', settingsSchema);
