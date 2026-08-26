const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { getSeedData } = require('../utils/seedData');

// Mongoose Models
const User = require('../models/User');
const PHC = require('../models/PHC');
const Attendance = require('../models/Attendance');
const Explanation = require('../models/Explanation');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');

const DATA_FILE_PATH = path.join(__dirname, '../data_store.json');

// Dynamic Data Store
const memoryStore = {
  users: [],
  phcs: [],
  attendances: [],
  explanations: [],
  settings: {},
  notifications: [],
  isInMemoryMode: true
};

// Save memory store to local disk (data_store.json) for 100% persistence across restarts & logins
function saveMemoryStoreToDisk() {
  try {
    const dataToSave = {
      users: memoryStore.users,
      phcs: memoryStore.phcs,
      attendances: memoryStore.attendances,
      explanations: memoryStore.explanations,
      settings: memoryStore.settings,
      notifications: memoryStore.notifications
    };
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(dataToSave, null, 2), 'utf8');
    console.log('💾 Data store auto-persisted to disk successfully.');
  } catch (err) {
    console.error('Error saving data store to disk:', err.message);
  }
}

async function syncMongoToMemory() {
  try {
    const users = await User.find().lean();
    const phcs = await PHC.find().lean();
    const attendances = await Attendance.find().lean();
    const explanations = await Explanation.find().lean();
    const notifications = await Notification.find().lean();
    const settings = await Settings.findOne().lean();

    if (users.length > 0) memoryStore.users = users.map(u => ({ ...u, _id: u._id.toString() }));
    if (phcs.length > 0) memoryStore.phcs = phcs.map(p => ({ ...p, _id: p._id.toString() }));
    if (attendances.length > 0) memoryStore.attendances = attendances.map(a => ({ ...a, _id: a._id.toString() }));
    if (explanations.length > 0) memoryStore.explanations = explanations.map(e => ({ ...e, _id: e._id.toString() }));
    if (notifications.length > 0) memoryStore.notifications = notifications.map(n => ({ ...n, _id: n._id.toString() }));
    if (settings) memoryStore.settings = settings;

    saveMemoryStoreToDisk();
  } catch (err) {
    console.error('Error syncing MongoDB to memory store:', err.message);
  }
}

async function initDb() {
  const seed = await getSeedData();

  // 1. Load data from disk or seed data if empty
  let hasDiskData = false;
  if (fs.existsSync(DATA_FILE_PATH)) {
    try {
      const fileData = fs.readFileSync(DATA_FILE_PATH, 'utf8');
      const parsed = JSON.parse(fileData);
      if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0) {
        memoryStore.users = parsed.users;
        memoryStore.phcs = parsed.phcs || [];
        memoryStore.attendances = parsed.attendances || [];
        memoryStore.explanations = parsed.explanations || [];
        memoryStore.settings = parsed.settings || {};
        memoryStore.notifications = parsed.notifications || [];
        hasDiskData = true;
        console.log(`📁 Loaded persistent data from disk: ${memoryStore.users.length} Users, ${memoryStore.phcs.length} PHCs, ${memoryStore.attendances.length} Attendance Logs.`);
      }
    } catch (e) {
      console.warn('Error reading data_store.json, falling back to seed data.');
    }
  }

  if (!hasDiskData || memoryStore.users.length === 0) {
    memoryStore.users = [...seed.users];
    memoryStore.phcs = [...seed.phcs];
    memoryStore.attendances = [...seed.attendances];
    memoryStore.explanations = [...seed.explanations];
    memoryStore.settings = { ...seed.settings };
    memoryStore.notifications = [...seed.notifications];
  }

  // Ensure BOTH CMO users exist (suriyachandru2006@gmail.com / Suriya@2006 AND cmo123@gmail.com / password@123)
  const cmo1Index = memoryStore.users.findIndex(u => u.email === 'suriyachandru2006@gmail.com');
  if (cmo1Index === -1) {
    const pass1 = await bcrypt.hash('Suriya@2006', 10);
    memoryStore.users.unshift({
      _id: 'cmo_001',
      name: 'Dr. Suriya N (CMO)',
      email: 'suriyachandru2006@gmail.com',
      username: 'suriyachandru2006@gmail.com',
      password: pass1,
      plainPassword: 'Suriya@2006',
      role: 'CMO',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    });
  }

  const cmo2Index = memoryStore.users.findIndex(u => u.email === 'cmo123@gmail.com');
  if (cmo2Index === -1) {
    const pass2 = await bcrypt.hash('password@123', 10);
    memoryStore.users.unshift({
      _id: 'cmo_002',
      name: 'State Chief Medical Officer (CMO)',
      email: 'cmo123@gmail.com',
      username: 'cmo123@gmail.com',
      password: pass2,
      plainPassword: 'password@123',
      role: 'CMO',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    });
  }

  // Ensure default Admin user exists
  const adminIndex = memoryStore.users.findIndex(u => u.role === 'ADMIN');
  if (adminIndex === -1) {
    const passAdmin = await bcrypt.hash('password123', 10);
    memoryStore.users.push({
      _id: 'admin_001',
      name: 'Dr. Central PHC Administrator',
      email: 'admin.central@hospital.gov.in',
      username: 'admin.central@hospital.gov.in',
      password: passAdmin,
      plainPassword: 'password123',
      role: 'ADMIN',
      assignedPHC: 'phc_001',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    });
  }

  // Ensure default Doctor user exists
  const docIndex = memoryStore.users.findIndex(u => u.role === 'DOCTOR');
  if (docIndex === -1) {
    const passDoc = await bcrypt.hash('password123', 10);
    memoryStore.users.push({
      _id: 'doc_001',
      name: 'Dr. Ranjith K (Medical Officer)',
      email: 'doctor@hospital.gov.in',
      username: 'doctor@hospital.gov.in',
      password: passDoc,
      plainPassword: 'password123',
      role: 'DOCTOR',
      assignedPHC: 'phc_001',
      shiftStart: '10:00 PM',
      shiftEnd: '04:00 AM',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    });
  }

  // Ensure default PHC exists
  if (memoryStore.phcs.length === 0) {
    memoryStore.phcs = [...seed.phcs];
  }

  saveMemoryStoreToDisk();

  const mongoUri = process.env.MONGODB_URI;

  if (mongoUri) {
    try {
      console.log('Connecting to MongoDB database...');
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
      console.log('=======================================================');
      console.log('🟢 MongoDB Atlas Cloud Database Connected Successfully!');
      console.log('=======================================================');
      memoryStore.isInMemoryMode = false;
      await syncMongoToMemory();
    } catch (err) {
      console.warn('⚠️ MongoDB connection warning:', err.message);
      console.log('Running on resilient Persistent Disk Data Engine!');
      memoryStore.isInMemoryMode = true;
    }
  } else {
    console.log('Running on Persistent Disk Data Engine!');
    memoryStore.isInMemoryMode = true;
  }
}

module.exports = {
  initDb,
  memoryStore,
  saveMemoryStoreToDisk,
  syncMongoToMemory
};
