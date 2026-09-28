const { memoryStore, saveMemoryStoreToDisk } = require('../config/db');

exports.submitExplanation = (req, res) => {
  try {
    const doctorId = req.user.id;
    // Support both old single-window and new multi-window submission
    const { attendanceId, reason, remarks, date, selectedCheckpoints } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Reason for absence is required.' });
    }

    const doctor = memoryStore.users.find(u => String(u._id) === String(doctorId));
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found.' });

    let proofUrl = req.file ? `/uploads/${req.file.filename}` : '';

    // ── Multi-window submission path ──────────────────────────────────────────
    if (date && selectedCheckpoints) {
      let checkpoints;
      try {
        checkpoints = typeof selectedCheckpoints === 'string' ? JSON.parse(selectedCheckpoints) : selectedCheckpoints;
      } catch { checkpoints = []; }

      if (!checkpoints || checkpoints.length === 0) {
        return res.status(400).json({ success: false, message: 'No checkpoints selected.' });
      }

      // Backend 3-day rule validation
      const nowIST = new Date();
      const minAllowed = new Date(nowIST);
      minAllowed.setDate(nowIST.getDate() - 3);
      minAllowed.setHours(0, 0, 0, 0);
      const targetDateObj = new Date(date + 'T00:00:00');
      if (targetDateObj < minAllowed) {
        return res.status(400).json({ success: false, message: 'Explanation deadline expired. Explanations can only be submitted within 3 days of the missed attendance date.' });
      }
      if (date > nowIST.toISOString().split('T')[0]) {
        return res.status(400).json({ success: false, message: 'Cannot submit explanation for a future date.' });
      }

      // Doctor account date check
      const docCreatedDate = new Date(doctor.createdAt).toISOString().split('T')[0];
      if (date < docCreatedDate) {
        return res.status(400).json({ success: false, message: 'Cannot submit explanation for a date before your account was created.' });
      }

      // Leave coverage check
      const isOnLeave = (memoryStore.leaves || []).some(l =>
        String(l.doctor) === String(doctorId) &&
        l.status === 'ACTIVE' &&
        l.startDate <= date && l.endDate >= date
      );
      if (isOnLeave) {
        return res.status(400).json({ success: false, message: 'This date is covered by an approved official leave. No explanation required.' });
      }

      const createdExplanations = [];
      const skipped = [];

      for (const windowLabel of checkpoints) {
        // Find the attendance record for this specific checkpoint
        let attendance = memoryStore.attendances.find(a =>
          String(a.doctor) === String(doctorId) &&
          a.date === date &&
          (a.windowLabel === windowLabel || a.checkpointTime === windowLabel)
        );

        // Skip if already PRESENT or EXPLANATION_APPROVED
        if (attendance && (attendance.status === 'PRESENT' || attendance.status === 'EXPLANATION_APPROVED')) {
          skipped.push(windowLabel + ' (already present)');
          continue;
        }

        // Skip if already has a PENDING explanation
        const existingPending = memoryStore.explanations.find(e =>
          String(e.doctor) === String(doctorId) &&
          String(e.attendance) === String(attendance?._id) &&
          e.status === 'PENDING'
        );
        if (existingPending) {
          skipped.push(windowLabel + ' (explanation already pending)');
          continue;
        }

        // Create attendance record if missing
        if (!attendance) {
          attendance = {
            _id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            doctor: doctorId,
            phc: doctor.assignedPHC,
            date,
            checkpointTime: windowLabel.split(' –')[0].trim(),
            windowLabel,
            markedAt: null,
            status: 'PENDING_EXPLANATION',
            withinGeofence: false,
            createdAt: new Date().toISOString()
          };
          memoryStore.attendances.push(attendance);
        } else {
          attendance.status = 'PENDING_EXPLANATION';
        }

        const exp = {
          _id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          attendance: attendance._id,
          doctor: doctorId,
          phc: doctor.assignedPHC,
          date,
          windowLabel,
          reason: reason.trim(),
          remarks: remarks || '',
          proofUrl,
          status: 'PENDING',
          reviewedBy: null,
          adminRemarks: null,
          reviewedAt: null,
          createdAt: new Date().toISOString()
        };
        memoryStore.explanations.push(exp);
        attendance.explanation = exp._id;
        createdExplanations.push(exp);
      }

      saveMemoryStoreToDisk();

      if (createdExplanations.length === 0) {
        return res.status(400).json({ success: false, message: `No explanations created. Skipped: ${skipped.join(', ')}` });
      }

      // Notify admin
      memoryStore.notifications.unshift({
        _id: 'notif_' + Date.now(),
        user: null,
        targetRole: 'ADMIN',
        title: 'New Absence Explanation Submitted',
        message: `Dr. ${doctor.name} submitted ${createdExplanations.length} absence explanation(s) for ${date} (Reason: ${reason}).`,
        type: 'WARNING',
        read: false,
        isRead: false,
        createdAt: new Date().toISOString()
      });

      saveMemoryStoreToDisk();
      return res.status(201).json({
        success: true,
        message: `${createdExplanations.length} explanation(s) submitted. Pending Admin review.`,
        explanations: createdExplanations,
        skipped
      });
    }

    // ── Legacy single-window path (backward compatibility) ────────────────────
    let attendance = null;
    if (attendanceId) {
      attendance = memoryStore.attendances.find(a => String(a._id) === String(attendanceId));
    } else {
      attendance = memoryStore.attendances.find(a => String(a.doctor) === String(doctorId) && (a.status === 'ABSENT' || a.status === 'PENDING_EXPLANATION'));
    }

    if (!attendance) {
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

exports.getDoctorExplanations = (req, res) => {
  try {
    const doctorId = req.user.id;
    const exps = memoryStore.explanations
      .filter(e => String(e.doctor) === String(doctorId))
      .map(e => {
        const att = memoryStore.attendances.find(a => String(a._id) === String(e.attendance));
        return {
          ...e,
          date: e.date || (att ? att.date : e.createdAt.split('T')[0]),
          windowLabel: e.windowLabel || (att ? att.windowLabel : 'N/A'),
          checkpointTime: att ? att.checkpointTime : 'N/A'
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ success: true, count: exps.length, explanations: exps });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching doctor explanations.' });
  }
};
