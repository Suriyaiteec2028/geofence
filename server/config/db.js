const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { getSeedData } = require('../utils/seedData');

// Mongoose Models
const User = require('../models/User');
const PHC = require('../models/PHC');
const Attendance = require('../models/Attendance');
const Explanation = require('../models/Explanation');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');

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

async function syncMongoToMemory() {
  try {
    const users = await User.find().lean();
    const phcs = await PHC.find().lean();
    const attendances = await Attendance.find().lean();
    const explanations = await Explanation.find().lean();
    const notifications = await Notification.find().lean();
    const settings = await Settings.findOne().lean();

    memoryStore.users = users.map(u => ({ ...u, _id: u._id.toString() }));
    memoryStore.phcs = phcs.map(p => ({ ...p, _id: p._id.toString() }));
    memoryStore.attendances = attendances.map(a => ({ ...a, _id: a._id.toString() }));
    memoryStore.explanations = explanations.map(e => ({ ...e, _id: e._id.toString() }));
    memoryStore.notifications = notifications.map(n => ({ ...n, _id: n._id.toString() }));
    if (settings) memoryStore.settings = settings;
  } catch (err) {
    console.error('Error syncing MongoDB to memory store:', err.message);
  }
}

async function initDb() {
  const seed = await getSeedData();
  memoryStore.users = [...seed.users];
  memoryStore.phcs = [...seed.phcs];
  memoryStore.attendances = [...seed.attendances];
  memoryStore.explanations = [...seed.explanations];
  memoryStore.settings = { ...seed.settings };
  memoryStore.notifications = [...seed.notifications];

  const mongoUri = process.env.MONGODB_URI;

  if (mongoUri) {
    try {
      console.log('Connecting to MongoDB database...');
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
      console.log('=======================================================');
      console.log('🟢 MongoDB Atlas Cloud Database Connected Successfully!');
      console.log('=======================================================');
      memoryStore.isInMemoryMode = false;

      // Upsert CMO user to guarantee suriyachandru2006@gmail.com always exists with password Suriya@2006
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
      console.log('Fallback: Running on resilient High-Performance In-Memory Data Engine!');
      memoryStore.isInMemoryMode = true;
    }
  } else {
    console.log('No MONGODB_URI found in .env. Running on In-Memory Engine!');
    memoryStore.isInMemoryMode = true;
  }
}

module.exports = {
  initDb,
  memoryStore,
  syncMongoToMemory
};
