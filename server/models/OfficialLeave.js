const mongoose = require('mongoose');

const officialLeaveSchema = new mongoose.Schema({
  doctor: { type: mongoose.Schema.Types.Mixed, required: true },
  phc: { type: mongoose.Schema.Types.Mixed },
  startDate: { type: String, required: true }, // YYYY-MM-DD
  endDate: { type: String, required: true },   // YYYY-MM-DD (inclusive)
  leaveNote: { type: String, default: '' },
  evidenceUrl: { type: String, default: '' },
  grantedBy: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['ACTIVE', 'CANCELLED'], default: 'ACTIVE' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('OfficialLeave', officialLeaveSchema);
