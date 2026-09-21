const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const { memoryStore, saveMemoryStoreToDisk } = require('../config/db');
const { 
  sendDoctorRegistrationEmail, 
  sendShiftUpdateEmail, 
  sendPasswordResetOTPEmail, 
  sendCustomMessageEmail, 
  sendDoctorAttendanceReportEmail 
} = require('../utils/emailService');
const { triggerImmediateReminderTest } = require('../utils/cronScheduler');

// Map to store temporary Doctor & Admin edit OTPs in memory
const doctorEditOtpMap = new Map();
const adminEditOtpMap = new Map();

// Helper to format 24h/12h timestamp
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

// Test & Simulate Duty Reminder Email Dispatch Immediately
exports.testDutyReminderSchedule = async (req, res) => {
  try {
    const { doctorId } = req.body || {};
    const results = await triggerImmediateReminderTest(doctorId);
    res.json({
      success: true,
      message: `Test duty reminder emails dispatched successfully to ${results.length} active doctor(s).`,
      results
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to test duty reminder schedule' });
  }
};

// Get Duty Reminders Audit Log for Admin Monitoring
exports.getDutyRemindersLog = async (req, res) => {
  try {
    const reminders = (memoryStore.notifications || []).filter(n => n.type === 'DUTY_REMINDER');
    res.json({
      success: true,
      count: reminders.length,
      reminders
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch duty reminders log' });
  }
};

// Get All Doctors (Filtered by Caller Workspace)
exports.getAllDoctors = async (req, res) => {
  try {
    const userWorkspace = req.user?.workspaceId || req.userDetails?.workspaceId || 'workspace_demo_public';
    const docs = memoryStore.users.filter(u => u.role === 'DOCTOR' && (u.workspaceId || 'workspace_demo_public') === userWorkspace);

    const enriched = docs.map(doc => {
      const phc = memoryStore.phcs.find(p => String(p._id) === String(doc.assignedPHC));
      return {
        ...doc,
        password: undefined,
        plainPassword: undefined,
        phcDetails: phc ? {
          _id: phc._id,
          name: phc.name,
          address: phc.address,
          district: phc.district
        } : null
      };
    });

    res.json({ success: true, count: enriched.length, doctors: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error loading doctors list' });
  }
};

// Create New Doctor Account
exports.createDoctor = async (req, res) => {
  try {
    const userWorkspace = req.user?.workspaceId || req.userDetails?.workspaceId || 'workspace_demo_public';
    const { 
      name, email, username, password, gender, mobile, qualification, 
      specialization, assignedPHC, shiftStart, shiftEnd, faceData 
    } = req.body;

    if (!name || !email || !username || !password) {
      return res.status(400).json({ success: false, message: 'Name, Email, Username, and Password are required fields.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const rawUsername = username.trim();
    const cleanUsername = rawUsername.toLowerCase();
    const cleanPassword = password.trim();

    // Check duplicate in workspace
    let existing = memoryStore.users.find(u => 
      (u.workspaceId || 'workspace_demo_public') === userWorkspace &&
      (u.email.toLowerCase() === cleanEmail || u.username.toLowerCase() === cleanUsername)
    );

    if (existing) {
      return res.status(400).json({ success: false, message: 'An account with this email address or username already exists in your workspace.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(cleanPassword, salt);

    const docId = 'doc_' + Date.now();
    const cleanShiftStart = shiftStart || '11:15';
    const cleanShiftEnd = shiftEnd || '16:15';

    let faceAuthenticationObj = null;
    if (faceData) {
      try {
        const parsed = typeof faceData === 'string' ? JSON.parse(faceData) : faceData;
        if (parsed && parsed.descriptor) {
          faceAuthenticationObj = {
            embeddings: Array.isArray(parsed.descriptor) ? parsed.descriptor : Array.from(parsed.descriptor),
            enrolledAt: new Date().toISOString()
          };
        }
      } catch (pErr) {
        console.warn('Face landmark parse notice:', pErr.message);
      }
    }

    const targetPhcId = assignedPHC || (req.user?.assignedPHC) || (memoryStore.phcs[0] ? memoryStore.phcs[0]._id : null);

    const newDoctor = {
      _id: docId,
      name: name.trim(),
      email: cleanEmail,
      username: rawUsername,
      password: hashedPassword,
      plainPassword: cleanPassword,
      role: 'DOCTOR',
      gender: gender || 'Male',
      mobile: mobile || '',
      qualification: qualification || 'MBBS, MD',
      specialization: specialization || 'General Physician',
      assignedPHC: targetPhcId || null,
      shiftStart: cleanShiftStart,
      shiftEnd: cleanShiftEnd,
      profilePhoto: '',
      faceData: faceData || '',
      faceAuthentication: faceAuthenticationObj,
      workspaceId: userWorkspace,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    memoryStore.users.push(newDoctor);
    saveMemoryStoreToDisk();

    // MongoDB Atlas Mongoose Persistence
    if (mongoose.connection.readyState === 1) {
      try {
        await User.create(newDoctor);
      } catch (mErr) {
        console.warn('MongoDB Atlas doctor create notice:', mErr.message);
      }
    }

    const phcObj = memoryStore.phcs.find(p => String(p._id) === String(targetPhcId));
    
    // Dispatch Welcome Credentials Email
    await sendDoctorRegistrationEmail({
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
      message: `Doctor account created successfully. Credentials sent to ${cleanEmail}`,
      doctor: { ...newDoctor, password: undefined, plainPassword: undefined }
    });

  } catch (err) {
    console.error('Create doctor error:', err);
    res.status(500).json({ success: false, message: 'Server error creating doctor profile' });
  }
};

// Request OTP to existing doctor email before modifying Email or Password or Face
exports.requestDoctorEditOTP = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = memoryStore.users.find(u => String(u._id) === String(id));
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor account not found' });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    doctorEditOtpMap.set(String(id), {
      otpCode,
      expiresAt,
      existingEmail: doctor.email
    });

    const callerEmail = req.user?.email || req.userDetails?.email;

    // Dispatch OTP to Doctor's email
    await sendPasswordResetOTPEmail({
      name: doctor.name,
      email: doctor.email,
      otpCode
    });

    // Also dispatch copy to caller email (Admin/CMO) if different and real email
    if (callerEmail && callerEmail !== doctor.email && callerEmail.includes('@')) {
      await sendPasswordResetOTPEmail({
        name: `Admin/CMO (${doctor.name} Authorization)`,
        email: callerEmail,
        otpCode
      });
    }

    res.json({
      success: true,
      existingEmail: doctor.email,
      message: `6-digit security OTP sent live to ${doctor.email}${callerEmail ? ` and ${callerEmail}` : ''}.`
    });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error generating OTP for Doctor edit.' });
  }
};

// Update Doctor Details
exports.updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, faceData, otp } = req.body;

    const docIndex = memoryStore.users.findIndex(u => String(u._id) === String(id));
    if (docIndex === -1) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

    const currentDoc = memoryStore.users[docIndex];
    const isEmailChanged = email && email.trim().toLowerCase() !== currentDoc.email.toLowerCase();
    const isPasswordChanged = password && password.trim().length > 0;
    const isFaceChanged = faceData && faceData !== currentDoc.faceData;

    // Enforce 6-Digit OTP verification if sensitive fields are modified
    if (isEmailChanged || isPasswordChanged || isFaceChanged) {
      const otpRecord = doctorEditOtpMap.get(String(id));
      if (!otpRecord || Date.now() > otpRecord.expiresAt || !otp || otp.trim() !== otpRecord.otpCode) {
        return res.status(400).json({
          success: false,
          requireOtp: true,
          message: 'Security OTP verification required or code invalid/expired. Please verify the 6-digit OTP code sent to email.'
        });
      }
      // OTP verified -> consume OTP
      doctorEditOtpMap.delete(String(id));
    }

    const fieldsToUpdate = { ...req.body };
    delete fieldsToUpdate.otp;

    if (fieldsToUpdate.email) fieldsToUpdate.email = fieldsToUpdate.email.trim().toLowerCase();
    if (fieldsToUpdate.username) fieldsToUpdate.username = fieldsToUpdate.username.trim();

    if (isPasswordChanged) {
      const salt = await bcrypt.genSalt(10);
      fieldsToUpdate.password = await bcrypt.hash(password.trim(), salt);
      fieldsToUpdate.plainPassword = password.trim();
    } else {
      delete fieldsToUpdate.password;
    }

    if (isFaceChanged && faceData) {
      try {
        const parsed = typeof faceData === 'string' ? JSON.parse(faceData) : faceData;
        if (parsed && parsed.descriptor) {
          fieldsToUpdate.faceAuthentication = {
            embeddings: Array.isArray(parsed.descriptor) ? parsed.descriptor : Array.from(parsed.descriptor),
            enrolledAt: new Date().toISOString()
          };
        }
      } catch (pErr) {
        console.warn('Update face descriptor notice:', pErr.message);
      }
    }

    const updatedDoc = {
      ...currentDoc,
      ...fieldsToUpdate
    };

    memoryStore.users[docIndex] = updatedDoc;
    saveMemoryStoreToDisk();

    // MongoDB Atlas Mongoose Persistence
    if (mongoose.connection.readyState === 1) {
      try {
        await User.findByIdAndUpdate(id, { $set: updatedDoc }, { new: true, upsert: true });
      } catch (mErr) {
        console.warn('MongoDB Atlas doctor update notice:', mErr.message);
      }
    }

    // Check if shift timing changed -> trigger notification email
    const isShiftStartChanged = req.body.shiftStart && req.body.shiftStart !== currentDoc.shiftStart;
    const isShiftEndChanged = req.body.shiftEnd && req.body.shiftEnd !== currentDoc.shiftEnd;

    if (isShiftStartChanged || isShiftEndChanged) {
      const phcObj = memoryStore.phcs.find(p => String(p._id) === String(updatedDoc.assignedPHC));
      await sendShiftUpdateEmail({
        name: updatedDoc.name,
        email: updatedDoc.email,
        shiftStart: formatTime12h(updatedDoc.shiftStart),
        shiftEnd: formatTime12h(updatedDoc.shiftEnd),
        phcName: phcObj ? phcObj.name : 'Assigned PHC'
      });
    }

    res.json({
      success: true,
      message: `Doctor "${updatedDoc.name}" details updated successfully.`,
      doctor: { ...updatedDoc, password: undefined, plainPassword: undefined }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating doctor profile' });
  }
};

// Send Manual Custom Notice Email to Doctor
exports.sendCustomNoticeEmail = async (req, res) => {
  try {
    const { recipientEmail, recipientName, subject, messageText } = req.body;
    if (!recipientEmail || !messageText) {
      return res.status(400).json({ success: false, message: 'Recipient email and message text are required.' });
    }

    await sendCustomMessageEmail({
      recipientName: recipientName || 'Medical Officer',
      recipientEmail,
      subject: subject || 'Official Directorate Communication Notice',
      messageText,
      senderRole: req.user?.role || 'Directorate'
    });

    res.json({
      success: true,
      message: `Official notice email sent successfully to ${recipientEmail}.`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to dispatch custom notice email' });
  }
};

// Send Test Email to Doctor
exports.sendTestDoctorEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = memoryStore.users.find(u => String(u._id) === String(id));
    if (!doc) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const phcObj = memoryStore.phcs.find(p => String(p._id) === String(doc.assignedPHC));

    await sendDoctorRegistrationEmail({
      name: doc.name,
      email: doc.email,
      username: doc.username || doc.email,
      password: doc.plainPassword || 'Set by Admin',
      shiftStart: formatTime12h(doc.shiftStart),
      shiftEnd: formatTime12h(doc.shiftEnd),
      phcName: phcObj ? phcObj.name : 'Assigned PHC'
    });

    res.json({
      success: true,
      message: `Test credentials & schedule email sent to Dr. ${doc.name} (${doc.email}).`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send test doctor email' });
  }
};

// Send Attendance Performance Audit Report to Doctor
exports.sendDoctorAttendanceReport = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = memoryStore.users.find(u => String(u._id) === String(id));
    if (!doc) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const docAtts = memoryStore.attendances.filter(a => String(a.doctor) === String(id));
    const totalCount = docAtts.length;
    const presentCount = docAtts.filter(a => a.status === 'PRESENT' || a.status === 'EXPLANATION_APPROVED').length;
    const absentCount = docAtts.filter(a => a.status === 'ABSENT' || a.status === 'EXPLANATION_REJECTED').length;
    const complianceRate = totalCount > 0 ? `${Math.round((presentCount / totalCount) * 100)}%` : '100%';

    const phcObj = memoryStore.phcs.find(p => String(p._id) === String(doc.assignedPHC));

    await sendDoctorAttendanceReportEmail({
      name: doc.name,
      email: doc.email,
      attendanceSummary: {
        totalCheckpoints: totalCount,
        presentCount,
        absentCount,
        complianceRate
      },
      phcName: phcObj ? phcObj.name : 'Assigned PHC'
    });

    res.json({
      success: true,
      message: `Attendance audit performance report dispatched to Dr. ${doc.name} (${doc.email}).`
    });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send attendance report email' });
  }
};

// Delete Doctor Account
exports.deleteDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const docIndex = memoryStore.users.findIndex(u => String(u._id) === String(id));
    if (docIndex === -1) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const doc = memoryStore.users[docIndex];
    memoryStore.users.splice(docIndex, 1);
    saveMemoryStoreToDisk();

    // MongoDB Atlas Mongoose Deletion
    if (mongoose.connection.readyState === 1) {
      try {
        await User.findByIdAndDelete(id);
      } catch (mErr) {
        console.warn('MongoDB Atlas doctor delete notice:', mErr.message);
      }
    }

    res.json({
      success: true,
      message: `Doctor account "${doc.name}" removed successfully.`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error deleting doctor' });
  }
};

// ==========================================
// ADMINISTRATOR MANAGEMENT (CMO ONLY)
// ==========================================

// Get All Admins (Filtered by Workspace)
exports.getAllAdmins = async (req, res) => {
  try {
    const userWorkspace = req.user?.workspaceId || req.userDetails?.workspaceId || 'workspace_demo_public';
    const admins = memoryStore.users.filter(u => u.role === 'ADMIN' && (u.workspaceId || 'workspace_demo_public') === userWorkspace);

    const enriched = admins.map(adm => {
      const phc = memoryStore.phcs.find(p => String(p._id) === String(adm.assignedPHC));
      return {
        ...adm,
        password: undefined,
        plainPassword: undefined,
        phcDetails: phc ? {
          _id: phc._id,
          name: phc.name,
          address: phc.address,
          district: phc.district
        } : null
      };
    });

    res.json({ success: true, count: enriched.length, admins: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error loading admins list' });
  }
};

// Create Admin (CMO only)
exports.createAdmin = async (req, res) => {
  try {
    const userWorkspace = req.user?.workspaceId || req.userDetails?.workspaceId || 'workspace_demo_public';
    const { name, email, username, password, gender, assignedPHC, mobile } = req.body;

    if (!name || !email || !username || !password) {
      return res.status(400).json({ success: false, message: 'Name, Email, Username, and Password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const rawUsername = username.trim();
    const cleanUsername = rawUsername.toLowerCase();
    const cleanPassword = password.trim();

    let existing = memoryStore.users.find(u => 
      (u.workspaceId || 'workspace_demo_public') === userWorkspace &&
      (u.email.toLowerCase() === cleanEmail || u.username.toLowerCase() === cleanUsername)
    );

    if (existing) {
      return res.status(400).json({ success: false, message: 'An account with this email address or username already exists in your workspace.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(cleanPassword, salt);

    const adminId = 'admin_' + Date.now();
    const phcsInWorkspace = memoryStore.phcs.filter(p => (p.workspaceId || 'workspace_demo_public') === userWorkspace);

    const newAdmin = {
      _id: adminId,
      name: name.trim(),
      email: cleanEmail,
      username: rawUsername,
      password: hashedPassword,
      plainPassword: cleanPassword,
      role: 'ADMIN',
      gender: gender || 'Male',
      mobile: mobile || '',
      assignedPHC: assignedPHC || (phcsInWorkspace[0] ? phcsInWorkspace[0]._id : null),
      workspaceId: userWorkspace,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    memoryStore.users.push(newAdmin);
    saveMemoryStoreToDisk();

    // MongoDB Atlas Mongoose Persistence
    if (mongoose.connection.readyState === 1) {
      try {
        await User.create(newAdmin);
      } catch (mErr) {
        console.warn('MongoDB Atlas admin create notice:', mErr.message);
      }
    }

    res.status(201).json({
      success: true,
      message: `Admin account "${newAdmin.name}" created successfully.`,
      admin: { ...newAdmin, password: undefined, plainPassword: undefined }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Error creating Admin' });
  }
};

// Request OTP to existing Admin email before CMO modifies Email or Password
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

    const callerEmail = req.user?.email || req.userDetails?.email;

    // Dispatch OTP to Admin's registered email
    await sendPasswordResetOTPEmail({
      name: admin.name,
      email: admin.email,
      otpCode
    });

    // Also dispatch copy to caller email (CMO) if different and real email
    if (callerEmail && callerEmail !== admin.email && callerEmail.includes('@')) {
      await sendPasswordResetOTPEmail({
        name: `CMO (${admin.name} Authorization)`,
        email: callerEmail,
        otpCode
      });
    }

    res.json({
      success: true,
      existingEmail: admin.email,
      message: `6-digit security OTP sent live to ${admin.email}${callerEmail ? ` and ${callerEmail}` : ''}.`
    });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error generating OTP for Admin edit.' });
  }
};

// Update Admin Details by CMO
exports.updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, otp } = req.body;

    const adminIndex = memoryStore.users.findIndex(u => String(u._id) === String(id) && u.role === 'ADMIN');
    if (adminIndex === -1) return res.status(404).json({ success: false, message: 'Admin account not found' });

    const currentAdmin = memoryStore.users[adminIndex];
    const isEmailChanged = email && email.trim().toLowerCase() !== currentAdmin.email.toLowerCase();
    const isPasswordChanged = password && password.trim().length > 0;

    if (isEmailChanged || isPasswordChanged) {
      const otpRecord = adminEditOtpMap.get(String(id));
      if (!otpRecord || Date.now() > otpRecord.expiresAt || !otp || otp.trim() !== otpRecord.otpCode) {
        return res.status(400).json({
          success: false,
          requireOtp: true,
          message: 'Security OTP verification required or code invalid/expired.'
        });
      }
      adminEditOtpMap.delete(String(id));
    }

    const fieldsToUpdate = { ...req.body };
    delete fieldsToUpdate.otp;

    if (fieldsToUpdate.email) fieldsToUpdate.email = fieldsToUpdate.email.trim().toLowerCase();
    if (fieldsToUpdate.username) fieldsToUpdate.username = fieldsToUpdate.username.trim();

    if (isPasswordChanged) {
      const salt = await bcrypt.genSalt(10);
      fieldsToUpdate.password = await bcrypt.hash(password.trim(), salt);
      fieldsToUpdate.plainPassword = password.trim();
    } else {
      delete fieldsToUpdate.password;
    }

    const updatedAdmin = {
      ...currentAdmin,
      ...fieldsToUpdate
    };

    memoryStore.users[adminIndex] = updatedAdmin;
    saveMemoryStoreToDisk();

    // MongoDB Atlas Mongoose Persistence
    if (mongoose.connection.readyState === 1) {
      try {
        await User.findByIdAndUpdate(id, { $set: updatedAdmin }, { new: true, upsert: true });
      } catch (mErr) {
        console.warn('MongoDB Atlas admin update notice:', mErr.message);
      }
    }

    res.json({
      success: true,
      message: `Admin account "${updatedAdmin.name}" updated successfully.`,
      admin: { ...updatedAdmin, password: undefined, plainPassword: undefined }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating admin account' });
  }
};

// Delete Admin Account by CMO
exports.deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const adminIndex = memoryStore.users.findIndex(u => String(u._id) === String(id) && u.role === 'ADMIN');
    if (adminIndex === -1) return res.status(404).json({ success: false, message: 'Admin account not found' });

    const admin = memoryStore.users[adminIndex];
    memoryStore.users.splice(adminIndex, 1);
    saveMemoryStoreToDisk();

    // MongoDB Atlas Mongoose Deletion
    if (mongoose.connection.readyState === 1) {
      try {
        await User.findByIdAndDelete(id);
      } catch (mErr) {
        console.warn('MongoDB Atlas admin delete notice:', mErr.message);
      }
    }

    res.json({
      success: true,
      message: `Admin account "${admin.name}" removed successfully.`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error deleting admin account' });
  }
};
