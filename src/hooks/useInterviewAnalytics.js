/**
 * Interview Analytics Hook
 * 
 * Comprehensive hook that combines:
 * - Pose detection (body posture, hand movement)
 * - Face-mesh detection (eye contact, face orientation, expressions)
 * - Reference data comparison (scoring against ideal values)
 * - Real-time feedback generation
 * - Data collection for training datasets
 * 
 * This is the main hook for interview body language analysis.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PoseLandmarker, FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import {
  POSE_LANDMARKS,
  FACE_LANDMARKS,
  POSTURE_REFERENCE,
  FACE_REFERENCE,
  SCORING_WEIGHTS,
  FEEDBACK_THRESHOLDS,
  calculateEAR,
  calculateMAR,
  calculateFaceOrientation,
  getScoreLevel,
  getFeedbackMessage,
} from '../config/mediapipeReferenceData';

const DETECTION_INTERVAL = 100; // 10 FPS

/**
 * Main Interview Analytics Hook
 */
export const useInterviewAnalytics = (videoElement, options = {}) => {
  const {
    enablePose = true,
    enableFace = true,
    collectData = false, // Enable data collection for training
    interviewId = null,
  } = options;

  // Model states
  const [poseLandmarker, setPoseLandmarker] = useState(null);
  const [faceLandmarker, setFaceLandmarker] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationStatus, setInitializationStatus] = useState({
    pose: 'loading',
    face: 'loading',
  });
  const [error, setError] = useState(null);

  // Comprehensive metrics state
  const [metrics, setMetrics] = useState({
    // Pose metrics
    pose: {
      posture: 'good',
      postureScore: 100,
      shoulderAlignment: 100,
      spineAlignment: 100,
      headPosition: 'centered',
      slouching: false,
      forwardHead: false,
      landmarks: null,
    },
    
    // Face metrics
    face: {
      eyeContactScore: 100,
      eyeContactStatus: 'good',
      leftEyeEAR: 0,
      rightEyeEAR: 0,
      isBlinking: false,
      blinkCount: 0,
      mouthMAR: 0,
      isSpeaking: false,
      yaw: 0,
      pitch: 0,
      roll: 0,
      faceOrientationStatus: 'direct',
      eyebrowPosition: 'neutral',
      landmarks: null,
    },
    
    // Body language metrics
    bodyLanguage: {
      fidgeting: false,
      handMovement: 0,
      overallStability: 100,
    },
    
    // Composite scores
    scores: {
      posture: 100,
      attention: 100,
      bodyLanguage: 100,
      expression: 100,
      overall: 100,
    },
    
    // Feedback
    feedback: {
      posture: '',
      eyeContact: '',
      composure: '',
      overall: '',
    },
    
    // Metadata
    lastUpdated: null,
    frameCount: 0,
  });

  // Data collection state
  const [collectedData, setCollectedData] = useState([]);
  const dataCollectionIntervalRef = useRef(null);

  // Detection refs
  const detectionIntervalRef = useRef(null);
  const metricsRef = useRef(metrics);
  const previousPoseLandmarksRef = useRef(null);
  const movementHistoryRef = useRef([]);
  const blinkCountRef = useRef(0);
  const isEyeClosedRef = useRef(false);
  const blinkFrameCountRef = useRef(0);
  const speakingFramesRef = useRef(0);
  const frameCountRef = useRef(0);

  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  /**
   * Initialize MediaPipe models
   */
  useEffect(() => {
    const initializeModels = async () => {
      try {
        // Load MediaPipe Vision tasks
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        // Initialize PoseLandmarker
        if (enablePose) {
          try {
            const poseModel = await PoseLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                delegate: 'GPU',
              },
              runningMode: 'VIDEO',
              numPoses: 1,
              minPoseDetectionConfidence: 0.5,
              minPosePresenceConfidence: 0.5,
              minTrackingConfidence: 0.5,
            });
            setPoseLandmarker(poseModel);
            setInitializationStatus(prev => ({ ...prev, pose: 'ready' }));
            console.log('PoseLandmarker initialized successfully');
          } catch (poseErr) {
            console.error('PoseLandmarker initialization failed:', poseErr);
            setInitializationStatus(prev => ({ ...prev, pose: 'error' }));
          }
        } else {
          setInitializationStatus(prev => ({ ...prev, pose: 'disabled' }));
        }

        // Initialize FaceLandmarker
        if (enableFace) {
          try {
            const faceModel = await FaceLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                delegate: 'GPU',
              },
              runningMode: 'VIDEO',
              numFaces: 1,
              minFaceDetectionConfidence: 0.5,
              minFacePresenceConfidence: 0.5,
              minTrackingConfidence: 0.5,
              outputFaceBlendshapes: true,
              outputFacialTransformationMatrixes: true,
            });
            setFaceLandmarker(faceModel);
            setInitializationStatus(prev => ({ ...prev, face: 'ready' }));
            console.log('FaceLandmarker initialized successfully');
          } catch (faceErr) {
            console.error('FaceLandmarker initialization failed:', faceErr);
            setInitializationStatus(prev => ({ ...prev, face: 'error' }));
          }
        } else {
          setInitializationStatus(prev => ({ ...prev, face: 'disabled' }));
        }

        setIsInitialized(true);
        setError(null);
      } catch (err) {
        console.error('Failed to initialize MediaPipe:', err);
        setError('Failed to initialize analytics. Interview will continue without body language analysis.');
        setIsInitialized(false);
      }
    };

    initializeModels();

    return () => {
      if (poseLandmarker) poseLandmarker.close();
      if (faceLandmarker) faceLandmarker.close();
    };
  }, [enablePose, enableFace]);

  /**
   * Analyze pose landmarks
   */
  const analyzePose = useCallback((landmarks) => {
    // Key landmarks
    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const nose = landmarks[POSE_LANDMARKS.NOSE];
    const leftEye = landmarks[POSE_LANDMARKS.LEFT_EYE];
    const rightEye = landmarks[POSE_LANDMARKS.RIGHT_EYE];
    const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rightWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];

    // === SHOULDER ALIGNMENT ===
    const shoulderSlope = Math.abs(leftShoulder.y - rightShoulder.y);
    let shoulderScore = 100;
    let shoulderStatus = 'good';
    
    if (shoulderSlope > POSTURE_REFERENCE.shoulder.poorSlopeThreshold) {
      shoulderScore = 40;
      shoulderStatus = 'poor';
    } else if (shoulderSlope > POSTURE_REFERENCE.shoulder.moderateSlopeThreshold) {
      shoulderScore = 70;
      shoulderStatus = 'fair';
    } else if (shoulderSlope > POSTURE_REFERENCE.shoulder.maxSlopeThreshold) {
      shoulderScore = 85;
    }

    // === SPINE/FORWARD HEAD ===
    const shoulderMidpoint = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
      z: ((leftShoulder.z || 0) + (rightShoulder.z || 0)) / 2,
    };
    
    const forwardHeadDistance = (nose.z || 0) - shoulderMidpoint.z;
    const forwardHead = forwardHeadDistance > POSTURE_REFERENCE.spine.maxForwardHeadThreshold;
    
    let spineScore = 100;
    if (forwardHeadDistance > POSTURE_REFERENCE.spine.poorForwardHeadThreshold) {
      spineScore = 40;
    } else if (forwardHeadDistance > POSTURE_REFERENCE.spine.moderateForwardHeadThreshold) {
      spineScore = 70;
    } else if (forwardHeadDistance > POSTURE_REFERENCE.spine.maxForwardHeadThreshold) {
      spineScore = 85;
    }

    // === HEAD POSITION ===
    const eyeSlope = Math.abs(leftEye.y - rightEye.y);
    const eyeMidpoint = (leftEye.y + rightEye.y) / 2;
    const headLowered = nose.y > eyeMidpoint + POSTURE_REFERENCE.head.loweredThreshold;
    
    let headPosition = 'centered';
    if (eyeSlope > POSTURE_REFERENCE.head.poorTiltThreshold) {
      headPosition = 'tilted';
    } else if (headLowered) {
      headPosition = 'lowered';
    } else if (eyeSlope > POSTURE_REFERENCE.head.maxTiltThreshold) {
      headPosition = 'slightly_tilted';
    }

    // === SLOUCHING ===
    const slouching = shoulderSlope > POSTURE_REFERENCE.shoulder.moderateSlopeThreshold || 
                      forwardHeadDistance > POSTURE_REFERENCE.spine.moderateForwardHeadThreshold;

    // === HAND MOVEMENT / FIDGETING ===
    let fidgeting = false;
    let handMovement = 0;
    
    if (previousPoseLandmarksRef.current) {
      const prevLeftWrist = previousPoseLandmarksRef.current[POSE_LANDMARKS.LEFT_WRIST];
      const prevRightWrist = previousPoseLandmarksRef.current[POSE_LANDMARKS.RIGHT_WRIST];
      
      const leftMovement = Math.sqrt(
        Math.pow(leftWrist.x - prevLeftWrist.x, 2) +
        Math.pow(leftWrist.y - prevLeftWrist.y, 2)
      );
      const rightMovement = Math.sqrt(
        Math.pow(rightWrist.x - prevRightWrist.x, 2) +
        Math.pow(rightWrist.y - prevRightWrist.y, 2)
      );
      
      handMovement = leftMovement + rightMovement;
      
      // Track movement history
      movementHistoryRef.current.push(handMovement);
      if (movementHistoryRef.current.length > POSTURE_REFERENCE.hands.historyWindow) {
        movementHistoryRef.current.shift();
      }
      
      const avgMovement = movementHistoryRef.current.reduce((a, b) => a + b, 0) / 
                          movementHistoryRef.current.length;
      fidgeting = avgMovement > POSTURE_REFERENCE.hands.fidgetingThreshold;
    }
    
    previousPoseLandmarksRef.current = landmarks;

    // === OVERALL POSTURE SCORE ===
    const postureScore = Math.round(
      shoulderScore * SCORING_WEIGHTS.posture.components.shoulderAlignment +
      spineScore * SCORING_WEIGHTS.posture.components.spineAlignment +
      (headPosition === 'centered' ? 100 : headPosition === 'slightly_tilted' ? 85 : 60) * 
        SCORING_WEIGHTS.posture.components.headPosition
    );

    const postureStatus = postureScore >= 80 ? 'good' : postureScore >= 60 ? 'fair' : 'poor';

    // === BODY LANGUAGE SCORE ===
    const stabilityScore = fidgeting ? 50 : handMovement > 0.03 ? 70 : 100;

    return {
      pose: {
        posture: postureStatus,
        postureScore,
        shoulderAlignment: shoulderScore,
        spineAlignment: spineScore,
        headPosition,
        slouching,
        forwardHead,
        landmarks,
      },
      bodyLanguage: {
        fidgeting,
        handMovement,
        overallStability: stabilityScore,
      },
    };
  }, []);

  /**
   * Analyze face landmarks
   */
  const analyzeFace = useCallback((faceLandmarks, blendshapes) => {
    // === EYE ANALYSIS ===
    const leftEyeTop = faceLandmarks[FACE_LANDMARKS.LEFT_EYE_TOP];
    const leftEyeBottom = faceLandmarks[FACE_LANDMARKS.LEFT_EYE_BOTTOM];
    const leftEyeLeft = faceLandmarks[FACE_LANDMARKS.LEFT_EYE_LEFT];
    const leftEyeRight = faceLandmarks[FACE_LANDMARKS.LEFT_EYE_RIGHT];
    
    const rightEyeTop = faceLandmarks[FACE_LANDMARKS.RIGHT_EYE_TOP];
    const rightEyeBottom = faceLandmarks[FACE_LANDMARKS.RIGHT_EYE_BOTTOM];
    const rightEyeLeft = faceLandmarks[FACE_LANDMARKS.RIGHT_EYE_LEFT];
    const rightEyeRight = faceLandmarks[FACE_LANDMARKS.RIGHT_EYE_RIGHT];
    
    const leftEAR = calculateEAR(leftEyeTop, leftEyeBottom, leftEyeLeft, leftEyeRight);
    const rightEAR = calculateEAR(rightEyeTop, rightEyeBottom, rightEyeLeft, rightEyeRight);
    const avgEAR = (leftEAR + rightEAR) / 2;
    
    // Blink detection
    const isBlinking = avgEAR < FACE_REFERENCE.eyes.blinkThreshold;
    if (isBlinking && !isEyeClosedRef.current) {
      blinkCountRef.current += 1;
      isEyeClosedRef.current = true;
    } else if (!isBlinking) {
      isEyeClosedRef.current = false;
      blinkFrameCountRef.current = 0;
    }
    
    if (isBlinking) {
      blinkFrameCountRef.current += 1;
    }

    // === MOUTH ANALYSIS ===
    const upperLip = faceLandmarks[FACE_LANDMARKS.UPPER_LIP];
    const lowerLip = faceLandmarks[FACE_LANDMARKS.LOWER_LIP];
    const leftMouth = faceLandmarks[FACE_LANDMARKS.LIPS_OUTER[0]];
    const rightMouth = faceLandmarks[FACE_LANDMARKS.LIPS_OUTER[10]];
    
    const mouthMAR = calculateMAR(upperLip, lowerLip, leftMouth, rightMouth);
    const isSpeakingNow = mouthMAR > FACE_REFERENCE.mouth.speakingThreshold;
    
    if (isSpeakingNow) {
      speakingFramesRef.current = Math.min(speakingFramesRef.current + 1, 10);
    } else {
      speakingFramesRef.current = Math.max(speakingFramesRef.current - 1, 0);
    }

    // === FACE ORIENTATION ===
    const noseTip = faceLandmarks[FACE_LANDMARKS.NOSE_TIP];
    const leftEyeCenter = faceLandmarks[FACE_LANDMARKS.LEFT_EYE_RIGHT];
    const rightEyeCenter = faceLandmarks[FACE_LANDMARKS.RIGHT_EYE_LEFT];
    const chin = faceLandmarks[FACE_LANDMARKS.CHIN];
    
    const { yaw, pitch, roll } = calculateFaceOrientation(noseTip, leftEyeCenter, rightEyeCenter, chin);
    
    const absYaw = Math.abs(yaw);
    const absPitch = Math.abs(pitch);
    
    let faceOrientationStatus = 'direct';
    if (absYaw > FACE_REFERENCE.orientation.poorYawThreshold || 
        absPitch > FACE_REFERENCE.orientation.poorPitchThreshold) {
      faceOrientationStatus = 'away';
    } else if (absYaw > FACE_REFERENCE.orientation.moderateYawThreshold ||
               absPitch > FACE_REFERENCE.orientation.moderatePitchThreshold) {
      faceOrientationStatus = 'moderate';
    } else if (absYaw > FACE_REFERENCE.orientation.maxYawThreshold ||
               absPitch > FACE_REFERENCE.orientation.maxPitchThreshold) {
      faceOrientationStatus = 'slight';
    }

    // === EYE CONTACT SCORE ===
    let eyeContactScore = 100;
    
    // Penalize based on face orientation
    if (faceOrientationStatus === 'away') {
      eyeContactScore -= 40;
    } else if (faceOrientationStatus === 'moderate') {
      eyeContactScore -= 20;
    } else if (faceOrientationStatus === 'slight') {
      eyeContactScore -= 10;
    }
    
    // Penalize prolonged eye closure
    if (blinkFrameCountRef.current > FACE_REFERENCE.eyes.prolongedClosureFrames) {
      eyeContactScore -= 30;
    }
    
    eyeContactScore = Math.max(0, eyeContactScore);
    
    const eyeContactStatus = eyeContactScore >= 80 ? 'good' : 
                             eyeContactScore >= 60 ? 'fair' : 'poor';

    // === EYEBROW ANALYSIS ===
    let eyebrowPosition = 'neutral';
    if (blendshapes && blendshapes.length > 0) {
      const shapes = blendshapes[0].categories;
      const browUpLeft = shapes.find(s => s.categoryName === 'browOuterUpLeft')?.score || 0;
      const browUpRight = shapes.find(s => s.categoryName === 'browOuterUpRight')?.score || 0;
      const browDownLeft = shapes.find(s => s.categoryName === 'browDownLeft')?.score || 0;
      const browDownRight = shapes.find(s => s.categoryName === 'browDownRight')?.score || 0;
      
      if ((browUpLeft + browUpRight) / 2 > 0.3) eyebrowPosition = 'raised';
      else if ((browDownLeft + browDownRight) / 2 > 0.3) eyebrowPosition = 'furrowed';
    }

    return {
      eyeContactScore,
      eyeContactStatus,
      leftEyeEAR: leftEAR,
      rightEyeEAR: rightEAR,
      isBlinking,
      blinkCount: blinkCountRef.current,
      mouthMAR,
      isSpeaking: speakingFramesRef.current > 3,
      yaw,
      pitch,
      roll,
      faceOrientationStatus,
      eyebrowPosition,
      landmarks: faceLandmarks,
    };
  }, []);

  /**
   * Calculate composite scores and generate feedback
   */
  const calculateScoresAndFeedback = useCallback((poseData, faceData, bodyLanguageData) => {
    // Posture score
    const postureScore = poseData.postureScore;
    
    // Attention score (primarily eye contact and face orientation)
    const attentionScore = faceData ? faceData.eyeContactScore : 100;
    
    // Body language score
    const bodyLanguageScore = bodyLanguageData.overallStability;
    
    // Expression score (neutral is good for interviews)
    const expressionScore = faceData?.eyebrowPosition === 'neutral' ? 100 :
                           faceData?.eyebrowPosition === 'raised' ? 90 : 80;
    
    // Overall weighted score
    const overallScore = Math.round(
      postureScore * SCORING_WEIGHTS.posture.weight +
      attentionScore * SCORING_WEIGHTS.attention.weight +
      bodyLanguageScore * SCORING_WEIGHTS.bodyLanguage.weight +
      expressionScore * SCORING_WEIGHTS.expression.weight
    );
    
    // Generate feedback
    const postureLevel = getScoreLevel(postureScore);
    const attentionLevel = getScoreLevel(attentionScore);
    const bodyLanguageLevel = getScoreLevel(bodyLanguageScore);
    const overallLevel = getScoreLevel(overallScore);
    
    return {
      scores: {
        posture: postureScore,
        attention: attentionScore,
        bodyLanguage: bodyLanguageScore,
        expression: expressionScore,
        overall: overallScore,
      },
      feedback: {
        posture: getFeedbackMessage('posture', postureLevel),
        eyeContact: getFeedbackMessage('eyeContact', attentionLevel),
        composure: getFeedbackMessage('composure', bodyLanguageLevel),
        overall: `Overall interview presence: ${overallLevel}`,
      },
    };
  }, []);

  /**
   * Main detection function
   */
  const runDetection = useCallback(async () => {
    if (!videoElement) return;

    const startTimeMs = performance.now();
    frameCountRef.current += 1;

    const currentMetrics = metricsRef.current;
    let poseData = currentMetrics.pose;
    let bodyLanguageData = currentMetrics.bodyLanguage;
    let faceData = currentMetrics.face;

    // Pose detection
    if (poseLandmarker) {
      try {
        const poseResults = poseLandmarker.detectForVideo(videoElement, startTimeMs);
        if (poseResults?.landmarks?.length > 0) {
          const analysis = analyzePose(poseResults.landmarks[0]);
          poseData = analysis.pose;
          bodyLanguageData = analysis.bodyLanguage;
        }
      } catch (err) {
        console.error('Pose detection error:', err);
      }
    }

    // Face detection
    if (faceLandmarker) {
      try {
        const faceResults = faceLandmarker.detectForVideo(videoElement, startTimeMs);
        if (faceResults?.faceLandmarks?.length > 0) {
          faceData = analyzeFace(
            faceResults.faceLandmarks[0],
            faceResults.faceBlendshapes
          );
        }
      } catch (err) {
        console.error('Face detection error:', err);
      }
    }

    // Calculate scores and feedback
    const { scores, feedback } = calculateScoresAndFeedback(poseData, faceData, bodyLanguageData);

    // Update metrics
    setMetrics((previousMetrics) => {
      const nextMetrics = {
        ...previousMetrics,
        pose: poseData,
        face: faceData,
        bodyLanguage: bodyLanguageData,
        scores,
        feedback,
        lastUpdated: Date.now(),
        frameCount: frameCountRef.current,
      };
      metricsRef.current = nextMetrics;
      return nextMetrics;
    });

    // Collect data if enabled
    if (collectData && interviewId) {
      const dataPoint = {
        timestamp: Date.now(),
        frameNumber: frameCountRef.current,
        pose: {
          postureScore: poseData.postureScore,
          shoulderAlignment: poseData.shoulderAlignment,
          spineAlignment: poseData.spineAlignment,
          headPosition: poseData.headPosition,
          slouching: poseData.slouching,
          forwardHead: poseData.forwardHead,
        },
        face: faceData ? {
          eyeContactScore: faceData.eyeContactScore,
          yaw: faceData.yaw,
          pitch: faceData.pitch,
          roll: faceData.roll,
          isSpeaking: faceData.isSpeaking,
          blinkCount: faceData.blinkCount,
        } : null,
        bodyLanguage: {
          fidgeting: bodyLanguageData.fidgeting,
          stability: bodyLanguageData.overallStability,
        },
        scores,
      };
      
      setCollectedData(prev => [...prev, dataPoint]);
    }
  }, [
    videoElement, 
    poseLandmarker, 
    faceLandmarker, 
    analyzePose, 
    analyzeFace, 
    calculateScoresAndFeedback,
    collectData,
    interviewId,
  ]);

  /**
   * Start detection loop
   */
  useEffect(() => {
    if (isInitialized && videoElement) {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      detectionIntervalRef.current = setInterval(runDetection, DETECTION_INTERVAL);
    }

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [isInitialized, videoElement, runDetection]);

  /**
   * Reset all metrics
   */
  const resetMetrics = useCallback(() => {
    previousPoseLandmarksRef.current = null;
    movementHistoryRef.current = [];
    blinkCountRef.current = 0;
    isEyeClosedRef.current = false;
    blinkFrameCountRef.current = 0;
    speakingFramesRef.current = 0;
    frameCountRef.current = 0;
    
    setMetrics({
      pose: {
        posture: 'good',
        postureScore: 100,
        shoulderAlignment: 100,
        spineAlignment: 100,
        headPosition: 'centered',
        slouching: false,
        forwardHead: false,
        landmarks: null,
      },
      face: {
        eyeContactScore: 100,
        eyeContactStatus: 'good',
        leftEyeEAR: 0,
        rightEyeEAR: 0,
        isBlinking: false,
        blinkCount: 0,
        mouthMAR: 0,
        isSpeaking: false,
        yaw: 0,
        pitch: 0,
        roll: 0,
        faceOrientationStatus: 'direct',
        eyebrowPosition: 'neutral',
        landmarks: null,
      },
      bodyLanguage: {
        fidgeting: false,
        handMovement: 0,
        overallStability: 100,
      },
      scores: {
        posture: 100,
        attention: 100,
        bodyLanguage: 100,
        expression: 100,
        overall: 100,
      },
      feedback: {
        posture: '',
        eyeContact: '',
        composure: '',
        overall: '',
      },
      lastUpdated: null,
      frameCount: 0,
    });
    
    setCollectedData([]);
  }, []);

  /**
   * Export collected data for training
   */
  const exportCollectedData = useCallback(() => {
    return {
      interviewId,
      totalFrames: frameCountRef.current,
      collectedAt: new Date().toISOString(),
      duration: collectedData.length > 0 
        ? collectedData[collectedData.length - 1].timestamp - collectedData[0].timestamp 
        : 0,
      dataPoints: collectedData,
      summary: {
        averagePostureScore: collectedData.length > 0
          ? Math.round(collectedData.reduce((sum, d) => sum + d.scores.posture, 0) / collectedData.length)
          : 0,
        averageAttentionScore: collectedData.length > 0
          ? Math.round(collectedData.reduce((sum, d) => sum + d.scores.attention, 0) / collectedData.length)
          : 0,
        averageOverallScore: collectedData.length > 0
          ? Math.round(collectedData.reduce((sum, d) => sum + d.scores.overall, 0) / collectedData.length)
          : 0,
        totalBlinks: blinkCountRef.current,
        fidgetingPercentage: collectedData.length > 0
          ? Math.round((collectedData.filter(d => d.bodyLanguage.fidgeting).length / collectedData.length) * 100)
          : 0,
      },
    };
  }, [interviewId, collectedData]);

  /**
   * Get simplified pose metrics for backward compatibility
   */
  const poseMetrics = useMemo(() => ({
    posture: metrics.pose.posture,
    postureScore: metrics.pose.postureScore,
    headPosition: metrics.pose.headPosition,
    eyeContact: metrics.face.eyeContactStatus,
    confidence: metrics.scores.overall,
    slouching: metrics.pose.slouching,
    fidgeting: metrics.bodyLanguage.fidgeting,
    lastUpdated: metrics.lastUpdated,
  }), [metrics]);

  return {
    // State
    isInitialized,
    initializationStatus,
    error,
    metrics,
    poseMetrics, // Backward compatible
    collectedData,
    
    // Actions
    resetMetrics,
    exportCollectedData,
    
    // Status
    isPoseReady: initializationStatus.pose === 'ready',
    isFaceReady: initializationStatus.face === 'ready',
    isCollecting: collectData,
  };
};

export default useInterviewAnalytics;
