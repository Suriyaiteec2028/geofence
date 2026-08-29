/**
 * Deep Face Recognition & Biometric Verification Engine
 * Implements 1:1 Cosine Similarity matching over normalized 128D deep embeddings
 * with calibrated thresholding, multi-pose aggregation, and standardized error codes.
 */

const DEFAULT_THRESHOLD = parseFloat(process.env.FACE_SIMILARITY_THRESHOLD || '0.72');

/**
 * Computes Cosine Similarity between two N-dimensional numerical embeddings.
 * @param {Array<number>} vecA - First embedding vector
 * @param {Array<number>} vecB - Second embedding vector
 * @returns {number} Normalized similarity score between -1.0 and 1.0 (typically 0.0 to 1.0 for normalized face embeddings)
 */
function calculateCosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB)) return 0;
  if (vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const valA = Number(vecA[i]) || 0;
    const valB = Number(vecB[i]) || 0;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Number(similarity.toFixed(4));
}

/**
 * Evaluates live face embedding against a set of 3-5 registered multi-pose embeddings for a user.
 * Uses Maximum Similarity aggregation while enforcing the calibrated threshold.
 * 
 * @param {Array<number>} liveEmbedding - Deep feature vector extracted from live camera frame
 * @param {Array<Array<number>>|Array<number>} registeredEmbeddings - Stored registered embedding(s)
 * @param {number} [customThreshold] - Optional override threshold
 * @returns {Object} { isMatch: boolean, similarityScore: number, thresholdUsed: number, matches: Array<number> }
 */
function evaluateBiometricMatch(liveEmbedding, registeredEmbeddings, customThreshold) {
  const threshold = customThreshold !== undefined ? customThreshold : DEFAULT_THRESHOLD;

  if (!Array.isArray(liveEmbedding) || liveEmbedding.length === 0) {
    return { isMatch: false, similarityScore: 0, thresholdUsed: threshold, matches: [], errorCode: 'NO_LIVE_EMBEDDING' };
  }

  // Handle single vector or array of vectors
  let regList = [];
  if (Array.isArray(registeredEmbeddings)) {
    if (registeredEmbeddings.length > 0 && Array.isArray(registeredEmbeddings[0])) {
      regList = registeredEmbeddings;
    } else if (typeof registeredEmbeddings[0] === 'number') {
      regList = [registeredEmbeddings];
    }
  }

  if (regList.length === 0) {
    return { isMatch: false, similarityScore: 0, thresholdUsed: threshold, matches: [], errorCode: 'NO_REGISTERED_EMBEDDINGS' };
  }

  // Compute similarity against all registered pose embeddings
  const matches = regList.map(regVec => calculateCosineSimilarity(liveEmbedding, regVec));
  const maxSimilarity = Math.max(...matches, 0);

  const isMatch = maxSimilarity >= threshold;

  return {
    isMatch,
    similarityScore: maxSimilarity,
    thresholdUsed: threshold,
    matches,
    errorCode: isMatch ? null : 'FACE_NOT_MATCHED'
  };
}

/**
 * Standardized Face Recognition Error Codes & User Messages
 */
const FACE_ERROR_CODES = {
  NO_FACE: 'No face detected. Please ensure your face is clearly visible inside the camera frame.',
  MULTIPLE_FACES: 'Please make sure only one person is visible in front of the camera.',
  LOW_QUALITY: 'Poor image quality. Please move closer to the camera and ensure good room lighting.',
  FACE_TOO_SMALL: 'Face is too far from camera. Please move closer.',
  LIVENESS_FAILED: 'Anti-spoofing verification failed. Please align your face naturally and blink.',
  FACE_NOT_MATCHED: 'Biometric Face Verification Failed! Live face scan does not match registered doctor profile.',
  AUTHENTICATION_SUCCESS: 'Biometric face verification successful.',
  MODEL_ERROR: 'Biometric model error processing face frame.'
};

module.exports = {
  calculateCosineSimilarity,
  evaluateBiometricMatch,
  FACE_ERROR_CODES,
  DEFAULT_THRESHOLD
};
