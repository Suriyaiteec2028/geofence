const { memoryStore, saveMemoryStoreToDisk } = require('../config/db');
const { calculateHaversineDistance } = require('../utils/haversine');
const { evaluateCurrentShiftState } = require('../utils/shiftEngine');
const { logAuditEvent } = require('../utils/auditLogger');

// Calculates deadline as 12:00 AM at the beginning of the third calendar day after the missed attendance date in IST (+05:30)
function getExplanationDeadline(missedDateStr) {
  const [y, m, d] = missedDateStr.split('-').map(Number);
  const temp = new Date(Date.UTC(y, m - 1, d + 3, 0, 0, 0, 0));
  const deadlineYear = temp.getUTCFullYear();
  const deadlineMonth = String(temp.getUTCMonth() + 1).padStart(2, '0');
  const deadlineDay = String(temp.getUTCDate()).padStart(2, '0');
  const deadlineISO = `${deadlineYear}-${deadlineMonth}-${deadlineDay}T00:00:00+05:30`;
  const deadlineObj = new Date(deadlineISO);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const formattedText = `${temp.getUTCDate()} ${monthNames[temp.getUTCMonth()]} ${deadlineYear}, 12:00 AM`;

  return {
    deadlineObj,
    deadlineISO,
    deadlineFormatted: formattedText
  };
}

function formatDeadlineString(deadline) {
  if (deadline && deadline.deadlineFormatted) return deadline.deadlineFormatted;
  if (deadline instanceof Date) {
    const day = String(deadline.getDate()).padStart(2, '0');
    const month = deadline.toLocaleString('en-IN', { month: 'short' });
    const year = deadline.getFullYear();
    return `${day} ${month} ${year}, 12:00 AM`;
  }
  return '';
}

exports.getDoctorShiftStatus = (req, res) => {
  try {
    const doctorId = req.user.id;
    const userEmail = req.user.email;

    const doctor = memoryStore.users.find(u => 
      String(u._id) === String(doctorId) || 
      (userEmail && u.email.toLowerCase() === userEmail.toLowerCase())
    );

    if (!doctor || doctor.role !== 'DOCTOR') {
      return res.status(404).json({ success: false, message: 'Doctor account not found' });
    }

    const phc = memoryStore.phcs.find(p => 
      String(p._id) === String(doctor.assignedPHC)
    );

    const intervalMins = memoryStore.settings.checkpointIntervalMinutes || 60;
    const windowMins = memoryStore.settings.windowDurationMinutes || 5;

    const shiftState = evaluateCurrentShiftState(
      doctor.shiftStart || '09:00',
      doctor.shiftEnd || '17:00',
      intervalMins,
      windowMins,
      new Date()
    );

    const todayStr = new Date().toISOString().split('T')[0];
    const todayAttendances = memoryStore.attendances.filter(a => 
      String(a.doctor) === String(doctor._id) && a.date === todayStr
    );

    res.json({
      success: true,
      doctor: {
        _id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        shiftStart: doctor.shiftStart,
        shiftEnd: doctor.shiftEnd,
        faceEnrolled: !!doctor.faceData
      },
      phc: phc ? {
        _id: phc._id,
        name: phc.name,
        address: phc.address,
        district: phc.district,
        latitude: phc.latitude,
        longitude: phc.longitude,
        radius: phc.radius
      } : null,
      phcLatitude: phc ? phc.latitude : null,
      phcLongitude: phc ? phc.longitude : null,
      phcRadius: phc ? phc.radius : null,
      phcCoordinatesSet: phc ? !!(phc.latitude && phc.longitude && phc.latitude !== 13.0827) : false,
      shiftState,
      todayAttendances
    });

  } catch (err) {
    console.error('Error fetching shift status:', err);
    res.status(500).json({ success: false, message: 'Server error calculating shift status' });
  }
};

// Get Doctor Shift Windows for Selected Date (STRICT 3-DAY RULE & PAST MISSED WINDOWS SELECTION)
exports.getDoctorDateWindows = (req, res) => {
  try {
    const doctorId = req.user.id;
    const { date } = req.query; // YYYY-MM-DD
    const nowObj = new Date();
    const todayStr = nowObj.toISOString().split('T')[0];
    const targetDate = date || todayStr;

    const doctor = memoryStore.users.find(u => String(u._id) === String(doctorId));
    if (!doctor || doctor.role !== 'DOCTOR') {
      return res.status(404).json({ success: false, message: 'Doctor account not found' });
    }

    // Leave coverage check
    const activeLeave = (memoryStore.leaves || []).find(l =>
      String(l.doctor) === String(doctorId) &&
      l.status === 'ACTIVE' &&
      l.startDate <= targetDate &&
      l.endDate >= targetDate
    );
    const isOnLeave = !!activeLeave;
    const leaveNote = activeLeave?.leaveNote || '';

    const intervalMins = memoryStore.settings.checkpointIntervalMinutes || 60;
    const windowMins = memoryStore.settings.windowDurationMinutes || 5;

    const shiftState = evaluateCurrentShiftState(
      doctor.shiftStart || '09:00',
      doctor.shiftEnd || '17:00',
      intervalMins,
      windowMins,
      new Date(targetDate + 'T12:00:00')
    );

    const dateAttendances = memoryStore.attendances.filter(a => 
      String(a.doctor) === String(doctorId) && a.date === targetDate
    );

    const { deadlineObj, deadlineISO, deadlineFormatted } = getExplanationDeadline(targetDate);
    const isDeadlinePassed = nowObj.getTime() >= deadlineObj.getTime();
    const docCreatedObj = new Date(doctor.createdAt);
    const doctorActiveDateStr = docCreatedObj.toISOString().split('T')[0];
    const isBeforeAccountCreation = targetDate < doctorActiveDateStr;
    const isExpired = isDeadlinePassed || isBeforeAccountCreation;

    // Minimum allowed date is 2 days before today (since 3 days before expired at 12:00 AM)
    const minAllowedDateObj = new Date(nowObj);
    minAllowedDateObj.setDate(nowObj.getDate() - 2);
    minAllowedDateObj.setHours(0, 0, 0, 0);
    const minAllowedDateStr = (docCreatedObj > minAllowedDateObj ? docCreatedObj : minAllowedDateObj).toISOString().split('T')[0];

    // RULE 2.3: System must never display attendance windows from before doctor's account was created
    if (targetDate < doctorActiveDateStr) {
      return res.json({
        success: true,
        date: targetDate,
        minAllowedDate: minAllowedDateStr,
        maxAllowedDate: todayStr,
        doctorActiveDate: doctorActiveDateStr,
        explanationDeadlineISO: deadlineISO,
        explanationDeadlineFormatted: deadlineFormatted,
        isOnLeave,
        leaveNote,
        isExpired: true,
        windows: []
      });
    }

    const isPastDate = targetDate < todayStr;
    const isTodayDate = targetDate === todayStr;
    const isFutureDate = targetDate > todayStr;

    const windowsWithStatus = shiftState.windows.map(w => {
      const windowEndObj = new Date(w.windowEndISO);
      const windowStartObj = new Date(w.windowStartISO);

      let isPastWindow = false;
      let isOpenWindow = false;
      let isFutureWindow = false;

      if (isPastDate) {
        isPastWindow = true;
      } else if (isFutureDate) {
        isFutureWindow = true;
      } else {
        // Today's date comparison
        if (nowObj > windowEndObj) {
          isPastWindow = true;
        } else if (nowObj >= windowStartObj && nowObj <= windowEndObj) {
          isOpenWindow = true;
        } else {
          isFutureWindow = true;
        }
      }

      // Check if window occurred before doctor account creation (middle-of-day onboarding rule)
      const isBeforeCreation = docCreatedObj && (new Date(doctor.createdAt) > windowEndObj);

      const att = dateAttendances.find(a => 
        a.checkpointTime === w.windowStartFormatted || a.windowLabel === w.windowLabel
      );

      let status = 'FUTURE';
      if (att) {
        status = att.status;
      } else if (isBeforeCreation) {
        status = 'NOT_APPLICABLE';
      } else if (isPastWindow) {
        status = 'ABSENT';
      } else if (isOpenWindow) {
        status = 'ACTIVE_OPEN';
      } else {
        status = 'FUTURE';
      }

      // STRICT RULE: ONLY PAST CLOSED MISSED WINDOWS WITHIN 3 DAYS ARE SELECTABLE!
      // Cannot select windows before account creation or already present/on-leave
      const isSelectable = !isExpired && !isBeforeCreation && !isOnLeave && isPastWindow && (status === 'ABSENT' || status === 'PENDING_EXPLANATION');

      return {
        ...w,
        status,
        isPastWindow,
        isOpenWindow,
        isFutureWindow,
        isBeforeCreation,
        attendanceId: att ? att._id : null,
        isSelectable
      };
    });

    res.json({
      success: true,
      date: targetDate,
      minAllowedDate: minAllowedDateStr,
      maxAllowedDate: todayStr,
      doctorActiveDate: doctorActiveDateStr,
      explanationDeadlineISO: deadlineObj.toISOString(),
      explanationDeadlineFormatted: formatDeadlineString(deadlineObj),
      isOnLeave,
      leaveNote,
      isExpired,
      windows: windowsWithStatus
    });

  } catch (err) {
    console.error('Error getting date shift windows:', err);
    res.status(500).json({ success: false, message: 'Error generating date shift windows' });
  }
};

exports.markAttendance = (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const doctorId = req.user.id;
    const userEmail = req.user.email;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: 'GPS Location coordinates (Latitude & Longitude) are required.' });
    }

    const doctor = memoryStore.users.find(u => 
      String(u._id) === String(doctorId) || 
      (userEmail && u.email.toLowerCase() === userEmail.toLowerCase())
    );
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

    const phc = memoryStore.phcs.find(p => String(p._id) === String(doctor.assignedPHC));
    if (!phc) {
      return res.status(400).json({ success: false, message: 'No hospital/PHC assigned to doctor.' });
    }

    // Check if doctor is on official leave today
    const todayCheckStr = new Date().toISOString().split('T')[0];
    const isOnLeaveToday = (memoryStore.leaves || []).some(l =>
      String(l.doctor) === String(doctor._id) &&
      l.status === 'ACTIVE' &&
      l.startDate <= todayCheckStr &&
      l.endDate >= todayCheckStr
    );
    if (isOnLeaveToday) {
      return res.status(400).json({
        success: false,
        message: 'You are on Official Leave today. Attendance marking is not required on leave days.'
      });
    }

    const intervalMins = memoryStore.settings.checkpointIntervalMinutes || 60;
    const windowMins = memoryStore.settings.windowDurationMinutes || 5;

    const shiftState = evaluateCurrentShiftState(
      doctor.shiftStart || '09:00',
      doctor.shiftEnd || '17:00',
      intervalMins,
      windowMins,
      new Date()
    );

    // Validate if window is open
    if (!shiftState.isWindowOpen || !shiftState.activeWindow) {
      return res.status(400).json({
        success: false,
        message: 'Attendance window closed! Attendance can only be marked during scheduled 5-minute checkpoint windows.',
        nextWindow: shiftState.nextWindow ? shiftState.nextWindow.windowLabel : 'None remaining today'
      });
    }

    // Geofence check using Haversine formula
    const distanceMeters = calculateHaversineDistance(
      latitude,
      longitude,
      phc.latitude,
      phc.longitude
    );

    const isWithinGeofence = distanceMeters <= phc.radius;
    const activeWin = shiftState.activeWindow;
    const todayStr = new Date().toISOString().split('T')[0];

    let attRecord = memoryStore.attendances.find(a => 
      String(a.doctor) === String(doctor._id) && 
      a.date === todayStr && 
      (a.checkpointTime === activeWin.windowStartFormatted || a.windowLabel === activeWin.windowLabel)
    );

    if (attRecord && (attRecord.status === 'PRESENT' || attRecord.status === 'EXPLANATION_APPROVED' || attRecord.status === 'PRESENT_APPROVED_EXPLANATION')) {
      return res.status(400).json({
        success: false,
        message: `Attendance already marked as PRESENT for window (${activeWin.windowLabel}).`
      });
    }

    if (!isWithinGeofence) {
      return res.status(400).json({
        success: false,
        message: `Geofence violation! You are ${distanceMeters} meters away from ${phc.name} (Max radius: ${phc.radius}m).`,
        distanceMeters,
        allowedRadius: phc.radius
      });
    }

    if (!attRecord) {
      attRecord = {
        _id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        doctor: doctor._id,
        phc: phc._id,
        date: todayStr,
        checkpointTime: activeWin.windowStartFormatted,
        windowLabel: activeWin.windowLabel,
        markedAt: new Date().toISOString(),
        status: 'PRESENT',
        withinGeofence: true,
        distanceMeters,
        createdAt: new Date().toISOString()
      };
      memoryStore.attendances.push(attRecord);
    } else {
      attRecord.status = 'PRESENT';
      attRecord.withinGeofence = true;
      attRecord.distanceMeters = distanceMeters;
      attRecord.markedAt = new Date().toISOString();
    }

    saveMemoryStoreToDisk();

    // Section 7 Audit Log
    logAuditEvent({
      userId: doctor._id,
      userRole: 'DOCTOR',
      userName: doctor.name,
      action: 'ATTENDANCE_MARKED',
      recordType: 'Attendance',
      recordId: attRecord._id,
      details: {
        date: todayStr,
        checkpointTime: activeWin.windowStartFormatted,
        windowLabel: activeWin.windowLabel,
        distanceMeters,
        allowedRadius: phc.radius,
        withinGeofence: true,
        status: 'PRESENT'
      }
    });

    res.json({
      success: true,
      message: `Attendance marked successfully for window (${activeWin.windowLabel})!`,
      attendance: attRecord
    });

  } catch (err) {
    console.error('Error marking attendance:', err);
    res.status(500).json({ success: false, message: 'Server error marking attendance' });
  }
};

exports.getDoctorAttendanceLogs = (req, res) => {
  try {
    const userId = req.user.id;
    const logs = memoryStore.attendances
      .filter(a => String(a.doctor) === String(userId))
      .map(a => {
        const phc = memoryStore.phcs.find(p => String(p._id) === String(a.phc));
        const docUser = memoryStore.users.find(u => String(u._id) === String(a.doctor));
        const explanation = (memoryStore.explanations || []).find(e => 
          String(e.attendance) === String(a._id) ||
          (String(e.doctor) === String(a.doctor) && e.date === a.date && e.windowLabel === a.windowLabel)
        );
        const leave = (memoryStore.leaves || []).find(l => 
          String(l.doctor) === String(a.doctor) && 
          l.status === 'ACTIVE' && 
          l.startDate <= a.date && 
          l.endDate >= a.date
        );

        return {
          ...a,
          phcName: phc ? phc.name : 'Primary Health Center',
          doctorName: docUser ? docUser.name : 'Medical Doctor',
          doctorSpecialization: docUser ? docUser.specialization : 'Medical Officer',
          explanation: explanation ? {
            _id: explanation._id,
            status: explanation.status,
            reason: explanation.reason,
            remarks: explanation.remarks,
            adminRemarks: explanation.adminRemarks,
            createdAt: explanation.createdAt
          } : null,
          leave: leave ? {
            _id: leave._id,
            leaveType: leave.leaveType || 'Official Leave',
            leaveNote: leave.leaveNote
          } : null
        };
      })
      .sort((a, b) => (b.date === a.date ? (b.checkpointTime || '').localeCompare(a.checkpointTime || '') : b.date.localeCompare(a.date)));

    res.json({ success: true, count: logs.length, attendances: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching doctor attendance logs' });
  }
};

exports.getAllAttendanceRecords = (req, res) => {
  try {
    const logs = memoryStore.attendances.map(a => {
      const phc = memoryStore.phcs.find(p => String(p._id) === String(a.phc));
      const docUser = memoryStore.users.find(u => String(u._id) === String(a.doctor));
      const explanation = (memoryStore.explanations || []).find(e => 
        String(e.attendance) === String(a._id) ||
        (String(e.doctor) === String(a.doctor) && e.date === a.date && e.windowLabel === a.windowLabel)
      );
      const leave = (memoryStore.leaves || []).find(l => 
        String(l.doctor) === String(a.doctor) && 
        l.status === 'ACTIVE' && 
        l.startDate <= a.date && 
        l.endDate >= a.date
      );

      return {
        ...a,
        phcName: phc ? phc.name : 'Primary Health Center',
        doctorName: docUser ? docUser.name : 'Medical Doctor',
        doctorSpecialization: docUser ? docUser.specialization : 'Medical Officer',
        gender: docUser ? docUser.gender : 'Male',
        explanation: explanation ? {
          _id: explanation._id,
          status: explanation.status,
          reason: explanation.reason,
          remarks: explanation.remarks,
          adminRemarks: explanation.adminRemarks,
          createdAt: explanation.createdAt
        } : null,
        leave: leave ? {
          _id: leave._id,
          leaveType: leave.leaveType || 'Official Leave',
          leaveNote: leave.leaveNote
        } : null
      };
    }).sort((a, b) => (b.date === a.date ? (b.checkpointTime || '').localeCompare(a.checkpointTime || '') : b.date.localeCompare(a.date)));

    res.json({ success: true, count: logs.length, attendances: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching all attendance records' });
  }
};
