const bcrypt = require('bcryptjs');

async function getHashedPassword(plainText) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(plainText, salt);
}

async function getSeedData() {
  const cmoPassword = await getHashedPassword('Suriya@2006');

  // Default System CMO Account with requested login credentials:
  // Email/Username: suriyachandru2006@gmail.com
  // Password: Suriya@2006
  const users = [
    {
      _id: 'cmo_001',
      name: 'Chief Medical Officer (CMO)',
      email: 'suriyachandru2006@gmail.com',
      username: 'suriyachandru2006@gmail.com',
      password: cmoPassword,
      role: 'CMO',
      mobile: '+91 98765 43210',
      qualification: 'MBBS, MD (Healthcare Administration)',
      specialization: 'Chief Medical Officer & Healthcare Director',
      assignedPHC: null,
      shiftStart: '09:00',
      shiftEnd: '17:00',
      profilePhoto: '',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    }
  ];

  const phcs = [];
  const attendances = [];
  const explanations = [];
  const notifications = [];

  const settings = {
    checkpointIntervalMinutes: 60,
    windowDurationMinutes: 5,
    requireProofForExplanation: true,
    systemName: 'Hospital Geofence Attendance System'
  };

  return { phcs, users, attendances, explanations, settings, notifications };
}

module.exports = { getSeedData };
