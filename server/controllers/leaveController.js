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

  // Reconcile any existing auto-absent records within the granted leave date range
  const affectedAttendances = (memoryStore.attendances || []).filter(a =>
    String(a.doctor) === String(doctorId) &&
    a.date >= startDate &&
    a.date <= endDate &&
    (a.status === 'ABSENT' || a.status === 'PENDING_EXPLANATION')
  );
  affectedAttendances.forEach(a => {
    a.status = 'OFFICIAL_LEAVE';
    a.leaveId = newLeave._id;
    a.reconciledAt = new Date().toISOString();
  });
  
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

  // Reconcile: revert OFFICIAL_LEAVE attendance records associated with this leave back to ABSENT
  const affected = (memoryStore.attendances || []).filter(a =>
    String(a.doctor) === String(leave.doctor) &&
    a.date >= leave.startDate &&
    a.date <= leave.endDate &&
    a.status === 'OFFICIAL_LEAVE' &&
    String(a.leaveId) === String(leave._id)
  );
  affected.forEach(a => {
    a.status = 'ABSENT';
    a.leaveId = null;
    a.reconciledAt = new Date().toISOString();
  });

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

exports.applyForLeave = (req, res) => {
  try {
    const doctorId = req.user.id;
    const { startDate, endDate, leaveType, reason, note } = req.body;
    const proofUrl = req.file ? '/uploads/' + req.file.filename : '';

    if (!startDate || !endDate || !reason || !leaveType) {
      return res.status(400).json({ success: false, message: 'startDate, endDate, leaveType, and reason are required.' });
    }
    if (startDate > endDate) {
      return res.status(400).json({ success: false, message: 'Start date must be before or equal to end date.' });
    }

    const doctor = memoryStore.users.find(u => String(u._id) === String(doctorId) && u.role === 'DOCTOR');
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found.' });

    // Check doctor createdAt - cannot apply for dates before account creation
    const docCreatedDate = new Date(doctor.createdAt).toISOString().split('T')[0];
    if (startDate < docCreatedDate) {
      return res.status(400).json({ success: false, message: `Cannot apply for leave before your account creation date (${docCreatedDate}).` });
    }

    memoryStore.leaveApplications = memoryStore.leaveApplications || [];

    // Check for overlapping pending/approved leave applications
    const overlap = memoryStore.leaveApplications.find(la =>
      String(la.doctor) === String(doctorId) &&
      ['PENDING', 'APPROVED'].includes(la.status) &&
      !(
        endDate < la.startDate || startDate > la.endDate
      )
    );
    if (overlap) {
      return res.status(400).json({ success: false, message: `Overlapping leave application exists for ${overlap.startDate} to ${overlap.endDate} (Status: ${overlap.status}).` });
    }

    // Also check existing granted leaves
    const leaveOverlap = (memoryStore.leaves || []).find(l =>
      String(l.doctor) === String(doctorId) &&
      l.status === 'ACTIVE' &&
      !(
        endDate < l.startDate || startDate > l.endDate
      )
    );
    if (leaveOverlap) {
      return res.status(400).json({ success: false, message: `An approved leave already exists for ${leaveOverlap.startDate} to ${leaveOverlap.endDate}.` });
    }

    const newApp = {
      _id: 'leaveapp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      doctor: doctorId,
      phc: doctor.assignedPHC,
      startDate,
      endDate,
      leaveType,
      reason,
      note: note || '',
      proofUrl,
      status: 'PENDING',
      submittedAt: new Date().toISOString(),
      reviewedBy: null,
      reviewedAt: null,
      adminNote: '',
      approvedLeaveId: null
    };

    memoryStore.leaveApplications.push(newApp);

    // Notify admin
    memoryStore.notifications = memoryStore.notifications || [];
    memoryStore.notifications.unshift({
      _id: 'notif_' + Date.now(),
      targetRole: 'ADMIN',
      title: 'New Leave Application',
      message: `Dr. ${doctor.name} has applied for ${leaveType} leave from ${startDate} to ${endDate}. Reason: ${reason}`,
      type: 'INFO',
      read: false,
      isRead: false,
      createdAt: new Date().toISOString()
    });

    saveMemoryStoreToDisk();
    res.status(201).json({ success: true, message: 'Leave application submitted. Pending Admin approval.', application: newApp });
  } catch (err) {
    console.error('applyForLeave error:', err);
    res.status(500).json({ success: false, message: 'Server error submitting leave application.' });
  }
};

exports.getMyLeaveApplications = (req, res) => {
  try {
    const doctorId = req.user.id;
    memoryStore.leaveApplications = memoryStore.leaveApplications || [];
    const apps = memoryStore.leaveApplications
      .filter(la => String(la.doctor) === String(doctorId))
      .map(la => {
        const phc = memoryStore.phcs.find(p => String(p._id) === String(la.phc));
        const reviewer = la.reviewedBy ? memoryStore.users.find(u => String(u._id) === String(la.reviewedBy)) : null;
        return { ...la, phcName: phc ? phc.name : 'Unknown PHC', reviewerName: reviewer ? reviewer.name : null };
      })
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    res.json({ success: true, count: apps.length, applications: apps });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching leave applications.' });
  }
};

exports.getAllLeaveApplications = (req, res) => {
  try {
    memoryStore.leaveApplications = memoryStore.leaveApplications || [];
    let apps = [...memoryStore.leaveApplications];

    if (req.user.role === 'ADMIN' && req.userDetails && req.userDetails.assignedPHC) {
      apps = apps.filter(la => String(la.phc) === String(req.userDetails.assignedPHC));
    }

    apps = apps.map(la => {
      const doc = memoryStore.users.find(u => String(u._id) === String(la.doctor));
      const phc = memoryStore.phcs.find(p => String(p._id) === String(la.phc));
      const reviewer = la.reviewedBy ? memoryStore.users.find(u => String(u._id) === String(la.reviewedBy)) : null;
      return {
        ...la,
        doctorName: doc ? doc.name : 'Unknown Doctor',
        phcName: phc ? phc.name : 'Unknown PHC',
        reviewerName: reviewer ? reviewer.name : null
      };
    }).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

    res.json({ success: true, count: apps.length, applications: apps });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching leave applications.' });
  }
};

exports.reviewLeaveApplication = (req, res) => {
  try {
    const { id } = req.params;
    const { action, adminNote } = req.body; // action: 'APPROVE' | 'REJECT'

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be APPROVE or REJECT.' });
    }

    memoryStore.leaveApplications = memoryStore.leaveApplications || [];
    const app = memoryStore.leaveApplications.find(la => la._id === id);
    if (!app) return res.status(404).json({ success: false, message: 'Leave application not found.' });
    if (app.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `Application is already ${app.status}.` });
    }

    app.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    app.reviewedBy = req.user.id;
    app.reviewedAt = new Date().toISOString();
    app.adminNote = adminNote || '';

    let approvedLeave = null;

    if (action === 'APPROVE') {
      // Create official leave record
      memoryStore.leaves = memoryStore.leaves || [];
      approvedLeave = {
        _id: 'leave_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        doctor: app.doctor,
        phc: app.phc,
        startDate: app.startDate,
        endDate: app.endDate,
        leaveNote: `${app.leaveType}: ${app.reason}. Note: ${app.note || ''}`,
        evidenceUrl: app.proofUrl || '',
        grantedBy: req.user.id,
        status: 'ACTIVE',
        sourceApplicationId: app._id,
        createdAt: new Date().toISOString()
      };
      memoryStore.leaves.push(approvedLeave);
      app.approvedLeaveId = approvedLeave._id;

      // Reconcile any auto-absent records within the leave date range
      const doctor = memoryStore.users.find(u => String(u._id) === String(app.doctor));
      const affectedAttendances = memoryStore.attendances.filter(a =>
        String(a.doctor) === String(app.doctor) &&
        a.date >= app.startDate &&
        a.date <= app.endDate &&
        (a.status === 'ABSENT' || a.status === 'PENDING_EXPLANATION')
      );
      affectedAttendances.forEach(a => {
        a.status = 'OFFICIAL_LEAVE';
        a.leaveId = approvedLeave._id;
        a.reconciledAt = new Date().toISOString();
      });
    }

    // Notify doctor
    const doctor = memoryStore.users.find(u => String(u._id) === String(app.doctor));
    memoryStore.notifications = memoryStore.notifications || [];
    memoryStore.notifications.unshift({
      _id: 'notif_' + Date.now(),
      user: app.doctor,
      targetRole: 'DOCTOR',
      title: action === 'APPROVE' ? 'Leave Application Approved ✅' : 'Leave Application Rejected ❌',
      message: action === 'APPROVE'
        ? `Your ${app.leaveType} leave from ${app.startDate} to ${app.endDate} has been approved.`
        : `Your ${app.leaveType} leave application was rejected. Admin note: ${adminNote || 'None'}`,
      type: action === 'APPROVE' ? 'SUCCESS' : 'DANGER',
      read: false,
      isRead: false,
      createdAt: new Date().toISOString()
    });

    saveMemoryStoreToDisk();
    res.json({
      success: true,
      message: action === 'APPROVE' ? 'Leave application approved. Official leave created.' : 'Leave application rejected.',
      application: app,
      approvedLeave
    });
  } catch (err) {
    console.error('reviewLeaveApplication error:', err);
    res.status(500).json({ success: false, message: 'Error reviewing leave application.' });
  }
};

exports.editGrantedLeave = (req, res) => {
  try {
    const { id } = req.params;
    const { action, leaveNote, startDate, endDate } = req.body; // action: 'REVOKE' | 'UPDATE'

    memoryStore.leaves = memoryStore.leaves || [];
    const leave = memoryStore.leaves.find(l => l._id === id);
    if (!leave) return res.status(404).json({ success: false, message: 'Leave record not found.' });

    if (action === 'REVOKE') {
      leave.status = 'CANCELLED';
      leave.revokedBy = req.user.id;
      leave.revokedAt = new Date().toISOString();

      // If sourced from application, mark application as REVOKED
      if (leave.sourceApplicationId) {
        const app = (memoryStore.leaveApplications || []).find(la => la._id === leave.sourceApplicationId);
        if (app) app.status = 'REVOKED';
      }

      // Reconcile: OFFICIAL_LEAVE attendance records revert to ABSENT
      const affected = memoryStore.attendances.filter(a =>
        String(a.doctor) === String(leave.doctor) &&
        a.date >= leave.startDate &&
        a.date <= leave.endDate &&
        a.status === 'OFFICIAL_LEAVE' &&
        String(a.leaveId) === String(leave._id)
      );
      affected.forEach(a => {
        a.status = 'ABSENT';
        a.leaveId = null;
        a.reconciledAt = new Date().toISOString();
      });
    } else if (action === 'UPDATE') {
      if (leaveNote !== undefined) leave.leaveNote = leaveNote;
      if (startDate) leave.startDate = startDate;
      if (endDate) leave.endDate = endDate;
      leave.updatedBy = req.user.id;
      leave.updatedAt = new Date().toISOString();
    }

    saveMemoryStoreToDisk();
    res.json({ success: true, message: `Leave ${action === 'REVOKE' ? 'revoked' : 'updated'} successfully.`, leave });
  } catch (err) {
    console.error('editGrantedLeave error:', err);
    res.status(500).json({ success: false, message: 'Error editing leave.' });
  }
};
