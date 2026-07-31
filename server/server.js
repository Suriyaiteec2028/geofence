const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./config/db');
const { initCronScheduler } = require('./utils/cronScheduler');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/doctors', require('./routes/doctorRoutes'));
app.use('/api/phcs', require('./routes/phcRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'Hospital Geofence Attendance Management System API',
    emailScheduler: 'ACTIVE',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend static build if client/dist exists or in production
const distPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
});

// Initialize database / memory store, launch hourly email cron scheduler, and launch server
initDb().then(() => {
  initCronScheduler();
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 HOSPITAL GEOFENCE ATTENDANCE SERVER ONLINE`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`📧 SENDER EMAIL: ${process.env.SMTP_USER || 'sn4194529@gmail.com'}`);
    console.log(`⏱️ HOURLY DUTY CHECKPOINT SCHEDULER: RUNNING (1-min ticker)`);
    console.log(`=======================================================`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});
