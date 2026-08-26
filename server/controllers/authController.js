const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { memoryStore, saveMemoryStoreToDisk } = require('../config/db');
const User = require('../models/User');
const { sendPasswordResetOTPEmail, sendCMORegistrationOTPEmail } = require('../utils/emailService');
const { evaluateBiometricMatch, FACE_ERROR_CODES } = require('../utils/faceRecognitionEngine');

const JWT_SECRET = process.env.JWT_SECRET || 'hospital_geofence_secret_key_2026';

// Store Password Reset OTP requests: email -> { otpCode, expiresAt, verified, userId }
const otpStoreMap = new Map();

// Store Master CMO Registration OTP requests: email -> { otpCode, expiresAt, lastRequestedAt, attemptsLeft, verified }
const cmoOtpStoreMap = new Map();

// Unified Facial Feature Vector Normalizer Fallback
function extractFacialMatrix(faceDataInput) {
  if (!faceDataInput) return new Array(128).fill(0);

  let rawValues = null;

  if (typeof faceDataInput === 'object') {
    if (Array.isArray(faceDataInput.embedding)) return faceDataInput.embedding;
    if (Array.isArray(faceDataInput.matrix)) return faceDataInput.matrix;
  }

  if (typeof faceDataInput === 'string' && faceDataInput.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(faceDataInput);
      if (parsed && Array.isArray(parsed.embedding)) return parsed.embedding;
      if (parsed && Array.isArray(parsed.matrix)) return parsed.matrix;
      if (parsed && parsed.image) faceDataInput = parsed.image;
    } catch (e) {}
  }

  const base64Str = typeof faceDataInput === 'string' ? faceDataInput : '';
  const parts = base64Str.split(',');
  const payload = parts.length > 1 ? parts[1] : base64Str;
  if (!payload || payload.length < 100) return new Array(128).fill(0);

  const rawLums = [];
  let totalLum = 0;
  const step = payload.length / 128;
  for (let i = 0; i < 128; i++) {
    const idx = Math.floor(i * step);
    const code = payload.charCodeAt(idx) || 0;
    rawLums.push(code);
    totalLum += code;
  }
  const avgLum = totalLum / 128 || 128;
  return rawLums.map(l => Number(((l - avgLum) / 128).toFixed(4)));
}

// Doctor Step 1: Pre-verify Doctor Credentials & Check if Face Enrollment exists
exports.verifyDoctorCredentials = async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ success: false, message: 'Doctor username/email and password are required.' });
    }

    const inputClean = usernameOrEmail.trim().toLowerCase();
    const passwordClean = password.trim();

    let user = memoryStore.users.find(u => 
      (u.role === 'DOCTOR') && 
      (
        (u.email && u.email.toLowerCase() === inputClean) || 
        (u.username && u.username.toLowerCase() === inputClean) ||
        (u.username && u.username.trim() === usernameOrEmail.trim())
      )
    );

    if (!user && !memoryStore.isInMemoryMode && mongoose.connection.readyState === 1) {
      try {
        const dbUser = await User.findOne({
          role: 'DOCTOR',
          $or: [
            { email: new RegExp(`^${inputClean}$`, 'i') },
            { username: new RegExp(`^${inputClean}$`, 'i') }
          ]
        }).lean();
        if (dbUser) user = dbUser;
      } catch (e) {}
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Doctor account not found with provided username or email.' });
    }

    const isMatch = await bcrypt.compare(passwordClean, user.password);
    if (!isMatch && user.plainPassword && user.plainPassword === passwordClean) {
      // Fallback plain text match
    } else if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect doctor password.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Doctor account is inactive. Please contact administration.' });
    }

    const hasEmbeddings = user.faceAuthentication && Array.isArray(user.faceAuthentication.embeddings) && user.faceAuthentication.embeddings.length > 0;
    const requiresFaceSetup = !hasEmbeddings && !user.faceData;

    res.json({
      success: true,
      message: 'Doctor credentials verified! Proceed to 2-step biometric face scan.',
      requiresFaceSetup,
      doctorName: user.name,
      doctorId: user._id
    });

  } catch (err) {
    console.error('Verify doctor error:', err);
    res.status(500).json({ success: false, message: 'Server error verifying doctor credentials' });
  }
};

// Doctor Step 2: Biometric 2-Step Facial Scan Verification & Login
exports.doctorFaceLogin = async (req, res) => {
  try {
    const { usernameOrEmail, password, liveFaceData } = req.body;

    if (!usernameOrEmail || !password || !liveFaceData) {
      return res.status(400).json({ success: false, message: 'Doctor credentials and live biometric face scan are required.' });
    }

    const inputClean = usernameOrEmail.trim().toLowerCase();
    const passwordClean = password.trim();

    let user = memoryStore.users.find(u => 
      (u.role === 'DOCTOR') && 
      (
        (u.email && u.email.toLowerCase() === inputClean) || 
        (u.username && u.username.toLowerCase() === inputClean) ||
        (u.username && u.username.trim() === usernameOrEmail.trim())
      )
    );

    if (!user && !memoryStore.isInMemoryMode && mongoose.connection.readyState === 1) {
      try {
        const dbUser = await User.findOne({
          role: 'DOCTOR',
          $or: [
            { email: new RegExp(`^${inputClean}$`, 'i') },
            { username: new RegExp(`^${inputClean}$`, 'i') }
          ]
        }).lean();
        if (dbUser) user = dbUser;
      } catch (e) {}
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Doctor account not found.' });
    }

    const isMatch = await bcrypt.compare(passwordClean, user.password);
    if (!isMatch && user.plainPassword && user.plainPassword === passwordClean) {
      // Fallback
    } else if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect doctor password.' });
    }

    // Parse Live Embedding
    let liveEmbedding = null;
    if (typeof liveFaceData === 'object' && Array.isArray(liveFaceData.embedding)) {
      liveEmbedding = liveFaceData.embedding;
    } else if (typeof liveFaceData === 'string') {
      try {
        const parsed = JSON.parse(liveFaceData);
        if (parsed && Array.isArray(parsed.embedding)) liveEmbedding = parsed.embedding;
        else if (parsed && Array.isArray(parsed.matrix)) liveEmbedding = parsed.matrix;
      } catch (e) {}
    }

    if (!liveEmbedding) {
      liveEmbedding = extractFacialMatrix(liveFaceData);
    }

    // Retrieve Registered Embeddings
    let registeredEmbeddings = [];
    if (user.faceAuthentication && Array.isArray(user.faceAuthentication.embeddings) && user.faceAuthentication.embeddings.length > 0) {
      registeredEmbeddings = user.faceAuthentication.embeddings;
    } else if (user.faceData) {
      registeredEmbeddings = [extractFacialMatrix(user.faceData)];
    }

    if (registeredEmbeddings.length === 0) {
      // Auto-enroll first face on login if account has no face profile yet
      const docIdx = memoryStore.users.findIndex(u => String(u._id) === String(user._id));
      const authProfile = {
        model: 'FaceRecognitionNet',
        embeddingDimension: liveEmbedding.length,
        embeddings: [liveEmbedding],
        version: 1,
        updatedAt: new Date().toISOString()
      };
      if (docIdx !== -1) {
        memoryStore.users[docIdx].faceAuthentication = authProfile;
        memoryStore.users[docIdx].faceData = JSON.stringify({ embedding: liveEmbedding });
        saveMemoryStoreToDisk();
      }
      user.faceAuthentication = authProfile;
    } else {
      // Execute 1:1 Cosine Similarity Verification over multi-pose registered embeddings
      const evalResult = evaluateBiometricMatch(liveEmbedding, registeredEmbeddings);

      console.log(`👤 Biometric Match Score for Dr. ${user.name}: ${(evalResult.similarityScore * 100).toFixed(1)}% (Threshold: ${(evalResult.thresholdUsed * 100).toFixed(1)}%)`);

      if (!evalResult.isMatch) {
        return res.status(401).json({
          success: false,
          errorCode: evalResult.errorCode || 'FACE_NOT_MATCHED',
          message: `🚫 Biometric Face Verification Failed! Live face scan (${(evalResult.similarityScore * 100).toFixed(1)}%) does not match Dr. ${user.name}'s registered facial profile. Proxy attendance is strictly prohibited.`
        });
      }
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    let phcDetails = null;
    if (user.assignedPHC) {
      phcDetails = memoryStore.phcs.find(p => String(p._id) === String(user.assignedPHC));
    }

    res.json({
      success: true,
      message: `Biometric Face Scan Verified! Welcome Dr. ${user.name}`,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        gender: user.gender || 'Male',
        qualification: user.qualification,
        specialization: user.specialization,
        assignedPHC: user.assignedPHC,
        phcDetails
      }
    });

  } catch (err) {
    console.error('Doctor face login error:', err);
    res.status(500).json({ success: false, message: 'Server error during doctor biometric face login' });
  }
};

// Generic Auth Login (CMO & Admin)
exports.login = async (req, res) => {
  try {
    const { usernameOrEmail, password, role } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({ success: false, message: 'Username/Email and Password are required.' });
    }

    const inputClean = usernameOrEmail.trim().toLowerCase();
    const passwordClean = password.trim();

    let user = memoryStore.users.find(u => 
      (u.email && u.email.toLowerCase() === inputClean) || 
      (u.username && u.username.toLowerCase() === inputClean)
    );

    if (!user && !memoryStore.isInMemoryMode && mongoose.connection.readyState === 1) {
      try {
        const dbUser = await User.findOne({
          $or: [
            { email: new RegExp(`^${inputClean}$`, 'i') },
            { username: new RegExp(`^${inputClean}$`, 'i') }
          ]
        }).lean();
        if (dbUser) user = dbUser;
      } catch (e) {}
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username/email or password.' });
    }

    if (role && user.role !== role) {
      return res.status(403).json({ success: false, message: `Access denied. Account is registered as ${user.role}.` });
    }

    const isMatch = await bcrypt.compare(passwordClean, user.password);
    if (!isMatch && user.plainPassword && user.plainPassword === passwordClean) {
      // Fallback
    } else if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username/email or password.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Account is inactive. Contact administration.' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      role: user.role,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        gender: user.gender || 'Male',
        assignedPHC: user.assignedPHC
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

// ==========================================
// MASTER CMO REGISTRATION WITH LIVE OTP FLOW
// ==========================================

// 1. Request Master CMO Registration OTP
exports.cmoRequestOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid official email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check Cooldown (60 seconds)
    const existingRecord = cmoOtpStoreMap.get(cleanEmail);
    if (existingRecord && existingRecord.lastRequestedAt && (Date.now() - existingRecord.lastRequestedAt < 60000)) {
      const remainingSecs = Math.ceil((60000 - (Date.now() - existingRecord.lastRequestedAt)) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${remainingSecs} second(s) before requesting a new OTP.`,
        cooldownSeconds: remainingSecs
      });
    }

    // Generate 6-Digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes validity

    cmoOtpStoreMap.set(cleanEmail, {
      otpCode,
      expiresAt,
      lastRequestedAt: Date.now(),
      attemptsLeft: 3,
      verified: false
    });

    // Send Live Email
    sendCMORegistrationOTPEmail({ email: cleanEmail, otpCode });

    res.json({
      success: true,
      message: `Master CMO verification OTP sent to ${cleanEmail}. Please check your email inbox.`,
      cooldownSeconds: 60
    });

  } catch (err) {
    console.error('CMO request OTP error:', err);
    res.status(500).json({ success: false, message: 'Error sending Master CMO verification OTP' });
  }
};

// 2. Verify Master CMO Registration OTP (Max 3 Attempts Enforcement)
exports.cmoVerifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email address and OTP code are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    const record = cmoOtpStoreMap.get(cleanEmail);

    if (!record || Date.now() > record.expiresAt) {
      return res.status(400).json({ success: false, message: 'OTP has expired or was not requested. Please request a new OTP.' });
    }

    if (record.attemptsLeft <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 3 invalid OTP attempts reached. Please wait for cooldown to request a new OTP.',
        attemptsLeft: 0
      });
    }

    if (record.otpCode !== cleanOtp) {
      record.attemptsLeft -= 1;
      cmoOtpStoreMap.set(cleanEmail, record);

      if (record.attemptsLeft <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Wrong OTP! Maximum 3 invalid attempts reached. Please request a new OTP code after 1-minute cooldown.',
          attemptsLeft: 0
        });
      } else {
        return res.status(400).json({
          success: false,
          message: `Wrong OTP! You have ${record.attemptsLeft} attempt(s) remaining.`,
          attemptsLeft: record.attemptsLeft
        });
      }
    }

    // OTP Verified Successfully
    record.verified = true;
    cmoOtpStoreMap.set(cleanEmail, record);

    res.json({
      success: true,
      message: 'OTP verified successfully! Please enter your Master CMO username and password to complete registration.'
    });

  } catch (err) {
    console.error('CMO verify OTP error:', err);
    res.status(500).json({ success: false, message: 'Error verifying OTP code' });
  }
};

// 3. Complete Master CMO Account Registration & Setup Credentials
exports.cmoCompleteRegistration = async (req, res) => {
  try {
    const { name, email, otp, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Full Name, Email, and Password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const record = cmoOtpStoreMap.get(cleanEmail);

    if (!record || !record.verified) {
      return res.status(400).json({ success: false, message: 'Valid OTP verification is required before setting CMO credentials.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password.trim(), salt);

    let cmoUser = memoryStore.users.find(u => u.role === 'CMO' || (u.email && u.email.toLowerCase() === cleanEmail));

    if (cmoUser) {
      cmoUser.name = name.trim();
      cmoUser.email = cleanEmail;
      cmoUser.username = cleanEmail;
      cmoUser.password = hashedPassword;
      cmoUser.plainPassword = password.trim();
      cmoUser.role = 'CMO';
      cmoUser.status = 'ACTIVE';
    } else {
      cmoUser = {
        _id: 'cmo_' + Date.now(),
        name: name.trim(),
        email: cleanEmail,
        username: cleanEmail,
        password: hashedPassword,
        plainPassword: password.trim(),
        role: 'CMO',
        gender: 'Male',
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      };
      memoryStore.users.unshift(cmoUser);
    }

    saveMemoryStoreToDisk();

    if (!memoryStore.isInMemoryMode && mongoose.connection.readyState === 1) {
      try {
        await User.findOneAndUpdate(
          { role: 'CMO' },
          { name: name.trim(), email: cleanEmail, username: cleanEmail, password: hashedPassword, plainPassword: password.trim(), status: 'ACTIVE' },
          { upsert: true }
        );
      } catch (e) {}
    }

    cmoOtpStoreMap.delete(cleanEmail);

    const token = jwt.sign(
      { id: cmoUser._id, role: cmoUser.role, email: cmoUser.email, name: cmoUser.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: `Master CMO account registered successfully! Welcome ${cmoUser.name}`,
      token,
      role: 'CMO',
      user: {
        _id: cmoUser._id,
        name: cmoUser.name,
        email: cmoUser.email,
        role: 'CMO'
      }
    });

  } catch (err) {
    console.error('CMO registration error:', err);
    res.status(500).json({ success: false, message: 'Server error completing Master CMO registration' });
  }
};

// Request Password Reset OTP
exports.requestPasswordResetOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email address is required.' });

    const cleanEmail = email.trim().toLowerCase();
    const user = memoryStore.users.find(u => u.email && u.email.toLowerCase() === cleanEmail);

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account registered with this email address.' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

    otpStoreMap.set(cleanEmail, { otpCode, expiresAt, verified: false, userId: user._id });

    sendPasswordResetOTPEmail({
      name: user.name,
      email: cleanEmail,
      otpCode
    });

    res.json({
      success: true,
      message: `Verification OTP sent to ${cleanEmail}. Please check your email inbox.`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error sending password reset OTP' });
  }
};

// Verify Password Reset OTP
exports.verifyPasswordResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required.' });

    const cleanEmail = email.trim().toLowerCase();
    const record = otpStoreMap.get(cleanEmail);

    if (!record || record.otpCode !== otp.trim() || Date.now() > record.expiresAt) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP code.' });
    }

    record.verified = true;
    otpStoreMap.set(cleanEmail, record);

    res.json({ success: true, message: 'OTP verified successfully. You may now reset your password.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error verifying OTP' });
  }
};

// Reset Password With OTP
exports.resetPasswordWithOTP = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const record = otpStoreMap.get(cleanEmail);

    if (!record || record.otpCode !== otp.trim() || !record.verified) {
      return res.status(400).json({ success: false, message: 'OTP verification required before resetting password.' });
    }

    const userIndex = memoryStore.users.findIndex(u => String(u._id) === String(record.userId));
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword.trim(), salt);

    memoryStore.users[userIndex].password = hashedPassword;
    memoryStore.users[userIndex].plainPassword = newPassword.trim();
    saveMemoryStoreToDisk();

    if (!memoryStore.isInMemoryMode && mongoose.connection.readyState === 1) {
      try {
        await User.updateOne({ _id: record.userId }, { password: hashedPassword, plainPassword: newPassword.trim() });
      } catch (e) {}
    }

    otpStoreMap.delete(cleanEmail);

    res.json({ success: true, message: 'Password reset successfully! You can now log in with your new password.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error resetting password' });
  }
};

// Get Current User Profile
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = memoryStore.users.find(u => String(u._id) === String(userId));
    if (!user) return res.status(404).json({ success: false, message: 'User profile not found.' });

    let phcDetails = null;
    if (user.assignedPHC) {
      phcDetails = memoryStore.phcs.find(p => String(p._id) === String(user.assignedPHC));
    }

    res.json({
      success: true,
      user: {
        ...user,
        password: undefined,
        plainPassword: undefined,
        phcDetails
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching user profile' });
  }
};
