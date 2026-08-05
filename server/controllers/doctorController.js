const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { memoryStore, saveMemoryStoreToDisk } = require('../config/db');
const User = require('../models/User');
const { 
  sendDoctorRegistrationEmail, 
  sendShiftUpdateEmail, 
  sendHourlyCheckpointReminderEmail,
  sendCustomMessageEmail,
  sendDoctorAttendanceReportEmail,
  sendPasswordResetOTPEmail
} = require('../utils/emailService');

// Map to track Admin Edit OTP requests: adminId -> { otpCode, expiresAt, existingEmail }
const adminEditOtpMap = new Map();

// Map to track Doctor Edit OTP requests: doctorId -> { otpCode, expiresAt, existingEmail }
const doctorEditOtpMap = new Map();

const formatTime12h = (timeStr) => {
  if (!timeStr) return '';
  if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
  const parts = timeStr.split(':');
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) || 0;
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const padH = h < 10 ? `0${h}` : `${h}`;
  const padM = m < 10 ? `0${m}` : `${m}`;
  return `${padH}:${padM} ${period}`;
};

exports.getAllDoctors = (req, res) => {
  try {
    const { search, phcId, status } = req.query;
    let doctors = memoryStore.users.filter(u => u.role === 'DOCTOR');

    if (req.user.role === 'ADMIN' && req.userDetails && req.userDetails.assignedPHC) {
      doctors = doctors.filter(d => String(d.assignedPHC) === String(req.userDetails.assignedPHC));
    }

    if (search) {
      const q = search.toLowerCase();
      doctors = doctors.filter(d => 
        d.name.toLowerCase().includes(q) || 
        d.email.toLowerCase().includes(q) || 
        d.username.toLowerCase().includes(q) ||
        d.specialization?.toLowerCase().includes(q)
      );
    }

    if (phcId) {
      doctors = doctors.filter(d => String(d.assignedPHC) === String(phcId));
    }

    if (status) {
      doctors = doctors.filter(d => d.status === status);
    }

    const enriched = doctors.map(d => {
      const phc = memoryStore.phcs.find(p => String(p._id) === String(d.assignedPHC));
      return {
        ...d,
        password: undefined,
        phcName: phc ? phc.name : 'Unassigned PHC'
      };
    });

    res.json({ success: true, count: enriched.length, doctors: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching doctors' });
  }
};

exports.createDoctor = async (req, res) => {
  try {
    const { name, email, username, password, mobile, qualification, specialization, assignedPHC, shiftStart, shiftEnd, faceData } = req.body;

    if (!name || !email || !username || !password) {
      return res.status(400).json({ success: false, message: 'Name, Email, Username, and Password are all required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const rawUsername = username.trim();
    const cleanUsername = rawUsername.toLowerCase();
    const cleanPassword = password.trim();

    let existing = memoryStore.users.find(u => 
      u.email.toLowerCase() === cleanEmail || u.username.toLowerCase() === cleanUsername
    );

    if (!existing && !memoryStore.isInMemoryMode && mongoose.connection.readyState === 1) {
      try {
        const dbExisting = await User.findOne({
          $or: [
            { email: new RegExp(`^${cleanEmail}$`, 'i') },
            { username: new RegExp(`^${cleanUsername}$`, 'i') }
          ]
        }).lean();
        if (dbExisting) existing = dbExisting;
      } catch (e) {}
    }

    if (existing) {
      return res.status(400).json({ success: false, message: 'An account with this email address or username already exists.' });
    }

    let targetPhcId = assignedPHC;
    if (!targetPhcId || targetPhcId === '') {
      if (req.userDetails && req.userDetails.assignedPHC) {
        targetPhcId = req.userDetails.assignedPHC;
      } else if (memoryStore.phcs.length > 0) {
        targetPhcId = memoryStore.phcs[0]._id;
      }
    }

    const cleanShiftStart = (shiftStart || '09:00').trim();
    const cleanShiftEnd = (shiftEnd || '17:00').trim();

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(cleanPassword, salt);

    const docId = 'doc_' + Date.now();

    const newDoctor = {
      _id: docId,
      name: name.trim(),
      email: cleanEmail,
      username: rawUsername,
      password: hashedPassword,
      plainPassword: cleanPassword,
      role: 'DOCTOR',
      mobile: mobile || '',
      qualification: qualification || 'MBBS, MD',
      specialization: specialization || 'General Physician',
      assignedPHC: targetPhcId || null,
      shiftStart: cleanShiftStart,
      shiftEnd: cleanShiftEnd,
      profilePhoto: '',
      faceData: faceData || '',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    memoryStore.users.push(newDoctor);
    saveMemoryStoreToDisk();

    if (!memoryStore.isInMemoryMode && mongoose.connection.readyState === 1) {
      try {
        await User.create(newDoctor);
      } catch (mErr) {
        console.warn('MongoDB Atlas doctor create notice:', mErr.message);
      }
    }

    const phcObj = memoryStore.phcs.find(p => String(p._id) === String(targetPhcId));
    sendDoctorRegistrationEmail({
      name: newDoctor.name,
      email: newDoctor.email,
      username: rawUsername,
      password: cleanPassword,
      shiftStart: formatTime12h(cleanShiftStart),
      shiftEnd: formatTime12h(cleanShiftEnd),
      phcName: phcObj ? phcObj.name : 'Assigned PHC'
    });

    res.status(201).json({
      success: true,
      message: `Doctor registered! Credentials & shift timings email sent immediately to ${cleanEmail}`,
      doctor: { ...newDoctor, password: undefined }
    });
  } catch (err) {
    console.error('Create doctor error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error creating doctor' });
  }
};

// Request OTP to existing Doctor email before editing Email or Password
exports.requestDoctorEditOTP = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = memoryStore.users.find(u => String(u._id) === String(id) && u.role === 'DOCTOR');
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor account not found' });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    doctorEditOtpMap.set(String(id), {
      otpCode,
      expiresAt,
      existingEmail: doctor.email
    });

    console.log(`🔑 Generated Doctor Edit OTP for Dr. ${doctor.name} (${doctor.email}): ${otpCode}`);

    await sendPasswordResetOTPEmail({
      name: doctor.name,
      email: doctor.email,
      otpCode
    });

    res.json({
      success: true,
      existingEmail: doctor.email,
      message: `OTP verification code sent live to Dr. ${doctor.name}'s registered email (${doctor.email}).`
    });

  } catch (err) {
    console.error('Request Doctor Edit OTP error:', err);
    res.status(500).json({ success: false, message: 'Server error generating OTP for Doctor edit.' });
  }
};

exports.updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, otp } = req.body;

    const docIndex = memoryStore.users.findIndex(u => String(u._id) === String(id) && u.role === 'DOCTOR');
    if (docIndex === -1) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const currentDoc = memoryStore.users[docIndex];

    const isEmailChanged = email && email.trim().toLowerCase() !== currentDoc.email.toLowerCase();
    const isPasswordChanged = password && password.trim() !== '';

    // Require OTP Verification if Email or Password is modified
    if (isEmailChanged || isPasswordChanged) {
      const otpRecord = doctorEditOtpMap.get(String(id));
      if (!otpRecord) {
        return res.status(400).json({
          success: false,
          requireOtp: true,
          message: `OTP verification required to modify Doctor email or password. Please request OTP sent to ${currentDoc.email}.`
        });
      }

      if (Date.now() > otpRecord.expiresAt) {
        doctorEditOtpMap.delete(String(id));
        return res.status(400).json({
          success: false,
          requireOtp: true,
          message: 'OTP verification code has expired. Please request a new OTP code.'
        });
      }

      if (!otp || otp.trim() !== otpRecord.otpCode) {
        return res.status(400).json({
          success: false,
          requireOtp: true,
          message: `Invalid OTP code. Please check OTP sent to Dr. ${currentDoc.name}'s email (${currentDoc.email}).`
        });
      }

      // OTP verified successfully! Consume OTP
      doctorEditOtpMap.delete(String(id));
    }

    if (isPasswordChanged) {
      const cleanPass = password.trim();
      const salt = await bcrypt.genSalt(10);
      req.body.password = await bcrypt.hash(cleanPass, salt);
      req.body.plainPassword = cleanPass;
    } else {
      delete req.body.password;
    }

    delete req.body.otp;

    const updated = {
      ...currentDoc,
      ...req.body
    };

    memoryStore.users[docIndex] = updated;
    saveMemoryStoreToDisk();

    if (!memoryStore.isInMemoryMode && mongoose.connection.readyState === 1) {
      try {
        await User.updateOne({ _id: currentDoc._id }, updated);
      } catch (mErr) {
        console.warn('MongoDB Atlas update notice:', mErr.message);
      }
    }

    const phcObj = memoryStore.phcs.find(p => String(p._id) === String(updated.assignedPHC));
    sendShiftUpdateEmail({
      name: updated.name,
      email: updated.email,
      shiftStart: formatTime12h(updated.shiftStart),
      shiftEnd: formatTime12h(updated.shiftEnd),
      phcName: phcObj ? phcObj.name : 'Assigned PHC'
    });

    res.json({
      success: true,
      message: `Doctor details updated! Schedule update email sent to ${updated.email}`,
      doctor: { ...updated, password: undefined }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating doctor' });
  }
};

exports.sendTestDoctorEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = memoryStore.users.find(u => String(u._id) === String(id) && u.role === 'DOCTOR');
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const phcObj = memoryStore.phcs.find(p => String(p._id) === String(doctor.assignedPHC));

    await sendHourlyCheckpointReminderEmail({
      name: doctor.name,
      email: doctor.email,
      checkpointIndex: 1,
      windowLabel: `${formatTime12h(doctor.shiftStart)} – Checkpoint Window Open`,
      phcName: phcObj ? phcObj.name : 'Assigned PHC'
    });

    res.json({
      success: true,
      message: `Hourly Checkpoint Reminder Email sent live to ${doctor.email}`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send test email' });
  }
};

exports.sendCustomNoticeEmail = async (req, res) => {
  try {
    const { recipientEmail, recipientName, subject, messageText } = req.body;
    if (!recipientEmail || !messageText) {
      return res.status(400).json({ success: false, message: 'Recipient email and message text are required.' });
    }

    await sendCustomMessageEmail({
      recipientName: recipientName || 'User',
      recipientEmail,
      subject: subject || 'Official Communication Notice',
      messageText,
      senderRole: req.user?.role || 'CMO'
    });

    res.json({
      success: true,
      message: `Official notice/warning email delivered live to ${recipientEmail}!`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send custom warning email' });
  }
};

exports.sendDoctorAttendanceReport = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = memoryStore.users.find(u => String(u._id) === String(id) && u.role === 'DOCTOR');
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor account not found' });

    const doctorAttendances = memoryStore.attendances.filter(a => String(a.doctor) === String(doctor._id));
    const presentCount = doctorAttendances.filter(a => a.status === 'PRESENT').length;
    const absentCount = doctorAttendances.filter(a => a.status === 'ABSENT' || a.status === 'PENDING_EXPLANATION').length;
    const totalCheckpoints = doctorAttendances.length || 6;
    const complianceRate = totalCheckpoints > 0 ? `${Math.round((presentCount / totalCheckpoints) * 100)}%` : '100%';

    const phcObj = memoryStore.phcs.find(p => String(p._id) === String(doctor.assignedPHC));

    await sendDoctorAttendanceReportEmail({
      name: doctor.name,
      email: doctor.email,
      phcName: phcObj ? phcObj.name : 'Assigned PHC',
      attendanceSummary: {
        totalCheckpoints,
        presentCount,
        absentCount,
        complianceRate
      }
    });

    res.json({
      success: true,
      message: `Attendance Summary Report email sent live to Dr. ${doctor.name} (${doctor.email})`
    });

  } catch (err) {
    console.error('Send attendance report error:', err);
    res.status(500).json({ success: false, message: 'Error dispatching attendance report email' });
  }
};

exports.deleteDoctor = async (req, res) => {
  const docIndex = memoryStore.users.findIndex(u => String(u._id) === String(req.params.id) && u.role === 'DOCTOR');
  if (docIndex === -1) return res.status(404).json({ success: false, message: 'Doctor not found' });

  const targetDoc = memoryStore.users[docIndex];
  memoryStore.users.splice(docIndex, 1);
  saveMemoryStoreToDisk();

  if (!memoryStore.isInMemoryMode && mongoose.connection.readyState === 1) {
    try {
      await User.deleteOne({ _id: targetDoc._id });
    } catch (mErr) {
      console.warn('MongoDB Atlas delete notice:', mErr.message);
    }
  }

  res.json({ success: true, message: 'Doctor account removed successfully' });
};

// Admin Account Management by CMO
exports.getAllAdmins = (req, res) => {
  const admins = memoryStore.users.filter(u => u.role === 'ADMIN').map(a => {
    const phc = memoryStore.phcs.find(p => String(p._id) === String(a.assignedPHC));
    return { ...a, password: undefined, phcName: phc ? phc.name : 'Unassigned' };
  });
  res.json({ success: true, admins });
};

exports.createAdmin = async (req, res) => {
  try {
    const { name, email, username, password, mobile, qualification, assignedPHC } = req.body;
    if (!name || !email || !username || !password) {
      return res.status(400).json({ success: false, message: 'Missing required admin fields' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const rawUsername = username.trim();
    const cleanPassword = password.trim();

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(cleanPassword, salt);

    const newAdmin = {
      _id: 'admin_' + Date.now(),
      name: name.trim(),
      email: cleanEmail,
      username: rawUsername,
      password: hashedPassword,
      plainPassword: cleanPassword,
      role: 'ADMIN',
      mobile: mobile || '',
      qualification: qualification || 'MBBS, MHA',
      assignedPHC: assignedPHC || null,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    memoryStore.users.push(newAdmin);
    saveMemoryStoreToDisk();

    if (!memoryStore.isInMemoryMode && mongoose.connection.readyState === 1) {
      try {
        await User.create(newAdmin);
      } catch (mErr) {
        console.warn('MongoDB Atlas admin write notice:', mErr.message);
      }
    }

    res.status(201).json({ success: true, message: 'Admin account created successfully (Password set by CMO)', admin: { ...newAdmin, password: undefined } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error creating admin account' });
  }
};

// Request OTP to existing Admin email before editing Email or Password
exports.requestAdminEditOTP = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = memoryStore.users.find(u => String(u._id) === String(id) && u.role === 'ADMIN');
    if (!admin) return res.status(404).json({ success: false, message: 'Admin account not found' });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    adminEditOtpMap.set(String(id), {
      otpCode,
      expiresAt,
      existingEmail: admin.email
    });

    console.log(`🔑 Generated CMO Admin Edit OTP for ${admin.email}: ${otpCode}`);

    await sendPasswordResetOTPEmail({
      name: admin.name,
      email: admin.email,
      otpCode
    });

    res.json({
      success: true,
      existingEmail: admin.email,
      message: `OTP verification code sent live to Admin's registered email (${admin.email}).`
    });

  } catch (err) {
    console.error('Request Admin Edit OTP error:', err);
    res.status(500).json({ success: false, message: 'Server error generating OTP for Admin edit.' });
  }
};

exports.updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, otp } = req.body;

    const adminIndex = memoryStore.users.findIndex(u => String(u._id) === String(id) && u.role === 'ADMIN');
    if (adminIndex === -1) return res.status(404).json({ success: false, message: 'Admin account not found' });

    const currentAdmin = memoryStore.users[adminIndex];

    const isEmailChanged = email && email.trim().toLowerCase() !== currentAdmin.email.toLowerCase();
    const isPasswordChanged = password && password.trim() !== '';

    // Require OTP Verification if Email or Password is modified
    if (isEmailChanged || isPasswordChanged) {
      const otpRecord = adminEditOtpMap.get(String(id));
      if (!otpRecord) {
        return res.status(400).json({
          success: false,
          requireOtp: true,
          message: `OTP verification required to modify Admin email or password. Please request OTP sent to ${currentAdmin.email}.`
        });
      }

      if (Date.now() > otpRecord.expiresAt) {
        adminEditOtpMap.delete(String(id));
        return res.status(400).json({
          success: false,
          requireOtp: true,
          message: 'OTP verification code has expired. Please request a new OTP code.'
        });
      }

      if (!otp || otp.trim() !== otpRecord.otpCode) {
        return res.status(400).json({
          success: false,
          requireOtp: true,
          message: `Invalid OTP code. Please check OTP sent to ${currentAdmin.email}.`
        });
      }

      adminEditOtpMap.delete(String(id));
    }

    if (isPasswordChanged) {
      const cleanPass = password.trim();
      const salt = await bcrypt.genSalt(10);
      req.body.password = await bcrypt.hash(cleanPass, salt);
      req.body.plainPassword = cleanPass;
    } else {
      delete req.body.password;
    }

    delete req.body.otp;

    const updated = {
      ...currentAdmin,
      ...req.body
    };

    memoryStore.users[adminIndex] = updated;
    saveMemoryStoreToDisk();

    if (!memoryStore.isInMemoryMode && mongoose.connection.readyState === 1) {
      try {
        await User.updateOne({ _id: currentAdmin._id }, updated);
      } catch (mErr) {
        console.warn('MongoDB Atlas admin update notice:', mErr.message);
      }
    }

    res.json({
      success: true,
      message: `Admin account "${updated.name}" updated successfully!`,
      admin: { ...updated, password: undefined }
    });
  } catch (err) {
    console.error('Update Admin error:', err);
    res.status(500).json({ success: false, message: 'Error updating admin account' });
  }
};

exports.deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const adminIndex = memoryStore.users.findIndex(u => String(u._id) === String(id) && u.role === 'ADMIN');
    if (adminIndex === -1) return res.status(404).json({ success: false, message: 'Admin account not found' });

    const targetAdmin = memoryStore.users[adminIndex];
    memoryStore.users.splice(adminIndex, 1);
    saveMemoryStoreToDisk();

    if (!memoryStore.isInMemoryMode && mongoose.connection.readyState === 1) {
      try {
        await User.deleteOne({ _id: targetAdmin._id });
      } catch (mErr) {
        console.warn('MongoDB Atlas delete notice:', mErr.message);
      }
    }

    res.json({ success: true, message: `Admin account "${targetAdmin.name}" deleted successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error deleting admin account' });
  }
};
