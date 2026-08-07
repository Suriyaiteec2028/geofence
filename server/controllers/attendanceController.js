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

// Get Doctor Shift Windows and Attendance Statuses for Selected Date with 3-Day Deadline Check
exports.getDoctorDateWindows = (req, res) => {
  try {
    const doctorId = req.user.id;
    const { date } = req.query; // YYYY-MM-DD
    const targetDate = date || new Date().toISOString().split('T')[0];

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

    // Calculate 3-Day Submission Deadline Rule (e.g. 5th Aug ➔ Deadline 8th Aug 11:59 PM)
    const dutyDateObj = new Date(targetDate + 'T23:59:59');
    const nowObj = new Date();
    const deadlineObj = new Date(dutyDateObj.getTime() + (3 * 24 * 60 * 60 * 1000));
    const isExpired = nowObj > deadlineObj;

    const windowsWithStatus = shiftState.windows.map(w => {
      const att = dateAttendances.find(a => 
        a.checkpointTime === w.windowStartFormatted || a.windowLabel === w.windowLabel
      );
      let status = 'ABSENT'; // Default for past un-marked windows
      if (att) {
        status = att.status;
      }

      return {
        ...w,
        status,
        attendanceId: att ? att._id : null,
        isSelectable: !isExpired && (status === 'ABSENT' || status === 'PENDING_EXPLANATION')
      };
    });

    res.json({
      success: true,
      date: targetDate,
      deadlineDate: deadlineObj.toISOString(),
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
      Number(latitude),
      Number(longitude),
      phc.latitude,
      phc.longitude
    );

    const withinGeofence = distanceMeters <= phc.radius;

    if (!withinGeofence) {
      return res.status(403).json({
        success: false,
        message: `Attendance Rejected! You are outside the hospital premises. Distance: ${distanceMeters}m, Permitted Radius: ${phc.radius}m.`,
        distanceMeters,
        allowedRadius: phc.radius,
        hospitalName: phc.name
      });
    }

    // Success! Record attendance
    const todayStr = new Date().toISOString().split('T')[0];
    const activeWin = shiftState.activeWindow;

    const newAttendance = {
      _id: 'att_' + Date.now(),
      doctor: doctor._id,
      phc: phc._id,
      date: todayStr,
      checkpointTime: activeWin.windowStartFormatted,
      windowLabel: activeWin.windowLabel,
      markedAt: new Date().toISOString(),
      status: 'PRESENT',
      latitude: Number(latitude),
      longitude: Number(longitude),
      distanceMeters,
      withinGeofence: true,
      createdAt: new Date().toISOString()
    };

    memoryStore.attendances.push(newAttendance);
    saveMemoryStoreToDisk();

    res.json({
      success: true,
      message: `Attendance verified & marked PRESENT for ${activeWin.windowLabel}!`,
      attendance: newAttendance
    });

  } catch (err) {
    console.error('Error marking attendance:', err);
    res.status(500).json({ success: false, message: 'Server error processing attendance' });
  }
};

// Get Doctor Attendance Logs History
exports.getDoctorAttendanceLogs = (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;
    let list = [...memoryStore.attendances];

    if (userRole === 'DOCTOR') {
      list = list.filter(a => String(a.doctor) === String(userId));
    } else if (userRole === 'ADMIN' && req.userDetails && req.userDetails.assignedPHC) {
      list = list.filter(a => String(a.phc) === String(req.userDetails.assignedPHC));
    }

    const enriched = list.map(a => {
      const doc = memoryStore.users.find(u => String(u._id) === String(a.doctor));
      const phc = memoryStore.phcs.find(p => String(p._id) === String(a.phc));
      return {
        ...a,
        doctorName: doc ? doc.name : 'Unknown Doctor',
        doctorSpecialization: doc ? doc.specialization : '',
        phcName: phc ? phc.name : 'Unknown PHC'
      };
    });

    res.json({ success: true, count: enriched.length, attendances: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching attendance logs' });
  }
};

// Get All Attendance Records (CMO & Admin)
exports.getAllAttendanceRecords = (req, res) => {
  try {
    let list = [...memoryStore.attendances];

    if (req.user.role === 'ADMIN' && req.userDetails && req.userDetails.assignedPHC) {
      list = list.filter(a => String(a.phc) === String(req.userDetails.assignedPHC));
    }

    const enriched = list.map(a => {
      const doc = memoryStore.users.find(u => String(u._id) === String(a.doctor));
      const phc = memoryStore.phcs.find(p => String(p._id) === String(a.phc));
      return {
        ...a,
        doctorName: doc ? doc.name : 'Unknown Doctor',
        doctorSpecialization: doc ? doc.specialization : '',
        phcName: phc ? phc.name : 'Unknown PHC'
      };
    });

    res.json({ success: true, count: enriched.length, attendances: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching all attendance records' });
  }
};
