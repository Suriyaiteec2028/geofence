const { memoryStore, saveMemoryStoreToDisk } = require('../config/db');
const { logAuditEvent } = require('../utils/auditLogger');
const { getISTDate, getISTDateString, evaluateCurrentShiftState } = require('../utils/shiftEngine');

function getExplanationDeadline(missedDateStr) {
  const [y, m, d] = missedDateStr.split('-').map(Number);
  const temp = new Date(Date.UTC(y, m - 1, d + 3, 0, 0, 0, 0));
  const deadlineYear = temp.getUTCFullYear();
  const deadlineMonth = String(temp.getUTCMonth() + 1).padStart(2, '0');
  const deadlineDay = String(temp.getUTCDate()).padStart(2, '0');
  const deadlineISO = `${deadlineYear}-${deadlineMonth}-${deadlineDay}T00:00:00+05:30`;
  const deadlineObj = new Date(deadlineISO);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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

      // Backend 3-day rule validation: must be before 12:00 AM on the 3rd calendar day after missed date
      const now = new Date();
      const { deadlineObj } = getExplanationDeadline(date);
      if (now.getTime() >= deadlineObj.getTime()) {
        return res.status(400).json({
          success: false,
          message: 'Your explanation submission deadline has expired. Explanations for this attendance date can no longer be submitted.'
        });
      }
      if (date > now.toISOString().split('T')[0]) {
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

        // Skip if already PRESENT or approved explanation
        if (attendance && (attendance.status === 'PRESENT' || attendance.status === 'EXPLANATION_APPROVED' || attendance.status === 'PRESENT_APPROVED_EXPLANATION')) {
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

        // Create attendance record if missing — underlying status strictly remains ABSENT
        if (!attendance) {
          attendance = {
            _id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            doctor: doctorId,
            phc: doctor.assignedPHC,
            date,
            shiftDutyDate: date,
            checkpointTime: windowLabel.split(' –')[0].trim(),
            windowLabel,
            markedAt: null,
            status: 'ABSENT',
            explanationStatus: 'PENDING',
            withinGeofence: false,
            createdAt: new Date().toISOString()
          };
          memoryStore.attendances.push(attendance);
        } else {
          // Strictly preserve underlying attendance status as ABSENT per Section 2
          attendance.status = 'ABSENT';
          attendance.explanationStatus = 'PENDING';
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

      // Section 7 Audit Log
      logAuditEvent({
        userId: doctor._id,
        userRole: 'DOCTOR',
        userName: doctor.name,
        action: 'EXPLANATION_SUBMITTED',
        recordType: 'Explanation',
        recordId: createdExplanations.map(e => e._id).join(','),
        details: {
          date,
          checkpointsCount: createdExplanations.length,
          reason,
          status: 'PENDING'
        }
      });

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
      const todayStr = getISTDateString();
      attendance = {
        _id: 'att_' + Date.now(),
        doctor: doctorId,
        phc: doctor ? doctor.assignedPHC : null,
        date: todayStr,
        shiftDutyDate: todayStr,
        checkpointTime: 'Scheduled Checkpoint',
        windowLabel: 'Missed Window',
        markedAt: null,
        status: 'ABSENT',
        explanationStatus: 'PENDING',
        withinGeofence: false,
        createdAt: new Date().toISOString()
      };
      memoryStore.attendances.push(attendance);
    } else {
      attendance.status = 'ABSENT';
      attendance.explanationStatus = 'PENDING';
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

    if (action === 'REJECT' && (!adminRemarks || !adminRemarks.trim())) {
      return res.status(400).json({ success: false, message: 'Rejection reason is mandatory when rejecting an explanation.' });
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
    explanation.adminRemarks = adminRemarks ? adminRemarks.trim() : '';
    explanation.reviewedAt = new Date().toISOString();

    const targetStatus = action === 'APPROVE' ? 'PRESENT_APPROVED_EXPLANATION' : 'ABSENT';
    const explanationStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    // Strictly update: PRESENT_APPROVED_EXPLANATION on approve, ABSENT on reject
    if (!attendance) {
      const dateStr = explanation.date || (explanation.createdAt ? explanation.createdAt.split('T')[0] : getISTDateString());
      attendance = {
        _id: 'att_' + Date.now(),
        doctor: explanation.doctor,
        phc: explanation.phc,
        date: dateStr,
        shiftDutyDate: dateStr,
        checkpointTime: explanation.checkpointTime || 'Approved Exemption',
        windowLabel: explanation.windowLabel || 'Exemption Window',
        markedAt: action === 'APPROVE' ? new Date().toISOString() : null,
        status: targetStatus,
        explanationStatus,
        withinGeofence: action === 'APPROVE',
        createdAt: new Date().toISOString()
      };
      memoryStore.attendances.push(attendance);
      explanation.attendance = attendance._id;
    } else {
      attendance.status = targetStatus;
      attendance.explanationStatus = explanationStatus;
      if (action === 'APPROVE') {
        attendance.withinGeofence = true;
        attendance.markedAt = new Date().toISOString();
      }
    }

    saveMemoryStoreToDisk();

    // Section 7 Audit Log
    logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role || 'ADMIN',
      userName: req.user.name || 'Admin',
      action: action === 'APPROVE' ? 'EXPLANATION_APPROVED' : 'EXPLANATION_REJECTED',
      recordType: 'Explanation',
      recordId: explanation._id,
      details: {
        attendanceId: attendance?._id,
        doctorId: explanation.doctor,
        decision: action,
        adminRemarks: adminRemarks || '',
        updatedAttendanceStatus: attendance?.status
      }
    });

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

exports.getEligibleMissedWindows = (req, res) => {
  try {
    const doctorId = req.user.id;
    const doctor = memoryStore.users.find(u => String(u._id) === String(doctorId));
    if (!doctor || doctor.role !== 'DOCTOR') {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    const nowIST = getISTDate();
    const docCreatedObj = new Date(doctor.createdAt);
    const doctorActiveDateStr = docCreatedObj ? getISTDateString(docCreatedObj) : '2000-01-01';

    const intervalMins = memoryStore.settings?.checkpointIntervalMinutes || 60;
    const windowMins = memoryStore.settings?.windowDurationMinutes || 5;

    const resultWindows = [];

    // Loop through past 3 days and today (e.g. offset 3, 2, 1, 0)
    for (let offset = 3; offset >= 0; offset--) {
      const targetDateObj = new Date(nowIST);
      targetDateObj.setDate(nowIST.getDate() - offset);
      const targetDateStr = getISTDateString(targetDateObj);

      // Section 3: Never display or create eligible missed windows for dates before account creation
      if (targetDateStr < doctorActiveDateStr) continue;

      // Section 6: Skip dates covered by ACTIVE official leave
      const isOnLeave = (memoryStore.leaves || []).some(leave =>
        String(leave.doctor) === String(doctorId) &&
        leave.status === 'ACTIVE' &&
        leave.startDate <= targetDateStr &&
        leave.endDate >= targetDateStr
      );
      if (isOnLeave) continue;

      const { deadlineObj, deadlineISO, deadlineFormatted } = getExplanationDeadline(targetDateStr);
      const isExpired = nowIST.getTime() >= deadlineObj.getTime();

      const shiftState = evaluateCurrentShiftState(
        doctor.shiftStart || '09:00',
        doctor.shiftEnd || '17:00',
        intervalMins,
        windowMins,
        targetDateObj
      );

      for (const win of shiftState.windows) {
        const windowEndObj = new Date(win.windowEndISO);
        // Middle-of-day onboarding: skip windows that ended before doctor account creation
        if (docCreatedObj && docCreatedObj > windowEndObj) continue;

        // Only windows that have closed (ended) can be missed
        const isPastWindow = nowIST > windowEndObj;
        if (!isPastWindow) continue;

        const winDateStr = win.shiftDutyDate || targetDateStr;

        // Skip if window's duty start date is covered by active leave
        const winOnLeave = (memoryStore.leaves || []).some(leave =>
          String(leave.doctor) === String(doctorId) &&
          leave.status === 'ACTIVE' &&
          leave.startDate <= winDateStr &&
          leave.endDate >= winDateStr
        );
        if (winOnLeave) continue;

        // Look for attendance record
        const att = (memoryStore.attendances || []).find(a =>
          String(a.doctor) === String(doctorId) &&
          (a.date === winDateStr || a.shiftDutyDate === winDateStr) &&
          (a.checkpointTime === win.windowStartFormatted || a.windowLabel === win.windowLabel)
        );

        // If attendance is PRESENT or already approved explanation, not missed!
        if (att && (att.status === 'PRESENT' || att.status === 'PRESENT_APPROVED_EXPLANATION' || att.status === 'OFFICIAL_LEAVE')) {
          continue;
        }

        // Look for linked explanation
        const explanation = (memoryStore.explanations || []).find(e =>
          String(e.doctor) === String(doctorId) &&
          (String(e.attendance) === String(att?._id) || (e.date === winDateStr && (e.windowLabel === win.windowLabel || e.checkpointTime === win.windowStartFormatted)))
        );

        const explanationStatus = explanation ? explanation.status : 'NOT_SUBMITTED';

        // An attendance window is eligible for explanation submission if:
        // 1. Deadline has not expired
        // 2. Explanation is NOT currently PENDING or APPROVED
        const isEligible = !isExpired && explanationStatus !== 'PENDING' && explanationStatus !== 'APPROVED';

        let attendanceDisplayStatus = 'Absent';
        if (explanationStatus === 'PENDING') {
          attendanceDisplayStatus = 'Absent — Explanation Pending';
        } else if (explanationStatus === 'APPROVED') {
          attendanceDisplayStatus = 'Present — Approved Explanation';
        }

        resultWindows.push({
          attendanceId: att ? att._id : null,
          attendanceDate: winDateStr,
          dutyDate: winDateStr,
          dutyWindow: win.windowLabel,
          windowLabel: win.windowLabel,
          checkpointTime: win.windowStartFormatted,
          windowEndFormatted: win.windowEndFormatted,
          attendanceStatus: attendanceDisplayStatus,
          underlyingAttendanceStatus: att?.status || 'ABSENT',
          explanationDeadline: deadlineFormatted,
          explanationDeadlineISO: deadlineISO,
          isExpired,
          isEligible,
          explanationStatus,
          explanation: explanation ? {
            _id: explanation._id,
            reason: explanation.reason,
            remarks: explanation.remarks,
            status: explanation.status,
            adminRemarks: explanation.adminRemarks,
            createdAt: explanation.createdAt,
            reviewedAt: explanation.reviewedAt
          } : null
        });
      }
    }

    // Sort by date descending, then checkpoint time
    resultWindows.sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate) || b.checkpointTime.localeCompare(a.checkpointTime));

    res.json({
      success: true,
      count: resultWindows.length,
      windows: resultWindows,
      doctorActiveDate: doctorActiveDateStr
    });
  } catch (err) {
    console.error('Error fetching eligible missed windows:', err);
    res.status(500).json({ success: false, message: 'Error fetching eligible missed windows' });
  }
};

