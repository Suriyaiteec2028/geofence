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
  // 1. Try loading persisted data from data_store.json
  let hasDiskData = false;
  if (fs.existsSync(DATA_FILE_PATH)) {
    try {
      const fileData = fs.readFileSync(DATA_FILE_PATH, 'utf8');
      const parsed = JSON.parse(fileData);
      if (parsed && Array.isArray(parsed.users)) {
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

  // 2. If no disk data exists, initialize from seed data
  if (!hasDiskData) {
    const seed = await getSeedData();
    memoryStore.users = [...seed.users];
    memoryStore.phcs = [...seed.phcs];
    memoryStore.attendances = [...seed.attendances];
    memoryStore.explanations = [...seed.explanations];
    memoryStore.settings = { ...seed.settings };
    memoryStore.notifications = [...seed.notifications];
    saveMemoryStoreToDisk();
  }

  // Ensure CMO user always exists with password Suriya@2006
  const cmoIndex = memoryStore.users.findIndex(u => u.role === 'CMO' || u.email === 'suriyachandru2006@gmail.com');
  if (cmoIndex === -1) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Suriya@2006', salt);
    memoryStore.users.unshift({
      _id: 'cmo_001',
      name: 'Chief Medical Officer (CMO)',
      email: 'suriyachandru2006@gmail.com',
      username: 'suriyachandru2006@gmail.com',
      password: hashedPassword,
      role: 'CMO',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    });
    saveMemoryStoreToDisk();
  }

  const mongoUri = process.env.MONGODB_URI;

  if (mongoUri) {
    try {
      console.log('Connecting to MongoDB database...');
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
      console.log('=======================================================');
      console.log('🟢 MongoDB Atlas Cloud Database Connected Successfully!');
      console.log('=======================================================');
      memoryStore.isInMemoryMode = false;

      // Upsert CMO user to MongoDB Atlas
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('Suriya@2006', salt);

      await User.findOneAndUpdate(
        { role: 'CMO' },
        {
          name: 'Chief Medical Officer (CMO)',
          email: 'suriyachandru2006@gmail.com',
          username: 'suriyachandru2006@gmail.com',
          password: hashedPassword,
          role: 'CMO',
          status: 'ACTIVE'
        },
        { upsert: true, new: true }
      );

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
