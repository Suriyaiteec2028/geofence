const { memoryStore } = require('../config/db');
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
        id: doctor._id,
        name: doctor.name,
        shiftStart: doctor.shiftStart,
        shiftEnd: doctor.shiftEnd
      },
      phc: phc || { name: 'Unassigned Hospital PHC', latitude: 13.0827, longitude: 80.2707, radius: 150 },
      shiftState,
      todayAttendances
    });
  } catch (err) {
    console.error('Shift status error:', err);
    res.status(500).json({ success: false, message: 'Error retrieving shift status' });
  }
};

exports.markAttendance = (req, res) => {
  try {
    const doctorId = req.user.id;
    const userEmail = req.user.email;
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: 'GPS coordinates (latitude and longitude) are required.' });
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

    res.status(200).json({
      success: true,
      message: `Attendance marked successfully! Status: PRESENT. Distance from hospital: ${distanceMeters}m.`,
      attendance: newAttendance
    });

  } catch (err) {
    console.error('Mark attendance error:', err);
    res.status(500).json({ success: false, message: 'Server error marking attendance' });
  }
};

exports.getAttendanceHistory = (req, res) => {
  try {
    const { doctorId, phcId, status, date } = req.query;
    let list = [...memoryStore.attendances];

    // Role level filtering
    if (req.user.role === 'DOCTOR') {
      list = list.filter(a => String(a.doctor) === String(req.user.id));
    } else if (doctorId) {
      list = list.filter(a => String(a.doctor) === String(doctorId));
    }

    if (phcId) list = list.filter(a => String(a.phc) === String(phcId));
    if (status) list = list.filter(a => a.status === status);
    if (date) list = list.filter(a => a.date === date);

    const enriched = list.map(a => {
      const doc = memoryStore.users.find(u => String(u._id) === String(a.doctor));
      const phc = memoryStore.phcs.find(p => String(p._id) === String(a.phc));
      const exp = a.explanation ? memoryStore.explanations.find(e => String(e._id) === String(a.explanation)) : null;
      return {
        ...a,
        doctorName: doc ? doc.name : 'Unknown Doctor',
        doctorSpecialization: doc ? doc.specialization : '',
        phcName: phc ? phc.name : 'Unknown PHC',
        explanationDetails: exp
      };
    });

    res.json({ success: true, count: enriched.length, attendances: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching attendance history' });
  }
};
