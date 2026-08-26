const { memoryStore, saveMemoryStoreToDisk } = require('../config/db');
const { calculateHaversineDistance } = require('../utils/haversine');
const { evaluateCurrentShiftState } = require('../utils/shiftEngine');

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

    // Calculate Strict 3-Day Window Rule (e.g. today 26/08/2026 -> allowed range 23/08/2026 to 26/08/2026)
    const minAllowedDateObj = new Date(nowObj);
    minAllowedDateObj.setDate(nowObj.getDate() - 3);
    minAllowedDateObj.setHours(0, 0, 0, 0);

    const minAllowedDateStr = minAllowedDateObj.toISOString().split('T')[0];

    const targetDateObj = new Date(targetDate + 'T00:00:00');
    const isExpired = targetDateObj < minAllowedDateObj;

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

      const att = dateAttendances.find(a => 
        a.checkpointTime === w.windowStartFormatted || a.windowLabel === w.windowLabel
      );

      let status = 'FUTURE';
      if (att) {
        status = att.status;
      } else if (isPastWindow) {
        status = 'ABSENT';
      } else if (isOpenWindow) {
        status = 'ACTIVE_OPEN';
      } else {
        status = 'FUTURE';
      }

      // STRICT RULE: ONLY PAST CLOSED MISSED WINDOWS WITHIN 3 DAYS ARE SELECTABLE!
      const isSelectable = !isExpired && isPastWindow && (status === 'ABSENT' || status === 'PENDING_EXPLANATION');

      return {
        ...w,
        status,
        isPastWindow,
        isOpenWindow,
        isFutureWindow,
        attendanceId: att ? att._id : null,
        isSelectable
      };
    });

    res.json({
      success: true,
      date: targetDate,
      minAllowedDate: minAllowedDateStr,
      maxAllowedDate: todayStr,
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

    if (attRecord && (attRecord.status === 'PRESENT' || attRecord.status === 'EXPLANATION_APPROVED')) {
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
        return {
          ...a,
          phcName: phc ? phc.name : 'Primary Health Center',
          doctorName: docUser ? docUser.name : 'Medical Doctor',
          doctorSpecialization: docUser ? docUser.specialization : 'Medical Officer'
        };
      });

    res.json({ success: true, attendances: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching doctor attendance logs' });
  }
};

exports.getAllAttendanceRecords = (req, res) => {
  try {
    const logs = memoryStore.attendances.map(a => {
      const phc = memoryStore.phcs.find(p => String(p._id) === String(a.phc));
      const docUser = memoryStore.users.find(u => String(u._id) === String(a.doctor));
      return {
        ...a,
        phcName: phc ? phc.name : 'Primary Health Center',
        doctorName: docUser ? docUser.name : 'Medical Doctor',
        doctorSpecialization: docUser ? docUser.specialization : 'Medical Officer',
        gender: docUser ? docUser.gender : 'Male'
      };
    });

    res.json({ success: true, attendances: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching all attendance records' });
  }
};
