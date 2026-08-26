const { memoryStore, saveMemoryStoreToDisk } = require('../config/db');
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
    const now = new Date();
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
        now
      );

      // 1. Send Hourly Email Reminder & In-App Notification if Active Window is Currently Open
      if (shiftState.isWindowOpen && shiftState.activeWindow) {
        const win = shiftState.activeWindow;
        const reminderKey = `${doctor._id}:${todayStr}:${win.checkpointIndex}`;

        if (!sentRemindersMap.has(reminderKey)) {
          sentRemindersMap.set(reminderKey, true);
          console.log(`⏰ Dispatching Hourly Duty Checkpoint #${win.checkpointIndex} Email & Notification to Dr. ${doctor.name} (${doctor.email})`);

          // Live Email Dispatch to Doctor Inbox
          sendHourlyCheckpointReminderEmail({
            name: doctor.name,
            email: doctor.email,
            checkpointIndex: win.checkpointIndex,
            windowLabel: win.windowLabel,
            phcName
          });

          // In-App Notification Dispatch
          memoryStore.notifications.unshift({
            _id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            user: doctor._id,
            recipientEmail: doctor.email,
            targetRole: 'DOCTOR',
            title: `Duty Checkpoint #${win.checkpointIndex} Open ⏰`,
            message: `Your hourly duty attendance window (${win.windowLabel}) is now OPEN at ${phcName}. Please mark present with biometric face scan.`,
            type: 'WARNING',
            read: false,
            isRead: false,
            createdAt: new Date().toISOString()
          });
          saveMemoryStoreToDisk();
        }
      }

      // 2. Immediate ABSENT Auto-Marking for Closed Windows if Doctor didn't mark attendance
      for (const win of shiftState.windows) {
        const windowEndObj = new Date(win.windowEndISO);
        if (now > windowEndObj) {
          const existingAtt = memoryStore.attendances.find(a => 
            String(a.doctor) === String(doctor._id) && 
            a.date === todayStr && 
            (a.checkpointTime === win.windowStartFormatted || a.windowLabel === win.windowLabel)
          );

          if (!existingAtt) {
            // Immediately change status to ABSENT for missed window!
            const autoAbsent = {
              _id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
              doctor: doctor._id,
              phc: doctor.assignedPHC,
              date: todayStr,
              checkpointTime: win.windowStartFormatted,
              windowLabel: win.windowLabel,
              markedAt: null,
              status: 'ABSENT',
              withinGeofence: false,
              createdAt: new Date().toISOString()
            };
            memoryStore.attendances.push(autoAbsent);
            saveMemoryStoreToDisk();
            console.log(`❌ Immediate Auto-Absent Recorded: Dr. ${doctor.name} missed checkpoint ${win.windowLabel}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error in hourly reminder scheduler:', err);
  }
}

function initCronScheduler() {
  console.log('⏰ Starting Automated Duty Checkpoint & Auto-Absent Engine...');
  // Run check every 1 minute using native Node.js ticker
  setInterval(checkAndSendHourlyReminders, 60000);
}

module.exports = {
  initCronScheduler,
  checkAndSendHourlyReminders
};
