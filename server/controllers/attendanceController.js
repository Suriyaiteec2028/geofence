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

    res.status(200).json({
      success: true,
      message: `🎉 Attendance Checkpoint Verified & Marked Successfully at ${phc.name}!`,
      attendance: newAttendance
    });

  } catch (err) {
    console.error('Error marking attendance:', err);
    res.status(500).json({ success: false, message: 'Server error verifying attendance' });
  }
};

exports.getDoctorAttendanceLogs = (req, res) => {
  try {
    const doctorId = req.user.id;
    const userEmail = req.user.email;

    const doctor = memoryStore.users.find(u => 
      String(u._id) === String(doctorId) || 
      (userEmail && u.email.toLowerCase() === userEmail.toLowerCase())
    );

    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const logs = memoryStore.attendances
      .filter(a => String(a.doctor) === String(doctor._id))
      .sort((a, b) => new Date(b.markedAt || b.createdAt) - new Date(a.markedAt || a.createdAt));

    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error loading logs' });
  }
};

exports.getAllAttendanceRecords = (req, res) => {
  try {
    const { doctorId, phcId, date, status } = req.query;
    let records = [...memoryStore.attendances];

    if (doctorId) records = records.filter(r => String(r.doctor) === String(doctorId));
    if (phcId) records = records.filter(r => String(r.phc) === String(phcId));
    if (date) records = records.filter(r => r.date === date);
    if (status) records = records.filter(r => r.status === status);

    const enriched = records.map(r => {
      const doc = memoryStore.users.find(u => String(u._id) === String(r.doctor));
      const phc = memoryStore.phcs.find(p => String(p._id) === String(r.phc));
      return {
        ...r,
        doctorName: doc ? doc.name : 'Unknown Doctor',
        doctorEmail: doc ? doc.email : '',
        phcName: phc ? phc.name : 'Unknown PHC'
      };
    });

    res.json({ success: true, count: enriched.length, records: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error loading attendance records' });
  }
};
