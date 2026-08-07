const { memoryStore, saveMemoryStoreToDisk } = require('../config/db');

exports.submitExplanation = (req, res) => {
  try {
    const doctorId = req.user.id;
    const { attendanceId, reason, remarks } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Reason for absence is required.' });
    }

    const doctor = memoryStore.users.find(u => String(u._id) === String(doctorId));
    let proofUrl = req.file ? `/uploads/${req.file.filename}` : '';

    let attendance = null;
    if (attendanceId) {
      attendance = memoryStore.attendances.find(a => String(a._id) === String(attendanceId));
    } else {
      // Find latest absent record for doctor
      attendance = memoryStore.attendances.find(a => String(a.doctor) === String(doctorId) && (a.status === 'ABSENT' || a.status === 'PENDING_EXPLANATION'));
    }

    if (!attendance) {
      // Create auto absent checkpoint record for explanation
      const todayStr = new Date().toISOString().split('T')[0];
      attendance = {
        _id: 'att_' + Date.now(),
        doctor: doctorId,
        phc: doctor ? doctor.assignedPHC : null,
        date: todayStr,
        checkpointTime: 'Scheduled Checkpoint',
        windowLabel: 'Missed Window',
        markedAt: null,
        status: 'PENDING_EXPLANATION',
        withinGeofence: false,
        createdAt: new Date().toISOString()
      };
      memoryStore.attendances.push(attendance);
    } else {
      attendance.status = 'PENDING_EXPLANATION';
    }

    const newExplanation = {
      _id: 'exp_' + Date.now(),
      attendance: attendance._id,
      doctor: doctorId,
      phc: doctor ? doctor.assignedPHC : null,
      reason,
      remarks: remarks || '',
      proofUrl,
      status: 'PENDING',
      reviewedBy: null,
      adminRemarks: null,
      reviewedAt: null,
      createdAt: new Date().toISOString()
    };

    memoryStore.explanations.push(newExplanation);
    attendance.explanation = newExplanation._id;
    saveMemoryStoreToDisk();

    // Send notification to Admin & CMO (No OTPs or Passwords)
    memoryStore.notifications.unshift({
      _id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      user: null,
      targetRole: 'ADMIN',
      title: 'New Absence Explanation Submitted',
      message: `Dr. ${doctor ? doctor.name : 'Doctor'} submitted an absence explanation for review (Reason: ${reason}).`,
      type: 'WARNING',
      read: false,
      isRead: false,
      createdAt: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      message: 'Absence explanation submitted successfully. Sent for Admin review.',
      explanation: newExplanation
    });

  } catch (err) {
    console.error('Submit explanation error:', err);
    res.status(500).json({ success: false, message: 'Server error submitting explanation' });
  }
};

exports.getPendingExplanations = (req, res) => {
  try {
    let list = [...memoryStore.explanations];

    if (req.user.role === 'ADMIN' && req.userDetails && req.userDetails.assignedPHC) {
      list = list.filter(e => String(e.phc) === String(req.userDetails.assignedPHC));
    }

    const enriched = list.map(e => {
      const doc = memoryStore.users.find(u => String(u._id) === String(e.doctor));
      const phc = memoryStore.phcs.find(p => String(p._id) === String(e.phc));
      const att = memoryStore.attendances.find(a => String(a._id) === String(e.attendance));
      return {
        ...e,
        doctorName: doc ? doc.name : 'Unknown Doctor',
        doctorSpecialization: doc ? doc.specialization : '',
        phcName: phc ? phc.name : 'Unknown PHC',
        checkpointTime: att ? att.checkpointTime : 'N/A',
        windowLabel: att ? att.windowLabel : 'N/A',
        date: att ? att.date : e.createdAt.split('T')[0]
      };
    });

    res.json({ success: true, count: enriched.length, explanations: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching explanations' });
  }
};

exports.reviewExplanation = (req, res) => {
  try {
    const { id } = req.params;
    const { action, adminRemarks } = req.body; // action: 'APPROVE' or 'REJECT'

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action. Must be APPROVE or REJECT.' });
    }

    const expIndex = memoryStore.explanations.findIndex(e => String(e._id) === String(id));
    if (expIndex === -1) {
      return res.status(404).json({ success: false, message: 'Explanation request not found' });
    }

    const explanation = memoryStore.explanations[expIndex];
    let attendance = memoryStore.attendances.find(a => String(a._id) === String(explanation.attendance));
    const doctor = memoryStore.users.find(u => String(u._id) === String(explanation.doctor));

    explanation.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    explanation.reviewedBy = req.user.id;
    explanation.adminRemarks = adminRemarks || '';
    explanation.reviewedAt = new Date().toISOString();

    // Immediately update attendance status to EXPLANATION_APPROVED (Counted as Present)
    if (!attendance) {
      const dateStr = explanation.createdAt ? explanation.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
      attendance = {
        _id: 'att_' + Date.now(),
        doctor: explanation.doctor,
        phc: explanation.phc,
        date: dateStr,
        checkpointTime: 'Approved Exemption',
        windowLabel: 'Exemption Window',
        markedAt: new Date().toISOString(),
        status: action === 'APPROVE' ? 'EXPLANATION_APPROVED' : 'EXPLANATION_REJECTED',
        withinGeofence: true,
        createdAt: new Date().toISOString()
      };
      memoryStore.attendances.push(attendance);
      explanation.attendance = attendance._id;
    } else {
      if (action === 'APPROVE') {
        attendance.status = 'EXPLANATION_APPROVED'; // IMMEDIATELY CHANGED TO PRESENT
        attendance.withinGeofence = true;
      } else {
        attendance.status = 'EXPLANATION_REJECTED'; // ABSENT
      }
    }

    saveMemoryStoreToDisk();

    // Send in-app notification to Doctor (No passwords or OTPs)
    memoryStore.notifications.unshift({
      _id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      user: explanation.doctor,
      recipientEmail: doctor ? doctor.email : '',
      targetRole: 'DOCTOR',
      title: `Absence Explanation ${action === 'APPROVE' ? 'Approved ✅' : 'Rejected ❌'}`,
      message: `Your absence explanation for ${explanation.reason || 'duty checkpoint'} was ${action === 'APPROVE' ? 'APPROVED by Admin. Your attendance for that hour has been immediately updated to PRESENT.' : 'REJECTED by Admin.'} Remarks: ${adminRemarks || 'None'}`,
      type: action === 'APPROVE' ? 'SUCCESS' : 'DANGER',
      read: false,
      isRead: false,
      createdAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Explanation ${action === 'APPROVE' ? 'approved (Attendance immediately updated to Present)' : 'rejected'}. Doctor notified.`,
      explanation,
      attendance
    });

  } catch (err) {
    console.error('Review explanation error:', err);
    res.status(500).json({ success: false, message: 'Error reviewing explanation' });
  }
};
