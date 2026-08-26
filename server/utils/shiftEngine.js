/**
 * Dynamic Shift & Checkpoint Calculation Engine
 * Parses 24h ("10:00", "22:00", "04:00") and 12h ("10:00 PM", "04:00 AM") time strings.
 * Full Support for Overnight Shifts Across Midnight (e.g. 10:00 PM to 04:00 AM).
 */

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
 * Generates list of checkpoints for a shift, including overnight shifts across midnight
 * @param {string} shiftStart e.g. "22:00" or "10:00 PM"
 * @param {string} shiftEnd e.g. "04:00" or "04:00 AM"
 * @param {number} intervalMinutes e.g. 60
 * @param {number} windowDurationMinutes e.g. 5
 * @param {Date} referenceDate Date object representing shift start date
 */
function generateShiftWindows(shiftStart = '09:00', shiftEnd = '17:00', intervalMinutes = 60, windowDurationMinutes = 5, referenceDate = new Date()) {
  const startMins = timeToMinutes(shiftStart);
  let endMins = timeToMinutes(shiftEnd);

  const isOvernight = endMins <= startMins;
  if (isOvernight) {
    endMins += 24 * 60; // Add 1440 mins (24h) for overnight shift
  }

  const windows = [];
  let currentCheckpointMins = startMins;

  // Base YYYY-MM-DD string
  const baseYear = referenceDate.getFullYear();
  const baseMonth = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const baseDay = String(referenceDate.getDate()).padStart(2, '0');
  const baseDateStr = `${baseYear}-${baseMonth}-${baseDay}`;

  while (currentCheckpointMins <= endMins) {
    const windowStartMins = currentCheckpointMins;
    const windowEndMins = currentCheckpointMins + windowDurationMinutes;

    // Check if checkpoint rolls over to next day
    const dayOffset = Math.floor(windowStartMins / (24 * 60));
    const winStartDateObj = new Date(referenceDate);
    winStartDateObj.setDate(winStartDateObj.getDate() + dayOffset);

    const startH = Math.floor((windowStartMins % (24 * 60)) / 60);
    const startM = windowStartMins % 60;
    winStartDateObj.setHours(startH, startM, 0, 0);

    const winEndDateObj = new Date(winStartDateObj.getTime() + windowDurationMinutes * 60 * 1000);

    const windowStartISO = winStartDateObj.toISOString();
    const windowEndISO = winEndDateObj.toISOString();

    const startFormatted = minutesToFormattedTime(windowStartMins);
    const endFormatted = minutesToFormattedTime(windowEndMins);

    windows.push({
      checkpointIndex: windows.length + 1,
      checkpointTime24: minutesTo24h(currentCheckpointMins),
      checkpointFormatted: startFormatted,
      windowStartMins,
      windowEndMins,
      windowStartFormatted: startFormatted,
      windowEndFormatted: endFormatted,
      windowStartISO,
      windowEndISO,
      windowLabel: `${startFormatted} – ${endFormatted}`
    });

    currentCheckpointMins += intervalMinutes;
  }

  return windows;
}

/**
 * Evaluates current doctor shift status against the current time
 * Supports Overnight Shifts (e.g. 10 PM to 4 AM) Across Midnight
 */
function evaluateCurrentShiftState(shiftStart = '09:00', shiftEnd = '17:00', intervalMinutes = 60, windowDurationMinutes = 5, now = new Date()) {
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentSec = now.getSeconds();
  const nowMins = currentHour * 60 + currentMin;

  const startMins = timeToMinutes(shiftStart);
  let endMins = timeToMinutes(shiftEnd);
  const isOvernight = endMins <= startMins;

  if (isOvernight) {
    endMins += 24 * 60;
  }

  // Adjust effectiveNowMins for overnight shift if current time is after midnight (early morning)
  let effectiveNowMins = nowMins;
  if (isOvernight && nowMins < startMins && nowMins <= (endMins - 24 * 60)) {
    effectiveNowMins = nowMins + 24 * 60;
  }

  // Reference date for shift start (if effectiveNowMins > 1440, shift started yesterday)
  const shiftRefDate = new Date(now);
  if (isOvernight && nowMins < startMins && nowMins <= (endMins - 24 * 60)) {
    shiftRefDate.setDate(shiftRefDate.getDate() - 1);
  }

  const windows = generateShiftWindows(shiftStart, shiftEnd, intervalMinutes, windowDurationMinutes, shiftRefDate);

  let activeWindow = null;
  let nextWindow = null;
  let secondsToNextWindow = null;
  let secondsRemainingInActiveWindow = null;

  for (let i = 0; i < windows.length; i++) {
    const w = windows[i];

    // Check if currently inside window
    if (effectiveNowMins >= w.windowStartMins && effectiveNowMins < w.windowEndMins) {
      activeWindow = w;
      const endSecs = w.windowEndMins * 60;
      const nowSecs = effectiveNowMins * 60 + currentSec;
      secondsRemainingInActiveWindow = Math.max(0, endSecs - nowSecs);
    }

    // Find next upcoming window
    if (w.windowStartMins > effectiveNowMins && (!nextWindow || w.windowStartMins < nextWindow.windowStartMins)) {
      nextWindow = w;
      const startSecs = w.windowStartMins * 60;
      const nowSecs = effectiveNowMins * 60 + currentSec;
      secondsToNextWindow = Math.max(0, startSecs - nowSecs);
    }
  }

  const isShiftCompleted = effectiveNowMins > (endMins + windowDurationMinutes);
  const isShiftStarted = effectiveNowMins >= startMins;

  return {
    nowFormatted: minutesToFormattedTime(nowMins),
    windows,
    activeWindow,
    nextWindow,
    secondsToNextWindow,
    secondsRemainingInActiveWindow,
    isWindowOpen: !!activeWindow,
    isShiftCompleted,
    isShiftStarted,
    isOvernight
  };
}

module.exports = {
  timeToMinutes,
  minutesToFormattedTime,
  generateShiftWindows,
  evaluateCurrentShiftState
};
