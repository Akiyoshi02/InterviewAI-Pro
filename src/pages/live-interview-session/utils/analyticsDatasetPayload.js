const DEFAULT_MAX_ANALYTICS_POINTS = 180;

const sanitizeNumber = (value) => (Number.isFinite(value) ? value : 0);

const compactFaceSummary = (face = {}) => {
  if (!face || typeof face !== 'object') {
    return null;
  }

  return {
    eyeContactScore: sanitizeNumber(face.eyeContactScore),
    orientation: {
      yaw: sanitizeNumber(face.yaw),
      pitch: sanitizeNumber(face.pitch),
      roll: sanitizeNumber(face.roll),
      status: face.faceOrientationStatus || null,
    },
    eyes: {
      leftEAR: sanitizeNumber(face.leftEAR ?? face.leftEyeEAR),
      rightEAR: sanitizeNumber(face.rightEAR ?? face.rightEyeEAR),
      avgEAR: sanitizeNumber(face.avgEAR ?? face.avgEyeEAR),
      asymmetry: sanitizeNumber(face.eyeAsymmetry),
      blinkCount: sanitizeNumber(face.blinkCount),
      blinkRate: sanitizeNumber(face.blinkRate),
      isBlinking: Boolean(face.isBlinking),
    },
    gaze: {
      isLookingAtCamera: Boolean(face.isLookingAtCamera ?? face.gaze?.isLookingAtCamera),
      direction: face.gaze?.direction || face.gazeDirection || null,
      status: face.gaze?.status || face.gazeStatus || null,
      deviation: sanitizeNumber(face.gaze?.deviation ?? face.gazeDeviation),
      horizontalOffset: sanitizeNumber(face.gaze?.horizontalOffset ?? face.gazeHorizontalOffset),
      verticalOffset: sanitizeNumber(face.gaze?.verticalOffset ?? face.gazeVerticalOffset),
    },
    iris: {
      left: {
        rawX: sanitizeNumber(face.iris?.left?.rawX ?? face.leftIrisCenter?.rawX),
        rawY: sanitizeNumber(face.iris?.left?.rawY ?? face.leftIrisCenter?.rawY),
        normalizedX: sanitizeNumber(face.iris?.left?.normalizedX ?? face.leftIrisCenter?.normalizedX),
        normalizedY: sanitizeNumber(face.iris?.left?.normalizedY ?? face.leftIrisCenter?.normalizedY),
      },
      right: {
        rawX: sanitizeNumber(face.iris?.right?.rawX ?? face.rightIrisCenter?.rawX),
        rawY: sanitizeNumber(face.iris?.right?.rawY ?? face.rightIrisCenter?.rawY),
        normalizedX: sanitizeNumber(face.iris?.right?.normalizedX ?? face.rightIrisCenter?.normalizedX),
        normalizedY: sanitizeNumber(face.iris?.right?.normalizedY ?? face.rightIrisCenter?.normalizedY),
      },
      symmetry: sanitizeNumber(face.iris?.symmetry ?? face.irisSymmetry),
    },
    speaking: {
      mouthMAR: sanitizeNumber(face.mouthMAR),
      isSpeaking: Boolean(face.isSpeaking),
    },
  };
};

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
  faceSummary: compactFaceSummary(point.face),
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

