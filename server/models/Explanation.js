const mongoose = require('mongoose');

const explanationSchema = new mongoose.Schema({
  attendance: { type: mongoose.Schema.Types.Mixed, required: true },
  doctor: { type: mongoose.Schema.Types.Mixed, required: true },
  phc: { type: mongoose.Schema.Types.Mixed },
  reason: { type: String, required: true },
  remarks: { type: String, default: '' },
  proofUrl: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['PENDING', 'APPROVED', 'REJECTED'], 
    default: 'PENDING' 
  },
  reviewedBy: { type: mongoose.Schema.Types.Mixed },
  adminRemarks: { type: String, default: '' },
  reviewedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Explanation', explanationSchema);
