/**
 * Automated Unit Test Suite for Upgraded Face Recognition Engine
 * Tests 1:1 Cosine Similarity, Multi-Pose Aggregation, Thresholding, and Error Codes
 */

const { calculateCosineSimilarity, evaluateBiometricMatch, FACE_ERROR_CODES, DEFAULT_THRESHOLD } = require('../utils/faceRecognitionEngine');

function runUnitTests() {
  console.log('🧪 Starting Automated Biometric Face Recognition Unit Tests...\n');
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition, testName) {
    totalCount++;
    if (condition) {
      console.log(`✅ [PASS] Test ${totalCount}: ${testName}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] Test ${totalCount}: ${testName}`);
    }
  }

  // Generate synthetic normalized 128D vectors for testing
  const createVector = (seed, len = 128) => {
    const vec = [];
    let norm = 0;
    for (let i = 0; i < len; i++) {
      const val = Math.sin(seed + i);
      vec.push(val);
      norm += val * val;
    }
    const mag = Math.sqrt(norm);
    return vec.map(v => Number((v / mag).toFixed(4)));
  };

  const registeredPose1 = createVector(1.0);
  const registeredPose2 = createVector(1.1); // Slightly different pose of same person
  const registeredPose3 = createVector(0.9); // Slightly different pose of same person
  const registeredUserPoses = [registeredPose1, registeredPose2, registeredPose3];

  const genuineLiveFace = createVector(1.02); // Same person live scan
  const impostorLiveFace = createVector(5.5);  // Completely different person

  // Test 1: Identical / Same Person Match (Should PASS)
  const evalGenuine = evaluateBiometricMatch(genuineLiveFace, registeredUserPoses, 0.65);
  assert(evalGenuine.isMatch === true && evalGenuine.similarityScore > 0.80, `Registered Person Match -> PASS (Score: ${(evalGenuine.similarityScore * 100).toFixed(1)}%)`);

  // Test 2: Completely Different Person / Impostor (Should FAIL)
  const evalImpostor = evaluateBiometricMatch(impostorLiveFace, registeredUserPoses, 0.65);
  assert(evalImpostor.isMatch === false && evalImpostor.similarityScore < 0.65, `Impostor / Different Person -> FAIL (Score: ${(evalImpostor.similarityScore * 100).toFixed(1)}%)`);

  // Test 3: No Face / Empty Live Embedding (Should FAIL)
  const evalNoFace = evaluateBiometricMatch([], registeredUserPoses, 0.65);
  assert(evalNoFace.isMatch === false && evalNoFace.errorCode === 'NO_LIVE_EMBEDDING', 'No Face Detected Frame -> FAIL with NO_LIVE_EMBEDDING');

  // Test 4: Unregistered Doctor / Empty Registered Embeddings (Should FAIL)
  const evalNoReg = evaluateBiometricMatch(genuineLiveFace, [], 0.65);
  assert(evalNoReg.isMatch === false && evalNoReg.errorCode === 'NO_REGISTERED_EMBEDDINGS', 'Unregistered Biometric Profile -> FAIL with NO_REGISTERED_EMBEDDINGS');

  // Test 5: Cosine Similarity Orthogonal Vectors Test
  const vecX = [1, 0, 0, 0];
  const vecY = [0, 1, 0, 0];
  const scoreOrthogonal = calculateCosineSimilarity(vecX, vecY);
  assert(scoreOrthogonal === 0, 'Orthogonal Vectors Similarity Score equals 0.0');

  // Test 6: Cosine Similarity Identical Vectors Test
  const scoreIdentical = calculateCosineSimilarity(registeredPose1, registeredPose1);
  assert(scoreIdentical >= 0.99, `Identical Vectors Cosine Similarity equals 1.0 (Got ${scoreIdentical})`);

  console.log(`\n📊 Unit Test Summary: ${passedCount} / ${totalCount} Tests Passed Successfully!\n`);

  if (passedCount === totalCount) {
    console.log('🎉 ALL BIOMETRIC ENGINE UNIT TESTS PASSED!');
  } else {
    process.exit(1);
  }
}

if (require.main === module) {
  runUnitTests();
}

module.exports = runUnitTests;
