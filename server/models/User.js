const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  username: { type: String, required: true },
  password: { type: String, required: true },
  plainPassword: { type: String },
  role: { type: String, enum: ['CMO', 'ADMIN', 'DOCTOR'], required: true },
  gender: { type: String, enum: ['Male', 'Female'], default: 'Male' },
  mobile: { type: String, default: '' },
  qualification: { type: String, default: '' },
  specialization: { type: String, default: '' },
  assignedPHC: { type: mongoose.Schema.Types.Mixed, default: null },
  shiftStart: { type: String, default: '09:00' },
  shiftEnd: { type: String, default: '17:00' },
  profilePhoto: { type: String, default: '' },
  faceData: { type: String, default: '' }, // Legacy fallback
  faceAuthentication: {
    model: { type: String, default: 'FaceRecognitionNet' },
    embeddingDimension: { type: Number, default: 128 },
    embeddings: { type: [[Number]], default: [] }, // Array of 3-5 normalized 128D deep feature vectors
    version: { type: Number, default: 1 },
    updatedAt: { type: Date, default: Date.now }
  },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
