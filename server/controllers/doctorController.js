const { memoryStore, saveMemoryStoreToDisk } = require('../config/db');
const { clearRemindersForDoctor } = require('../utils/cronScheduler');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Explanation = require('../models/Explanation');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const {
  sendDoctorRegistrationEmail,
  sendShiftUpdateEmail,
  sendPasswordResetOTPEmail,
  sendCustomMessageEmail,
  sendDoctorAttendanceReportEmail
} = require('../utils/emailService');

// Temporary in-memory OTP stores for credential edit authorizations
const adminEditOtpMap = new Map();
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

// Get All Registered Doctors (Workspace Isolated)
exports.getAllDoctors = async (req, res) => {
  try {
    const userWorkspace = req.user?.workspaceId || req.userDetails?.workspaceId || 'workspace_demo_public';
    let doctors = memoryStore.users.filter(u => u.role === 'DOCTOR' && (u.workspaceId || 'workspace_demo_public') === userWorkspace);

    const enriched = doctors.map(d => {
      const phc = memoryStore.phcs.find(p => String(p._id) === String(d.assignedPHC));
      return {
        ...d,
        gender: d.gender || 'Male',
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
    res.status(500).json({ success: false, message: 'Error fetching doctors' });
  }
};

// Create New Doctor (By CMO or Admin within Workspace)
exports.createDoctor = async (req, res) => {
  try {
    const userWorkspace = req.user?.workspaceId || req.userDetails?.workspaceId || 'workspace_demo_public';
    const { name, email, username, password, gender, mobile, qualification, specialization, assignedPHC, shiftStart, shiftEnd, faceData } = req.body;

    if (!name || !email || !username || !password) {
      return res.status(400).json({ success: false, message: 'Name, Email, Username, and Password are all required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const rawUsername = username.trim();
    const cleanUsername = rawUsername.toLowerCase();
    const cleanPassword = password.trim();

    let existing = memoryStore.users.find(u => 
      (u.workspaceId || 'workspace_demo_public') === userWorkspace &&
      (u.email.toLowerCase() === cleanEmail || u.username.toLowerCase() === cleanUsername)
    );

    if (!existing && !memoryStore.isInMemoryMode && mongoose.connection.readyState === 1) {
      try {
        const dbExisting = await User.findOne({
          workspaceId: userWorkspace,
          $or: [
            { email: new RegExp(`^${cleanEmail}$`, 'i') },
            { username: new RegExp(`^${cleanUsername}$`, 'i') }
          ]
        }).lean();
        if (dbExisting) existing = dbExisting;
      } catch (e) {}
    }

    if (existing) {
      return res.status(400).json({ success: false, message: 'An account with this email address or username already exists in your workspace.' });
    }

    let targetPhcId = assignedPHC;
    if (!targetPhcId || targetPhcId === '') {
      const phcsInWorkspace = memoryStore.phcs.filter(p => (p.workspaceId || 'workspace_demo_public') === userWorkspace);
      if (req.userDetails && req.userDetails.assignedPHC) {
        targetPhcId = req.userDetails.assignedPHC;
      } else if (phcsInWorkspace.length > 0) {
        targetPhcId = phcsInWorkspace[0]._id;
      }
    }

    const cleanShiftStart = (shiftStart || '09:00').trim();
    const cleanShiftEnd = (shiftEnd || '17:00').trim();

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(cleanPassword, salt);

    const docId = 'doc_' + Date.now();

    let faceAuthenticationObj = {
      model: 'FaceRecognitionNet',
      embeddingDimension: 128,
      embeddings: [],
      version: 1,
      updatedAt: new Date().toISOString()
    };

    if (faceData) {
      try {
        const parsed = typeof faceData === 'string' ? JSON.parse(faceData) : faceData;
        if (parsed && Array.isArray(parsed.embeddings) && parsed.embeddings.length > 0) {
          faceAuthenticationObj.embeddings = parsed.embeddings;
          faceAuthenticationObj.embeddingDimension = parsed.embeddings[0].length;
        } else if (parsed && Array.isArray(parsed.embedding)) {
          faceAuthenticationObj.embeddings = [parsed.embedding];
          faceAuthenticationObj.embeddingDimension = parsed.embedding.length;
        }
      } catch (e) {}
    }

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

    await sendPasswordResetOTPEmail({
      name: doctor.name,
      email: doctor.email,
      otpCode
    });

    res.json({
      success: true,
      existingEmail: doctor.email,
      message: `6-digit security OTP sent live to existing doctor email (${doctor.email}).`
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
    if (docIndex === -1) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const currentDoc = memoryStore.users[docIndex];
    const isEmailChanged = email && email.trim().toLowerCase() !== currentDoc.email.toLowerCase();
    const isPasswordChanged = password && password.trim().length > 0;
    const isFaceChanged = faceData && faceData !== currentDoc.faceData;

    if (isEmailChanged || isPasswordChanged || isFaceChanged) {
      const otpRecord = doctorEditOtpMap.get(String(id));
      if (!otpRecord) {
        return res.status(400).json({
          success: false,
          requireOtp: true,
          message: `OTP verification required to modify doctor credentials. Please request OTP sent to ${currentDoc.email}.`
        });
      }

      if (Date.now() > otpRecord.expiresAt) {
        doctorEditOtpMap.delete(String(id));
        return res.status(400).json({
          success: false,
          requireOtp: true,
          message: 'OTP code has expired. Please request a new code.'
        });
      }

      if (!otp || otp.trim() !== otpRecord.otpCode) {
        return res.status(400).json({
          success: false,
          requireOtp: true,
          message: `Invalid OTP code. Please check OTP sent to existing email (${currentDoc.email}).`
        });
      }

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

    res.json({
      success: true,
      message: `Doctor details updated successfully`,
      doctor: { ...updated, password: undefined, plainPassword: undefined }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error updating doctor' });
  }
};

// Delete Doctor Account
exports.deleteDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const docIdx = memoryStore.users.findIndex(u => String(u._id) === String(id) && u.role === 'DOCTOR');
    if (docIdx === -1) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const deletedDoctor = memoryStore.users.splice(docIdx, 1)[0];

    clearRemindersForDoctor(id);
    memoryStore.attendances = memoryStore.attendances.filter(a => String(a.doctor) !== String(id));
    memoryStore.explanations = memoryStore.explanations.filter(e => String(e.doctor) !== String(id));
    saveMemoryStoreToDisk();

    res.json({ success: true, message: `Doctor "${deletedDoctor.name}" removed successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error deleting doctor' });
  }
};

// Send Direct Test Registration Email
exports.sendTestDoctorEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = memoryStore.users.find(u => String(u._id) === String(id));
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

    const phcObj = memoryStore.phcs.find(p => String(p._id) === String(doctor.assignedPHC));

    sendDoctorRegistrationEmail({
      name: doctor.name,
      email: doctor.email,
      username: doctor.username,
      password: doctor.plainPassword || 'Set by Admin',
      shiftStart: formatTime12h(doctor.shiftStart),
      shiftEnd: formatTime12h(doctor.shiftEnd),
      phcName: phcObj ? phcObj.name : 'Assigned PHC'
    });

    res.json({
      success: true,
      message: `Direct registration credentials email sent live to Dr. ${doctor.name} (${doctor.email})`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to dispatch email' });
  }
};

// Send Attendance Audit Summary Email
exports.sendDoctorAttendanceReport = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = memoryStore.users.find(u => String(u._id) === String(id));
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

    const attendances = memoryStore.attendances.filter(a => String(a.doctor) === String(id));
    const presentCount = attendances.filter(a => a.status === 'PRESENT' || a.status === 'EXPLANATION_APPROVED').length;
    const absentCount = attendances.filter(a => a.status === 'ABSENT' || a.status === 'EXPLANATION_REJECTED').length;
    const totalCheckpoints = attendances.length || 0;
    const rate = totalCheckpoints > 0 ? Math.round((presentCount / totalCheckpoints) * 100) : 100;

    const phcObj = memoryStore.phcs.find(p => String(p._id) === String(doctor.assignedPHC));

    sendDoctorAttendanceReportEmail({
      name: doctor.name,
      email: doctor.email,
      attendanceSummary: {
        totalCheckpoints,
        presentCount,
        absentCount,
        complianceRate: `${rate}%`
      },
      phcName: phcObj ? phcObj.name : 'Assigned PHC'
    });

    res.json({
      success: true,
      message: `Attendance performance audit report dispatched to Dr. ${doctor.name} (${doctor.email})`
    });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send attendance report email' });
  }
};

// Send Custom Official Notice Email
exports.sendCustomNoticeEmail = async (req, res) => {
  try {
    const { recipientEmail, recipientName, subject, messageText } = req.body;
    if (!recipientEmail || !messageText) {
      return res.status(400).json({ success: false, message: 'Recipient Email and Message Content are required.' });
    }

    sendCustomMessageEmail({
      recipientName: recipientName || 'Medical Officer',
      recipientEmail: recipientEmail.trim(),
      subject: subject || 'Official Directorate Communication',
      messageText,
      senderRole: req.user.role || 'CMO'
    });

    res.json({
      success: true,
      message: `Official communication notice delivered live to ${recipientEmail}`
    });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to deliver notice email' });
  }
};

// --- ADMIN MANAGEMENT BY CMO (Workspace Isolated) ---

// Get All Admins (CMO only)
exports.getAllAdmins = async (req, res) => {
  try {
    const userWorkspace = req.user?.workspaceId || req.userDetails?.workspaceId || 'workspace_demo_public';
    const admins = memoryStore.users.filter(u => u.role === 'ADMIN' && (u.workspaceId || 'workspace_demo_public') === userWorkspace);

    const enriched = admins.map(a => {
      const phc = memoryStore.phcs.find(p => String(p._id) === String(a.assignedPHC));
      return {
        ...a,
        gender: a.gender || 'Male',
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

    await sendPasswordResetOTPEmail({
      name: admin.name,
      email: admin.email,
      otpCode
    });

    res.json({
      success: true,
      existingEmail: admin.email,
      message: `6-digit security OTP sent live to existing admin email (${admin.email}).`
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
          message: `Invalid or missing OTP code sent to existing email (${currentAdmin.email}).`
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

    res.json({
      success: true,
      message: `Admin details updated successfully`,
      admin: { ...updated, password: undefined, plainPassword: undefined }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating admin' });
  }
};

// Delete Admin Account
exports.deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const adminIdx = memoryStore.users.findIndex(u => String(u._id) === String(id) && u.role === 'ADMIN');
    if (adminIdx === -1) return res.status(404).json({ success: false, message: 'Admin not found' });

    const deletedAdmin = memoryStore.users[adminIdx];
    const phcId = deletedAdmin.assignedPHC;

    const adminDoctors = memoryStore.users.filter(u => 
      u.role === 'DOCTOR' && 
      (String(u.assignedPHC) === String(phcId) || String(u.createdByAdmin) === String(id))
    );
    const doctorIdsToDelete = adminDoctors.map(d => String(d._id));

    doctorIdsToDelete.forEach(docId => clearRemindersForDoctor(docId));
    memoryStore.users.splice(adminIdx, 1);

    memoryStore.users = memoryStore.users.filter(u => !(
      u.role === 'DOCTOR' && 
      (String(u.assignedPHC) === String(phcId) || String(u.createdByAdmin) === String(id))
    ));

    memoryStore.attendances = memoryStore.attendances.filter(a => 
      String(a.phc) !== String(phcId) && !doctorIdsToDelete.includes(String(a.doctor))
    );

    memoryStore.explanations = memoryStore.explanations.filter(e => 
      String(e.phc) !== String(phcId) && !doctorIdsToDelete.includes(String(a.doctor))
    );

    saveMemoryStoreToDisk();

    res.json({
      success: true,
      message: `Admin "${deletedAdmin.name}" and assigned doctor account(s) deleted.`
    });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Error deleting Admin account.' });
  }
};
