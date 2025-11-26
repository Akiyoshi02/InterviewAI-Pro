/**
 * MediaPipe Pose Detection Hook
 * Analyzes body language, posture, and confidence indicators during interviews
 * 
 * Metrics tracked:
 * - Posture (slouching detection)
 * - Head position (eye level, tilting)
 * - Eye contact approximation (face angle)
 * - Hand gestures (fidgeting detection)
 * - Overall confidence score
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const DETECTION_INTERVAL = 100; // Run detection every 100ms (10 FPS)

export const usePoseDetection = (videoElement, enabled = true) => {
  const [poseLandmarker, setPoseLandmarker] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  const [poseMetrics, setPoseMetrics] = useState({
    posture: 'good', // 'good', 'fair', 'poor'
    postureScore: 100,
    headPosition: 'centered', // 'centered', 'tilted', 'lowered'
    eyeContact: 'good', // 'good', 'fair', 'poor'
    confidence: 85,
    slouching: false,
    fidgeting: false,
    lastUpdated: null,
  });

  const detectionIntervalRef = useRef(null);
  const previousLandmarksRef = useRef(null);
  const movementHistoryRef = useRef([]);

  /**
   * Initialize MediaPipe Pose Landmarker
   */
  useEffect(() => {
    const initializePoseLandmarker = async () => {
      try {
        // Load MediaPipe Vision tasks
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        // Create Pose Landmarker
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
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

        setPoseLandmarker(landmarker);
        setIsInitialized(true);
        setError(null);
      } catch (err) {
        console.error('Failed to initialize MediaPipe Pose Landmarker:', err);
        setError('Failed to initialize pose detection. Using interview without pose analysis.');
        setIsInitialized(false);
      }
    };

    if (enabled) {
      initializePoseLandmarker();
    }

    return () => {
      if (poseLandmarker) {
        poseLandmarker.close();
      }
    };
  }, [enabled]);

  /**
   * Calculate posture score based on shoulder and spine alignment
   */
  const calculatePosture = useCallback((landmarks) => {
    // Key landmarks: shoulders (11, 12), hips (23, 24), nose (0)
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[23];
    const nose = landmarks[0];

    // Calculate shoulder slope (slouching indicator)
    const shoulderSlope = Math.abs(leftShoulder.y - rightShoulder.y);
    
    // Calculate spine alignment (head to hip distance)
    const shoulderMidpoint = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
    };
    
    const hipMidpoint = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2,
    };

    // Forward head posture (nose ahead of shoulders)
    const headForward = nose.z > shoulderMidpoint.z + 0.05;

    // Shoulder height difference (slouching)
    const slouching = shoulderSlope > 0.05;

    // Calculate posture score (0-100)
    let score = 100;
    if (slouching) score -= 20;
    if (headForward) score -= 15;
    if (Math.abs(leftShoulder.y - rightShoulder.y) > 0.1) score -= 15;

    return {
      score: Math.max(0, Math.min(100, score)),
      slouching,
      headForward,
      status: score >= 80 ? 'good' : score >= 60 ? 'fair' : 'poor',
    };
  }, []);

  /**
   * Calculate head position and eye contact approximation
   */
  const calculateHeadPosition = useCallback((landmarks) => {
    const nose = landmarks[0];
    const leftEye = landmarks[2];
    const rightEye = landmarks[5];
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];

    // Head tilt (eyes not level)
    const eyeSlope = Math.abs(leftEye.y - rightEye.y);
    const tilted = eyeSlope > 0.03;

    // Head lowered (nose below eye level significantly)
    const eyeMidpoint = (leftEye.y + rightEye.y) / 2;
    const lowered = nose.y > eyeMidpoint + 0.05;

    // Face angle (forward facing = good eye contact)
    const faceWidth = Math.abs(leftEar.x - rightEar.x);
    const lookingStraight = faceWidth > 0.15; // Approximation

    const headPosition = tilted ? 'tilted' : lowered ? 'lowered' : 'centered';
    const eyeContact = lookingStraight ? 'good' : faceWidth > 0.1 ? 'fair' : 'poor';

    return { headPosition, eyeContact, tilted, lowered, lookingStraight };
  }, []);

  /**
   * Detect fidgeting by tracking hand movement
   */
  const detectFidgeting = useCallback((landmarks) => {
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    if (!previousLandmarksRef.current) {
      previousLandmarksRef.current = landmarks;
      return false;
    }

    const prevLeftWrist = previousLandmarksRef.current[15];
    const prevRightWrist = previousLandmarksRef.current[16];

    // Calculate movement magnitude
    const leftMovement = Math.sqrt(
      Math.pow(leftWrist.x - prevLeftWrist.x, 2) +
      Math.pow(leftWrist.y - prevLeftWrist.y, 2)
    );

    const rightMovement = Math.sqrt(
      Math.pow(rightWrist.x - prevRightWrist.x, 2) +
      Math.pow(rightWrist.y - prevRightWrist.y, 2)
    );

    const totalMovement = leftMovement + rightMovement;

    // Track movement history (last 10 frames)
    movementHistoryRef.current.push(totalMovement);
    if (movementHistoryRef.current.length > 10) {
      movementHistoryRef.current.shift();
    }

    // Average movement over time
    const avgMovement = movementHistoryRef.current.reduce((a, b) => a + b, 0) / movementHistoryRef.current.length;

    // Fidgeting if consistent high movement
    const fidgeting = avgMovement > 0.05;

    previousLandmarksRef.current = landmarks;

    return fidgeting;
  }, []);

  /**
   * Calculate overall confidence score based on all metrics
   */
  const calculateConfidence = useCallback((posture, headPos, eyeContact, fidgeting) => {
    let confidence = 100;

    // Posture impact
    if (posture.status === 'poor') confidence -= 25;
    else if (posture.status === 'fair') confidence -= 10;

    // Head position impact
    if (headPos.tilted) confidence -= 10;
    if (headPos.lowered) confidence -= 15;

    // Eye contact impact
    if (eyeContact === 'poor') confidence -= 20;
    else if (eyeContact === 'fair') confidence -= 10;

    // Fidgeting impact
    if (fidgeting) confidence -= 15;

    return Math.max(0, Math.min(100, confidence));
  }, []);

  /**
   * Process video frame and detect pose
   */
  const detectPose = useCallback(async () => {
    if (!poseLandmarker || !videoElement || !enabled) return;

    try {
      const startTimeMs = performance.now();
      const results = poseLandmarker.detectForVideo(videoElement, startTimeMs);

      if (results && results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];

        // Calculate all metrics
        const posture = calculatePosture(landmarks);
        const headPos = calculateHeadPosition(landmarks);
        const fidgeting = detectFidgeting(landmarks);
        const confidence = calculateConfidence(posture, headPos, headPos.eyeContact, fidgeting);

        // Update metrics state
        setPoseMetrics({
          posture: posture.status,
          postureScore: posture.score,
          headPosition: headPos.headPosition,
          eyeContact: headPos.eyeContact,
          confidence,
          slouching: posture.slouching,
          fidgeting,
          lastUpdated: Date.now(),
        });
      }
    } catch (err) {
      console.error('Pose detection error:', err);
      // Don't update error state to avoid UI disruption
    }
  }, [poseLandmarker, videoElement, enabled, calculatePosture, calculateHeadPosition, detectFidgeting, calculateConfidence]);

  /**
   * Start continuous pose detection
   */
  useEffect(() => {
    if (isInitialized && videoElement && enabled) {
      // Clear any existing interval
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }

      // Start detection loop
      detectionIntervalRef.current = setInterval(detectPose, DETECTION_INTERVAL);
    }

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [isInitialized, videoElement, enabled, detectPose]);

  /**
   * Reset metrics
   */
  const resetMetrics = useCallback(() => {
    setPoseMetrics({
      posture: 'good',
      postureScore: 100,
      headPosition: 'centered',
      eyeContact: 'good',
      confidence: 85,
      slouching: false,
      fidgeting: false,
      lastUpdated: null,
    });
    previousLandmarksRef.current = null;
    movementHistoryRef.current = [];
  }, []);

  return {
    isInitialized,
    error,
    poseMetrics,
    resetMetrics,
    enabled: enabled && isInitialized,
  };
};

export default usePoseDetection;
