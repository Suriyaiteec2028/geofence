/**
 * Dynamic Shift & Checkpoint Calculation Engine
 * Robustly parses both 24h ("11:15", "16:15") and 12h ("11:15 AM", "04:15 PM") time strings.
 */

// Helper to convert any time string ("11:15", "09:00 AM", "04:15 PM", "16:15") into minutes from midnight
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
 * Generates list of checkpoints for a shift
 * @param {string} shiftStart e.g. "09:00" or "09:00 AM"
 * @param {string} shiftEnd e.g. "17:00" or "05:00 PM"
 * @param {number} intervalMinutes e.g. 60
 * @param {number} windowDurationMinutes e.g. 5
 */
function generateShiftWindows(shiftStart = '09:00', shiftEnd = '17:00', intervalMinutes = 60, windowDurationMinutes = 5) {
  const startMins = timeToMinutes(shiftStart);
  let endMins = timeToMinutes(shiftEnd);
  
  // Handle overnight shift if end <= start
  if (endMins <= startMins) {
    endMins += 24 * 60;
  }

  const windows = [];
  let currentCheckpointMins = startMins;

  while (currentCheckpointMins <= endMins) {
    const windowStartMins = currentCheckpointMins;
    const windowEndMins = currentCheckpointMins + windowDurationMinutes;

    windows.push({
      checkpointIndex: windows.length + 1,
      checkpointTime24: minutesTo24h(currentCheckpointMins),
      checkpointFormatted: minutesToFormattedTime(currentCheckpointMins),
      windowStartMins,
      windowEndMins,
      windowStartFormatted: minutesToFormattedTime(windowStartMins),
      windowEndFormatted: minutesToFormattedTime(windowEndMins),
      windowLabel: `${minutesToFormattedTime(windowStartMins)} – ${minutesToFormattedTime(windowEndMins)}`
    });

    currentCheckpointMins += intervalMinutes;
  }

  return windows;
}

/**
 * Evaluates current doctor shift status against the current time
 */
function evaluateCurrentShiftState(shiftStart = '09:00', shiftEnd = '17:00', intervalMinutes = 60, windowDurationMinutes = 5, now = new Date()) {
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentSec = now.getSeconds();
  const nowMins = currentHour * 60 + currentMin;

  const windows = generateShiftWindows(shiftStart, shiftEnd, intervalMinutes, windowDurationMinutes);

  let activeWindow = null;
  let nextWindow = null;
  let secondsToNextWindow = null;
  let secondsRemainingInActiveWindow = null;

  for (let i = 0; i < windows.length; i++) {
    const w = windows[i];

    // Check if currently inside window
    if (nowMins >= w.windowStartMins && nowMins < w.windowEndMins) {
      activeWindow = w;
      const endSecs = w.windowEndMins * 60;
      const nowSecs = nowMins * 60 + currentSec;
      secondsRemainingInActiveWindow = Math.max(0, endSecs - nowSecs);
    }

    // Find next upcoming window
    if (w.windowStartMins > nowMins && (!nextWindow || w.windowStartMins < nextWindow.windowStartMins)) {
      nextWindow = w;
      const startSecs = w.windowStartMins * 60;
      const nowSecs = nowMins * 60 + currentSec;
      secondsToNextWindow = Math.max(0, startSecs - nowSecs);
    }
  }

  const shiftEndMins = timeToMinutes(shiftEnd);
  const isShiftCompleted = nowMins > (shiftEndMins + windowDurationMinutes);
  const isShiftStarted = nowMins >= timeToMinutes(shiftStart);

  return {
    nowFormatted: minutesToFormattedTime(nowMins),
    windows,
    activeWindow,
    nextWindow,
    secondsToNextWindow,
    secondsRemainingInActiveWindow,
    isWindowOpen: !!activeWindow,
    isShiftCompleted,
    isShiftStarted
  };
}

module.exports = {
  timeToMinutes,
  minutesToFormattedTime,
  generateShiftWindows,
  evaluateCurrentShiftState
};
