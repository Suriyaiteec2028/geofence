const bcrypt = require('bcryptjs');

async function getHashedPassword(plainText) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(plainText, salt);
}

async function getSeedData() {
  const masterCMOPassword = await getHashedPassword('Suriya@2006');
  const demoCMOPassword = await getHashedPassword('password@123');
  const demoAdminPassword = await getHashedPassword('password123');
  const demoDoctorPassword = await getHashedPassword('password123');

  const users = [
    {
      _id: 'cmo_master_001',
      name: 'Dr. Suriya N (Master CMO)',
      email: 'suriyachandru2006@gmail.com',
      username: 'suriyachandru2006@gmail.com',
      password: masterCMOPassword,
      plainPassword: 'Suriya@2006',
      role: 'CMO',
      gender: 'Male',
      mobile: '+91 98765 43210',
      qualification: 'MBBS, MD (Healthcare Administration)',
      specialization: 'Master Chief Medical Officer & Healthcare Director',
      assignedPHC: null,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    },
    {
      _id: 'cmo_demo_002',
      name: 'State Chief Medical Officer (Demo CMO)',
      email: 'cmo123@gmail.com',
      username: 'cmo123@gmail.com',
      password: demoCMOPassword,
      plainPassword: 'password@123',
      role: 'CMO',
      gender: 'Male',
      mobile: '+91 98765 43211',
      qualification: 'MBBS, MD (Public Health)',
      specialization: 'Chief Medical Officer',
      assignedPHC: null,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    },
    {
      _id: 'admin_demo_001',
      name: 'Dr. Central PHC Administrator',
      email: 'admin.central@hospital.gov.in',
      username: 'admin.central@hospital.gov.in',
      password: demoAdminPassword,
      plainPassword: 'password123',
      role: 'ADMIN',
      gender: 'Female',
      mobile: '+91 98765 43212',
      qualification: 'MBBS, MHA',
      specialization: 'Hospital Administrator',
      assignedPHC: 'phc_001',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    },
    {
      _id: 'doc_demo_001',
      name: 'Dr. Ranjith K (Medical Officer)',
      email: 'doctor@hospital.gov.in',
      username: 'doctor@hospital.gov.in',
      password: demoDoctorPassword,
      plainPassword: 'password123',
      role: 'DOCTOR',
      gender: 'Male',
      mobile: '+91 98765 43213',
      qualification: 'MBBS, MS (Surgery)',
      specialization: 'General Physician & Emergency Care',
      assignedPHC: 'phc_001',
      shiftStart: '10:00 PM',
      shiftEnd: '04:00 AM',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    }
  ];

  const phcs = [
    {
      _id: 'phc_001',
      name: 'City Care Hospital & Central PHC',
      code: 'PHC-THANJAVUR-01',
      address: '45, Health Care Road, Medical Nagar, Thanjavur, Tamil Nadu - 613007, India',
      district: 'Thanjavur',
      state: 'Tamil Nadu',
      pincode: '613007',
      latitude: 10.7870,
      longitude: 79.1378,
      radius: 200,
      assignedAdmin: 'admin_demo_001',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    }
  ];

  // Completely clean initial state for scratch testing!
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
