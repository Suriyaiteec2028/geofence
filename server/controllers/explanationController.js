const { memoryStore } = require('../config/db');

exports.submitExplanation = (req, res) => {
  try {
    const doctorId = req.user.id;
    const { attendanceId, reason, remarks } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Reason for absence is required.' });
    }

    const doctor = memoryStore.users.find(u => u._id === doctorId);
    let proofUrl = req.file ? `/uploads/${req.file.filename}` : '';

    let attendance = null;
    if (attendanceId) {
      attendance = memoryStore.attendances.find(a => a._id === attendanceId);
    } else {
      // Find latest absent record for doctor
      attendance = memoryStore.attendances.find(a => a.doctor === doctorId && (a.status === 'ABSENT' || a.status === 'PENDING_EXPLANATION'));
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

    // Send notification to Admin & CMO
    memoryStore.notifications.push({
      _id: 'notif_' + Date.now(),
      user: null,
      targetRole: 'ADMIN',
      title: 'New Explanation Submitted',
      message: `Dr. ${doctor ? doctor.name : 'Doctor'} submitted an absence explanation for review.`,
      type: 'WARNING',
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
      list = list.filter(e => e.phc === req.userDetails.assignedPHC);
    }

    const enriched = list.map(e => {
      const doc = memoryStore.users.find(u => u._id === e.doctor);
      const phc = memoryStore.phcs.find(p => p._id === e.phc);
      const att = memoryStore.attendances.find(a => a._id === e.attendance);
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

    const expIndex = memoryStore.explanations.findIndex(e => e._id === id);
    if (expIndex === -1) {
      return res.status(404).json({ success: false, message: 'Explanation request not found' });
    }

    const explanation = memoryStore.explanations[expIndex];
    const attendance = memoryStore.attendances.find(a => a._id === explanation.attendance);
    const doctor = memoryStore.users.find(u => u._id === explanation.doctor);

    explanation.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    explanation.reviewedBy = req.user.id;
    explanation.adminRemarks = adminRemarks || '';
    explanation.reviewedAt = new Date().toISOString();

    if (attendance) {
      if (action === 'APPROVE') {
        attendance.status = 'EXPLANATION_APPROVED'; // Counted as Present
      } else {
        attendance.status = 'EXPLANATION_REJECTED'; // Counted as Absent
      }
    }

    // Send notification to doctor
    memoryStore.notifications.push({
      _id: 'notif_' + Date.now(),
      user: explanation.doctor,
      targetRole: 'DOCTOR',
      title: `Explanation ${action === 'APPROVE' ? 'Approved' : 'Rejected'}`,
      message: `Your absence explanation has been ${action === 'APPROVE' ? 'APPROVED (Attendance updated to Present)' : 'REJECTED'}. Remarks: ${adminRemarks || 'None'}`,
      type: action === 'APPROVE' ? 'SUCCESS' : 'DANGER',
      isRead: false,
      createdAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Explanation successfully ${action === 'APPROVE' ? 'approved' : 'rejected'}. Doctor notified.`,
      explanation,
      attendance
    });

  } catch (err) {
    console.error('Review explanation error:', err);
    res.status(500).json({ success: false, message: 'Error reviewing explanation' });
  }
};
