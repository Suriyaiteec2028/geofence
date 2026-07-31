const mongoose = require('mongoose');

const phcSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true },
  address: { type: String, required: true },
  district: { type: String, required: true },
  latitude: { type: Number, default: 13.0827 },
  longitude: { type: Number, default: 80.2707 },
  radius: { type: Number, default: 150 }, // In meters
  assignedAdmin: { type: mongoose.Schema.Types.Mixed, default: null },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PHC', phcSchema);
