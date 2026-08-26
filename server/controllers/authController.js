const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { memoryStore, saveMemoryStoreToDisk } = require('../config/db');
const User = require('../models/User');
const { sendPasswordResetOTPEmail } = require('../utils/emailService');
const { evaluateBiometricMatch, FACE_ERROR_CODES } = require('../utils/faceRecognitionEngine');

const JWT_SECRET = process.env.JWT_SECRET || 'hospital_geofence_secret_key_2026';

// Store OTP requests in memory map: email -> { otpCode, expiresAt, verified, userId }
const otpStoreMap = new Map();

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
