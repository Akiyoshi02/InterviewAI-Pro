/**
 * MediaPipe Calibration Service
 *
 * Produces data-driven calibration values that match the runtime threshold
 * schema used by useInterviewAnalytics + mediapipeReferenceData.js.
 */

import logger from '../utils/logger.js';
import { firestore } from '../config/firebase.js';

const HIGH_SCORE_THRESHOLD = 70;

// Static defaults aligned with src/config/mediapipeReferenceData.js (legacy aliases)
const STATIC_THRESHOLDS = {
  posture: {
    shoulder: {
      maxSlopeThreshold: 0.03,
      moderateSlopeThreshold: 0.05,
      poorSlopeThreshold: 0.08,
    },
    spine: {
      maxForwardHeadThreshold: 0.03,
      moderateForwardHeadThreshold: 0.06,
      poorForwardHeadThreshold: 0.10,
    },
    head: {
      maxTiltThreshold: 7,
      poorTiltThreshold: 18,
      loweredThreshold: 0.03,
    },
    hands: {
      fidgetingThreshold: 0.06,
    },
  },
  eyeContact: {
    eyes: {
      blinkThreshold: 0.16,
      prolongedClosureFrames: 15,
    },
    gaze: {
      irisPosition: {
        tolerance: 0.15,
      },
      horizontalOffsetThreshold: 0.12,
      verticalOffsetThreshold: 0.12,
      asymmetryThreshold: 0.08,
      irisSymmetryThreshold: 0.10,
    },
    orientation: {
      maxYawThreshold: 15,
      moderateYawThreshold: 25,
      poorYawThreshold: 40,
      maxPitchThreshold: 8,
      moderatePitchThreshold: 15,
      poorPitchThreshold: 25,
    },
  },
  facial: {
    mouth: {
      speakingThreshold: 0.12,
    },
  },
  engagement: {
    fidgetThreshold: 0.06,
  },
};

const COMPARISON_METRICS = [
  {
    metric: 'posture.shoulder.maxSlopeThreshold',
    staticPath: 'posture.shoulder.maxSlopeThreshold',
    calibratedPath: 'posture.shoulder.maxSlopeThreshold',
    sampleKey: 'shoulderSlope',
  },
  {
    metric: 'posture.shoulder.moderateSlopeThreshold',
    staticPath: 'posture.shoulder.moderateSlopeThreshold',
    calibratedPath: 'posture.shoulder.moderateSlopeThreshold',
    sampleKey: 'shoulderSlope',
  },
  {
    metric: 'posture.shoulder.poorSlopeThreshold',
    staticPath: 'posture.shoulder.poorSlopeThreshold',
    calibratedPath: 'posture.shoulder.poorSlopeThreshold',
    sampleKey: 'shoulderSlope',
  },
  {
    metric: 'posture.spine.maxForwardHeadThreshold',
    staticPath: 'posture.spine.maxForwardHeadThreshold',
    calibratedPath: 'posture.spine.maxForwardHeadThreshold',
    sampleKey: 'forwardHead',
  },
  {
    metric: 'posture.spine.moderateForwardHeadThreshold',
    staticPath: 'posture.spine.moderateForwardHeadThreshold',
    calibratedPath: 'posture.spine.moderateForwardHeadThreshold',
    sampleKey: 'forwardHead',
  },
  {
    metric: 'posture.spine.poorForwardHeadThreshold',
    staticPath: 'posture.spine.poorForwardHeadThreshold',
    calibratedPath: 'posture.spine.poorForwardHeadThreshold',
    sampleKey: 'forwardHead',
  },
  {
    metric: 'posture.head.maxTiltThreshold',
    staticPath: 'posture.head.maxTiltThreshold',
    calibratedPath: 'posture.head.maxTiltThreshold',
    sampleKey: 'headTilt',
  },
  {
    metric: 'posture.head.poorTiltThreshold',
    staticPath: 'posture.head.poorTiltThreshold',
    calibratedPath: 'posture.head.poorTiltThreshold',
    sampleKey: 'headTilt',
  },
  {
    metric: 'posture.head.loweredThreshold',
    staticPath: 'posture.head.loweredThreshold',
    calibratedPath: 'posture.head.loweredThreshold',
    sampleKey: 'headLowered',
  },
  {
    metric: 'eyeContact.orientation.maxYawThreshold',
    staticPath: 'eyeContact.orientation.maxYawThreshold',
    calibratedPath: 'eyeContact.orientation.maxYawThreshold',
    sampleKey: 'yawAbs',
  },
  {
    metric: 'eyeContact.orientation.moderateYawThreshold',
    staticPath: 'eyeContact.orientation.moderateYawThreshold',
    calibratedPath: 'eyeContact.orientation.moderateYawThreshold',
    sampleKey: 'yawAbs',
  },
  {
    metric: 'eyeContact.orientation.poorYawThreshold',
    staticPath: 'eyeContact.orientation.poorYawThreshold',
    calibratedPath: 'eyeContact.orientation.poorYawThreshold',
    sampleKey: 'yawAbs',
  },
  {
    metric: 'eyeContact.orientation.maxPitchThreshold',
    staticPath: 'eyeContact.orientation.maxPitchThreshold',
    calibratedPath: 'eyeContact.orientation.maxPitchThreshold',
    sampleKey: 'pitchAbs',
  },
  {
    metric: 'eyeContact.orientation.moderatePitchThreshold',
    staticPath: 'eyeContact.orientation.moderatePitchThreshold',
    calibratedPath: 'eyeContact.orientation.moderatePitchThreshold',
    sampleKey: 'pitchAbs',
  },
  {
    metric: 'eyeContact.orientation.poorPitchThreshold',
    staticPath: 'eyeContact.orientation.poorPitchThreshold',
    calibratedPath: 'eyeContact.orientation.poorPitchThreshold',
    sampleKey: 'pitchAbs',
  },
  {
    metric: 'eyeContact.eyes.blinkThreshold',
    staticPath: 'eyeContact.eyes.blinkThreshold',
    calibratedPath: 'eyeContact.eyes.blinkThreshold',
    sampleKey: 'blinkEAR',
  },
  {
    metric: 'eyeContact.gaze.irisPosition.tolerance',
    staticPath: 'eyeContact.gaze.irisPosition.tolerance',
    calibratedPath: 'eyeContact.gaze.irisPosition.tolerance',
    sampleKey: 'gazeDeviation',
  },
  {
    metric: 'eyeContact.gaze.horizontalOffsetThreshold',
    staticPath: 'eyeContact.gaze.horizontalOffsetThreshold',
    calibratedPath: 'eyeContact.gaze.horizontalOffsetThreshold',
    sampleKey: 'gazeHorizontalOffsetAbs',
  },
  {
    metric: 'eyeContact.gaze.verticalOffsetThreshold',
    staticPath: 'eyeContact.gaze.verticalOffsetThreshold',
    calibratedPath: 'eyeContact.gaze.verticalOffsetThreshold',
    sampleKey: 'gazeVerticalOffsetAbs',
  },
  {
    metric: 'eyeContact.gaze.asymmetryThreshold',
    staticPath: 'eyeContact.gaze.asymmetryThreshold',
    calibratedPath: 'eyeContact.gaze.asymmetryThreshold',
    sampleKey: 'eyeAsymmetry',
  },
  {
    metric: 'eyeContact.gaze.irisSymmetryThreshold',
    staticPath: 'eyeContact.gaze.irisSymmetryThreshold',
    calibratedPath: 'eyeContact.gaze.irisSymmetryThreshold',
    sampleKey: 'irisSymmetry',
  },
  {
    metric: 'facial.mouth.speakingThreshold',
    staticPath: 'facial.mouth.speakingThreshold',
    calibratedPath: 'facial.mouth.speakingThreshold',
    sampleKey: 'speakingMAR',
  },
  // Keep one "engagement" metric for panel grouping; mapped to runtime hands threshold.
  {
    metric: 'engagement.fidgetThreshold',
    staticPath: 'engagement.fidgetThreshold',
    calibratedPath: 'posture.hands.fidgetingThreshold',
    sampleKey: 'fidgetMovement',
  },
];

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickFirstNumeric(...values) {
  for (const value of values) {
    const n = toNumber(value);
    if (n != null) return n;
  }
  return null;
}

function absIfNumeric(value) {
  const n = toNumber(value);
  return n != null ? Math.abs(n) : null;
}

function pushIfNumeric(collection, key, value) {
  const n = toNumber(value);
  if (n != null) {
    collection[key].push(n);
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function percentile(values, q) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function computeStats(values) {
  if (!values || values.length === 0) return null;
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  return {
    mean: round(mean),
    median: round(percentile(values, 0.5) ?? mean),
    stdDev: round(stdDev),
    p10: round(percentile(values, 0.1) ?? mean),
    p90: round(percentile(values, 0.9) ?? mean),
    sampleSize: n,
  };
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((cursor, key) => (cursor ? cursor[key] : undefined), obj);
}

/**
 * Fetch analytics datasets from Firestore and keep high-scoring sets first.
 */
async function fetchHighScoreAnalytics() {
  const analyticsSnapshot = await firestore
    .collection('trainingDatasets_analytics')
    .limit(500)
    .get();

  const datasets = analyticsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const interviewsSnapshot = await firestore
    .collection('interviews')
    .where('status', '==', 'COMPLETED')
    .limit(500)
    .get();

  const interviewScores = new Map();
  interviewsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const score = Number(data.overallScore || data.finalOverallScore || 0);
    if (score >= HIGH_SCORE_THRESHOLD) {
      interviewScores.set(doc.id, score);
    }
  });

  let highScoreData = datasets.filter((dataset) => {
    if (dataset.interviewId && interviewScores.has(dataset.interviewId)) return true;
    const score =
      Number(dataset.overallScore || dataset.statistics?.averageScore) ||
      Number(dataset.referenceComparison?.averages?.overall) ||
      Number(dataset.summary?.averageOverallScore);
    return score >= HIGH_SCORE_THRESHOLD;
  });

  // If no interview-level score metadata is available yet, still calibrate from recent samples.
  if (highScoreData.length === 0 && datasets.length > 0) {
    highScoreData = datasets.slice(0, Math.min(50, datasets.length));
  }

  return { highScoreData, totalAnalytics: datasets.length, totalHighScore: highScoreData.length };
}

/**
 * Extract normalized calibration samples from mixed analytics formats.
 */
function extractSamples(analyticsData) {
  const samples = {
    shoulderSlope: [],
    forwardHead: [],
    headTilt: [],
    headLowered: [],
    fidgetMovement: [],
    yawAbs: [],
    pitchAbs: [],
    blinkEAR: [],
    speakingMAR: [],
    gazeDeviation: [],
    gazeHorizontalOffsetAbs: [],
    gazeVerticalOffsetAbs: [],
    eyeAsymmetry: [],
    irisSymmetry: [],
  };

  for (const dataset of analyticsData) {
    const rawData = dataset.data || dataset.analyticsData || dataset;
    const dataPoints = Array.isArray(rawData?.dataPoints)
      ? rawData.dataPoints
      : Array.isArray(rawData)
        ? rawData
        : [rawData];

    for (const point of dataPoints) {
      const pose = point?.pose || point?.poseMetrics || {};
      const face = point?.faceSummary || point?.face || point?.faceMetrics || point?.faceMesh || {};
      const body = point?.bodyLanguage || point?.bodyLanguageMetrics || {};
      const scores = point?.scores || {};
      const faceOrientation = face?.orientation || {};
      const faceEyes = face?.eyes || {};
      const faceGaze = face?.gaze || {};
      const faceIris = face?.iris || {};
      const faceSpeaking = face?.speaking || {};

      const shoulderScore = pickFirstNumeric(pose.shoulderAlignment, scores.posture);
      const shoulderSlope = pickFirstNumeric(
        pose.shoulderSlope,
        pose.shoulderLevel,
        pose.shoulderDifference,
        pose.shoulderDelta,
        shoulderScore != null ? ((100 - shoulderScore) / 100) * 0.10 : null,
      );
      pushIfNumeric(samples, 'shoulderSlope', shoulderSlope);

      const spineScore = pickFirstNumeric(pose.spineAlignment, scores.posture);
      const forwardHead = pickFirstNumeric(
        pose.forwardHeadDistance,
        pose.headForward,
        pose.spineForwardLean,
        pose.forwardHead ? 0.08 : null,
        pose.forwardHead === false ? 0.02 : null,
        spineScore != null ? ((100 - spineScore) / 100) * 0.12 : null,
      );
      pushIfNumeric(samples, 'forwardHead', forwardHead);

      const headTilt = pickFirstNumeric(
        pose.headTilt,
        Math.abs(toNumber(face.roll) ?? NaN),
        Math.abs(toNumber(face.yaw) ?? NaN) * 0.5,
      );
      pushIfNumeric(samples, 'headTilt', headTilt);

      const headLowered = pickFirstNumeric(
        pose.headLoweredDistance,
        pose.headDrop,
        pose.headPosition === 'lowered' ? 0.05 : null,
        pose.headPosition === 'centered' ? 0.02 : null,
      );
      pushIfNumeric(samples, 'headLowered', headLowered);

      const fidgetMovement = pickFirstNumeric(
        body.handMovement,
        body.avgMovement,
        body.movement,
        body.fidgeting ? 0.09 : null,
        body.fidgeting === false ? 0.03 : null,
      );
      pushIfNumeric(samples, 'fidgetMovement', fidgetMovement);

      const yaw = toNumber(face.yaw);
      pushIfNumeric(samples, 'yawAbs', absIfNumeric(yaw ?? faceOrientation.yaw));

      const pitch = toNumber(face.pitch);
      pushIfNumeric(samples, 'pitchAbs', absIfNumeric(pitch ?? faceOrientation.pitch));

      const blinkEAR = pickFirstNumeric(
        face.eyeAspectRatio,
        face.avgEAR,
        faceEyes.avgEAR,
        toNumber(face.leftEAR) != null && toNumber(face.rightEAR) != null
          ? (Number(face.leftEAR) + Number(face.rightEAR)) / 2
          : null,
        toNumber(faceEyes.leftEAR) != null && toNumber(faceEyes.rightEAR) != null
          ? (Number(faceEyes.leftEAR) + Number(faceEyes.rightEAR)) / 2
          : null,
      );
      pushIfNumeric(samples, 'blinkEAR', blinkEAR);

      const speakingMAR = pickFirstNumeric(face.mouthMAR, face.mar, faceSpeaking.mouthMAR);
      pushIfNumeric(samples, 'speakingMAR', speakingMAR);

      const gazeDeviation = pickFirstNumeric(face.gazeDeviation, faceGaze.deviation);
      pushIfNumeric(samples, 'gazeDeviation', gazeDeviation);

      const gazeHorizontalOffset = pickFirstNumeric(
        absIfNumeric(face.gazeHorizontalOffset),
        absIfNumeric(faceGaze.horizontalOffset),
      );
      pushIfNumeric(samples, 'gazeHorizontalOffsetAbs', gazeHorizontalOffset);

      const gazeVerticalOffset = pickFirstNumeric(
        absIfNumeric(face.gazeVerticalOffset),
        absIfNumeric(faceGaze.verticalOffset),
      );
      pushIfNumeric(samples, 'gazeVerticalOffsetAbs', gazeVerticalOffset);

      const eyeAsymmetry = pickFirstNumeric(face.eyeAsymmetry, faceEyes.asymmetry, face.asymmetry);
      pushIfNumeric(samples, 'eyeAsymmetry', eyeAsymmetry);

      const irisSymmetry = pickFirstNumeric(face.irisSymmetry, faceIris.symmetry);
      pushIfNumeric(samples, 'irisSymmetry', irisSymmetry);
    }
  }

  return samples;
}

function calibrateFromSamples(samples) {
  const calibrated = {
    posture: {
      shoulder: {
        maxSlopeThreshold: round(clamp(percentile(samples.shoulderSlope, 0.60) ?? STATIC_THRESHOLDS.posture.shoulder.maxSlopeThreshold, 0.01, 0.08)),
        moderateSlopeThreshold: STATIC_THRESHOLDS.posture.shoulder.moderateSlopeThreshold,
        poorSlopeThreshold: STATIC_THRESHOLDS.posture.shoulder.poorSlopeThreshold,
      },
      spine: {
        maxForwardHeadThreshold: round(clamp(percentile(samples.forwardHead, 0.60) ?? STATIC_THRESHOLDS.posture.spine.maxForwardHeadThreshold, 0.01, 0.08)),
        moderateForwardHeadThreshold: STATIC_THRESHOLDS.posture.spine.moderateForwardHeadThreshold,
        poorForwardHeadThreshold: STATIC_THRESHOLDS.posture.spine.poorForwardHeadThreshold,
      },
      head: {
        maxTiltThreshold: round(clamp(percentile(samples.headTilt, 0.60) ?? STATIC_THRESHOLDS.posture.head.maxTiltThreshold, 3, 20)),
        poorTiltThreshold: STATIC_THRESHOLDS.posture.head.poorTiltThreshold,
        loweredThreshold: round(clamp(percentile(samples.headLowered, 0.75) ?? STATIC_THRESHOLDS.posture.head.loweredThreshold, 0.01, 0.10)),
      },
      hands: {
        fidgetingThreshold: round(clamp(percentile(samples.fidgetMovement, 0.80) ?? STATIC_THRESHOLDS.posture.hands.fidgetingThreshold, 0.02, 0.20)),
      },
    },
    eyeContact: {
      eyes: {
        blinkThreshold: round(clamp(percentile(samples.blinkEAR, 0.10) ?? STATIC_THRESHOLDS.eyeContact.eyes.blinkThreshold, 0.08, 0.30)),
        prolongedClosureFrames: STATIC_THRESHOLDS.eyeContact.eyes.prolongedClosureFrames,
      },
      gaze: {
        irisPosition: {
          tolerance: round(clamp(percentile(samples.gazeDeviation, 0.60) ?? STATIC_THRESHOLDS.eyeContact.gaze.irisPosition.tolerance, 0.05, 0.30)),
        },
        horizontalOffsetThreshold: round(clamp(percentile(samples.gazeHorizontalOffsetAbs, 0.70) ?? STATIC_THRESHOLDS.eyeContact.gaze.horizontalOffsetThreshold, 0.03, 0.30)),
        verticalOffsetThreshold: round(clamp(percentile(samples.gazeVerticalOffsetAbs, 0.70) ?? STATIC_THRESHOLDS.eyeContact.gaze.verticalOffsetThreshold, 0.03, 0.30)),
        asymmetryThreshold: round(clamp(percentile(samples.eyeAsymmetry, 0.80) ?? STATIC_THRESHOLDS.eyeContact.gaze.asymmetryThreshold, 0.02, 0.25)),
        irisSymmetryThreshold: round(clamp(percentile(samples.irisSymmetry, 0.80) ?? STATIC_THRESHOLDS.eyeContact.gaze.irisSymmetryThreshold, 0.02, 0.30)),
      },
      orientation: {
        maxYawThreshold: round(clamp(percentile(samples.yawAbs, 0.60) ?? STATIC_THRESHOLDS.eyeContact.orientation.maxYawThreshold, 5, 35)),
        moderateYawThreshold: STATIC_THRESHOLDS.eyeContact.orientation.moderateYawThreshold,
        poorYawThreshold: STATIC_THRESHOLDS.eyeContact.orientation.poorYawThreshold,
        maxPitchThreshold: round(clamp(percentile(samples.pitchAbs, 0.60) ?? STATIC_THRESHOLDS.eyeContact.orientation.maxPitchThreshold, 4, 20)),
        moderatePitchThreshold: STATIC_THRESHOLDS.eyeContact.orientation.moderatePitchThreshold,
        poorPitchThreshold: STATIC_THRESHOLDS.eyeContact.orientation.poorPitchThreshold,
      },
    },
    facial: {
      mouth: {
        speakingThreshold: round(clamp(percentile(samples.speakingMAR, 0.60) ?? STATIC_THRESHOLDS.facial.mouth.speakingThreshold, 0.06, 0.30)),
      },
    },
    // Engagement is included for panel grouping/readability.
    engagement: {
      fidgetThreshold: null,
    },
  };

  // Enforce monotonic thresholds for shoulder/spine/yaw/pitch after initial calibration.
  calibrated.posture.shoulder.moderateSlopeThreshold = round(
    clamp(
      percentile(samples.shoulderSlope, 0.80) ?? STATIC_THRESHOLDS.posture.shoulder.moderateSlopeThreshold,
      calibrated.posture.shoulder.maxSlopeThreshold + 0.005,
      0.15,
    ),
  );
  calibrated.posture.shoulder.poorSlopeThreshold = round(
    clamp(
      percentile(samples.shoulderSlope, 0.93) ?? STATIC_THRESHOLDS.posture.shoulder.poorSlopeThreshold,
      calibrated.posture.shoulder.moderateSlopeThreshold + 0.005,
      0.25,
    ),
  );

  calibrated.posture.spine.moderateForwardHeadThreshold = round(
    clamp(
      percentile(samples.forwardHead, 0.80) ?? STATIC_THRESHOLDS.posture.spine.moderateForwardHeadThreshold,
      calibrated.posture.spine.maxForwardHeadThreshold + 0.005,
      0.20,
    ),
  );
  calibrated.posture.spine.poorForwardHeadThreshold = round(
    clamp(
      percentile(samples.forwardHead, 0.93) ?? STATIC_THRESHOLDS.posture.spine.poorForwardHeadThreshold,
      calibrated.posture.spine.moderateForwardHeadThreshold + 0.005,
      0.30,
    ),
  );

  calibrated.posture.head.poorTiltThreshold = round(
    clamp(
      percentile(samples.headTilt, 0.93) ?? STATIC_THRESHOLDS.posture.head.poorTiltThreshold,
      calibrated.posture.head.maxTiltThreshold + 2,
      40,
    ),
  );

  calibrated.eyeContact.orientation.moderateYawThreshold = round(
    clamp(
      percentile(samples.yawAbs, 0.80) ?? STATIC_THRESHOLDS.eyeContact.orientation.moderateYawThreshold,
      calibrated.eyeContact.orientation.maxYawThreshold + 2,
      55,
    ),
  );
  calibrated.eyeContact.orientation.poorYawThreshold = round(
    clamp(
      percentile(samples.yawAbs, 0.93) ?? STATIC_THRESHOLDS.eyeContact.orientation.poorYawThreshold,
      calibrated.eyeContact.orientation.moderateYawThreshold + 2,
      75,
    ),
  );

  calibrated.eyeContact.orientation.moderatePitchThreshold = round(
    clamp(
      percentile(samples.pitchAbs, 0.80) ?? STATIC_THRESHOLDS.eyeContact.orientation.moderatePitchThreshold,
      calibrated.eyeContact.orientation.maxPitchThreshold + 2,
      35,
    ),
  );
  calibrated.eyeContact.orientation.poorPitchThreshold = round(
    clamp(
      percentile(samples.pitchAbs, 0.93) ?? STATIC_THRESHOLDS.eyeContact.orientation.poorPitchThreshold,
      calibrated.eyeContact.orientation.moderatePitchThreshold + 2,
      50,
    ),
  );

  calibrated.engagement.fidgetThreshold = calibrated.posture.hands.fidgetingThreshold;
  return calibrated;
}

function getConfidence(stats) {
  if (!stats) return 'none';
  if (stats.sampleSize >= 30) return 'high';
  if (stats.sampleSize >= 10) return 'medium';
  return 'low';
}

/**
 * Calibrate thresholds from collected analytics data.
 */
export async function calibrateFromCollectedData() {
  const { highScoreData, totalAnalytics, totalHighScore } = await fetchHighScoreAnalytics();

  if (highScoreData.length === 0) {
    return {
      success: false,
      error: 'No analytics data available for calibration. Conduct more interviews first.',
      totalAnalytics,
      totalHighScore: 0,
    };
  }

  const samples = extractSamples(highScoreData);
  const calibrated = calibrateFromSamples(samples);

  const comparisons = COMPARISON_METRICS.map((metricConfig) => {
    const values = samples[metricConfig.sampleKey] || [];
    const stats = computeStats(values);
    const staticValue = getNestedValue(STATIC_THRESHOLDS, metricConfig.staticPath);
    const calibratedValue = getNestedValue(calibrated, metricConfig.calibratedPath);
    const deviation =
      stats && staticValue !== 0 && staticValue != null
        ? round(((calibratedValue - staticValue) / staticValue) * 100, 2)
        : null;

    return {
      metric: metricConfig.metric,
      staticValue,
      calibratedValue: stats ? calibratedValue : null,
      deviation,
      stats,
      confidence: getConfidence(stats),
    };
  });

  const calibratedCount = comparisons.filter((c) => c.stats).length;
  const highConfidenceCount = comparisons.filter((c) => c.confidence === 'high').length;

  return {
    success: true,
    calibrated,
    comparisons,
    summary: {
      totalAnalyticsDatasets: totalAnalytics,
      highScoreDatasets: totalHighScore,
      metricsCalibrated: calibratedCount,
      metricsWithInsufficientData: comparisons.length - calibratedCount,
      highConfidenceMetrics: highConfidenceCount,
    },
  };
}

/**
 * Get static reference thresholds for debugging/comparison.
 */
export function getStaticThresholds() {
  return STATIC_THRESHOLDS;
}

export default {
  calibrateFromCollectedData,
  getStaticThresholds,
};

