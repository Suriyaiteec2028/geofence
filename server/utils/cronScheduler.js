const { memoryStore, saveMemoryStoreToDisk } = require('../config/db');
const { evaluateCurrentShiftState, getISTDate, getISTDateString, minutesToFormattedTime } = require('./shiftEngine');
const { sendHourlyCheckpointReminderEmail } = require('./emailService');

// In-Memory map to track sent reminders for today: "doctor_id:date:checkpointTime" -> true
const sentRemindersMap = new Map();

// Clean up old reminder records from previous days
function cleanOldReminders() {
  const todayStr = getISTDateString();
  for (const [key] of sentRemindersMap.entries()) {
    if (!key.includes(todayStr)) {
      sentRemindersMap.delete(key);
    }
  }
}

// Clear reminders for a specific doctor if profile is updated
function clearRemindersForDoctor(doctorId) {
  if (!doctorId) return;
  for (const [key] of sentRemindersMap.entries()) {
    if (key.startsWith(`${doctorId}:`)) {
      sentRemindersMap.delete(key);
    }
  }
}

/**
 * Server-Side Backend Automated Duty Reminder Ticker
 * Evaluates active doctor duty schedules in Asia/Kolkata (IST)
 * Dispatches reminder email exactly 5 minutes BEFORE every hourly checkpoint (checkpoint - 5 min).
 * Idempotent: Ensures EXACTLY ONE reminder email is sent per doctor + date + checkpoint.
 */
function checkAndSendHourlyReminders() {
  try {
    cleanOldReminders();
    const istNow = getISTDate();
    const todayStr = getISTDateString(istNow);
    const currentHour = istNow.getHours();
    const currentMin = istNow.getMinutes();
    const currentTotalMins = currentHour * 60 + currentMin;
    const nowFormatted = minutesToFormattedTime(currentTotalMins);

    const intervalMins = memoryStore.settings.checkpointIntervalMinutes || 60;
    const windowMins = memoryStore.settings.windowDurationMinutes || 5;

    // Filter ONLY ACTIVE registered doctors currently present in data store
    const doctors = memoryStore.users.filter(u => u.role === 'DOCTOR' && u.status === 'ACTIVE' && u.email);

    for (const doctor of doctors) {
      const phc = memoryStore.phcs.find(p => String(p._id) === String(doctor.assignedPHC));
      const phcName = phc ? phc.name : 'Primary Health Center';

      const shiftState = evaluateCurrentShiftState(
        doctor.shiftStart || '09:00',
        doctor.shiftEnd || '17:00',
        intervalMins,
        windowMins,
        istNow
      );

      // 1. Check Every Hourly Checkpoint Window for 5-Minute Pre-Reminder Time
      for (const win of shiftState.windows) {
        // Reminder trigger condition: current time has reached or passed reminderMins (checkpoint - 5 min)
        // AND current time is still before or inside the checkpoint window (effectiveNowMins < windowEndMins)
        const isReminderTimeWindow = currentTotalMins >= win.reminderMins && currentTotalMins < win.windowEndMins;

        if (isReminderTimeWindow) {
          const reminderKey = `${doctor._id}:${todayStr}:${win.checkpointFormatted}`;

          // Check if reminder was already recorded in memory map OR database store
          const alreadyInDb = (memoryStore.notifications || []).some(n => 
            String(n.user) === String(doctor._id) && 
            n.type === 'DUTY_REMINDER' && 
            n.checkpointTime === win.checkpointFormatted && 
            n.dutyDate === todayStr
          );

          if (!sentRemindersMap.has(reminderKey) && !alreadyInDb) {
            sentRemindersMap.set(reminderKey, true);

            console.log(`[DOCTOR-DUTY-REMINDER] Current IST time: ${nowFormatted}`);
            console.log(`[DOCTOR-DUTY-REMINDER] Active Doctor: Dr. ${doctor.name} (${doctor.email})`);
            console.log(`[DOCTOR-DUTY-REMINDER] Duty Schedule: ${doctor.shiftStart} - ${doctor.shiftEnd}`);
            console.log(`[DOCTOR-DUTY-REMINDER] Upcoming Checkpoint: ${win.checkpointFormatted}`);
            console.log(`[DOCTOR-DUTY-REMINDER] Scheduled Reminder Time: ${win.reminderFormatted}`);
            console.log(`[DOCTOR-DUTY-REMINDER] Sending 5-minute pre-checkpoint reminder email to ${doctor.email}...`);

            // Dispatch Email to Doctor's Registered Email Address
            sendHourlyCheckpointReminderEmail({
              name: doctor.name,
              email: doctor.email,
              checkpointTime: win.checkpointFormatted,
              reminderTime: win.reminderFormatted,
              dutyDate: todayStr,
              shiftLabel: `${doctor.shiftStart} – ${doctor.shiftEnd}`,
              phcName
            });

            // Store Idempotent Reminder Record in Database Store
            const reminderNotif = {
              _id: 'notif_rem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              user: doctor._id,
              recipientEmail: doctor.email,
              targetRole: 'DOCTOR',
              title: `Duty Checkpoint Reminder: ${win.checkpointFormatted} ⏰`,
              message: `Your duty checkpoint opens in 5 minutes at ${win.checkpointFormatted}. Please complete biometric face scan & geofence verification at ${phcName}.`,
              type: 'DUTY_REMINDER',
              checkpointTime: win.checkpointFormatted,
              reminderTime: win.reminderFormatted,
              dutyDate: todayStr,
              status: 'SENT',
              sentAt: new Date().toISOString(),
              read: false,
              isRead: false,
              createdAt: new Date().toISOString()
            };

            memoryStore.notifications.unshift(reminderNotif);
            saveMemoryStoreToDisk();

            console.log(`[DOCTOR-DUTY-REMINDER] Duty reminder sent successfully to ${doctor.email}`);
          }
        }
      }

      // 2. Immediate Auto-Absent Record for Closed Checkpoint Windows
      for (const win of shiftState.windows) {
        const windowEndObj = new Date(win.windowEndISO);
        if (istNow > windowEndObj) {
          const existingAtt = memoryStore.attendances.find(a => 
            String(a.doctor) === String(doctor._id) && 
            (a.date === todayStr || a.checkpointTime === win.windowStartFormatted) && 
            (a.checkpointTime === win.windowStartFormatted || a.windowLabel === win.windowLabel)
          );

          if (!existingAtt) {
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
    console.error('[DOCTOR-DUTY-REMINDER] Error in backend reminder scheduler:', err);
  }
}

/**
 * Immediate Development & Testing Helper
 * Evaluates and dispatches reminder for a target doctor immediately regardless of current minute
 */
async function triggerImmediateReminderTest(doctorId = null) {
  const istNow = getISTDate();
  const todayStr = getISTDateString(istNow);
  const intervalMins = memoryStore.settings.checkpointIntervalMinutes || 60;
  const windowMins = memoryStore.settings.windowDurationMinutes || 5;

  let doctors = memoryStore.users.filter(u => u.role === 'DOCTOR' && u.status === 'ACTIVE' && u.email);
  if (doctorId) {
    doctors = doctors.filter(u => String(u._id) === String(doctorId));
  }

  const results = [];

  for (const doctor of doctors) {
    const phc = memoryStore.phcs.find(p => String(p._id) === String(doctor.assignedPHC));
    const phcName = phc ? phc.name : 'Primary Health Center';

    const shiftState = evaluateCurrentShiftState(
      doctor.shiftStart || '09:00',
      doctor.shiftEnd || '17:00',
      intervalMins,
      windowMins,
      istNow
    );

    const nextOrActiveWin = shiftState.dueReminderWindow || shiftState.nextWindow || shiftState.windows[0];
    const checkpointTime = nextOrActiveWin ? nextOrActiveWin.checkpointFormatted : '02:00 PM';
    const reminderTime = nextOrActiveWin ? nextOrActiveWin.reminderFormatted : '01:55 PM';

    console.log(`[DOCTOR-DUTY-REMINDER] TEST DISPATCH -> Dr. ${doctor.name} (${doctor.email}) for Checkpoint ${checkpointTime}`);

    await sendHourlyCheckpointReminderEmail({
      name: doctor.name,
      email: doctor.email,
      checkpointTime,
      reminderTime,
      dutyDate: todayStr,
      shiftLabel: `${doctor.shiftStart} – ${doctor.shiftEnd}`,
      phcName
    });

    const testNotif = {
      _id: 'notif_rem_test_' + Date.now(),
      user: doctor._id,
      recipientEmail: doctor.email,
      targetRole: 'DOCTOR',
      title: `Duty Checkpoint Reminder: ${checkpointTime} (TEST) ⏰`,
      message: `TEST REMINDER: Your duty checkpoint opens in 5 minutes at ${checkpointTime}. Please complete biometric face scan & geofence verification at ${phcName}.`,
      type: 'DUTY_REMINDER',
      checkpointTime,
      reminderTime,
      dutyDate: todayStr,
      status: 'SENT',
      sentAt: new Date().toISOString(),
      read: false,
      isRead: false,
      createdAt: new Date().toISOString()
    };

    memoryStore.notifications.unshift(testNotif);
    saveMemoryStoreToDisk();

    results.push({
      doctorName: doctor.name,
      doctorEmail: doctor.email,
      shift: `${doctor.shiftStart} - ${doctor.shiftEnd}`,
      checkpointTime,
      reminderTime,
      status: 'SENT',
      dispatchedAt: new Date().toISOString()
    });
  }

  return results;
}

function initCronScheduler() {
  console.log('⏰ Starting Automated Server-Side Duty Checkpoint & 5-Minute Reminder Engine...');
  // Run background check every 60 seconds on server
  setInterval(checkAndSendHourlyReminders, 60000);
}

module.exports = {
  initCronScheduler,
  checkAndSendHourlyReminders,
  triggerImmediateReminderTest,
  clearRemindersForDoctor
};
