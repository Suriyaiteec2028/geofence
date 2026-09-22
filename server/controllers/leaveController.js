const { memoryStore, saveMemoryStoreToDisk } = require('../config/db');

exports.grantOfficialLeave = (req, res) => {
  const { doctorId, startDate, endDate, leaveNote } = req.body;
  const evidenceUrl = req.file ? '/uploads/' + req.file.filename : '';

  if (!doctorId || !startDate || !endDate) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  if (startDate > endDate) {
    return res.status(400).json({ success: false, message: 'Start date must be before or equal to end date' });
  }

  const doctor = memoryStore.users.find(u => u._id === doctorId && u.role === 'DOCTOR');
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found' });
  }

  memoryStore.leaves = memoryStore.leaves || [];

  const overlap = memoryStore.leaves.find(leave => 
    leave.doctor === doctorId && 
    leave.status === 'ACTIVE' && 
    ((startDate >= leave.startDate && startDate <= leave.endDate) || 
     (endDate >= leave.startDate && endDate <= leave.endDate) ||
     (startDate <= leave.startDate && endDate >= leave.endDate))
  );

  if (overlap) {
    return res.status(400).json({ success: false, message: 'Overlapping active leave found' });
  }

  const newLeave = {
    _id: 'leave_' + Date.now(),
    doctor: doctorId,
    phc: doctor.assignedPHC,
    startDate,
    endDate,
    leaveNote: leaveNote || '',
    evidenceUrl,
    grantedBy: req.user.id,
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };

  memoryStore.leaves.push(newLeave);
  
  // Add notification for doctor
  memoryStore.notifications = memoryStore.notifications || [];
  memoryStore.notifications.push({
    _id: 'notif_' + Date.now(),
    user: doctorId,
    type: 'LEAVE_GRANTED',
    title: 'Official Leave Granted',
    message: `You have been granted official leave from ${startDate} to ${endDate}.`,
    isRead: false,
    createdAt: new Date().toISOString()
  });

  saveMemoryStoreToDisk();

  res.status(201).json({ success: true, message: 'Official leave granted successfully', leave: newLeave });
};

exports.cancelOfficialLeave = (req, res) => {
  const { id } = req.params;
  memoryStore.leaves = memoryStore.leaves || [];
  const leave = memoryStore.leaves.find(l => l._id === id);
  if (!leave) {
    return res.status(404).json({ success: false, message: 'Leave not found' });
  }

  leave.status = 'CANCELLED';
  saveMemoryStoreToDisk();
  res.json({ success: true, message: 'Leave cancelled successfully', data: leave });
};

exports.getDoctorLeaves = (req, res) => {
  const doctorId = req.params.doctorId || req.user.id;
  memoryStore.leaves = memoryStore.leaves || [];
  
  let doctorLeaves = memoryStore.leaves.filter(l => l.doctor === doctorId);
  
  // Enrich
  doctorLeaves = doctorLeaves.map(leave => {
    const doc = memoryStore.users.find(u => u._id === leave.doctor);
    const phc = memoryStore.phcs.find(p => p._id === leave.phc);
    return {
      ...leave,
      doctorName: doc ? doc.name : 'Unknown',
      phcName: phc ? phc.name : 'Unknown'
    };
  });
  
  doctorLeaves.sort((a, b) => b.startDate.localeCompare(a.startDate));
  
  res.json({ success: true, count: doctorLeaves.length, leaves: doctorLeaves });
};

exports.getAllLeaves = (req, res) => {
  memoryStore.leaves = memoryStore.leaves || [];
  let allLeaves = [...memoryStore.leaves];

  if (req.user.role === 'ADMIN' && req.userDetails && req.userDetails.assignedPHC) {
    allLeaves = allLeaves.filter(l => l.phc === req.userDetails.assignedPHC);
  }

  // Enrich
  allLeaves = allLeaves.map(leave => {
    const doc = memoryStore.users.find(u => u._id === leave.doctor);
    const phc = memoryStore.phcs.find(p => p._id === leave.phc);
    return {
      ...leave,
      doctorName: doc ? doc.name : 'Unknown',
      phcName: phc ? phc.name : 'Unknown'
    };
  });

  allLeaves.sort((a, b) => b.startDate.localeCompare(a.startDate));

  res.json({ success: true, count: allLeaves.length, leaves: allLeaves });
};
