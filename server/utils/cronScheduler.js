const { memoryStore } = require('../config/db');
const { evaluateCurrentShiftState } = require('./shiftEngine');
const { sendHourlyCheckpointReminderEmail } = require('./emailService');

// Map to track sent reminders for today: "doctor_id:date:checkpointIndex" -> true
const sentRemindersMap = new Map();

function cleanOldReminders() {
  const todayStr = new Date().toISOString().split('T')[0];
  for (const [key] of sentRemindersMap.entries()) {
    if (!key.includes(todayStr)) {
      sentRemindersMap.delete(key);
    }
  }
}

function checkAndSendHourlyReminders() {
  try {
    cleanOldReminders();
    const todayStr = new Date().toISOString().split('T')[0];
    const intervalMins = memoryStore.settings.checkpointIntervalMinutes || 60;
    const windowMins = memoryStore.settings.windowDurationMinutes || 5;

    const doctors = memoryStore.users.filter(u => u.role === 'DOCTOR' && u.status === 'ACTIVE' && u.email);

    for (const doctor of doctors) {
      const phc = memoryStore.phcs.find(p => String(p._id) === String(doctor.assignedPHC));
      const phcName = phc ? phc.name : 'Primary Health Center';

      const shiftState = evaluateCurrentShiftState(
        doctor.shiftStart || '09:00',
        doctor.shiftEnd || '17:00',
        intervalMins,
        windowMins,
        new Date()
      );

      // If active checkpoint window is currently open!
      if (shiftState.isWindowOpen && shiftState.activeWindow) {
        const win = shiftState.activeWindow;
        const reminderKey = `${doctor._id}:${todayStr}:${win.checkpointIndex}`;

        // Ensure exactly ONE email reminder is sent per hourly checkpoint window
        if (!sentRemindersMap.has(reminderKey)) {
          sentRemindersMap.set(reminderKey, true);
          console.log(`⏰ Dispatching Hourly Duty Checkpoint #${win.checkpointIndex} Email Reminder to Dr. ${doctor.name} (${doctor.email})`);

          sendHourlyCheckpointReminderEmail({
            name: doctor.name,
            email: doctor.email,
            checkpointIndex: win.checkpointIndex,
            windowLabel: win.windowLabel,
            phcName
          });
        }
      }
    }
  } catch (err) {
    console.error('Error in hourly reminder scheduler:', err);
  }
}

function initCronScheduler() {
  console.log('⏰ Starting Automated Hourly Duty Checkpoint Email Scheduler...');
  // Run check every 1 minute using native Node.js timer
  setInterval(checkAndSendHourlyReminders, 60000);
}

module.exports = {
  initCronScheduler,
  checkAndSendHourlyReminders
};
