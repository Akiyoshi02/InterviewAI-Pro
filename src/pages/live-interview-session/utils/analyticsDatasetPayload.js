const DEFAULT_MAX_ANALYTICS_POINTS = 180;

const sanitizeNumber = (value) => (Number.isFinite(value) ? value : 0);

export const compactAnalyticsPoint = (point = {}) => ({
  timestamp: sanitizeNumber(point.timestamp),
  frameNumber: sanitizeNumber(point.frameNumber),
  scores: {
    posture: sanitizeNumber(point.scores?.posture),
    attention: sanitizeNumber(point.scores?.attention),
    bodyLanguage: sanitizeNumber(point.scores?.bodyLanguage),
    overall: sanitizeNumber(point.scores?.overall),
  },
  bodyLanguage: {
    posture: point.bodyLanguage?.posture || null,
    eyeContact: point.bodyLanguage?.eyeContact || null,
    headPosition: point.bodyLanguage?.headPosition || null,
    handMovement: point.bodyLanguage?.handMovement || null,
  },
  signals: {
    poseDetected: Boolean(point.pose),
    faceDetected: Boolean(point.face),
  },
});

export const evenlySampleAnalyticsPoints = (
  dataPoints = [],
  maxPoints = DEFAULT_MAX_ANALYTICS_POINTS,
) => {
  if (!Array.isArray(dataPoints) || dataPoints.length <= maxPoints) {
    return dataPoints.map(compactAnalyticsPoint);
  }

  const sampled = [];
  const lastIndex = dataPoints.length - 1;
  for (let index = 0; index < maxPoints; index += 1) {
    const sourceIndex = Math.min(
      lastIndex,
      Math.round((index * lastIndex) / Math.max(maxPoints - 1, 1)),
    );
    sampled.push(compactAnalyticsPoint(dataPoints[sourceIndex]));
  }

  return sampled;
};

export const buildAnalyticsDatasetPayload = ({
  collectedData = [],
  interviewId = null,
  sessionDuration = 0,
  detectionInterval = 100,
} = {}) => {
  if (!Array.isArray(collectedData) || collectedData.length === 0) {
    return null;
  }

  const sampledPoints = evenlySampleAnalyticsPoints(collectedData);
  const averages = collectedData.reduce((acc, point) => ({
    posture: acc.posture + sanitizeNumber(point.scores?.posture),
    overall: acc.overall + sanitizeNumber(point.scores?.overall),
  }), { posture: 0, overall: 0 });

  return {
    sessionId: `session_${Date.now()}`,
    interviewId,
    dataPoints: sampledPoints,
    summary: {
      totalFrames: collectedData.length,
      storedFrames: sampledPoints.length,
      averagePostureScore: Math.round(averages.posture / collectedData.length),
      averageOverallScore: Math.round(averages.overall / collectedData.length),
      sessionDuration,
    },
    config: {
      enablePose: true,
      enableFace: true,
      detectionInterval,
    },
  };
};

