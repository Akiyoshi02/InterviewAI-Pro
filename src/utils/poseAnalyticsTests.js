/**
 * Pose Analytics Tests
 * Test utilities and validation functions for pose detection analytics
 */

/**
 * Test data for pose analytics validation
 */
export const testPoseData = {
  // Good posture example
  goodPosture: {
    nose: { x: 320, y: 150, z: 0, visibility: 0.95 },
    leftShoulder: { x: 280, y: 200, z: 0, visibility: 0.92 },
    rightShoulder: { x: 360, y: 200, z: 0, visibility: 0.93 },
    leftElbow: { x: 260, y: 280, z: 0, visibility: 0.88 },
    rightElbow: { x: 380, y: 280, z: 0, visibility: 0.89 },
    leftWrist: { x: 250, y: 350, z: 0, visibility: 0.85 },
    rightWrist: { x: 390, y: 350, z: 0, visibility: 0.86 }
  },
  
  // Poor posture - slouching
  poorPostureSlouching: {
    nose: { x: 320, y: 180, z: 0, visibility: 0.94 },
    leftShoulder: { x: 285, y: 240, z: 0, visibility: 0.91 },
    rightShoulder: { x: 355, y: 240, z: 0, visibility: 0.92 },
    leftElbow: { x: 270, y: 310, z: 0, visibility: 0.87 },
    rightElbow: { x: 370, y: 310, z: 0, visibility: 0.88 },
    leftWrist: { x: 260, y: 370, z: 0, visibility: 0.84 },
    rightWrist: { x: 380, y: 370, z: 0, visibility: 0.85 }
  },
  
  // Poor posture - leaning
  poorPostureLeaning: {
    nose: { x: 280, y: 160, z: 0, visibility: 0.93 },
    leftShoulder: { x: 250, y: 210, z: 0, visibility: 0.90 },
    rightShoulder: { x: 310, y: 210, z: 0, visibility: 0.91 },
    leftElbow: { x: 230, y: 290, z: 0, visibility: 0.86 },
    rightElbow: { x: 330, y: 290, z: 0, visibility: 0.87 },
    leftWrist: { x: 220, y: 360, z: 0, visibility: 0.83 },
    rightWrist: { x: 340, y: 360, z: 0, visibility: 0.84 }
  }
};

/**
 * Calculate angle between three points
 */
export function calculateAngle(p1, p2, p3) {
  const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - 
                  Math.atan2(p1.y - p2.y, p1.x - p2.x);
  let angle = Math.abs(radians * 180 / Math.PI);
  if (angle > 180) {
    angle = 360 - angle;
  }
  return angle;
}

/**
 * Calculate distance between two points
 */
export function calculateDistance(p1, p2) {
  return Math.sqrt(
    Math.pow(p2.x - p1.x, 2) + 
    Math.pow(p2.y - p1.y, 2) + 
    Math.pow((p2.z || 0) - (p1.z || 0), 2)
  );
}

/**
 * Test posture detection accuracy
 */
export function testPostureDetection(poseData) {
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  // Test 1: Shoulder alignment
  const shoulderDiff = Math.abs(poseData.leftShoulder.y - poseData.rightShoulder.y);
  if (shoulderDiff < 20) {
    results.passed.push('Shoulder alignment: PASS (difference: ' + shoulderDiff.toFixed(1) + 'px)');
  } else if (shoulderDiff < 40) {
    results.warnings.push('Shoulder alignment: WARNING (difference: ' + shoulderDiff.toFixed(1) + 'px)');
  } else {
    results.failed.push('Shoulder alignment: FAIL (difference: ' + shoulderDiff.toFixed(1) + 'px)');
  }

  // Test 2: Head position (relative to shoulders)
  const shoulderMidY = (poseData.leftShoulder.y + poseData.rightShoulder.y) / 2;
  const headShoulderGap = shoulderMidY - poseData.nose.y;
  if (headShoulderGap > 40 && headShoulderGap < 80) {
    results.passed.push('Head position: PASS (gap: ' + headShoulderGap.toFixed(1) + 'px)');
  } else if (headShoulderGap >= 30 || headShoulderGap <= 90) {
    results.warnings.push('Head position: WARNING (gap: ' + headShoulderGap.toFixed(1) + 'px)');
  } else {
    results.failed.push('Head position: FAIL (gap: ' + headShoulderGap.toFixed(1) + 'px)');
  }

  // Test 3: Visibility scores
  const avgVisibility = Object.values(poseData).reduce((sum, point) => sum + point.visibility, 0) / Object.keys(poseData).length;
  if (avgVisibility > 0.85) {
    results.passed.push('Landmark visibility: PASS (avg: ' + (avgVisibility * 100).toFixed(1) + '%)');
  } else if (avgVisibility > 0.70) {
    results.warnings.push('Landmark visibility: WARNING (avg: ' + (avgVisibility * 100).toFixed(1) + '%)');
  } else {
    results.failed.push('Landmark visibility: FAIL (avg: ' + (avgVisibility * 100).toFixed(1) + '%)');
  }

  // Test 4: Body centering
  const shoulderMidX = (poseData.leftShoulder.x + poseData.rightShoulder.x) / 2;
  const noseCenterDiff = Math.abs(poseData.nose.x - shoulderMidX);
  if (noseCenterDiff < 20) {
    results.passed.push('Body centering: PASS (offset: ' + noseCenterDiff.toFixed(1) + 'px)');
  } else if (noseCenterDiff < 40) {
    results.warnings.push('Body centering: WARNING (offset: ' + noseCenterDiff.toFixed(1) + 'px)');
  } else {
    results.failed.push('Body centering: FAIL (offset: ' + noseCenterDiff.toFixed(1) + 'px)');
  }

  return results;
}

/**
 * Run all test cases
 */
export function runPoseAnalyticsTests() {
  console.log('=== Running Pose Analytics Tests ===\n');

  // Test good posture
  console.log('Test 1: Good Posture');
  const goodResults = testPostureDetection(testPoseData.goodPosture);
  console.log('✓ Passed:', goodResults.passed.length);
  console.log('⚠ Warnings:', goodResults.warnings.length);
  console.log('✗ Failed:', goodResults.failed.length);
  goodResults.passed.forEach(msg => console.log('  ✓', msg));
  goodResults.warnings.forEach(msg => console.log('  ⚠', msg));
  goodResults.failed.forEach(msg => console.log('  ✗', msg));
  console.log('');

  // Test slouching
  console.log('Test 2: Poor Posture - Slouching');
  const slouchResults = testPostureDetection(testPoseData.poorPostureSlouching);
  console.log('✓ Passed:', slouchResults.passed.length);
  console.log('⚠ Warnings:', slouchResults.warnings.length);
  console.log('✗ Failed:', slouchResults.failed.length);
  slouchResults.passed.forEach(msg => console.log('  ✓', msg));
  slouchResults.warnings.forEach(msg => console.log('  ⚠', msg));
  slouchResults.failed.forEach(msg => console.log('  ✗', msg));
  console.log('');

  // Test leaning
  console.log('Test 3: Poor Posture - Leaning');
  const leanResults = testPostureDetection(testPoseData.poorPostureLeaning);
  console.log('✓ Passed:', leanResults.passed.length);
  console.log('⚠ Warnings:', leanResults.warnings.length);
  console.log('✗ Failed:', leanResults.failed.length);
  leanResults.passed.forEach(msg => console.log('  ✓', msg));
  leanResults.warnings.forEach(msg => console.log('  ⚠', msg));
  leanResults.failed.forEach(msg => console.log('  ✗', msg));
  console.log('');

  console.log('=== Test Suite Complete ===');
}

/**
 * Validate pose analytics data structure
 */
export function validatePoseAnalyticsData(data) {
  const errors = [];
  const warnings = [];

  if (!data) {
    errors.push('Pose data is null or undefined');
    return { valid: false, errors, warnings };
  }

  // Check required landmarks
  const requiredLandmarks = ['nose', 'leftShoulder', 'rightShoulder'];
  requiredLandmarks.forEach(landmark => {
    if (!data[landmark]) {
      errors.push(`Missing required landmark: ${landmark}`);
    } else {
      if (typeof data[landmark].x !== 'number' || typeof data[landmark].y !== 'number') {
        errors.push(`Invalid coordinates for ${landmark}`);
      }
      if (typeof data[landmark].visibility !== 'number' || data[landmark].visibility < 0 || data[landmark].visibility > 1) {
        warnings.push(`Invalid visibility score for ${landmark}`);
      }
    }
  });

  // Check optional landmarks
  const optionalLandmarks = ['leftElbow', 'rightElbow', 'leftWrist', 'rightWrist'];
  optionalLandmarks.forEach(landmark => {
    if (data[landmark]) {
      if (typeof data[landmark].x !== 'number' || typeof data[landmark].y !== 'number') {
        warnings.push(`Invalid coordinates for ${landmark}`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Generate mock pose data for testing
 */
export function generateMockPoseData(variance = 5) {
  const baseData = testPoseData.goodPosture;
  const mockData = {};

  Object.keys(baseData).forEach(landmark => {
    mockData[landmark] = {
      x: baseData[landmark].x + (Math.random() - 0.5) * variance * 2,
      y: baseData[landmark].y + (Math.random() - 0.5) * variance * 2,
      z: baseData[landmark].z + (Math.random() - 0.5) * variance * 2,
      visibility: Math.min(1, Math.max(0, baseData[landmark].visibility + (Math.random() - 0.5) * 0.1))
    };
  });

  return mockData;
}

export default {
  testPoseData,
  calculateAngle,
  calculateDistance,
  testPostureDetection,
  runPoseAnalyticsTests,
  validatePoseAnalyticsData,
  generateMockPoseData
};
