const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  doctor: { type: mongoose.Schema.Types.Mixed, required: true },
  phc: { type: mongoose.Schema.Types.Mixed, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  checkpointTime: { type: String, required: true }, // e.g. "11:15 AM"
  windowLabel: { type: String }, // e.g. "11:15 AM - 11:20 AM"
  markedAt: { type: Date },
  status: { 
    type: String, 
    enum: ['PRESENT', 'ABSENT', 'PENDING_EXPLANATION', 'EXPLANATION_APPROVED', 'EXPLANATION_REJECTED'], 
    default: 'ABSENT' 
  },
  latitude: { type: Number },
  longitude: { type: Number },
  distanceMeters: { type: Number },
  withinGeofence: { type: Boolean, default: false },
  explanation: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
