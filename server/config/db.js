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

// Sync MongoDB Atlas & Memory Store bidirectionally
async function syncMongoToMemory() {
  if (mongoose.connection.readyState !== 1) return;

  try {
    // 1. Push any local memory store items to MongoDB Atlas (upserting to ensure no data loss)
    for (const u of memoryStore.users) {
      await User.updateOne({ _id: u._id }, { $set: u }, { upsert: true });
    }
    for (const p of memoryStore.phcs) {
      await PHC.updateOne({ _id: p._id }, { $set: p }, { upsert: true });
    }
    for (const a of memoryStore.attendances) {
      await Attendance.updateOne({ _id: a._id }, { $set: a }, { upsert: true });
    }
    for (const e of memoryStore.explanations) {
      await Explanation.updateOne({ _id: e._id }, { $set: e }, { upsert: true });
    }

    // 2. Fetch all collections from MongoDB Atlas
    const mongoUsers = await User.find().lean();
    const mongoPhcs = await PHC.find().lean();
    const mongoAttendances = await Attendance.find().lean();
    const mongoExplanations = await Explanation.find().lean();
    const mongoNotifications = await Notification.find().lean();
    const mongoSettings = await Settings.findOne().lean();

    if (mongoUsers.length > 0) memoryStore.users = mongoUsers.map(u => ({ ...u, _id: u._id.toString() }));
    if (mongoPhcs.length > 0) memoryStore.phcs = mongoPhcs.map(p => ({ ...p, _id: p._id.toString() }));
    if (mongoAttendances.length > 0) memoryStore.attendances = mongoAttendances.map(a => ({ ...a, _id: a._id.toString() }));
    if (mongoExplanations.length > 0) memoryStore.explanations = mongoExplanations.map(e => ({ ...e, _id: e._id.toString() }));
    if (mongoNotifications.length > 0) memoryStore.notifications = mongoNotifications.map(n => ({ ...n, _id: n._id.toString() }));
    if (mongoSettings) memoryStore.settings = mongoSettings;

    saveMemoryStoreToDisk();
    console.log(`🟢 Bidirectional sync complete: ${memoryStore.users.length} Users, ${memoryStore.phcs.length} PHCs in database.`);
  } catch (err) {
    console.error('Error syncing MongoDB to memory store:', err.message);
  }
}

async function initDb() {
  let loadedFromDisk = false;

  // Step 1: Check if persistent data_store.json file exists on disk
  if (fs.existsSync(DATA_FILE_PATH)) {
    try {
      const rawData = fs.readFileSync(DATA_FILE_PATH, 'utf8');
      const parsed = JSON.parse(rawData);
      if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0) {
        memoryStore.users = parsed.users;
        memoryStore.phcs = parsed.phcs || [];
        memoryStore.attendances = parsed.attendances || [];
        memoryStore.explanations = parsed.explanations || [];
        memoryStore.settings = parsed.settings || {};
        memoryStore.notifications = parsed.notifications || [];
        loadedFromDisk = true;
        console.log(`📁 Loaded existing persistent database from disk: ${memoryStore.users.length} Users, ${memoryStore.phcs.length} PHCs.`);
      }
    } catch (diskErr) {
      console.warn('Notice reading data_store.json:', diskErr.message);
    }
  }

  // Step 2: Fall back to seed data only if disk file does not exist or is empty
  if (!loadedFromDisk) {
    const seed = await getSeedData();
    memoryStore.users = [...seed.users];
    memoryStore.phcs = [...seed.phcs];
    memoryStore.attendances = [...seed.attendances];
    memoryStore.explanations = [...seed.explanations];
    memoryStore.settings = { ...seed.settings };
    memoryStore.notifications = [...seed.notifications];
    saveMemoryStoreToDisk();
    console.log(`📁 Initialized fresh seed data state: ${memoryStore.users.length} Users, ${memoryStore.phcs.length} PHCs.`);
  }

  // Step 3: Connect to MongoDB Atlas and sync bidirectionally
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
