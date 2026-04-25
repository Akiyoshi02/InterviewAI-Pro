/**
 * ============================================================================
 * COMPREHENSIVE MEDIAPIPE REFERENCE DATA LIBRARY
 * Research-Grade Implementation for Interview Body Language Analysis
 * ============================================================================
 * 
 * This file contains complete reference values for detecting and scoring
 * ALL aspects of body language during video interviews using MediaPipe.
 * 
 * DETECTION MODELS USED:
 * 1. PoseLandmarker - 33 body landmarks (full body skeleton)
 * 2. FaceLandmarker - 478 facial landmarks (468 face + 10 iris)
 * 3. HandLandmarker - 21 landmarks per hand (42 total for both hands)
 * 
 * TOTAL LANDMARKS TRACKED: 553 points
 * 
 * Research Sources:
 * - Nonverbal Communication in Professional Settings (Mehrabian, 1971)
 * - Body Language in Job Interviews (Gifford et al., 1985)
 * - Facial Action Coding System - FACS (Ekman & Friesen, 1978)
 * - MediaPipe Documentation (Google, 2023)
 * - Interview Performance Assessment Studies
 * 
 * @author InterviewAI Pro Research Team
 * @version 3.0.0 - Complete Research Edition
 * @lastUpdated 2026-01-28
 */

// ============================================================================
// SECTION 1: POSE LANDMARKS (33 Total)
// ============================================================================

/**
 * MediaPipe PoseLandmarker provides 33 landmarks
 * 
 * Coordinate System:
 * - X: Horizontal position (0 = left edge, 1 = right edge of frame)
 * - Y: Vertical position (0 = top edge, 1 = bottom edge of frame)
 * - Z: Depth (smaller values = closer to camera)
 * - Visibility: Confidence score (0-1) that landmark is visible
 * - Presence: Confidence score (0-1) that landmark exists in frame
 */
export const POSE_LANDMARKS = {
  // === FACE (0-10) ===
  NOSE: 0,                    // Tip of nose
  LEFT_EYE_INNER: 1,          // Inner corner of left eye
  LEFT_EYE: 2,                // Center of left eye
  LEFT_EYE_OUTER: 3,          // Outer corner of left eye
  RIGHT_EYE_INNER: 4,         // Inner corner of right eye
  RIGHT_EYE: 5,               // Center of right eye
  RIGHT_EYE_OUTER: 6,         // Outer corner of right eye
  LEFT_EAR: 7,                // Left ear tragion
  RIGHT_EAR: 8,               // Right ear tragion
  MOUTH_LEFT: 9,              // Left corner of mouth
  MOUTH_RIGHT: 10,            // Right corner of mouth
  
  // === UPPER BODY (11-22) ===
  LEFT_SHOULDER: 11,          // Left shoulder joint
  RIGHT_SHOULDER: 12,         // Right shoulder joint
  LEFT_ELBOW: 13,             // Left elbow joint
  RIGHT_ELBOW: 14,            // Right elbow joint
  LEFT_WRIST: 15,             // Left wrist joint
  RIGHT_WRIST: 16,            // Right wrist joint
  LEFT_PINKY: 17,             // Left pinky finger MCP
  RIGHT_PINKY: 18,            // Right pinky finger MCP
  LEFT_INDEX: 19,             // Left index finger MCP
  RIGHT_INDEX: 20,            // Right index finger MCP
  LEFT_THUMB: 21,             // Left thumb CMC
  RIGHT_THUMB: 22,            // Right thumb CMC
  
  // === LOWER BODY (23-32) ===
  LEFT_HIP: 23,               // Left hip joint
  RIGHT_HIP: 24,              // Right hip joint
  LEFT_KNEE: 25,              // Left knee joint
  RIGHT_KNEE: 26,             // Right knee joint
  LEFT_ANKLE: 27,             // Left ankle joint
  RIGHT_ANKLE: 28,            // Right ankle joint
  LEFT_HEEL: 29,              // Left heel
  RIGHT_HEEL: 30,             // Right heel
  LEFT_FOOT_INDEX: 31,        // Left foot index toe
  RIGHT_FOOT_INDEX: 32,       // Right foot index toe
};

/**
 * Pose Landmark Groups for organized access
 */
export const POSE_GROUPS = {
  FACE: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  EYES: [1, 2, 3, 4, 5, 6],
  EARS: [7, 8],
  MOUTH: [9, 10],
  SHOULDERS: [11, 12],
  ELBOWS: [13, 14],
  WRISTS: [15, 16],
  HANDS_BASIC: [15, 16, 17, 18, 19, 20, 21, 22],
  LEFT_ARM: [11, 13, 15],
  RIGHT_ARM: [12, 14, 16],
  LEFT_HAND_BASIC: [15, 17, 19, 21],
  RIGHT_HAND_BASIC: [16, 18, 20, 22],
  TORSO: [11, 12, 23, 24],
  HIPS: [23, 24],
  LEGS: [23, 24, 25, 26, 27, 28],
  FEET: [27, 28, 29, 30, 31, 32],
  UPPER_BODY: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
  FULL_BODY: Array.from({ length: 33 }, (_, i) => i),
};

/**
 * Pose Landmark Names for display
 */
export const POSE_LANDMARK_NAMES = {
  0: 'Nose',
  1: 'Left Eye (Inner)',
  2: 'Left Eye',
  3: 'Left Eye (Outer)',
  4: 'Right Eye (Inner)',
  5: 'Right Eye',
  6: 'Right Eye (Outer)',
  7: 'Left Ear',
  8: 'Right Ear',
  9: 'Mouth (Left)',
  10: 'Mouth (Right)',
  11: 'Left Shoulder',
  12: 'Right Shoulder',
  13: 'Left Elbow',
  14: 'Right Elbow',
  15: 'Left Wrist',
  16: 'Right Wrist',
  17: 'Left Pinky',
  18: 'Right Pinky',
  19: 'Left Index',
  20: 'Right Index',
  21: 'Left Thumb',
  22: 'Right Thumb',
  23: 'Left Hip',
  24: 'Right Hip',
  25: 'Left Knee',
  26: 'Right Knee',
  27: 'Left Ankle',
  28: 'Right Ankle',
  29: 'Left Heel',
  30: 'Right Heel',
  31: 'Left Foot Index',
  32: 'Right Foot Index',
};

/**
 * Pose Skeleton Connections for drawing
 */
export const POSE_CONNECTIONS = [
  // Face
  [0, 1], [1, 2], [2, 3], [3, 7],  // Left eye to ear
  [0, 4], [4, 5], [5, 6], [6, 8],  // Right eye to ear
  [9, 10],                          // Mouth
  // Arms
  [11, 13], [13, 15],               // Left arm
  [12, 14], [14, 16],               // Right arm
  [15, 17], [15, 19], [15, 21],     // Left hand
  [16, 18], [16, 20], [16, 22],     // Right hand
  // Torso
  [11, 12],                          // Shoulders
  [11, 23], [12, 24],                // Shoulders to hips
  [23, 24],                          // Hips
  // Legs
  [23, 25], [25, 27], [27, 29], [27, 31],  // Left leg
  [24, 26], [26, 28], [28, 30], [28, 32],  // Right leg
];


// ============================================================================
// SECTION 2: HAND LANDMARKS (21 per hand, 42 total)
// ============================================================================

/**
 * MediaPipe HandLandmarker provides 21 landmarks per hand
 * 
 * Hand Anatomy Reference:
 * - CMC: Carpometacarpal joint
 * - MCP: Metacarpophalangeal joint (knuckle)
 * - PIP: Proximal interphalangeal joint
 * - DIP: Distal interphalangeal joint
 * - TIP: Fingertip
 */
export const HAND_LANDMARKS = {
  // === WRIST ===
  WRIST: 0,                   // Wrist center
  
  // === THUMB (1-4) ===
  THUMB_CMC: 1,               // Thumb carpometacarpal joint
  THUMB_MCP: 2,               // Thumb metacarpophalangeal joint
  THUMB_IP: 3,                // Thumb interphalangeal joint
  THUMB_TIP: 4,               // Thumb tip
  
  // === INDEX FINGER (5-8) ===
  INDEX_FINGER_MCP: 5,        // Index finger knuckle
  INDEX_FINGER_PIP: 6,        // Index finger first joint
  INDEX_FINGER_DIP: 7,        // Index finger second joint
  INDEX_FINGER_TIP: 8,        // Index finger tip
  
  // === MIDDLE FINGER (9-12) ===
  MIDDLE_FINGER_MCP: 9,       // Middle finger knuckle
  MIDDLE_FINGER_PIP: 10,      // Middle finger first joint
  MIDDLE_FINGER_DIP: 11,      // Middle finger second joint
  MIDDLE_FINGER_TIP: 12,      // Middle finger tip
  
  // === RING FINGER (13-16) ===
  RING_FINGER_MCP: 13,        // Ring finger knuckle
  RING_FINGER_PIP: 14,        // Ring finger first joint
  RING_FINGER_DIP: 15,        // Ring finger second joint
  RING_FINGER_TIP: 16,        // Ring finger tip
  
  // === PINKY FINGER (17-20) ===
  PINKY_MCP: 17,              // Pinky finger knuckle
  PINKY_PIP: 18,              // Pinky finger first joint
  PINKY_DIP: 19,              // Pinky finger second joint
  PINKY_TIP: 20,              // Pinky finger tip
};

/**
 * Hand Landmark Groups
 */
export const HAND_GROUPS = {
  WRIST: [0],
  THUMB: [1, 2, 3, 4],
  INDEX: [5, 6, 7, 8],
  MIDDLE: [9, 10, 11, 12],
  RING: [13, 14, 15, 16],
  PINKY: [17, 18, 19, 20],
  FINGERTIPS: [4, 8, 12, 16, 20],
  KNUCKLES: [5, 9, 13, 17],
  ALL_FINGERS: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
};

/**
 * Hand Landmark Names
 */
export const HAND_LANDMARK_NAMES = {
  0: 'Wrist',
  1: 'Thumb CMC',
  2: 'Thumb MCP',
  3: 'Thumb IP',
  4: 'Thumb Tip',
  5: 'Index MCP',
  6: 'Index PIP',
  7: 'Index DIP',
  8: 'Index Tip',
  9: 'Middle MCP',
  10: 'Middle PIP',
  11: 'Middle DIP',
  12: 'Middle Tip',
  13: 'Ring MCP',
  14: 'Ring PIP',
  15: 'Ring DIP',
  16: 'Ring Tip',
  17: 'Pinky MCP',
  18: 'Pinky PIP',
  19: 'Pinky DIP',
  20: 'Pinky Tip',
};

/**
 * Hand Skeleton Connections
 */
export const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle finger
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring finger
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm connections
  [5, 9], [9, 13], [13, 17],
];


// ============================================================================
// SECTION 3: FACE LANDMARKS (478 total)
// ============================================================================

/**
 * MediaPipe FaceLandmarker provides 478 landmarks
 * - 468 face mesh landmarks
 * - 10 iris landmarks (5 per eye)
 * 
 * Key landmark indices for interview analysis
 */
export const FACE_LANDMARKS = {
  // === FACE SILHOUETTE / OVAL ===
  FACE_OVAL: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
  
  // === LEFT EYE (16 landmarks) ===
  LEFT_EYE: [263, 249, 390, 373, 374, 380, 381, 382, 362, 466, 388, 387, 386, 385, 384, 398],
  LEFT_EYE_TOP: 386,
  LEFT_EYE_BOTTOM: 374,
  LEFT_EYE_INNER: 362,
  LEFT_EYE_OUTER: 263,
  LEFT_EYE_UPPER_LID: [386, 387, 388, 466],
  LEFT_EYE_LOWER_LID: [374, 373, 390, 249],
  
  // === RIGHT EYE (16 landmarks) ===
  RIGHT_EYE: [33, 7, 163, 144, 145, 153, 154, 155, 133, 246, 161, 160, 159, 158, 157, 173],
  RIGHT_EYE_TOP: 159,
  RIGHT_EYE_BOTTOM: 145,
  RIGHT_EYE_INNER: 133,
  RIGHT_EYE_OUTER: 33,
  RIGHT_EYE_UPPER_LID: [159, 160, 161, 246],
  RIGHT_EYE_LOWER_LID: [145, 144, 163, 7],
  
  // === LEFT IRIS (5 landmarks: 473-477) ===
  LEFT_IRIS: [474, 475, 476, 477],
  LEFT_IRIS_CENTER: 473,
  
  // === RIGHT IRIS (5 landmarks: 468-472) ===
  RIGHT_IRIS: [469, 470, 471, 472],
  RIGHT_IRIS_CENTER: 468,
  
  // === LEFT EYEBROW (10 landmarks) ===
  LEFT_EYEBROW: [336, 296, 334, 293, 300, 276, 283, 282, 295, 285],
  LEFT_EYEBROW_INNER: 285,
  LEFT_EYEBROW_OUTER: 336,
  LEFT_EYEBROW_TOP: 334,
  
  // === RIGHT EYEBROW (10 landmarks) ===
  RIGHT_EYEBROW: [107, 66, 105, 63, 70, 46, 53, 52, 65, 55],
  RIGHT_EYEBROW_INNER: 55,
  RIGHT_EYEBROW_OUTER: 107,
  RIGHT_EYEBROW_TOP: 105,
  
  // === NOSE ===
  NOSE_TIP: 1,
  NOSE_BOTTOM: 2,
  NOSE_BRIDGE: 6,
  NOSE_LEFT_ALAR: 129,
  NOSE_RIGHT_ALAR: 358,
  NOSE_TOP: 168,
  
  // === LIPS / MOUTH ===
  LIPS_OUTER: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185],
  LIPS_INNER: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191],
  UPPER_LIP_TOP: 0,
  UPPER_LIP_BOTTOM: 13,
  LOWER_LIP_TOP: 14,
  LOWER_LIP_BOTTOM: 17,
  MOUTH_LEFT: 61,
  MOUTH_RIGHT: 291,
  LEFT_LIP_CORNER: 61,
  RIGHT_LIP_CORNER: 291,
  
  // === FACE REFERENCE POINTS ===
  FOREHEAD_CENTER: 10,
  FOREHEAD_LEFT: 67,
  FOREHEAD_RIGHT: 297,
  CHIN: 152,
  CHIN_LEFT: 172,
  CHIN_RIGHT: 397,
  LEFT_CHEEK: 234,
  RIGHT_CHEEK: 454,
  LEFT_TEMPLE: 54,
  RIGHT_TEMPLE: 284,
  LEFT_JAW: 132,
  RIGHT_JAW: 361,
};


// ============================================================================
// SECTION 4: POSTURE REFERENCE VALUES & THRESHOLDS
// ============================================================================

/**
 * Research-backed posture thresholds
 * All values are normalized (0-1) based on MediaPipe output
 */
export const POSTURE_REFERENCE = {
  
  // === SHOULDER ANALYSIS ===
  shoulders: {
    alignment: {
      excellent: 0.015,      // < 1.5% Y-difference between shoulders
      good: 0.030,           // < 3% difference
      fair: 0.050,           // < 5% difference
      poor: 0.080,           // < 8% difference
      critical: 0.100,       // >= 10% difference
    },
    width: {
      veryOpen: 0.45,        // Very confident/open posture
      open: 0.38,            // Open, relaxed posture
      neutral: 0.32,         // Normal stance
      closed: 0.26,          // Closed/defensive
      veryClosed: 0.20,      // Very defensive
    },
    tension: {
      relaxed: 0.12,         // Normal shoulder-to-ear distance ratio
      slight: 0.09,          // Slight tension
      moderate: 0.06,        // Moderate stress
      high: 0.04,            // High tension (raised shoulders)
    },
  },
  
  // === SPINE/BACK ALIGNMENT ===
  spine: {
    forwardLean: {
      engaged: 0.02,         // Slight forward lean (interest)
      neutral: 0.00,         // Upright
      slightBack: -0.02,     // Slight backward lean
      disengaged: -0.05,     // Leaning back (disinterest)
      poorPosture: 0.08,     // Too far forward (slouching)
    },
    lateralLean: {
      centered: 0.02,        // Well centered
      slight: 0.04,          // Slight lean
      moderate: 0.06,        // Noticeable lean
      significant: 0.10,     // Significant lean
    },
    verticalAngle: {
      excellent: 5,          // Within 5° of vertical
      good: 10,              // Within 10°
      fair: 15,              // Within 15°
      poor: 25,              // Within 25°
      slouching: 35,         // Significant slouch
    },
    // Legacy aliases for useInterviewAnalytics (forward head distance thresholds)
    maxForwardHeadThreshold: 0.03,
    moderateForwardHeadThreshold: 0.06,
    poorForwardHeadThreshold: 0.10,
  },
  
  // === HEAD POSITION ===
  head: {
    tilt: {
      level: 3,              // Very level (degrees)
      slight: 7,             // Slight tilt
      moderate: 12,          // Moderate tilt
      significant: 18,       // Significant tilt
    },
    turn: {
      facing: 10,            // Facing forward
      slight: 20,            // Slight turn
      moderate: 35,          // Looking away
      turnedAway: 50,        // Significantly turned
    },
    pitch: {
      level: 8,              // Level gaze
      slightUp: 15,          // Looking slightly up
      slightDown: 12,        // Looking slightly down
      up: 25,                // Looking up
      down: 20,              // Looking down
    },
    forwardPosition: {
      good: 0.03,            // Head over shoulders
      fair: 0.06,            // Slight forward
      poor: 0.10,            // Notable forward
      severe: 0.15,          // Severe forward head
    },
    // Legacy aliases for useInterviewAnalytics
    loweredThreshold: 0.03,
    poorTiltThreshold: 18,
    maxTiltThreshold: 7,
  },
  
  // === UPPER BODY ===
  upperBody: {
    symmetry: {
      excellent: 0.97,       // 97%+ symmetry
      good: 0.93,            // 93%+ symmetry
      fair: 0.88,            // 88%+ symmetry
      poor: 0.80,            // 80%+ symmetry
    },
    frameCentering: {
      centered: 0.05,        // Within 5% of center
      good: 0.10,            // Within 10%
      acceptable: 0.15,      // Within 15%
      offCenter: 0.25,       // More than 25% off
    },
  },
  
  // === ARM POSITION ===
  arms: {
    crossing: {
      open: 0.35,            // Arms apart
      neutral: 0.20,         // Neutral
      crossed: 0.10,         // Arms crossed (defensive)
    },
    angle: {
      relaxed: { min: 70, max: 110 },    // Relaxed elbow angle
      tense: { min: 40, max: 70 },       // Tense
      veryRelaxed: { min: 110, max: 160 }, // Very relaxed
    },
  },

  // === LEGACY ALIASES for useInterviewAnalytics ===
  shoulder: {
    poorSlopeThreshold: 0.080,     // shoulders.alignment.poor
    moderateSlopeThreshold: 0.050, // shoulders.alignment.fair
    maxSlopeThreshold: 0.030,      // shoulders.alignment.good
  },
  hands: {
    historyWindow: 10,             // frames for fidgeting window
    fidgetingThreshold: 0.06,      // normalized movement threshold
  },
};


// ============================================================================
// SECTION 5: FACE REFERENCE VALUES & THRESHOLDS
// ============================================================================

export const FACE_REFERENCE = {
  
  // === EYE ANALYSIS ===
  eyes: {
    aspectRatio: {
      wideOpen: 0.35,        // Eyes wide open
      open: 0.26,            // Normal open
      neutral: 0.22,         // Relaxed
      narrowed: 0.18,        // Narrowed/squinting
      closed: 0.10,          // Closed
    },
    blink: {
      threshold: 0.16,       // EAR below this = blink
      normalRateMin: 15,     // Normal blinks/minute
      normalRateMax: 20,     // Normal blinks/minute
      stressedRate: 25,      // Elevated (stress)
      lowRate: 10,           // Low (staring/tense)
      maxDuration: 400,      // Normal blink duration (ms)
    },
    // Legacy aliases for useInterviewAnalytics
    blinkThreshold: 0.16,
    prolongedClosureFrames: 15,  // ~1.5s at 10fps = prolonged closure
    asymmetry: {
      symmetric: 0.03,       // Very symmetric
      slight: 0.06,          // Natural asymmetry
      notable: 0.10,         // Notable
      significant: 0.15,     // Significant (winking)
    },
  },
  
  // === GAZE / EYE CONTACT ===
  gaze: {
    irisPosition: {
      center: { x: 0.50, y: 0.50 },
      tolerance: 0.15,
    },
    horizontalOffsetThreshold: 0.12,
    verticalOffsetThreshold: 0.12,
    moderateDeviationThreshold: 0.22,
    poorDeviationThreshold: 0.34,
    asymmetryThreshold: 0.08,
    irisSymmetryThreshold: 0.10,
    contactQuality: {
      excellent: 0.80,       // 80%+ eye contact
      good: 0.65,            // 65-80%
      fair: 0.50,            // 50-65%
      poor: 0.35,            // 35-50%
      avoiding: 0.20,        // Below 35%
    },
    stability: {
      steady: 0.02,          // Very steady
      normal: 0.04,          // Normal
      restless: 0.08,        // Restless
      darting: 0.12,         // Darting eyes
    },
  },
  
  // === FACE ORIENTATION ===
  orientation: {
    yaw: {
      direct: 8,             // Facing camera
      slight: 15,            // Slight turn
      moderate: 25,          // Moderate turn
      significant: 40,       // Significant turn
      turnedAway: 55,        // Turned away
    },
    pitch: {
      level: 8,              // Level gaze
      slightUp: 15,          // Slight up
      slightDown: 12,        // Slight down
      up: 25,                // Looking up
      down: 20,              // Looking down
      extremeUp: 40,         // Extreme up
      extremeDown: 35,       // Extreme down
    },
    // Legacy aliases for useInterviewAnalytics (degrees)
    poorYawThreshold: 40,
    moderateYawThreshold: 25,
    maxYawThreshold: 15,
    poorPitchThreshold: 25,
    moderatePitchThreshold: 15,
    maxPitchThreshold: 8,
    roll: {
      level: 5,              // Level head
      slight: 10,            // Slight tilt
      moderate: 18,          // Moderate tilt
      significant: 28,       // Significant tilt
      extreme: 40,           // Extreme tilt
    },
  },
  
  // === MOUTH ANALYSIS ===
  mouth: {
    aspectRatio: {
      closed: 0.05,          // Mouth closed
      slightOpen: 0.12,      // Slightly open
      speaking: 0.18,        // Normal speaking
      wideOpen: 0.35,        // Wide open
      veryWide: 0.50,        // Very wide
    },
    speaking: {
      threshold: 0.12,       // MAR for speech
      minDuration: 200,      // Minimum ms
    },
    speakingThreshold: 0.12,  // Legacy alias for useInterviewAnalytics
    smile: {
      neutral: 0.00,         // Neutral
      slight: 0.015,         // Slight smile
      moderate: 0.030,       // Moderate smile
      broad: 0.045,          // Broad smile
    },
    smileSymmetry: {
      genuine: 0.85,         // Symmetric (genuine)
      slight: 0.70,          // Slight asymmetry
      asymmetric: 0.55,      // May be forced
    },
  },
  
  // === EYEBROW ANALYSIS ===
  eyebrows: {
    position: {
      raised: 0.025,         // Raised (surprise)
      slightRaise: 0.012,    // Slightly raised
      neutral: 0.000,        // Neutral
      slightFurrow: -0.008,  // Slightly furrowed
      furrowed: -0.020,      // Furrowed (concern)
      deepFurrow: -0.035,    // Deep furrow
    },
    asymmetry: {
      symmetric: 0.008,      // Symmetric
      slight: 0.015,         // Slight
      notable: 0.025,        // Notable (skeptical)
      significant: 0.040,    // Significant
    },
  },
};


// ============================================================================
// SECTION 6: HAND & FINGER REFERENCE VALUES
// ============================================================================

export const HAND_REFERENCE = {
  
  // === HAND VISIBILITY ===
  visibility: {
    fullyVisible: 0.9,       // Both hands clearly visible
    partiallyVisible: 0.5,   // Some hand visible
    notVisible: 0.1,         // Hands not in frame
  },
  
  // === HAND POSITION ===
  position: {
    onDesk: 'optimal',       // Hands resting on desk
    clasped: 'good',         // Hands clasped
    inLap: 'acceptable',     // Hands in lap
    gesturing: 'active',     // Actively gesturing
    fidgeting: 'nervous',    // Fidgeting
    hidden: 'concerning',    // Hidden hands
  },
  
  // === HAND MOVEMENT ===
  movement: {
    velocity: {
      still: 0.005,          // Very still
      calm: 0.015,           // Calm
      moderate: 0.035,       // Gesturing
      fast: 0.060,           // Fast
      excessive: 0.100,      // Excessive/nervous
    },
    frequency: {
      calm: 0.5,             // Movements/second
      normal: 1.5,
      elevated: 3.0,
      high: 5.0,
    },
  },
  
  // === FINGER ANALYSIS ===
  fingers: {
    // Finger curl threshold (0 = straight, 1 = fully curled)
    curl: {
      extended: 0.2,         // Finger extended
      relaxed: 0.4,          // Relaxed position
      partialCurl: 0.6,      // Partially curled
      curled: 0.8,           // Fully curled
    },
    // Finger spread threshold
    spread: {
      closed: 0.02,          // Fingers together
      relaxed: 0.05,         // Normal spread
      spread: 0.08,          // Spread apart
      wideSpread: 0.12,      // Wide spread
    },
  },
  
  // === HAND GESTURES ===
  gestures: {
    openPalm: {
      description: 'Open palm facing camera - honesty/transparency',
      fingerCurl: 0.2,
      palmFacing: 'camera',
    },
    closedFist: {
      description: 'Closed fist - tension/stress',
      fingerCurl: 0.8,
    },
    pointingIndex: {
      description: 'Pointing with index finger',
      indexExtended: true,
      othersCurled: true,
    },
    steepling: {
      description: 'Fingertips touching - confidence/authority',
      fingertipsTouching: true,
      palmsSeparate: true,
    },
    claspedHands: {
      description: 'Hands clasped together - self-comfort',
      handsTouching: true,
    },
  },
  
  // === SELF-TOUCHING (Stress Indicators) ===
  selfTouching: {
    faceTouch: 0.08,         // Hand near face
    hairTouch: 0.10,         // Hand near hair
    neckTouch: 0.12,         // Hand on neck (stress)
    armCross: 0.15,          // Arms crossed
  },
};


// ============================================================================
// SECTION 7: MOVEMENT & STABILITY REFERENCE
// ============================================================================

export const MOVEMENT_REFERENCE = {
  
  // === BODY STABILITY ===
  stability: {
    magnitude: {
      veryStill: 0.005,      // Almost no movement
      stable: 0.012,         // Stable
      normal: 0.025,         // Normal
      active: 0.045,         // Active
      restless: 0.070,       // Restless
      excessive: 0.100,      // Excessive
    },
    frequency: {
      calm: 0.5,             // Changes/second
      normal: 1.5,
      elevated: 3.0,
      high: 5.0,
    },
  },
  
  // === NERVOUS BEHAVIORS ===
  nervousBehaviors: {
    swaying: {
      lateralThreshold: 0.03,
      forwardBackThreshold: 0.025,
      frequencyThreshold: 0.8,
    },
    bouncing: {
      verticalThreshold: 0.02,
      rhythmicThreshold: 1.5,
    },
  },
  
  // === TEMPORAL ANALYSIS ===
  temporal: {
    shortWindow: 3000,       // 3 seconds
    mediumWindow: 30000,     // 30 seconds
    longWindow: 300000,      // 5 minutes
    baselineFrames: 150,     // Frames for baseline
  },
};


// ============================================================================
// SECTION 8: SCORING SYSTEM
// ============================================================================

/**
 * Component weights for overall score calculation
 */
export const SCORING_WEIGHTS = {
  overall: {
    posture: 0.20,           // 20%
    eyeContact: 0.25,        // 25%
    facialExpression: 0.15,  // 15%
    handGestures: 0.15,      // 15%
    bodyLanguage: 0.15,      // 15%
    professionalPresence: 0.10, // 10%
  },
  
  posture: {
    shoulders: 0.30,
    spine: 0.35,
    head: 0.20,
    upperBody: 0.15,
    // Legacy aliases for useInterviewAnalytics
    components: {
      shoulderAlignment: 0.35,
      spineAlignment: 0.35,
      headPosition: 0.30,
    },
    weight: 0.20,
  },
  attention: { weight: 0.25 },
  expression: { weight: 0.15 },
  
  eyeContact: {
    gazeDirection: 0.40,
    faceOrientation: 0.30,
    eyeOpenness: 0.15,
    blinkRate: 0.15,
  },
  
  facialExpression: {
    smile: 0.30,
    eyebrows: 0.25,
    mouthNatural: 0.25,
    overall: 0.20,
  },
  
  handGestures: {
    visibility: 0.20,
    steadiness: 0.30,
    appropriateGestures: 0.30,
    fingerRelaxation: 0.20,
  },
  
  bodyLanguage: {
    weight: 0.15,            // Legacy alias for useInterviewAnalytics
    stability: 0.40,
    openness: 0.30,
    engagement: 0.30,
  },
};

/**
 * Score level thresholds
 */
export const FEEDBACK_THRESHOLDS = {
  excellent: 90,             // 90-100
  good: 75,                  // 75-89
  fair: 60,                  // 60-74
  needsImprovement: 40,      // 40-59
  poor: 0,                   // 0-39
};


// ============================================================================
// SECTION 9: CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate Euclidean distance between two 2D points
 */
export function distance2D(p1, p2) {
  if (!p1 || !p2) return 0;
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

/**
 * Calculate Euclidean distance between two 3D points
 */
export function distance3D(p1, p2) {
  if (!p1 || !p2) return 0;
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) + 
    Math.pow(p1.y - p2.y, 2) + 
    Math.pow((p1.z || 0) - (p2.z || 0), 2)
  );
}

/**
 * Calculate angle between three points (in degrees)
 * Point B is the vertex
 */
export function calculateAngle(pointA, pointB, pointC) {
  if (!pointA || !pointB || !pointC) return 0;
  
  const vectorBA = { x: pointA.x - pointB.x, y: pointA.y - pointB.y };
  const vectorBC = { x: pointC.x - pointB.x, y: pointC.y - pointB.y };
  
  const dotProduct = vectorBA.x * vectorBC.x + vectorBA.y * vectorBC.y;
  const magnitudeBA = Math.sqrt(vectorBA.x ** 2 + vectorBA.y ** 2);
  const magnitudeBC = Math.sqrt(vectorBC.x ** 2 + vectorBC.y ** 2);
  
  if (magnitudeBA === 0 || magnitudeBC === 0) return 0;
  
  const cosAngle = dotProduct / (magnitudeBA * magnitudeBC);
  const clampedCos = Math.max(-1, Math.min(1, cosAngle));
  
  return Math.acos(clampedCos) * (180 / Math.PI);
}

/**
 * Calculate Eye Aspect Ratio (EAR)
 * 
 * EAR = (vertical_distance) / (horizontal_distance)
 * Used for blink detection and eye openness
 * 
 * @returns {number} EAR value (typically 0.1-0.4)
 */
export function calculateEAR(eyeTop, eyeBottom, eyeLeft, eyeRight) {
  if (!eyeTop || !eyeBottom || !eyeLeft || !eyeRight) return 0.25;
  
  const verticalDist = distance2D(eyeTop, eyeBottom);
  const horizontalDist = distance2D(eyeLeft, eyeRight);
  
  if (horizontalDist === 0) return 0.25;
  return verticalDist / horizontalDist;
}

/**
 * Calculate Mouth Aspect Ratio (MAR)
 * 
 * MAR = (vertical_distance) / (horizontal_distance)
 * Used for speech detection
 * 
 * @returns {number} MAR value (typically 0.0-0.5)
 */
export function calculateMAR(upperLip, lowerLip, leftMouth, rightMouth) {
  if (!upperLip || !lowerLip || !leftMouth || !rightMouth) return 0.05;
  
  const verticalDist = distance2D(upperLip, lowerLip);
  const horizontalDist = distance2D(leftMouth, rightMouth);
  
  if (horizontalDist === 0) return 0.05;
  return verticalDist / horizontalDist;
}

/**
 * Calculate face orientation (yaw, pitch, roll)
 * 
 * @returns {Object} { yaw, pitch, roll } in degrees
 */
export function calculateFaceOrientation(noseTip, leftEye, rightEye, chin, forehead = null) {
  if (!noseTip || !leftEye || !rightEye || !chin) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }
  
  // Eye center
  const eyeCenter = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2,
    z: ((leftEye.z || 0) + (rightEye.z || 0)) / 2,
  };
  
  // YAW (left-right rotation)
  const yaw = Math.atan2(
    eyeCenter.x - noseTip.x,
    Math.abs((noseTip.z || 0) - eyeCenter.z) + 0.001
  ) * (180 / Math.PI);
  
  // PITCH (up-down rotation)
  const faceRef = forehead || eyeCenter;
  const faceHeight = distance2D(faceRef, chin);
  const noseHeight = noseTip.y - faceRef.y;
  const expectedNoseHeight = faceHeight * 0.33;
  const pitch = Math.atan2(
    noseHeight - expectedNoseHeight,
    faceHeight || 0.001
  ) * (180 / Math.PI);
  
  // ROLL (head tilt)
  const roll = Math.atan2(
    rightEye.y - leftEye.y,
    rightEye.x - leftEye.x
  ) * (180 / Math.PI);
  
  return {
    yaw: Math.round(yaw * 10) / 10,
    pitch: Math.round(pitch * 10) / 10,
    roll: Math.round(roll * 10) / 10,
  };
}

/**
 * Calculate shoulder metrics
 */
export function calculateShoulderMetrics(leftShoulder, rightShoulder) {
  if (!leftShoulder || !rightShoulder) {
    return { slope: 0, width: 0, angle: 0, isLevel: true, score: 100, status: 'N/A' };
  }
  
  const slope = Math.abs(leftShoulder.y - rightShoulder.y);
  const width = Math.abs(leftShoulder.x - rightShoulder.x);
  const angle = Math.atan2(
    rightShoulder.y - leftShoulder.y,
    rightShoulder.x - leftShoulder.x
  ) * (180 / Math.PI);
  
  const ref = POSTURE_REFERENCE.shoulders.alignment;
  let status, score;
  
  if (slope < ref.excellent) {
    status = 'Excellent'; score = 100;
  } else if (slope < ref.good) {
    status = 'Good'; score = 85;
  } else if (slope < ref.fair) {
    status = 'Fair'; score = 70;
  } else if (slope < ref.poor) {
    status = 'Poor'; score = 50;
  } else {
    status = 'Critical'; score = 30;
  }
  
  return { slope, width, angle, isLevel: slope < ref.good, score, status };
}

/**
 * Calculate spine alignment metrics
 */
export function calculateSpineAlignment(nose, leftShoulder, rightShoulder, leftHip = null, rightHip = null) {
  if (!nose || !leftShoulder || !rightShoulder) {
    return { forwardLean: 0, lateralLean: 0, isUpright: true, score: 100, status: 'N/A' };
  }
  
  const shoulderCenter = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
    z: ((leftShoulder.z || 0) + (rightShoulder.z || 0)) / 2,
  };
  
  const forwardLean = (nose.z || 0) - shoulderCenter.z;
  const lateralLean = nose.x - shoulderCenter.x;
  
  const ref = POSTURE_REFERENCE.spine;
  let score = 100;
  let status = 'Excellent';
  
  if (Math.abs(forwardLean) > ref.forwardLean.poorPosture) {
    score -= 30; status = 'Poor';
  } else if (Math.abs(forwardLean) > 0.04) {
    score -= 15; status = 'Fair';
  }
  
  if (Math.abs(lateralLean) > ref.lateralLean.moderate) {
    score -= 20;
    if (status === 'Excellent') status = 'Fair';
  }
  
  return {
    forwardLean,
    lateralLean,
    isUpright: Math.abs(forwardLean) < 0.05 && Math.abs(lateralLean) < 0.04,
    score: Math.max(0, score),
    status,
  };
}

/**
 * Calculate arm angle (elbow bend)
 */
export function calculateArmAngle(shoulder, elbow, wrist) {
  return calculateAngle(shoulder, elbow, wrist);
}

/**
 * Calculate finger curl (0 = extended, 1 = fully curled)
 */
export function calculateFingerCurl(mcp, pip, dip, tip) {
  if (!mcp || !pip || !dip || !tip) return 0;
  
  const angle1 = calculateAngle(mcp, pip, dip);
  const angle2 = calculateAngle(pip, dip, tip);
  
  // Normalize: 180° = straight (0 curl), 0° = fully curled (1 curl)
  const avgAngle = (angle1 + angle2) / 2;
  const curl = 1 - (avgAngle / 180);
  
  return Math.max(0, Math.min(1, curl));
}

/**
 * Calculate finger spread between two fingertips
 */
export function calculateFingerSpread(tip1, tip2) {
  if (!tip1 || !tip2) return 0;
  return distance2D(tip1, tip2);
}

/**
 * Calculate hand openness (0 = fist, 1 = fully open)
 */
export function calculateHandOpenness(handLandmarks) {
  if (!handLandmarks || handLandmarks.length < 21) return 0.5;
  
  const h = HAND_LANDMARKS;
  
  // Calculate curl for each finger
  const thumbCurl = calculateFingerCurl(
    handLandmarks[h.THUMB_CMC],
    handLandmarks[h.THUMB_MCP],
    handLandmarks[h.THUMB_IP],
    handLandmarks[h.THUMB_TIP]
  );
  
  const indexCurl = calculateFingerCurl(
    handLandmarks[h.INDEX_FINGER_MCP],
    handLandmarks[h.INDEX_FINGER_PIP],
    handLandmarks[h.INDEX_FINGER_DIP],
    handLandmarks[h.INDEX_FINGER_TIP]
  );
  
  const middleCurl = calculateFingerCurl(
    handLandmarks[h.MIDDLE_FINGER_MCP],
    handLandmarks[h.MIDDLE_FINGER_PIP],
    handLandmarks[h.MIDDLE_FINGER_DIP],
    handLandmarks[h.MIDDLE_FINGER_TIP]
  );
  
  const ringCurl = calculateFingerCurl(
    handLandmarks[h.RING_FINGER_MCP],
    handLandmarks[h.RING_FINGER_PIP],
    handLandmarks[h.RING_FINGER_DIP],
    handLandmarks[h.RING_FINGER_TIP]
  );
  
  const pinkyCurl = calculateFingerCurl(
    handLandmarks[h.PINKY_MCP],
    handLandmarks[h.PINKY_PIP],
    handLandmarks[h.PINKY_DIP],
    handLandmarks[h.PINKY_TIP]
  );
  
  // Average curl (inverted = openness)
  const avgCurl = (thumbCurl + indexCurl + middleCurl + ringCurl + pinkyCurl) / 5;
  return 1 - avgCurl;
}

/**
 * Analyze complete hand metrics
 */
export function analyzeHand(handLandmarks) {
  if (!handLandmarks || handLandmarks.length < 21) {
    return {
      detected: false,
      openness: 0,
      fingers: {
        thumb: { curl: 0, extended: false },
        index: { curl: 0, extended: false },
        middle: { curl: 0, extended: false },
        ring: { curl: 0, extended: false },
        pinky: { curl: 0, extended: false },
      },
      spread: 0,
      wristPosition: null,
    };
  }
  
  const h = HAND_LANDMARKS;
  const extendedThreshold = HAND_REFERENCE.fingers.curl.extended;
  
  // Calculate each finger's curl
  const thumbCurl = calculateFingerCurl(
    handLandmarks[h.THUMB_CMC], handLandmarks[h.THUMB_MCP],
    handLandmarks[h.THUMB_IP], handLandmarks[h.THUMB_TIP]
  );
  const indexCurl = calculateFingerCurl(
    handLandmarks[h.INDEX_FINGER_MCP], handLandmarks[h.INDEX_FINGER_PIP],
    handLandmarks[h.INDEX_FINGER_DIP], handLandmarks[h.INDEX_FINGER_TIP]
  );
  const middleCurl = calculateFingerCurl(
    handLandmarks[h.MIDDLE_FINGER_MCP], handLandmarks[h.MIDDLE_FINGER_PIP],
    handLandmarks[h.MIDDLE_FINGER_DIP], handLandmarks[h.MIDDLE_FINGER_TIP]
  );
  const ringCurl = calculateFingerCurl(
    handLandmarks[h.RING_FINGER_MCP], handLandmarks[h.RING_FINGER_PIP],
    handLandmarks[h.RING_FINGER_DIP], handLandmarks[h.RING_FINGER_TIP]
  );
  const pinkyCurl = calculateFingerCurl(
    handLandmarks[h.PINKY_MCP], handLandmarks[h.PINKY_PIP],
    handLandmarks[h.PINKY_DIP], handLandmarks[h.PINKY_TIP]
  );
  
  // Calculate finger spread (average distance between adjacent fingertips)
  const spreadIndex = distance2D(handLandmarks[h.INDEX_FINGER_TIP], handLandmarks[h.MIDDLE_FINGER_TIP]);
  const spreadMiddle = distance2D(handLandmarks[h.MIDDLE_FINGER_TIP], handLandmarks[h.RING_FINGER_TIP]);
  const spreadRing = distance2D(handLandmarks[h.RING_FINGER_TIP], handLandmarks[h.PINKY_TIP]);
  const avgSpread = (spreadIndex + spreadMiddle + spreadRing) / 3;
  
  return {
    detected: true,
    openness: calculateHandOpenness(handLandmarks),
    fingers: {
      thumb: { curl: thumbCurl, extended: thumbCurl < extendedThreshold },
      index: { curl: indexCurl, extended: indexCurl < extendedThreshold },
      middle: { curl: middleCurl, extended: middleCurl < extendedThreshold },
      ring: { curl: ringCurl, extended: ringCurl < extendedThreshold },
      pinky: { curl: pinkyCurl, extended: pinkyCurl < extendedThreshold },
    },
    spread: avgSpread,
    wristPosition: handLandmarks[h.WRIST],
  };
}

/**
 * Detect hand gesture
 */
export function detectHandGesture(handAnalysis) {
  if (!handAnalysis.detected) return 'Not Detected';
  
  const { fingers, openness } = handAnalysis;
  const extended = {
    thumb: fingers.thumb.extended,
    index: fingers.index.extended,
    middle: fingers.middle.extended,
    ring: fingers.ring.extended,
    pinky: fingers.pinky.extended,
  };
  
  // Count extended fingers
  const extendedCount = Object.values(extended).filter(Boolean).length;
  
  // Open palm (all fingers extended)
  if (extendedCount === 5 && openness > 0.7) {
    return 'Open Palm';
  }
  
  // Closed fist (no fingers extended)
  if (extendedCount === 0 || openness < 0.2) {
    return 'Closed Fist';
  }
  
  // Pointing (only index extended)
  if (extended.index && !extended.middle && !extended.ring && !extended.pinky) {
    return 'Pointing';
  }
  
  // Peace sign (index and middle extended)
  if (extended.index && extended.middle && !extended.ring && !extended.pinky) {
    return 'Peace Sign';
  }
  
  // Thumbs up
  if (extended.thumb && !extended.index && !extended.middle && !extended.ring && !extended.pinky) {
    return 'Thumbs Up';
  }
  
  // OK sign (thumb and index touching, others extended)
  if (extended.middle && extended.ring && extended.pinky && !extended.index) {
    return 'OK Sign';
  }
  
  // Relaxed/natural
  if (openness > 0.4 && openness < 0.7) {
    return 'Relaxed';
  }
  
  return 'Natural';
}

/**
 * Calculate hand movement between frames
 */
export function calculateHandMovement(currentHand, previousHand) {
  if (!currentHand || !previousHand) return 0;
  
  // Use wrist position for overall hand movement
  const wristCurrent = currentHand[HAND_LANDMARKS.WRIST];
  const wristPrevious = previousHand[HAND_LANDMARKS.WRIST];
  
  if (!wristCurrent || !wristPrevious) return 0;
  
  return distance2D(wristCurrent, wristPrevious);
}

/**
 * Calculate body stability
 */
export function calculateStability(currentPose, previousPose, history = []) {
  if (!currentPose || !previousPose) {
    return { stability: 1, movement: 0, isStable: true, score: 100, history: [] };
  }
  
  // Calculate movement for key points
  const keyPoints = ['nose', 'leftShoulder', 'rightShoulder'];
  let totalMovement = 0;
  let count = 0;
  
  keyPoints.forEach(point => {
    if (currentPose[point] && previousPose[point]) {
      totalMovement += distance2D(currentPose[point], previousPose[point]);
      count++;
    }
  });
  
  const avgMovement = count > 0 ? totalMovement / count : 0;
  const newHistory = [...history, avgMovement].slice(-30);
  const avgHistorical = newHistory.reduce((a, b) => a + b, 0) / newHistory.length;
  
  const ref = MOVEMENT_REFERENCE.stability.magnitude;
  let score = 100;
  
  if (avgHistorical < ref.veryStill) score = 100;
  else if (avgHistorical < ref.stable) score = 90;
  else if (avgHistorical < ref.normal) score = 75;
  else if (avgHistorical < ref.active) score = 60;
  else if (avgHistorical < ref.restless) score = 40;
  else score = 20;
  
  return {
    stability: Math.max(0, 1 - (avgHistorical / ref.excessive)),
    movement: avgMovement,
    averageMovement: avgHistorical,
    isStable: avgHistorical < ref.normal,
    score,
    history: newHistory,
  };
}

/**
 * Get score level
 */
export function getScoreLevel(score) {
  if (score >= FEEDBACK_THRESHOLDS.excellent) return 'excellent';
  if (score >= FEEDBACK_THRESHOLDS.good) return 'good';
  if (score >= FEEDBACK_THRESHOLDS.fair) return 'fair';
  if (score >= FEEDBACK_THRESHOLDS.needsImprovement) return 'needsImprovement';
  return 'poor';
}

/**
 * Get score color class
 */
export function getScoreColor(score) {
  const level = typeof score === 'number' ? getScoreLevel(score) : score;
  const colors = {
    excellent: 'text-emerald-500',
    good: 'text-green-500',
    fair: 'text-yellow-500',
    needsImprovement: 'text-orange-500',
    poor: 'text-red-500',
  };
  return colors[level] || 'text-gray-500';
}

/**
 * Get score background color class
 */
export function getScoreBgColor(score) {
  const level = typeof score === 'number' ? getScoreLevel(score) : score;
  const colors = {
    excellent: 'bg-emerald-500',
    good: 'bg-green-500',
    fair: 'bg-yellow-500',
    needsImprovement: 'bg-orange-500',
    poor: 'bg-red-500',
  };
  return colors[level] || 'bg-gray-500';
}


// ============================================================================
// SECTION 10: FEEDBACK MESSAGES
// ============================================================================

export const FEEDBACK_MESSAGES = {
  posture: {
    excellent: ['Excellent posture! Professional and confident.'],
    good: ['Good posture. Keep it up!'],
    fair: ['Try to sit up a bit straighter.'],
    needsImprovement: ['Focus on sitting upright with shoulders back.'],
    poor: ['Please sit up straight and face the camera.'],
  },
  eyeContact: {
    excellent: ['Excellent eye contact! Engaged and confident.'],
    good: ['Good eye contact. Keep engaging with the camera.'],
    fair: ['Try to look at the camera more directly.'],
    needsImprovement: ['Focus on maintaining eye contact with the camera.'],
    poor: ['Please look towards the camera when speaking.'],
  },
  hands: {
    excellent: ['Hands are steady and visible. Great composure!'],
    good: ['Good hand positioning.'],
    fair: ['Try to keep hands more still.'],
    needsImprovement: ['Some fidgeting detected. Try to relax.'],
    poor: ['Excessive hand movement. Take a breath and settle.'],
  },
  expression: {
    excellent: ['Great facial expressions - friendly and engaged.'],
    good: ['Good expression - appearing approachable.'],
    fair: ['Try to appear a bit more relaxed.'],
    needsImprovement: ['Expression seems tense - try to relax.'],
    poor: ['Focus on relaxing your facial muscles.'],
  },
};

/**
 * Get feedback message
 */
export function getFeedbackMessage(category, score) {
  const level = getScoreLevel(score);
  const messages = FEEDBACK_MESSAGES[category]?.[level];
  if (!messages || messages.length === 0) return 'Keep up the good work!';
  return messages[Math.floor(Math.random() * messages.length)];
}


// ============================================================================
// SECTION 11: CALIBRATED OVERRIDE SUPPORT
// ============================================================================

const CALIBRATED_STORAGE_KEY = 'mediapipe_calibrated_thresholds';

function emitCalibrationUpdateEvent() {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('mediapipe-calibration-updated'));
    }
  } catch {
    // Ignore event dispatch errors (storage still remains source of truth).
  }
}

/**
 * Load calibrated threshold overrides from localStorage.
 * Returns null if no calibrated values are stored.
 */
export function loadCalibratedOverrides() {
  try {
    const stored = localStorage.getItem(CALIBRATED_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Save calibrated threshold overrides to localStorage.
 * @param {Object} calibrated - calibrated threshold object from the backend
 */
export function saveCalibratedOverrides(calibrated) {
  try {
    localStorage.setItem(
      CALIBRATED_STORAGE_KEY,
      JSON.stringify({ ...calibrated, appliedAt: new Date().toISOString() }),
    );
    emitCalibrationUpdateEvent();
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear calibrated overrides and revert to static reference values.
 */
export function clearCalibratedOverrides() {
  try {
    localStorage.removeItem(CALIBRATED_STORAGE_KEY);
    emitCalibrationUpdateEvent();
    return true;
  } catch {
    return false;
  }
}

/**
 * Deep-merge calibrated values on top of the static reference object.
 * Only overrides leaf values that exist in the calibrated set.
 */
function deepMerge(base, overrides) {
  if (!overrides || typeof overrides !== 'object') return base;
  const result = { ...base };
  for (const key of Object.keys(overrides)) {
    if (
      result[key] &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key]) &&
      typeof overrides[key] === 'object' &&
      !Array.isArray(overrides[key])
    ) {
      result[key] = deepMerge(result[key], overrides[key]);
    } else if (overrides[key] !== undefined && overrides[key] !== null) {
      result[key] = overrides[key];
    }
  }
  return result;
}

/**
 * Get the effective POSTURE_REFERENCE with calibrated overrides applied.
 */
export function getEffectivePostureReference() {
  const overrides = loadCalibratedOverrides();
  if (!overrides?.posture) return POSTURE_REFERENCE;
  return deepMerge(POSTURE_REFERENCE, overrides.posture);
}

/**
 * Get the effective FACE_REFERENCE with calibrated overrides applied.
 */
export function getEffectiveFaceReference() {
  const overrides = loadCalibratedOverrides();
  if (!overrides?.eyeContact && !overrides?.facial) return FACE_REFERENCE;
  return deepMerge(FACE_REFERENCE, { ...overrides.eyeContact, ...overrides.facial });
}

/**
 * Get the effective SCORING_WEIGHTS with calibrated overrides applied.
 */
export function getEffectiveScoringWeights() {
  const overrides = loadCalibratedOverrides();
  if (!overrides?.scoringWeights) return SCORING_WEIGHTS;
  return deepMerge(SCORING_WEIGHTS, overrides.scoringWeights);
}

// ============================================================================
// SECTION 12: DEFAULT EXPORT
// ============================================================================

export default {
  // Landmark indices
  POSE_LANDMARKS,
  POSE_GROUPS,
  POSE_LANDMARK_NAMES,
  POSE_CONNECTIONS,
  HAND_LANDMARKS,
  HAND_GROUPS,
  HAND_LANDMARK_NAMES,
  HAND_CONNECTIONS,
  FACE_LANDMARKS,
  
  // Reference values
  POSTURE_REFERENCE,
  FACE_REFERENCE,
  HAND_REFERENCE,
  MOVEMENT_REFERENCE,
  
  // Scoring
  SCORING_WEIGHTS,
  FEEDBACK_THRESHOLDS,
  FEEDBACK_MESSAGES,
  
  // Utility functions
  distance2D,
  distance3D,
  calculateAngle,
  calculateEAR,
  calculateMAR,
  calculateFaceOrientation,
  calculateShoulderMetrics,
  calculateSpineAlignment,
  calculateArmAngle,
  calculateFingerCurl,
  calculateFingerSpread,
  calculateHandOpenness,
  analyzeHand,
  detectHandGesture,
  calculateHandMovement,
  calculateStability,
  getScoreLevel,
  getScoreColor,
  getScoreBgColor,
  getFeedbackMessage,

  // Calibrated override functions
  loadCalibratedOverrides,
  saveCalibratedOverrides,
  clearCalibratedOverrides,
  getEffectivePostureReference,
  getEffectiveFaceReference,
  getEffectiveScoringWeights,
};
