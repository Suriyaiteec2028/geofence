/**
 * Dynamic Shift & Checkpoint Calculation Engine
 * Parses 24h ("10:00", "22:00", "04:00") and 12h ("10:00 PM", "04:00 AM") time strings.
 * Full Support for Overnight Shifts Across Midnight (e.g. 10:00 PM to 04:00 AM).
 * Strict Asia/Kolkata (IST, UTC+5:30) Timezone Handling.
 */

// Convert any Date into an IST Date object (Asia/Kolkata - UTC+5:30)
function getISTDate(dateInput = new Date()) {
  const utc = dateInput.getTime() + dateInput.getTimezoneOffset() * 60000;
  const istOffset = 5.5 * 3600000; // +05:30 in ms
  return new Date(utc + istOffset);
}

// Format IST Date to YYYY-MM-DD
function getISTDateString(dateInput = new Date()) {
  const ist = getISTDate(dateInput);
  const year = ist.getFullYear();
  const month = String(ist.getMonth() + 1).padStart(2, '0');
  const day = String(ist.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to convert any time string ("11:15", "09:00 AM", "10:00 PM", "04:00 AM") into minutes from midnight
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  let str = String(timeStr).trim().toUpperCase();

  const isPM = str.includes('PM');
  const isAM = str.includes('AM');

  // Strip AM / PM suffixes
  str = str.replace('AM', '').replace('PM', '').trim();

  const parts = str.split(':');
  let hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;

  if (isPM && hours < 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
}

// Helper to convert minutes from midnight to clean 12h "HH:MM AM/PM" format
function minutesToFormattedTime(totalMinutes) {
  if (isNaN(totalMinutes) || totalMinutes === null || totalMinutes < 0) return '12:00 AM';

  const normalized = Math.floor(totalMinutes) % (24 * 60);
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;

  const period = hours24 >= 12 ? 'PM' : 'AM';
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;

  const padHours = hours12 < 10 ? `0${hours12}` : `${hours12}`;
  const padMins = mins < 10 ? `0${mins}` : `${mins}`;

  return `${padHours}:${padMins} ${period}`;
}

// Helper to convert minutes from midnight to "HH:MM" 24h string
function minutesTo24h(totalMinutes) {
  if (isNaN(totalMinutes) || totalMinutes < 0) return '00:00';
  const normalized = Math.floor(totalMinutes) % (24 * 60);
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const padHours = hours24 < 10 ? `0${hours24}` : `${hours24}`;
  const padMins = mins < 10 ? `0${mins}` : `${mins}`;
  return `${padHours}:${padMins}`;
}

/**
 * Generates list of checkpoints for a shift, including 5-minute pre-checkpoint reminder times
 * @param {string} shiftStart e.g. "14:00" or "02:00 PM"
 * @param {string} shiftEnd e.g. "22:00" or "10:00 PM"
 * @param {number} intervalMinutes e.g. 60
 * @param {number} windowDurationMinutes e.g. 5
 * @param {Date} referenceDate Date object representing shift start date in IST
 */
function generateShiftWindows(shiftStart = '09:00', shiftEnd = '17:00', intervalMinutes = 60, windowDurationMinutes = 5, referenceDate = new Date()) {
  const istRef = getISTDate(referenceDate);
  const startMins = timeToMinutes(shiftStart);
  let endMins = timeToMinutes(shiftEnd);

  const isOvernight = endMins <= startMins;
  if (isOvernight) {
    endMins += 24 * 60; // Add 1440 mins for overnight shift
  }

  const windows = [];
  let currentCheckpointMins = startMins;

  while (currentCheckpointMins <= endMins) {
    const windowStartMins = currentCheckpointMins;
    const windowEndMins = currentCheckpointMins + windowDurationMinutes;
    
    // Reminder is ALWAYS 5 Minutes BEFORE the Checkpoint!
    const reminderMins = currentCheckpointMins - 5;

    const startFormatted = minutesToFormattedTime(windowStartMins);
    const endFormatted = minutesToFormattedTime(windowEndMins);
    const reminderFormatted = minutesToFormattedTime(reminderMins);

    windows.push({
      checkpointIndex: windows.length + 1,
      checkpointTime24: minutesTo24h(currentCheckpointMins),
      checkpointFormatted: startFormatted,
      windowStartMins,
      windowEndMins,
      reminderMins,
      reminderFormatted,
      windowStartFormatted: startFormatted,
      windowEndFormatted: endFormatted,
      windowLabel: `${startFormatted} – ${endFormatted}`
    });

    currentCheckpointMins += intervalMinutes;
  }

  return windows;
}

/**
 * Evaluates current doctor shift status against IST current time
 */
function evaluateCurrentShiftState(shiftStart = '09:00', shiftEnd = '17:00', intervalMinutes = 60, windowDurationMinutes = 5, nowInput = new Date()) {
  const istNow = getISTDate(nowInput);
  const currentHour = istNow.getHours();
  const currentMin = istNow.getMinutes();
  const currentSec = istNow.getSeconds();
  const nowMins = currentHour * 60 + currentMin;

  const startMins = timeToMinutes(shiftStart);
  let endMins = timeToMinutes(shiftEnd);
  const isOvernight = endMins <= startMins;

  if (isOvernight) {
    endMins += 24 * 60;
  }

  let effectiveNowMins = nowMins;
  if (isOvernight && nowMins < startMins && nowMins <= (endMins - 24 * 60)) {
    effectiveNowMins = nowMins + 24 * 60;
  }

  const shiftRefDate = new Date(istNow);
  if (isOvernight && nowMins < startMins && nowMins <= (endMins - 24 * 60)) {
    shiftRefDate.setDate(shiftRefDate.getDate() - 1);
  }

  const windows = generateShiftWindows(shiftStart, shiftEnd, intervalMinutes, windowDurationMinutes, shiftRefDate);

  let activeWindow = null;
  let nextWindow = null;
  let dueReminderWindow = null;

  for (let i = 0; i < windows.length; i++) {
    const w = windows[i];

    // Check if currently inside 5-minute checkpoint window
    if (effectiveNowMins >= w.windowStartMins && effectiveNowMins < w.windowEndMins) {
      activeWindow = w;
    }

    // Check if current time matches the 5-Minute Pre-Checkpoint Reminder Window (reminderMins <= effectiveNowMins < windowStartMins)
    if (effectiveNowMins >= w.reminderMins && effectiveNowMins < w.windowStartMins) {
      dueReminderWindow = w;
    }

    // Find next upcoming checkpoint
    if (w.windowStartMins > effectiveNowMins && (!nextWindow || w.windowStartMins < nextWindow.windowStartMins)) {
      nextWindow = w;
    }
  }

  const isShiftCompleted = effectiveNowMins >= (endMins + windowDurationMinutes);
  const isShiftStarted = effectiveNowMins >= startMins;

  const effectiveNowSecs = effectiveNowMins * 60 + currentSec;
  let secondsRemainingInActiveWindow = null;
  if (activeWindow) {
    const activeEndSecs = activeWindow.windowEndMins * 60;
    secondsRemainingInActiveWindow = Math.max(0, activeEndSecs - effectiveNowSecs);
  }

  let secondsToNextWindow = null;
  if (nextWindow) {
    const nextStartSecs = nextWindow.windowStartMins * 60;
    secondsToNextWindow = Math.max(0, nextStartSecs - effectiveNowSecs);
  }

  return {
    istNowFormatted: minutesToFormattedTime(nowMins),
    istDateStr: getISTDateString(nowInput),
    windows,
    activeWindow,
    nextWindow,
    dueReminderWindow,
    isWindowOpen: !!activeWindow,
    secondsRemainingInActiveWindow,
    secondsToNextWindow,
    isShiftCompleted,
    isShiftStarted,
    isOvernight
  };
}

module.exports = {
  getISTDate,
  getISTDateString,
  timeToMinutes,
  minutesToFormattedTime,
  generateShiftWindows,
  evaluateCurrentShiftState
};
