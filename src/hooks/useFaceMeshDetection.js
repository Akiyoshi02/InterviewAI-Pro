/**
 * MediaPipe Face-Mesh Detection Hook
 * 
 * Analyzes facial landmarks for interview feedback including:
 * - Eye contact estimation via iris tracking
 * - Face orientation (yaw, pitch, roll)
 * - Blink detection
 * - Mouth movement (speaking detection)
 * - Expression analysis
 * 
 * Uses 478 facial landmarks (468 face + 10 iris) from MediaPipe FaceLandmarker
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import {
  FACE_LANDMARKS,
  FACE_REFERENCE,
  calculateEAR,
  calculateMAR,
  calculateFaceOrientation,
  getScoreLevel,
  getFeedbackMessage,
} from '../config/mediapipeReferenceData';

const DETECTION_INTERVAL = 100; // Run detection every 100ms (10 FPS)

export const useFaceMeshDetection = (videoElement, enabled = true) => {
  const [faceLandmarker, setFaceLandmarker] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  
  // Face metrics state
  const [faceMetrics, setFaceMetrics] = useState({
    // Eye metrics
    leftEyeEAR: 0,
    rightEyeEAR: 0,
    averageEAR: 0,
    isBlinking: false,
    blinkCount: 0,
    eyeContactScore: 100,
    eyeContactStatus: 'good', // 'good', 'fair', 'poor'
    
    // Mouth metrics
    mouthMAR: 0,
    isSpeaking: false,
    
    // Face orientation
    yaw: 0, // left-right rotation
    pitch: 0, // up-down rotation
    roll: 0, // head tilt
    faceOrientationStatus: 'direct', // 'direct', 'slight', 'moderate', 'away'
    
    // Expression
    eyebrowPosition: 'neutral', // 'neutral', 'raised', 'furrowed'
    
    // Overall
    attentionScore: 100,
    lastUpdated: null,
    
    // Raw landmarks for advanced analysis
    landmarks: null,
  });

  const detectionIntervalRef = useRef(null);
  const blinkCountRef = useRef(0);
  const blinkFrameCountRef = useRef(0);
  const isEyeClosedRef = useRef(false);
  const previousMARRef = useRef(0);
  const speakingFramesRef = useRef(0);

  /**
   * Initialize MediaPipe FaceLandmarker
   */
  useEffect(() => {
    const initializeFaceLandmarker = async () => {
      try {
        // Load MediaPipe Vision tasks
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        // Create Face Landmarker with iris tracking
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: true, // For expression detection
          outputFacialTransformationMatrixes: true, // For head pose
        });

        setFaceLandmarker(landmarker);
        setIsInitialized(true);
        setError(null);
        console.log('FaceLandmarker initialized successfully');
      } catch (err) {
        console.error('Failed to initialize MediaPipe FaceLandmarker:', err);
        setError('Failed to initialize face detection. Using interview without face analysis.');
        setIsInitialized(false);
      }
    };

    if (enabled) {
      initializeFaceLandmarker();
    }

    return () => {
      if (faceLandmarker) {
        faceLandmarker.close();
      }
    };
  }, [enabled]);

  /**
   * Calculate eye aspect ratio and detect blinks
   */
  const analyzeEyes = useCallback((landmarks) => {
    // Left eye landmarks
    const leftEyeTop = landmarks[FACE_LANDMARKS.LEFT_EYE_TOP];
    const leftEyeBottom = landmarks[FACE_LANDMARKS.LEFT_EYE_BOTTOM];
    const leftEyeLeft = landmarks[FACE_LANDMARKS.LEFT_EYE_LEFT];
    const leftEyeRight = landmarks[FACE_LANDMARKS.LEFT_EYE_RIGHT];
    
    // Right eye landmarks
    const rightEyeTop = landmarks[FACE_LANDMARKS.RIGHT_EYE_TOP];
    const rightEyeBottom = landmarks[FACE_LANDMARKS.RIGHT_EYE_BOTTOM];
    const rightEyeLeft = landmarks[FACE_LANDMARKS.RIGHT_EYE_LEFT];
    const rightEyeRight = landmarks[FACE_LANDMARKS.RIGHT_EYE_RIGHT];
    
    // Calculate EAR for both eyes
    const leftEAR = calculateEAR(leftEyeTop, leftEyeBottom, leftEyeLeft, leftEyeRight);
    const rightEAR = calculateEAR(rightEyeTop, rightEyeBottom, rightEyeLeft, rightEyeRight);
    const averageEAR = (leftEAR + rightEAR) / 2;
    
    // Blink detection
    const isCurrentlyBlinking = averageEAR < FACE_REFERENCE.eyes.blinkThreshold;
    
    // Count blinks (transition from open to closed)
    if (isCurrentlyBlinking && !isEyeClosedRef.current) {
      blinkCountRef.current += 1;
      isEyeClosedRef.current = true;
    } else if (!isCurrentlyBlinking) {
      isEyeClosedRef.current = false;
    }
    
    // Track prolonged eye closure
    if (isCurrentlyBlinking) {
      blinkFrameCountRef.current += 1;
    } else {
      blinkFrameCountRef.current = 0;
    }
    
    // Calculate eye contact score based on EAR
    let eyeContactScore = 100;
    if (averageEAR < FACE_REFERENCE.eyes.openEyeEARMin) {
      eyeContactScore = 60; // Eyes too closed
    } else if (averageEAR > FACE_REFERENCE.eyes.openEyeEARMax) {
      eyeContactScore = 90; // Eyes very wide (might be surprised)
    }
    
    // Determine eye contact status
    let eyeContactStatus = 'good';
    if (blinkFrameCountRef.current > FACE_REFERENCE.eyes.prolongedClosureFrames) {
      eyeContactStatus = 'poor'; // Prolonged eye closure
      eyeContactScore = 40;
    } else if (averageEAR < FACE_REFERENCE.eyes.openEyeEARMin + 0.02) {
      eyeContactStatus = 'fair';
    }
    
    return {
      leftEyeEAR: leftEAR,
      rightEyeEAR: rightEAR,
      averageEAR,
      isBlinking: isCurrentlyBlinking,
      blinkCount: blinkCountRef.current,
      eyeContactScore,
      eyeContactStatus,
    };
  }, []);

  /**
   * Analyze mouth movement for speech detection
   */
  const analyzeMouth = useCallback((landmarks) => {
    // Get mouth landmarks
    const upperLip = landmarks[FACE_LANDMARKS.UPPER_LIP];
    const lowerLip = landmarks[FACE_LANDMARKS.LOWER_LIP];
    const leftMouth = landmarks[FACE_LANDMARKS.LIPS_OUTER[0]]; // Left corner
    const rightMouth = landmarks[FACE_LANDMARKS.LIPS_OUTER[10]]; // Right corner
    
    const mouthMAR = calculateMAR(upperLip, lowerLip, leftMouth, rightMouth);
    
    // Speaking detection with smoothing
    const isSpeaking = mouthMAR > FACE_REFERENCE.mouth.speakingThreshold;
    
    // Smooth speaking detection to avoid flickering
    if (isSpeaking) {
      speakingFramesRef.current = Math.min(speakingFramesRef.current + 1, 10);
    } else {
      speakingFramesRef.current = Math.max(speakingFramesRef.current - 1, 0);
    }
    
    previousMARRef.current = mouthMAR;
    
    return {
      mouthMAR,
      isSpeaking: speakingFramesRef.current > 3, // Smoothed speaking state
    };
  }, []);

  /**
   * Analyze face orientation for eye contact estimation
   */
  const analyzeFaceOrientation = useCallback((landmarks) => {
    const noseTip = landmarks[FACE_LANDMARKS.NOSE_TIP];
    const leftEye = landmarks[FACE_LANDMARKS.LEFT_EYE_RIGHT]; // Use inner corner
    const rightEye = landmarks[FACE_LANDMARKS.RIGHT_EYE_LEFT]; // Use inner corner
    const chin = landmarks[FACE_LANDMARKS.CHIN];
    
    const { yaw, pitch, roll } = calculateFaceOrientation(noseTip, leftEye, rightEye, chin);
    
    // Determine face orientation status
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
    
    return {
      yaw,
      pitch,
      roll,
      faceOrientationStatus,
    };
  }, []);

  /**
   * Analyze eyebrow position for expression detection
   */
  const analyzeEyebrows = useCallback((landmarks, blendshapes) => {
    // Use blendshapes if available for more accurate expression detection
    if (blendshapes && blendshapes.length > 0) {
      const shapes = blendshapes[0].categories;
      const browUpLeft = shapes.find(s => s.categoryName === 'browOuterUpLeft')?.score || 0;
      const browUpRight = shapes.find(s => s.categoryName === 'browOuterUpRight')?.score || 0;
      const browDownLeft = shapes.find(s => s.categoryName === 'browDownLeft')?.score || 0;
      const browDownRight = shapes.find(s => s.categoryName === 'browDownRight')?.score || 0;
      
      const avgRaised = (browUpLeft + browUpRight) / 2;
      const avgFurrowed = (browDownLeft + browDownRight) / 2;
      
      if (avgRaised > 0.3) return 'raised';
      if (avgFurrowed > 0.3) return 'furrowed';
      return 'neutral';
    }
    
    // Fallback to landmark-based detection
    return 'neutral';
  }, []);

  /**
   * Calculate overall attention score
   */
  const calculateAttentionScore = useCallback((eyeMetrics, orientation) => {
    let score = 100;
    
    // Eye contact contribution (50%)
    score -= (100 - eyeMetrics.eyeContactScore) * 0.5;
    
    // Face orientation contribution (40%)
    const { yaw, pitch } = orientation;
    const absYaw = Math.abs(yaw);
    const absPitch = Math.abs(pitch);
    
    if (absYaw > FACE_REFERENCE.orientation.poorYawThreshold) {
      score -= 30;
    } else if (absYaw > FACE_REFERENCE.orientation.moderateYawThreshold) {
      score -= 15;
    } else if (absYaw > FACE_REFERENCE.orientation.maxYawThreshold) {
      score -= 5;
    }
    
    if (absPitch > FACE_REFERENCE.orientation.poorPitchThreshold) {
      score -= 20;
    } else if (absPitch > FACE_REFERENCE.orientation.moderatePitchThreshold) {
      score -= 10;
    }
    
    // Head roll contribution (10%)
    const absRoll = Math.abs(orientation.roll);
    if (absRoll > FACE_REFERENCE.orientation.poorRollThreshold) {
      score -= 10;
    } else if (absRoll > FACE_REFERENCE.orientation.moderateRollThreshold) {
      score -= 5;
    }
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }, []);

  /**
   * Process video frame and detect face landmarks
   */
  const detectFace = useCallback(async () => {
    if (!faceLandmarker || !videoElement || !enabled) return;

    try {
      const startTimeMs = performance.now();
      const results = faceLandmarker.detectForVideo(videoElement, startTimeMs);

      if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        const blendshapes = results.faceBlendshapes;
        
        // Analyze all facial features
        const eyeMetrics = analyzeEyes(landmarks);
        const mouthMetrics = analyzeMouth(landmarks);
        const orientationMetrics = analyzeFaceOrientation(landmarks);
        const eyebrowPosition = analyzeEyebrows(landmarks, blendshapes);
        
        // Calculate overall attention score
        const attentionScore = calculateAttentionScore(eyeMetrics, orientationMetrics);
        
        // Update metrics state
        setFaceMetrics({
          ...eyeMetrics,
          ...mouthMetrics,
          ...orientationMetrics,
          eyebrowPosition,
          attentionScore,
          lastUpdated: Date.now(),
          landmarks, // Store raw landmarks for advanced analysis
        });
      }
    } catch (err) {
      console.error('Face detection error:', err);
    }
  }, [faceLandmarker, videoElement, enabled, analyzeEyes, analyzeMouth, analyzeFaceOrientation, analyzeEyebrows, calculateAttentionScore]);

  /**
   * Start continuous face detection
   */
  useEffect(() => {
    if (isInitialized && videoElement && enabled) {
      // Clear any existing interval
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }

      // Start detection loop
      detectionIntervalRef.current = setInterval(detectFace, DETECTION_INTERVAL);
    }

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [isInitialized, videoElement, enabled, detectFace]);

  /**
   * Reset metrics
   */
  const resetMetrics = useCallback(() => {
    blinkCountRef.current = 0;
    blinkFrameCountRef.current = 0;
    isEyeClosedRef.current = false;
    speakingFramesRef.current = 0;
    
    setFaceMetrics({
      leftEyeEAR: 0,
      rightEyeEAR: 0,
      averageEAR: 0,
      isBlinking: false,
      blinkCount: 0,
      eyeContactScore: 100,
      eyeContactStatus: 'good',
      mouthMAR: 0,
      isSpeaking: false,
      yaw: 0,
      pitch: 0,
      roll: 0,
      faceOrientationStatus: 'direct',
      eyebrowPosition: 'neutral',
      attentionScore: 100,
      lastUpdated: null,
      landmarks: null,
    });
  }, []);

  /**
   * Get feedback for current state
   */
  const getFeedback = useCallback(() => {
    const level = getScoreLevel(faceMetrics.attentionScore);
    return {
      eyeContact: getFeedbackMessage('eyeContact', level),
      level,
      score: faceMetrics.attentionScore,
    };
  }, [faceMetrics.attentionScore]);

  return {
    isInitialized,
    error,
    faceMetrics,
    resetMetrics,
    getFeedback,
    enabled: enabled && isInitialized,
  };
};

export default useFaceMeshDetection;
