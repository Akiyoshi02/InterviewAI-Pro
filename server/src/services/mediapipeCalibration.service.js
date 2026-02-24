/**
 * MediaPipe Calibration Service
 *
 * Analyzes collected posture/face-mesh data from high-scoring interviews
 * to derive data-driven thresholds, then compares against static values
 * from mediapipeReferenceData.js.
 */

import logger from '../utils/logger.js';
import { firestore } from '../config/firebase.js';

const HIGH_SCORE_THRESHOLD = 70;

const STATIC_THRESHOLDS = {
  posture: {
    shoulderLevelThreshold: 0.03,
    headTiltThreshold: 15,
    slouchThreshold: 0.15,
    leanThreshold: 0.08,
  },
  eyeContact: {
    gazeDeviationThreshold: 0.12,
    blinkRateMin: 10,
    blinkRateMax: 25,
    eyeOpenRatioMin: 0.2,
  },
  facial: {
    smileThreshold: 0.3,
    neutralThreshold: 0.5,
    expressionVarianceMin: 0.1,
  },
  engagement: {
    headMovementMin: 0.02,
    headMovementMax: 0.15,
    fidgetThreshold: 0.2,
    stillnessThreshold: 0.01,
  },
};

const METRIC_KEYS = [
  'posture.shoulderLevelThreshold',
  'posture.headTiltThreshold',
  'posture.slouchThreshold',
  'posture.leanThreshold',
  'eyeContact.gazeDeviationThreshold',
  'eyeContact.blinkRateMin',
  'eyeContact.blinkRateMax',
  'eyeContact.eyeOpenRatioMin',
  'facial.smileThreshold',
  'facial.neutralThreshold',
  'facial.expressionVarianceMin',
  'engagement.headMovementMin',
  'engagement.headMovementMax',
  'engagement.fidgetThreshold',
  'engagement.stillnessThreshold',
];

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, key) => (o ? o[key] : undefined), obj);
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

function computeStats(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  const p10 = sorted[Math.max(0, Math.floor(n * 0.1))];
  const p90 = sorted[Math.min(n - 1, Math.floor(n * 0.9))];

  return {
    mean: Math.round(mean * 10000) / 10000,
    median: Math.round(median * 10000) / 10000,
    stdDev: Math.round(stdDev * 10000) / 10000,
    p10: Math.round(p10 * 10000) / 10000,
    p90: Math.round(p90 * 10000) / 10000,
    sampleSize: n,
  };
}

/**
 * Fetch analytics datasets from Firestore and filter by high scores.
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

  let highScoreData = datasets.filter((d) => {
    if (d.interviewId && interviewScores.has(d.interviewId)) return true;
    const score =
      Number(d.overallScore || d.statistics?.averageScore) ||
      Number(d.referenceComparison?.averages?.overall) ||
      Number(d.summary?.averageOverallScore);
    return score >= HIGH_SCORE_THRESHOLD;
  });

  if (highScoreData.length === 0 && datasets.length > 0) {
    highScoreData = datasets.slice(0, Math.min(50, datasets.length));
  }

  return { highScoreData, totalAnalytics: datasets.length, totalHighScore: highScoreData.length };
}

/**
 * Extract metric values from analytics data for calibration.
 * Supports both: (a) dataPoints array format from backend, (b) flat data format.
 */
function extractMetricValues(analyticsData) {
  const metricCollections = {};
  METRIC_KEYS.forEach((key) => {
    metricCollections[key] = [];
  });

  const pushIfNumeric = (collections, key, value) => {
    if (value !== undefined && value !== null && Number.isFinite(Number(value))) {
      collections[key].push(Number(value));
    }
  };

  for (const dataset of analyticsData) {
    const rawData = dataset.data || dataset.analyticsData || dataset;
    const dataPoints = Array.isArray(rawData.dataPoints) ? rawData.dataPoints : [rawData];

    for (const point of dataPoints) {
      const pose = point.pose || point.poseMetrics || {};
      const face = point.face || point.faceMetrics || point.faceMesh || {};
      const bodyLang = point.bodyLanguage || point.bodyLanguageMetrics || {};
      const scores = point.scores || {};

      pushIfNumeric(metricCollections, 'posture.shoulderLevelThreshold', pose.shoulderAlignment ?? (100 - (scores.posture || 0)) / 100);
      pushIfNumeric(metricCollections, 'posture.headTiltThreshold', Math.abs(face.yaw ?? face.pitch ?? 0));
      pushIfNumeric(metricCollections, 'posture.slouchThreshold', pose.slouching ? 0.15 : 0.02);
      pushIfNumeric(metricCollections, 'posture.leanThreshold', pose.forwardHead ? 0.08 : 0.02);
      pushIfNumeric(metricCollections, 'eyeContact.gazeDeviationThreshold', (100 - (face.eyeContactScore ?? scores.attention ?? 100)) / 1000);
      pushIfNumeric(metricCollections, 'eyeContact.blinkRateMin', face.blinkCount);
      pushIfNumeric(metricCollections, 'eyeContact.blinkRateMax', face.blinkCount);
      pushIfNumeric(metricCollections, 'eyeContact.eyeOpenRatioMin', face.eyeAspectRatio ?? 0.22);
      pushIfNumeric(metricCollections, 'facial.smileThreshold', face.mouthMAR ?? 0.3);
      pushIfNumeric(metricCollections, 'facial.neutralThreshold', 0.5);
      pushIfNumeric(metricCollections, 'facial.expressionVarianceMin', face.pitch != null ? Math.abs(face.pitch) / 90 : 0.1);
      pushIfNumeric(metricCollections, 'engagement.headMovementMin', bodyLang.stability != null ? bodyLang.stability / 100 : 0.02);
      pushIfNumeric(metricCollections, 'engagement.headMovementMax', bodyLang.stability ?? bodyLang.overallStability);
      pushIfNumeric(metricCollections, 'engagement.fidgetThreshold', bodyLang.fidgeting ? 0.2 : 0.05);
      pushIfNumeric(metricCollections, 'engagement.stillnessThreshold', bodyLang.overallStability != null ? (100 - bodyLang.overallStability) / 100 : 0.01);
    }
  }

  return metricCollections;
}

/**
 * Calibrate thresholds from collected data.
 */
export async function calibrateFromCollectedData() {
  const { highScoreData, totalAnalytics, totalHighScore } = await fetchHighScoreAnalytics();

  if (highScoreData.length === 0) {
    return {
      success: false,
      error: 'No high-scoring analytics data available for calibration. Conduct more interviews.',
      totalAnalytics,
      totalHighScore: 0,
    };
  }

  const metricValues = extractMetricValues(highScoreData);
  const calibratedMetrics = {};
  const comparisons = [];

  for (const key of METRIC_KEYS) {
    const stats = computeStats(metricValues[key]);
    const staticValue = getNestedValue(STATIC_THRESHOLDS, key);
    const calibratedValue = stats ? stats.mean : staticValue;

    setNestedValue(calibratedMetrics, key, calibratedValue);

    const deviation = stats && staticValue !== 0
      ? Math.round(((calibratedValue - staticValue) / staticValue) * 10000) / 100
      : null;

    comparisons.push({
      metric: key,
      staticValue,
      calibratedValue: stats ? calibratedValue : null,
      deviation,
      stats,
      confidence: stats
        ? stats.sampleSize >= 30 ? 'high' : stats.sampleSize >= 10 ? 'medium' : 'low'
        : 'none',
    });
  }

  return {
    success: true,
    calibrated: calibratedMetrics,
    comparisons,
    summary: {
      totalAnalyticsDatasets: totalAnalytics,
      highScoreDatasets: totalHighScore,
      metricsCalibrated: comparisons.filter((c) => c.stats !== null).length,
      metricsWithInsufficientData: comparisons.filter((c) => c.stats === null).length,
      highConfidenceMetrics: comparisons.filter((c) => c.confidence === 'high').length,
    },
  };
}

/**
 * Get static reference thresholds for comparison.
 */
export function getStaticThresholds() {
  return STATIC_THRESHOLDS;
}
