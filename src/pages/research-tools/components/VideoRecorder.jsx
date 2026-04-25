/**
 * ============================================================================
 * COMPREHENSIVE VIDEO RECORDER WITH FULL BODY TRACKING
 * Research-Grade MediaPipe Implementation
 * ============================================================================
 * 
 * This component provides complete body language detection using:
 * 1. PoseLandmarker - 33 body landmarks (full skeleton)
 * 2. FaceLandmarker - 478 facial landmarks (face mesh + iris)
 * 3. HandLandmarker - 21 landmarks per hand (detailed finger tracking)
 * 
 * TOTAL: 553 landmarks tracked in real-time
 * 
 * Features:
 * - Real-time detection overlay with color-coded landmarks
 * - Complete metrics panel with all tracked values
 * - Finger-level analysis for each hand
 * - Comprehensive scoring system
 * - Recording with metadata for research
 * 
 * @version 3.0.0 - Complete Research Edition
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  PoseLandmarker, 
  FaceLandmarker, 
  HandLandmarker,
  FilesetResolver,
  DrawingUtils 
} from '@mediapipe/tasks-vision';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';

// Import all reference data and calculation functions
import {
  POSE_LANDMARKS,
  POSE_LANDMARK_NAMES,
  POSE_CONNECTIONS,
  HAND_LANDMARKS,
  HAND_LANDMARK_NAMES,
  HAND_CONNECTIONS,
  FACE_LANDMARKS,
  POSTURE_REFERENCE,
  FACE_REFERENCE,
  HAND_REFERENCE,
  MOVEMENT_REFERENCE,
  SCORING_WEIGHTS,
  FEEDBACK_THRESHOLDS,
  calculateEAR,
  calculateMAR,
  calculateFaceOrientation,
  calculateShoulderMetrics,
  calculateSpineAlignment,
  calculateArmAngle,
  analyzeHand,
  detectHandGesture,
  calculateStability,
  getScoreLevel,
  getScoreColor,
} from '../../../config/mediapipeReferenceData';

// ============================================================================
// COMPONENT CONFIGURATION
// ============================================================================

const CATEGORIES = [
  { id: 'posture', label: 'Posture', description: 'Upper body alignment, shoulder position' },
  { id: 'head_position', label: 'Head Position', description: 'Head level, tilt, centering' },
  { id: 'eye_contact', label: 'Eye Contact', description: 'Looking at camera, attention' },
  { id: 'hand_gestures', label: 'Hand Gestures', description: 'Hand position, finger movement' },
  { id: 'facial_expression', label: 'Facial Expression', description: 'Smile, eyebrows, engagement' },
  { id: 'body_movement', label: 'Body Movement', description: 'Stability, fidgeting' },
];

const QUALITY_TYPES = [
  { id: 'good', label: 'Good Example', color: 'green' },
  { id: 'bad', label: 'Bad Example', color: 'red' },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const VideoRecorder = () => {
  const toast = useToast();
  
  // === REFS ===
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const animationRef = useRef(null);
  
  // MediaPipe model refs
  const poseLandmarkerRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const handLandmarkerRef = useRef(null);
  
  // Tracking history refs
  const previousPoseRef = useRef(null);
  const previousLeftHandRef = useRef(null);
  const previousRightHandRef = useRef(null);
  const stabilityHistoryRef = useRef([]);
  const blinkCountRef = useRef(0);
  const blinkTimeRef = useRef(Date.now());
  const lastBlinkStateRef = useRef(false);
  
  // === STATE ===
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [category, setCategory] = useState('posture');
  const [quality, setQuality] = useState('good');
  const [description, setDescription] = useState('');
  const [recordings, setRecordings] = useState([]);
  
  // MediaPipe states
  const [isMediaPipeReady, setIsMediaPipeReady] = useState(false);
  const [isMediaPipeLoading, setIsMediaPipeLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  
  // Display toggles
  const [showOverlay, setShowOverlay] = useState(true);
  const [showPose, setShowPose] = useState(true);
  const [showFace, setShowFace] = useState(true);
  const [showHands, setShowHands] = useState(true);
  const [showMetrics, setShowMetrics] = useState(true);
  const [activeMetricTab, setActiveMetricTab] = useState('overview');
  
  // === SESSION RECORDING FOR RESEARCH ===
  const [sessionData, setSessionData] = useState([]);
  const [isSessionRecording, setIsSessionRecording] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const sessionIntervalRef = useRef(null);

  // === COMPREHENSIVE METRICS STATE ===
  const [metrics, setMetrics] = useState({
    // System
    fps: 0,
    timestamp: 0,
    
    // Detection status
    detection: {
      poseDetected: false,
      faceDetected: false,
      leftHandDetected: false,
      rightHandDetected: false,
      landmarksCount: {
        pose: 0,
        face: 0,
        leftHand: 0,
        rightHand: 0,
        total: 0,
      },
    },
    
    // === POSTURE (from PoseLandmarker) ===
    posture: {
      // Shoulders
      shoulders: {
        slope: 0,
        width: 0,
        angle: 0,
        isLevel: true,
        status: 'N/A',
        score: 0,
      },
      // Spine
      spine: {
        forwardLean: 0,
        lateralLean: 0,
        isUpright: true,
        status: 'N/A',
        score: 0,
      },
      // Head (from pose)
      head: {
        tilt: 0,
        forwardPosition: 0,
        status: 'N/A',
      },
      // Arms
      arms: {
        leftAngle: 0,
        rightAngle: 0,
        leftStatus: 'N/A',
        rightStatus: 'N/A',
      },
      // Body alignment
      body: {
        symmetry: 0,
        centering: 0,
      },
      // Overall
      overallScore: 0,
    },
    
    // === FACE (from FaceLandmarker) ===
    face: {
      // Eyes
      eyes: {
        leftEAR: 0,
        rightEAR: 0,
        avgEAR: 0,
        asymmetry: 0,
        isBlinking: false,
        blinkRate: 0,
        status: 'N/A',
        score: 0,
      },
      // Gaze
      gaze: {
        isLookingAtCamera: false,
        direction: 'center',
        deviation: 0,
        status: 'N/A',
        score: 0,
      },
      // Orientation
      orientation: {
        yaw: 0,
        pitch: 0,
        roll: 0,
        combined: 0,
        status: 'N/A',
        score: 0,
      },
      // Mouth
      mouth: {
        mar: 0,
        isSpeaking: false,
        openness: 'closed',
        status: 'N/A',
      },
      // Expression
      expression: {
        isSmiling: false,
        smileIntensity: 0,
        eyebrowPosition: 'neutral',
        status: 'N/A',
      },
      // Overall
      overallScore: 0,
    },
    
    // === LEFT HAND (from HandLandmarker) ===
    leftHand: {
      detected: false,
      openness: 0,
      gesture: 'Not Detected',
      wristPosition: { x: 0, y: 0, z: 0 },
      movement: 0,
      fingers: {
        thumb: { curl: 0, extended: false },
        index: { curl: 0, extended: false },
        middle: { curl: 0, extended: false },
        ring: { curl: 0, extended: false },
        pinky: { curl: 0, extended: false },
      },
      spread: 0,
      score: 0,
    },
    
    // === RIGHT HAND (from HandLandmarker) ===
    rightHand: {
      detected: false,
      openness: 0,
      gesture: 'Not Detected',
      wristPosition: { x: 0, y: 0, z: 0 },
      movement: 0,
      fingers: {
        thumb: { curl: 0, extended: false },
        index: { curl: 0, extended: false },
        middle: { curl: 0, extended: false },
        ring: { curl: 0, extended: false },
        pinky: { curl: 0, extended: false },
      },
      spread: 0,
      score: 0,
    },
    
    // === MOVEMENT/STABILITY ===
    movement: {
      bodyStability: 0,
      bodyMovement: 0,
      avgMovement: 0,
      isStable: true,
      isFidgeting: false,
      status: 'N/A',
      score: 0,
    },
    
    // === COMPOSITE SCORES ===
    scores: {
      posture: 0,
      eyeContact: 0,
      expression: 0,
      hands: 0,
      stability: 0,
      overall: 0,
      level: 'fair',
    },
  });

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  // Load saved recordings
  useEffect(() => {
    const saved = localStorage.getItem('research_video_recordings');
    if (saved) {
      try {
        setRecordings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load recordings:', e);
      }
    }
  }, []);

  // Recording timer
  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Initialize MediaPipe models
  const initializeMediaPipe = useCallback(async () => {
    if (isMediaPipeReady || isMediaPipeLoading) return;
    
    setIsMediaPipeLoading(true);
    try {
      setLoadingStatus('Loading MediaPipe Vision...');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      // Initialize PoseLandmarker (33 landmarks)
      setLoadingStatus('Loading Pose Model (33 landmarks)...');
      const poseDetector = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
      poseLandmarkerRef.current = poseDetector;

      // Initialize FaceLandmarker (478 landmarks)
      setLoadingStatus('Loading Face Model (478 landmarks)...');
      const faceDetector = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
      faceLandmarkerRef.current = faceDetector;

      // Initialize HandLandmarker (21 landmarks per hand)
      setLoadingStatus('Loading Hand Model (21 landmarks × 2)...');
      const handDetector = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
      });
      handLandmarkerRef.current = handDetector;

      setIsMediaPipeReady(true);
      setLoadingStatus('');
      toast.success('MediaPipe initialized - All 3 models loaded (553 total landmarks)');
    } catch (error) {
      console.error('MediaPipe init error:', error);
      toast.error('Failed to initialize MediaPipe: ' + error.message);
      setLoadingStatus('Error: ' + error.message);
    } finally {
      setIsMediaPipeLoading(false);
    }
  }, [isMediaPipeReady, isMediaPipeLoading, toast]);

  // ============================================================================
  // DETECTION LOOP
  // ============================================================================

  const runDetection = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isStreaming) return;
    if (!poseLandmarkerRef.current || !faceLandmarkerRef.current || !handLandmarkerRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    let lastTime = performance.now();
    let frameCount = 0;

    const detect = () => {
      if (!isStreaming) return;
      
      const now = performance.now();
      frameCount++;
      
      // Calculate FPS
      if (now - lastTime >= 1000) {
        setMetrics(prev => ({ ...prev, fps: frameCount, timestamp: now }));
        frameCount = 0;
        lastTime = now;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const timestamp = performance.now();
      let poseResults = null;
      let faceResults = null;
      let handResults = null;

      // Run pose detection
      try {
        poseResults = poseLandmarkerRef.current.detectForVideo(video, timestamp);
      } catch (e) { /* ignore */ }

      // Run face detection
      try {
        faceResults = faceLandmarkerRef.current.detectForVideo(video, timestamp);
      } catch (e) { /* ignore */ }

      // Run hand detection
      try {
        handResults = handLandmarkerRef.current.detectForVideo(video, timestamp);
      } catch (e) { /* ignore */ }

      // Draw overlays
      if (showOverlay) {
        drawOverlay(ctx, canvas, poseResults, faceResults, handResults);
      }

      // Update metrics
      updateMetrics(poseResults, faceResults, handResults);

      animationRef.current = requestAnimationFrame(detect);
    };

    detect();
  }, [isStreaming, showOverlay, showPose, showFace, showHands]);

  // Start detection when ready
  useEffect(() => {
    if (isStreaming && isMediaPipeReady) {
      runDetection();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isStreaming, isMediaPipeReady, runDetection]);

  // ============================================================================
  // DRAWING FUNCTIONS
  // ============================================================================

  const drawOverlay = (ctx, canvas, poseResults, faceResults, handResults) => {
    // Draw Pose (Green)
    if (showPose && poseResults?.landmarks?.[0]) {
      const landmarks = poseResults.landmarks[0];
      
      // Draw connections
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 3;
      POSE_CONNECTIONS.forEach(([start, end]) => {
        if (landmarks[start] && landmarks[end]) {
          ctx.beginPath();
          ctx.moveTo(landmarks[start].x * canvas.width, landmarks[start].y * canvas.height);
          ctx.lineTo(landmarks[end].x * canvas.width, landmarks[end].y * canvas.height);
          ctx.stroke();
        }
      });

      // Draw landmarks
      landmarks.forEach((landmark, idx) => {
        if (landmark.visibility > 0.5) {
          ctx.beginPath();
          ctx.arc(
            landmark.x * canvas.width,
            landmark.y * canvas.height,
            idx === 0 ? 8 : 5,
            0, 2 * Math.PI
          );
          ctx.fillStyle = idx === 0 ? '#FF0000' : '#00FF00';
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    }

    // Draw Face Mesh (Cyan)
    if (showFace && faceResults?.faceLandmarks?.[0]) {
      const landmarks = faceResults.faceLandmarks[0];
      
      // Draw eyes
      ctx.strokeStyle = '#00FFFF';
      ctx.lineWidth = 2;
      
      // Left eye
      ctx.beginPath();
      FACE_LANDMARKS.LEFT_EYE.forEach((idx, i) => {
        if (landmarks[idx]) {
          const x = landmarks[idx].x * canvas.width;
          const y = landmarks[idx].y * canvas.height;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
      });
      ctx.closePath();
      ctx.stroke();
      
      // Right eye
      ctx.beginPath();
      FACE_LANDMARKS.RIGHT_EYE.forEach((idx, i) => {
        if (landmarks[idx]) {
          const x = landmarks[idx].x * canvas.width;
          const y = landmarks[idx].y * canvas.height;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
      });
      ctx.closePath();
      ctx.stroke();

      // Draw lips (Pink)
      ctx.strokeStyle = '#FF69B4';
      ctx.beginPath();
      FACE_LANDMARKS.LIPS_OUTER.forEach((idx, i) => {
        if (landmarks[idx]) {
          const x = landmarks[idx].x * canvas.width;
          const y = landmarks[idx].y * canvas.height;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
      });
      ctx.closePath();
      ctx.stroke();

      // Draw iris centers (Yellow)
      [FACE_LANDMARKS.LEFT_IRIS_CENTER, FACE_LANDMARKS.RIGHT_IRIS_CENTER].forEach(idx => {
        if (landmarks[idx]) {
          ctx.beginPath();
          ctx.arc(
            landmarks[idx].x * canvas.width,
            landmarks[idx].y * canvas.height,
            4, 0, 2 * Math.PI
          );
          ctx.fillStyle = '#FFFF00';
          ctx.fill();
        }
      });

      // Draw face mesh points (sparse)
      ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
      for (let i = 0; i < landmarks.length; i += 15) {
        if (landmarks[i]) {
          ctx.beginPath();
          ctx.arc(
            landmarks[i].x * canvas.width,
            landmarks[i].y * canvas.height,
            1, 0, 2 * Math.PI
          );
          ctx.fill();
        }
      }
    }

    // Draw Hands (Orange for left, Blue for right)
    if (showHands && handResults?.landmarks) {
      handResults.landmarks.forEach((handLandmarks, handIdx) => {
        const isLeft = handResults.handednesses?.[handIdx]?.[0]?.categoryName === 'Left';
        const color = isLeft ? '#FFA500' : '#4169E1';
        
        // Draw connections
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        HAND_CONNECTIONS.forEach(([start, end]) => {
          if (handLandmarks[start] && handLandmarks[end]) {
            ctx.beginPath();
            ctx.moveTo(handLandmarks[start].x * canvas.width, handLandmarks[start].y * canvas.height);
            ctx.lineTo(handLandmarks[end].x * canvas.width, handLandmarks[end].y * canvas.height);
            ctx.stroke();
          }
        });

        // Draw landmarks
        handLandmarks.forEach((landmark, idx) => {
          ctx.beginPath();
          ctx.arc(
            landmark.x * canvas.width,
            landmark.y * canvas.height,
            idx === 0 ? 6 : (idx % 4 === 0 ? 5 : 3),
            0, 2 * Math.PI
          );
          ctx.fillStyle = idx === 0 ? '#FFFFFF' : color;
          ctx.fill();
          if (idx % 4 === 0) {
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      });
    }
  };

  // ============================================================================
  // METRICS CALCULATION
  // ============================================================================

  const updateMetrics = (poseResults, faceResults, handResults) => {
    const newMetrics = { ...metrics };
    
    // === DETECTION STATUS ===
    const poseDetected = poseResults?.landmarks?.[0]?.length > 0;
    const faceDetected = faceResults?.faceLandmarks?.[0]?.length > 0;
    
    let leftHandLandmarks = null;
    let rightHandLandmarks = null;
    
    if (handResults?.landmarks) {
      handResults.landmarks.forEach((landmarks, idx) => {
        const isLeft = handResults.handednesses?.[idx]?.[0]?.categoryName === 'Left';
        if (isLeft) leftHandLandmarks = landmarks;
        else rightHandLandmarks = landmarks;
      });
    }
    
    newMetrics.detection = {
      poseDetected,
      faceDetected,
      leftHandDetected: !!leftHandLandmarks,
      rightHandDetected: !!rightHandLandmarks,
      landmarksCount: {
        pose: poseDetected ? 33 : 0,
        face: faceDetected ? 478 : 0,
        leftHand: leftHandLandmarks ? 21 : 0,
        rightHand: rightHandLandmarks ? 21 : 0,
        total: (poseDetected ? 33 : 0) + (faceDetected ? 478 : 0) + 
               (leftHandLandmarks ? 21 : 0) + (rightHandLandmarks ? 21 : 0),
      },
    };

    // === POSTURE METRICS ===
    if (poseDetected) {
      const pl = poseResults.landmarks[0];
      
      // Shoulders
      const shoulderMetrics = calculateShoulderMetrics(
        pl[POSE_LANDMARKS.LEFT_SHOULDER],
        pl[POSE_LANDMARKS.RIGHT_SHOULDER]
      );
      newMetrics.posture.shoulders = shoulderMetrics;
      
      // Spine
      const spineMetrics = calculateSpineAlignment(
        pl[POSE_LANDMARKS.NOSE],
        pl[POSE_LANDMARKS.LEFT_SHOULDER],
        pl[POSE_LANDMARKS.RIGHT_SHOULDER],
        pl[POSE_LANDMARKS.LEFT_HIP],
        pl[POSE_LANDMARKS.RIGHT_HIP]
      );
      newMetrics.posture.spine = spineMetrics;
      
      // Head
      const shoulderMidX = (pl[POSE_LANDMARKS.LEFT_SHOULDER].x + pl[POSE_LANDMARKS.RIGHT_SHOULDER].x) / 2;
      const shoulderMidZ = ((pl[POSE_LANDMARKS.LEFT_SHOULDER].z || 0) + (pl[POSE_LANDMARKS.RIGHT_SHOULDER].z || 0)) / 2;
      newMetrics.posture.head = {
        tilt: Math.abs(pl[POSE_LANDMARKS.NOSE].x - shoulderMidX),
        forwardPosition: (pl[POSE_LANDMARKS.NOSE].z || 0) - shoulderMidZ,
        status: Math.abs((pl[POSE_LANDMARKS.NOSE].z || 0) - shoulderMidZ) < 0.06 ? 'Good' : 'Forward',
      };
      
      // Arms
      newMetrics.posture.arms = {
        leftAngle: calculateArmAngle(
          pl[POSE_LANDMARKS.LEFT_SHOULDER],
          pl[POSE_LANDMARKS.LEFT_ELBOW],
          pl[POSE_LANDMARKS.LEFT_WRIST]
        ),
        rightAngle: calculateArmAngle(
          pl[POSE_LANDMARKS.RIGHT_SHOULDER],
          pl[POSE_LANDMARKS.RIGHT_ELBOW],
          pl[POSE_LANDMARKS.RIGHT_WRIST]
        ),
        leftStatus: 'Detected',
        rightStatus: 'Detected',
      };
      
      // Body alignment
      newMetrics.posture.body = {
        symmetry: 1 - Math.abs(pl[POSE_LANDMARKS.LEFT_SHOULDER].y - pl[POSE_LANDMARKS.RIGHT_SHOULDER].y) * 10,
        centering: Math.abs(shoulderMidX - 0.5),
      };
      
      // Overall posture score
      newMetrics.posture.overallScore = Math.round(
        shoulderMetrics.score * 0.4 + spineMetrics.score * 0.4 +
        (newMetrics.posture.head.status === 'Good' ? 100 : 60) * 0.2
      );
      
      // Movement/Stability
      const currentPose = {
        nose: pl[POSE_LANDMARKS.NOSE],
        leftShoulder: pl[POSE_LANDMARKS.LEFT_SHOULDER],
        rightShoulder: pl[POSE_LANDMARKS.RIGHT_SHOULDER],
      };
      const stabilityMetrics = calculateStability(currentPose, previousPoseRef.current, stabilityHistoryRef.current);
      previousPoseRef.current = currentPose;
      stabilityHistoryRef.current = stabilityMetrics.history;
      
      newMetrics.movement = {
        bodyStability: stabilityMetrics.stability,
        bodyMovement: stabilityMetrics.movement,
        avgMovement: stabilityMetrics.averageMovement,
        isStable: stabilityMetrics.isStable,
        isFidgeting: stabilityMetrics.averageMovement > MOVEMENT_REFERENCE.stability.magnitude.active,
        status: stabilityMetrics.isStable ? 'Stable' : 'Moving',
        score: stabilityMetrics.score,
      };
    }

    // === FACE METRICS ===
    if (faceDetected) {
      const fl = faceResults.faceLandmarks[0];
      
      // Eyes (EAR)
      const leftEAR = calculateEAR(
        fl[FACE_LANDMARKS.LEFT_EYE_TOP],
        fl[FACE_LANDMARKS.LEFT_EYE_BOTTOM],
        fl[FACE_LANDMARKS.LEFT_EYE_OUTER],
        fl[FACE_LANDMARKS.LEFT_EYE_INNER]
      );
      const rightEAR = calculateEAR(
        fl[FACE_LANDMARKS.RIGHT_EYE_TOP],
        fl[FACE_LANDMARKS.RIGHT_EYE_BOTTOM],
        fl[FACE_LANDMARKS.RIGHT_EYE_OUTER],
        fl[FACE_LANDMARKS.RIGHT_EYE_INNER]
      );
      const avgEAR = (leftEAR + rightEAR) / 2;
      const isBlinking = avgEAR < FACE_REFERENCE.eyes.blink.threshold;
      
      // Blink rate calculation
      if (isBlinking && !lastBlinkStateRef.current) {
        blinkCountRef.current++;
      }
      lastBlinkStateRef.current = isBlinking;
      
      const elapsed = (Date.now() - blinkTimeRef.current) / 1000;
      let blinkRate = newMetrics.face.eyes.blinkRate;
      if (elapsed >= 10) {
        blinkRate = Math.round((blinkCountRef.current / elapsed) * 60);
        blinkCountRef.current = 0;
        blinkTimeRef.current = Date.now();
      }
      
      let eyeStatus = 'Open';
      let eyeScore = 100;
      if (isBlinking) { eyeStatus = 'Blinking'; eyeScore = 50; }
      else if (avgEAR < FACE_REFERENCE.eyes.aspectRatio.narrowed) { eyeStatus = 'Narrowed'; eyeScore = 70; }
      else if (avgEAR > FACE_REFERENCE.eyes.aspectRatio.wideOpen) { eyeStatus = 'Wide Open'; eyeScore = 90; }
      
      newMetrics.face.eyes = {
        leftEAR,
        rightEAR,
        avgEAR,
        asymmetry: Math.abs(leftEAR - rightEAR),
        isBlinking,
        blinkRate,
        status: eyeStatus,
        score: eyeScore,
      };
      
      // Face Orientation
      const orientation = calculateFaceOrientation(
        fl[FACE_LANDMARKS.NOSE_TIP],
        fl[FACE_LANDMARKS.LEFT_EYE_OUTER],
        fl[FACE_LANDMARKS.RIGHT_EYE_OUTER],
        fl[FACE_LANDMARKS.CHIN],
        fl[FACE_LANDMARKS.FOREHEAD_CENTER]
      );
      
      const absYaw = Math.abs(orientation.yaw);
      const absPitch = Math.abs(orientation.pitch);
      const absRoll = Math.abs(orientation.roll);
      const combined = absYaw + absPitch + absRoll;
      
      let orientStatus = 'Facing Camera';
      let orientScore = 100;
      if (absYaw > 40 || absPitch > 30) { orientStatus = 'Turned Away'; orientScore = 30; }
      else if (absYaw > 25 || absPitch > 20) { orientStatus = 'Looking Away'; orientScore = 50; }
      else if (absYaw > 15) { orientStatus = 'Slight Turn'; orientScore = 75; }
      
      newMetrics.face.orientation = {
        yaw: orientation.yaw,
        pitch: orientation.pitch,
        roll: orientation.roll,
        combined,
        status: orientStatus,
        score: orientScore,
      };
      
      // Gaze
      const gazeScore = Math.max(20, orientScore - (combined * 0.5));
      newMetrics.face.gaze = {
        isLookingAtCamera: absYaw < 15 && absPitch < 12,
        direction: absYaw < 10 ? 'center' : (orientation.yaw > 0 ? 'left' : 'right'),
        deviation: combined / 90,
        status: absYaw < 15 ? 'Direct' : 'Averted',
        score: Math.round(gazeScore),
      };
      
      // Mouth
      const mar = calculateMAR(
        fl[FACE_LANDMARKS.UPPER_LIP_BOTTOM],
        fl[FACE_LANDMARKS.LOWER_LIP_TOP],
        fl[FACE_LANDMARKS.MOUTH_LEFT],
        fl[FACE_LANDMARKS.MOUTH_RIGHT]
      );
      const isSpeaking = mar > FACE_REFERENCE.mouth.speaking.threshold;
      
      newMetrics.face.mouth = {
        mar,
        isSpeaking,
        openness: mar < 0.08 ? 'closed' : (mar < 0.15 ? 'slightly open' : (mar < 0.3 ? 'speaking' : 'wide open')),
        status: isSpeaking ? 'Speaking' : 'Silent',
      };
      
      // Expression (simplified)
      const leftLipCorner = fl[FACE_LANDMARKS.LEFT_LIP_CORNER];
      const rightLipCorner = fl[FACE_LANDMARKS.RIGHT_LIP_CORNER];
      const noseTip = fl[FACE_LANDMARKS.NOSE_TIP];
      
      const avgLipCornerY = (leftLipCorner.y + rightLipCorner.y) / 2;
      const smileIndicator = noseTip.y - avgLipCornerY;
      const isSmiling = smileIndicator > 0.02;
      
      newMetrics.face.expression = {
        isSmiling,
        smileIntensity: Math.max(0, Math.min(1, smileIndicator * 20)),
        eyebrowPosition: 'neutral',
        status: isSmiling ? 'Smiling' : 'Neutral',
      };
      
      // Overall face score
      newMetrics.face.overallScore = Math.round(
        eyeScore * 0.3 + orientScore * 0.4 + gazeScore * 0.3
      );
    }

    // === HAND METRICS ===
    // Left Hand
    if (leftHandLandmarks) {
      const analysis = analyzeHand(leftHandLandmarks);
      const gesture = detectHandGesture(analysis);
      
      newMetrics.leftHand = {
        detected: true,
        openness: analysis.openness,
        gesture,
        wristPosition: analysis.wristPosition || { x: 0, y: 0, z: 0 },
        movement: previousLeftHandRef.current ? 
          Math.sqrt(
            Math.pow((analysis.wristPosition?.x || 0) - (previousLeftHandRef.current.x || 0), 2) +
            Math.pow((analysis.wristPosition?.y || 0) - (previousLeftHandRef.current.y || 0), 2)
          ) : 0,
        fingers: analysis.fingers,
        spread: analysis.spread,
        score: Math.round(analysis.openness * 50 + 50),
      };
      previousLeftHandRef.current = analysis.wristPosition;
    } else {
      newMetrics.leftHand = { ...newMetrics.leftHand, detected: false, gesture: 'Not Detected' };
    }
    
    // Right Hand
    if (rightHandLandmarks) {
      const analysis = analyzeHand(rightHandLandmarks);
      const gesture = detectHandGesture(analysis);
      
      newMetrics.rightHand = {
        detected: true,
        openness: analysis.openness,
        gesture,
        wristPosition: analysis.wristPosition || { x: 0, y: 0, z: 0 },
        movement: previousRightHandRef.current ?
          Math.sqrt(
            Math.pow((analysis.wristPosition?.x || 0) - (previousRightHandRef.current.x || 0), 2) +
            Math.pow((analysis.wristPosition?.y || 0) - (previousRightHandRef.current.y || 0), 2)
          ) : 0,
        fingers: analysis.fingers,
        spread: analysis.spread,
        score: Math.round(analysis.openness * 50 + 50),
      };
      previousRightHandRef.current = analysis.wristPosition;
    } else {
      newMetrics.rightHand = { ...newMetrics.rightHand, detected: false, gesture: 'Not Detected' };
    }

    // =========================================================================
    // COMPOSITE SCORES - Research-Grade Calculations
    // =========================================================================
    
    /**
     * POSTURE SCORE (0-100)
     * Components:
     * - Shoulder alignment (40%): How level the shoulders are
     * - Spine alignment (40%): Forward/lateral lean
     * - Head position (20%): Tilt and forward position
     */
    let postureScore = 50; // Default when not detected
    if (poseDetected) {
      const shoulderScore = newMetrics.posture.shoulders.score || 50;
      const spineScore = newMetrics.posture.spine.score || 50;
      
      // Head score based on tilt and forward position
      const headTilt = newMetrics.posture.head.tilt;
      const headForward = Math.abs(newMetrics.posture.head.forwardPosition);
      let headScore = 100;
      // Penalize for head tilt (lateral offset from center)
      if (headTilt > 0.08) headScore -= 40;
      else if (headTilt > 0.05) headScore -= 25;
      else if (headTilt > 0.03) headScore -= 10;
      // Penalize for forward head position
      if (headForward > 0.10) headScore -= 30;
      else if (headForward > 0.06) headScore -= 15;
      else if (headForward > 0.03) headScore -= 5;
      headScore = Math.max(0, headScore);
      
      postureScore = Math.round(
        shoulderScore * 0.40 +
        spineScore * 0.40 +
        headScore * 0.20
      );
    }
    newMetrics.posture.overallScore = postureScore;
    
    /**
     * EYE CONTACT SCORE (0-100)
     * Components:
     * - Face orientation (50%): Yaw, pitch, roll - how directly facing camera
     * - Gaze direction (30%): Where eyes are looking
     * - Eye openness (20%): EAR value indicating alertness
     */
    let eyeContactScore = 50; // Default when not detected
    if (faceDetected) {
      const yaw = newMetrics.face.orientation.yaw;
      const pitch = newMetrics.face.orientation.pitch;
      const roll = newMetrics.face.orientation.roll;
      
      // Orientation score - penalize for turning away
      // Perfect = facing camera (yaw, pitch, roll all ~0)
      let orientationScore = 100;
      const absYaw = Math.abs(yaw);
      const absPitch = Math.abs(pitch);
      const absRoll = Math.abs(roll);
      
      // Yaw penalty (most important for eye contact)
      if (absYaw > 45) orientationScore -= 60;
      else if (absYaw > 30) orientationScore -= 45;
      else if (absYaw > 20) orientationScore -= 30;
      else if (absYaw > 10) orientationScore -= 15;
      else if (absYaw > 5) orientationScore -= 5;
      
      // Pitch penalty
      if (absPitch > 30) orientationScore -= 25;
      else if (absPitch > 20) orientationScore -= 15;
      else if (absPitch > 10) orientationScore -= 8;
      
      // Roll penalty (head tilt)
      if (absRoll > 20) orientationScore -= 15;
      else if (absRoll > 10) orientationScore -= 8;
      
      orientationScore = Math.max(0, orientationScore);
      
      // Gaze score - based on whether looking at camera
      let gazeScore = newMetrics.face.gaze.isLookingAtCamera ? 100 : 50;
      // Adjust based on deviation
      const deviation = newMetrics.face.gaze.deviation;
      if (deviation > 0.5) gazeScore -= 30;
      else if (deviation > 0.3) gazeScore -= 15;
      gazeScore = Math.max(0, gazeScore);
      
      // Eye openness score
      const avgEAR = newMetrics.face.eyes.avgEAR;
      let eyeOpennessScore = 100;
      if (newMetrics.face.eyes.isBlinking) {
        eyeOpennessScore = 70; // Blinking is normal, slight penalty
      } else if (avgEAR < 0.15) {
        eyeOpennessScore = 40; // Eyes nearly closed
      } else if (avgEAR < 0.18) {
        eyeOpennessScore = 60; // Drowsy/narrowed
      } else if (avgEAR < 0.22) {
        eyeOpennessScore = 80; // Slightly narrowed
      } else if (avgEAR > 0.35) {
        eyeOpennessScore = 90; // Wide open (alert)
      }
      
      eyeContactScore = Math.round(
        orientationScore * 0.50 +
        gazeScore * 0.30 +
        eyeOpennessScore * 0.20
      );
      
      // Update the stored orientation score
      newMetrics.face.orientation.score = orientationScore;
      newMetrics.face.gaze.score = gazeScore;
      newMetrics.face.eyes.score = eyeOpennessScore;
    }
    newMetrics.face.overallScore = eyeContactScore;
    
    /**
     * EXPRESSION SCORE (0-100)
     * Components:
     * - Facial naturalness (40%): Not tense, relaxed expression
     * - Smile/positive expression (30%): Appropriate smiling
     * - Mouth state (30%): Appropriate for speaking/listening
     */
    let expressionScore = 70; // Default neutral
    if (faceDetected) {
      // Naturalness score - based on not having extreme values
      let naturalnessScore = 100;
      const mar = newMetrics.face.mouth.mar;
      // Penalize for unusual mouth states
      if (mar > 0.4) naturalnessScore -= 30; // Mouth too wide (yawning?)
      else if (mar > 0.3 && !newMetrics.face.mouth.isSpeaking) naturalnessScore -= 15;
      naturalnessScore = Math.max(50, naturalnessScore);
      
      // Smile score
      let smileScore = 70; // Neutral is acceptable
      if (newMetrics.face.expression.isSmiling) {
        const intensity = newMetrics.face.expression.smileIntensity;
        if (intensity > 0.7) smileScore = 100; // Good smile
        else if (intensity > 0.4) smileScore = 90;
        else if (intensity > 0.2) smileScore = 85;
        else smileScore = 80;
      }
      
      // Mouth state score
      let mouthScore = 80; // Default acceptable
      if (newMetrics.face.mouth.isSpeaking) {
        mouthScore = 90; // Speaking is good (engaged)
      } else if (newMetrics.face.mouth.openness === 'closed') {
        mouthScore = 85; // Closed mouth when listening is good
      } else if (newMetrics.face.mouth.openness === 'slightly open') {
        mouthScore = 75; // Slightly open is okay
      } else if (newMetrics.face.mouth.openness === 'wide open') {
        mouthScore = 50; // Wide open without speaking is unusual
      }
      
      expressionScore = Math.round(
        naturalnessScore * 0.40 +
        smileScore * 0.30 +
        mouthScore * 0.30
      );
    }
    
    /**
     * HANDS SCORE (0-100)
     * Components:
     * - Visibility (40%): Hands visible in frame (trust indicator)
     * - Steadiness (35%): Low movement (not fidgeting)
     * - Openness/relaxation (25%): Open hands = confidence
     */
    let handsScore = 70; // Default when hands not visible
    const leftDetected = newMetrics.leftHand.detected;
    const rightDetected = newMetrics.rightHand.detected;
    const handsDetectedCount = (leftDetected ? 1 : 0) + (rightDetected ? 1 : 0);
    
    // Visibility score
    let visibilityScore = 50; // No hands visible
    if (handsDetectedCount === 2) visibilityScore = 100;
    else if (handsDetectedCount === 1) visibilityScore = 75;
    
    // Steadiness score (lower movement = better)
    let steadinessScore = 100;
    if (leftDetected || rightDetected) {
      const leftMovement = leftDetected ? newMetrics.leftHand.movement : 0;
      const rightMovement = rightDetected ? newMetrics.rightHand.movement : 0;
      const avgMovement = handsDetectedCount > 0 ? 
        (leftMovement + rightMovement) / handsDetectedCount : 0;
      
      if (avgMovement > 0.08) steadinessScore = 30; // Excessive movement
      else if (avgMovement > 0.05) steadinessScore = 50; // Fidgeting
      else if (avgMovement > 0.03) steadinessScore = 70; // Some movement
      else if (avgMovement > 0.015) steadinessScore = 85; // Mild movement
      else steadinessScore = 100; // Very steady
    }
    
    // Openness/relaxation score
    let opennessScore = 70; // Default
    if (leftDetected || rightDetected) {
      const leftOpenness = leftDetected ? newMetrics.leftHand.openness : 0.5;
      const rightOpenness = rightDetected ? newMetrics.rightHand.openness : 0.5;
      const avgOpenness = (leftOpenness + rightOpenness) / 2;
      
      // Relaxed open hands (0.4-0.7) are ideal
      if (avgOpenness >= 0.4 && avgOpenness <= 0.7) {
        opennessScore = 100; // Ideal relaxed position
      } else if (avgOpenness > 0.7) {
        opennessScore = 90; // Very open (confident but possibly tense)
      } else if (avgOpenness >= 0.25) {
        opennessScore = 80; // Partially closed
      } else {
        opennessScore = 60; // Closed fist (tension indicator)
      }
    }
    
    handsScore = Math.round(
      visibilityScore * 0.40 +
      steadinessScore * 0.35 +
      opennessScore * 0.25
    );
    
    // Update individual hand scores
    if (leftDetected) {
      newMetrics.leftHand.score = Math.round(
        (newMetrics.leftHand.openness >= 0.4 && newMetrics.leftHand.openness <= 0.7 ? 100 : 
         newMetrics.leftHand.openness > 0.7 ? 90 : 
         newMetrics.leftHand.openness >= 0.25 ? 75 : 50) * 0.6 +
        (newMetrics.leftHand.movement < 0.02 ? 100 : newMetrics.leftHand.movement < 0.04 ? 80 : 50) * 0.4
      );
    }
    if (rightDetected) {
      newMetrics.rightHand.score = Math.round(
        (newMetrics.rightHand.openness >= 0.4 && newMetrics.rightHand.openness <= 0.7 ? 100 : 
         newMetrics.rightHand.openness > 0.7 ? 90 : 
         newMetrics.rightHand.openness >= 0.25 ? 75 : 50) * 0.6 +
        (newMetrics.rightHand.movement < 0.02 ? 100 : newMetrics.rightHand.movement < 0.04 ? 80 : 50) * 0.4
      );
    }
    
    /**
     * STABILITY SCORE (0-100)
     * Already calculated in movement metrics
     * Based on body movement over time
     */
    const stabilityScore = newMetrics.movement.score || 70;
    
    /**
     * OVERALL SCORE (0-100)
     * Weighted combination of all components
     * Weights based on interview research:
     * - Eye Contact: Most important for connection (25%)
     * - Posture: Professional appearance (20%)
     * - Stability: Composure indicator (20%)
     * - Expression: Engagement/approachability (20%)
     * - Hands: Trust and confidence (15%)
     */
    const overallScore = Math.round(
      postureScore * 0.20 +
      eyeContactScore * 0.25 +
      expressionScore * 0.20 +
      handsScore * 0.15 +
      stabilityScore * 0.20
    );
    
    newMetrics.scores = {
      posture: postureScore,
      eyeContact: eyeContactScore,
      expression: expressionScore,
      hands: handsScore,
      stability: stabilityScore,
      overall: overallScore,
      level: getScoreLevel(overallScore),
    };

    setMetrics(newMetrics);
  };

  // ============================================================================
  // CAMERA & RECORDING CONTROLS
  // ============================================================================

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: false,
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      setIsStreaming(true);
      toast.success('Camera started');
      
      if (!isMediaPipeReady) {
        await initializeMediaPipe();
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Failed to access camera');
    }
  }, [toast, isMediaPipeReady, initializeMediaPipe]);

  const stopCamera = useCallback(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  const startRecording = useCallback(() => {
    if (!videoRef.current?.srcObject) return;
    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(videoRef.current.srcObject, {
      mimeType: 'video/webm;codecs=vp9',
    });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const recording = {
        id: Date.now().toString(),
        category,
        quality,
        description: description || `${category}_${quality}`,
        duration: recordingTime,
        timestamp: new Date().toISOString(),
        blobSize: blob.size,
        filename: `${category}_${quality}_${Date.now()}.webm`,
      };
      saveVideoBlob(recording.id, blob);
      const newRecordings = [...recordings, recording];
      setRecordings(newRecordings);
      localStorage.setItem('research_video_recordings', JSON.stringify(newRecordings));
      toast.success('Recording saved!');
    };
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000);
    setIsRecording(true);
    setRecordingTime(0);
  }, [category, quality, description, recordings, toast, recordingTime]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const saveVideoBlob = async (id, blob) => {
    const request = indexedDB.open('ResearchVideoDB', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('videos')) {
        db.createObjectStore('videos', { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction(['videos'], 'readwrite');
      tx.objectStore('videos').put({ id, blob, timestamp: Date.now() });
    };
  };

  const downloadRecording = async (recording) => {
    const request = indexedDB.open('ResearchVideoDB', 1);
    request.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction(['videos'], 'readonly');
      const req = tx.objectStore('videos').get(recording.id);
      req.onsuccess = () => {
        if (req.result) {
          const url = URL.createObjectURL(req.result.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = recording.filename;
          a.click();
          URL.revokeObjectURL(url);
        }
      };
    };
  };

  const deleteRecording = (id) => {
    const newRecordings = recordings.filter(r => r.id !== id);
    setRecordings(newRecordings);
    localStorage.setItem('research_video_recordings', JSON.stringify(newRecordings));
    toast.info('Recording deleted');
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // ============================================================================
  // RESEARCH DATA COLLECTION & EXPORT
  // ============================================================================

  // Start/Stop Session Recording
  const startSessionRecording = useCallback(() => {
    setSessionData([]);
    setSessionStartTime(Date.now());
    setIsSessionRecording(true);
    toast.info('Session recording started - collecting metrics data');
  }, [toast]);

  const stopSessionRecording = useCallback(() => {
    setIsSessionRecording(false);
    if (sessionIntervalRef.current) {
      clearInterval(sessionIntervalRef.current);
    }
    toast.success(`Session recorded: ${sessionData.length} data points collected`);
  }, [sessionData.length, toast]);

  // Capture metrics at regular intervals when session recording is active
  useEffect(() => {
    if (isSessionRecording && isStreaming && isMediaPipeReady) {
      sessionIntervalRef.current = setInterval(() => {
        const dataPoint = {
          timestamp: Date.now(),
          relativeTime: Date.now() - sessionStartTime,
          fps: metrics.fps,
          detection: { ...metrics.detection },
          scores: { ...metrics.scores },
          posture: {
            shoulderSlope: metrics.posture.shoulders.slope,
            shoulderScore: metrics.posture.shoulders.score,
            spineForwardLean: metrics.posture.spine.forwardLean,
            spineLateralLean: metrics.posture.spine.lateralLean,
            spineScore: metrics.posture.spine.score,
            headTilt: metrics.posture.head.tilt,
            headForward: metrics.posture.head.forwardPosition,
          },
          face: {
            leftEAR: metrics.face.eyes.leftEAR,
            rightEAR: metrics.face.eyes.rightEAR,
            avgEAR: metrics.face.eyes.avgEAR,
            isBlinking: metrics.face.eyes.isBlinking,
            blinkRate: metrics.face.eyes.blinkRate,
            yaw: metrics.face.orientation.yaw,
            pitch: metrics.face.orientation.pitch,
            roll: metrics.face.orientation.roll,
            isLookingAtCamera: metrics.face.gaze.isLookingAtCamera,
            mar: metrics.face.mouth.mar,
            isSpeaking: metrics.face.mouth.isSpeaking,
            isSmiling: metrics.face.expression.isSmiling,
            smileIntensity: metrics.face.expression.smileIntensity,
          },
          hands: {
            leftDetected: metrics.leftHand.detected,
            leftOpenness: metrics.leftHand.openness,
            leftGesture: metrics.leftHand.gesture,
            leftMovement: metrics.leftHand.movement,
            rightDetected: metrics.rightHand.detected,
            rightOpenness: metrics.rightHand.openness,
            rightGesture: metrics.rightHand.gesture,
            rightMovement: metrics.rightHand.movement,
          },
          movement: {
            stability: metrics.movement.bodyStability,
            avgMovement: metrics.movement.avgMovement,
            isStable: metrics.movement.isStable,
            isFidgeting: metrics.movement.isFidgeting,
          },
        };
        setSessionData(prev => [...prev, dataPoint]);
      }, 500); // Capture every 500ms (2 samples per second)
    }
    return () => {
      if (sessionIntervalRef.current) {
        clearInterval(sessionIntervalRef.current);
      }
    };
  }, [isSessionRecording, isStreaming, isMediaPipeReady, sessionStartTime, metrics]);

  // Export to JSON
  const exportToJSON = useCallback(() => {
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        sessionDuration: sessionData.length > 0 ? 
          (sessionData[sessionData.length - 1].relativeTime / 1000).toFixed(2) + 's' : '0s',
        totalDataPoints: sessionData.length,
        sampleRate: '2 Hz (500ms intervals)',
        modelsUsed: ['PoseLandmarker (33)', 'FaceLandmarker (478)', 'HandLandmarker (21×2)'],
        totalLandmarks: 553,
      },
      summary: sessionData.length > 0 ? {
        avgPostureScore: (sessionData.reduce((sum, d) => sum + d.scores.posture, 0) / sessionData.length).toFixed(2),
        avgEyeContactScore: (sessionData.reduce((sum, d) => sum + d.scores.eyeContact, 0) / sessionData.length).toFixed(2),
        avgExpressionScore: (sessionData.reduce((sum, d) => sum + d.scores.expression, 0) / sessionData.length).toFixed(2),
        avgHandsScore: (sessionData.reduce((sum, d) => sum + d.scores.hands, 0) / sessionData.length).toFixed(2),
        avgStabilityScore: (sessionData.reduce((sum, d) => sum + d.scores.stability, 0) / sessionData.length).toFixed(2),
        avgOverallScore: (sessionData.reduce((sum, d) => sum + d.scores.overall, 0) / sessionData.length).toFixed(2),
        eyeContactPercentage: ((sessionData.filter(d => d.face.isLookingAtCamera).length / sessionData.length) * 100).toFixed(2) + '%',
        smilingPercentage: ((sessionData.filter(d => d.face.isSmiling).length / sessionData.length) * 100).toFixed(2) + '%',
        speakingPercentage: ((sessionData.filter(d => d.face.isSpeaking).length / sessionData.length) * 100).toFixed(2) + '%',
        stablePercentage: ((sessionData.filter(d => d.movement.isStable).length / sessionData.length) * 100).toFixed(2) + '%',
      } : null,
      data: sessionData,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview_metrics_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Metrics exported to JSON');
  }, [sessionData, toast]);

  // Export to CSV
  const exportToCSV = useCallback(() => {
    if (sessionData.length === 0) {
      toast.error('No data to export. Start a session recording first.');
      return;
    }

    const headers = [
      'timestamp', 'relative_time_ms',
      'posture_score', 'eye_contact_score', 'expression_score', 'hands_score', 'stability_score', 'overall_score',
      'shoulder_slope', 'shoulder_score', 'spine_forward_lean', 'spine_lateral_lean', 'spine_score',
      'head_tilt', 'head_forward',
      'left_EAR', 'right_EAR', 'avg_EAR', 'is_blinking', 'blink_rate',
      'yaw', 'pitch', 'roll', 'looking_at_camera',
      'MAR', 'is_speaking', 'is_smiling', 'smile_intensity',
      'left_hand_detected', 'left_hand_openness', 'left_hand_gesture', 'left_hand_movement',
      'right_hand_detected', 'right_hand_openness', 'right_hand_gesture', 'right_hand_movement',
      'body_stability', 'avg_movement', 'is_stable', 'is_fidgeting'
    ];

    const rows = sessionData.map(d => [
      d.timestamp, d.relativeTime,
      d.scores.posture, d.scores.eyeContact, d.scores.expression, d.scores.hands, d.scores.stability, d.scores.overall,
      d.posture.shoulderSlope?.toFixed(6) || '', d.posture.shoulderScore || '',
      d.posture.spineForwardLean?.toFixed(6) || '', d.posture.spineLateralLean?.toFixed(6) || '', d.posture.spineScore || '',
      d.posture.headTilt?.toFixed(6) || '', d.posture.headForward?.toFixed(6) || '',
      d.face.leftEAR?.toFixed(4) || '', d.face.rightEAR?.toFixed(4) || '', d.face.avgEAR?.toFixed(4) || '',
      d.face.isBlinking ? 1 : 0, d.face.blinkRate || 0,
      d.face.yaw?.toFixed(2) || '', d.face.pitch?.toFixed(2) || '', d.face.roll?.toFixed(2) || '',
      d.face.isLookingAtCamera ? 1 : 0,
      d.face.mar?.toFixed(4) || '', d.face.isSpeaking ? 1 : 0, d.face.isSmiling ? 1 : 0, d.face.smileIntensity?.toFixed(4) || '',
      d.hands.leftDetected ? 1 : 0, d.hands.leftOpenness?.toFixed(4) || '', d.hands.leftGesture || '',
      d.hands.leftMovement?.toFixed(6) || '',
      d.hands.rightDetected ? 1 : 0, d.hands.rightOpenness?.toFixed(4) || '', d.hands.rightGesture || '',
      d.hands.rightMovement?.toFixed(6) || '',
      d.movement.stability?.toFixed(4) || '', d.movement.avgMovement?.toFixed(6) || '',
      d.movement.isStable ? 1 : 0, d.movement.isFidgeting ? 1 : 0
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview_metrics_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Metrics exported to CSV');
  }, [sessionData, toast]);

  // Generate Research Report
  const generateResearchReport = useCallback(() => {
    if (sessionData.length === 0) {
      toast.error('No data to generate report. Start a session recording first.');
      return;
    }

    const duration = sessionData.length > 0 ? 
      (sessionData[sessionData.length - 1].relativeTime / 1000) : 0;
    
    const avgScores = {
      posture: sessionData.reduce((sum, d) => sum + d.scores.posture, 0) / sessionData.length,
      eyeContact: sessionData.reduce((sum, d) => sum + d.scores.eyeContact, 0) / sessionData.length,
      expression: sessionData.reduce((sum, d) => sum + d.scores.expression, 0) / sessionData.length,
      hands: sessionData.reduce((sum, d) => sum + d.scores.hands, 0) / sessionData.length,
      stability: sessionData.reduce((sum, d) => sum + d.scores.stability, 0) / sessionData.length,
      overall: sessionData.reduce((sum, d) => sum + d.scores.overall, 0) / sessionData.length,
    };

    const report = `
================================================================================
            INTERVIEW BODY LANGUAGE ANALYSIS REPORT
                    Research-Grade MediaPipe Implementation
================================================================================

Generated: ${new Date().toLocaleString()}
Session Duration: ${duration.toFixed(2)} seconds
Total Data Points: ${sessionData.length}
Sample Rate: 2 Hz (500ms intervals)

--------------------------------------------------------------------------------
                          DETECTION SYSTEM
--------------------------------------------------------------------------------

Models Used:
  - PoseLandmarker: 33 body landmarks (skeleton tracking)
  - FaceLandmarker: 478 facial landmarks (face mesh + iris)
  - HandLandmarker: 21 landmarks per hand (detailed finger tracking)
  
Total Landmarks Tracked: 553 points in real-time

--------------------------------------------------------------------------------
                         OVERALL RESULTS
--------------------------------------------------------------------------------

                    COMPONENT SCORES (0-100)
                    ========================

  Posture Score:        ${avgScores.posture.toFixed(2)} / 100  (Weight: 20%)
  Eye Contact Score:    ${avgScores.eyeContact.toFixed(2)} / 100  (Weight: 25%)
  Expression Score:     ${avgScores.expression.toFixed(2)} / 100  (Weight: 20%)
  Hands Score:          ${avgScores.hands.toFixed(2)} / 100  (Weight: 15%)
  Stability Score:      ${avgScores.stability.toFixed(2)} / 100  (Weight: 20%)
  
  ──────────────────────────────────────────
  OVERALL INTERVIEW PRESENCE: ${avgScores.overall.toFixed(2)} / 100
  ──────────────────────────────────────────

--------------------------------------------------------------------------------
                      BEHAVIORAL ANALYSIS
--------------------------------------------------------------------------------

Eye Contact:
  - Looking at camera: ${((sessionData.filter(d => d.face.isLookingAtCamera).length / sessionData.length) * 100).toFixed(2)}% of the time
  - Average face yaw: ${(sessionData.reduce((sum, d) => sum + Math.abs(d.face.yaw || 0), 0) / sessionData.length).toFixed(2)}°
  - Average face pitch: ${(sessionData.reduce((sum, d) => sum + Math.abs(d.face.pitch || 0), 0) / sessionData.length).toFixed(2)}°

Facial Expression:
  - Smiling: ${((sessionData.filter(d => d.face.isSmiling).length / sessionData.length) * 100).toFixed(2)}% of the time
  - Average smile intensity: ${((sessionData.reduce((sum, d) => sum + (d.face.smileIntensity || 0), 0) / sessionData.length) * 100).toFixed(2)}%
  - Speaking: ${((sessionData.filter(d => d.face.isSpeaking).length / sessionData.length) * 100).toFixed(2)}% of the time

Body Language:
  - Stable posture: ${((sessionData.filter(d => d.movement.isStable).length / sessionData.length) * 100).toFixed(2)}% of the time
  - Fidgeting detected: ${((sessionData.filter(d => d.movement.isFidgeting).length / sessionData.length) * 100).toFixed(2)}% of the time
  - Average body movement: ${(sessionData.reduce((sum, d) => sum + (d.movement.avgMovement || 0), 0) / sessionData.length).toFixed(6)}

Hand Analysis:
  - Left hand visible: ${((sessionData.filter(d => d.hands.leftDetected).length / sessionData.length) * 100).toFixed(2)}% of the time
  - Right hand visible: ${((sessionData.filter(d => d.hands.rightDetected).length / sessionData.length) * 100).toFixed(2)}% of the time

--------------------------------------------------------------------------------
                         SCORING METHODOLOGY
--------------------------------------------------------------------------------

Overall Score Formula:
  Overall = (Posture × 20%) + (Eye Contact × 25%) + (Expression × 20%) 
          + (Hands × 15%) + (Stability × 20%)

Component Breakdown:

1. POSTURE SCORE (20% of overall)
   - Shoulder alignment: 40%
   - Spine alignment: 40%
   - Head position: 20%

2. EYE CONTACT SCORE (25% of overall)
   - Face orientation: 50%
   - Gaze direction: 30%
   - Eye openness: 20%

3. EXPRESSION SCORE (20% of overall)
   - Facial naturalness: 40%
   - Smile/positive expression: 30%
   - Mouth state: 30%

4. HANDS SCORE (15% of overall)
   - Visibility: 40%
   - Steadiness: 35%
   - Relaxation: 25%

5. STABILITY SCORE (20% of overall)
   - Based on body movement magnitude over time
   - Lower movement = higher score

--------------------------------------------------------------------------------
                        RESEARCH REFERENCES
--------------------------------------------------------------------------------

- Mehrabian, A. (1971). Silent Messages. Wadsworth Publishing.
- Gifford, R., Ng, C. F., & Wilkinson, M. (1985). Nonverbal cues in the 
  employment interview. Journal of Applied Psychology, 70(4), 729-736.
- Ekman, P., & Friesen, W. V. (1978). Facial Action Coding System. 
  Consulting Psychologists Press.
- Google MediaPipe Documentation (2023). https://developers.google.com/mediapipe

================================================================================
                          END OF REPORT
================================================================================
`;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview_analysis_report_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Research report generated');
  }, [sessionData, toast]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Comprehensive Body Language Detection</h2>
            <p className="text-blue-100 text-sm">Research-grade MediaPipe implementation</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{metrics.detection.landmarksCount.total}</div>
            <div className="text-xs text-blue-100">Landmarks Tracked</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
          <div className={`rounded-lg p-2 ${metrics.detection.poseDetected ? 'bg-green-500/30' : 'bg-white/10'}`}>
            <div className="font-bold">Pose</div>
            <div>{metrics.detection.poseDetected ? '33' : '0'}</div>
          </div>
          <div className={`rounded-lg p-2 ${metrics.detection.faceDetected ? 'bg-green-500/30' : 'bg-white/10'}`}>
            <div className="font-bold">Face</div>
            <div>{metrics.detection.faceDetected ? '478' : '0'}</div>
          </div>
          <div className={`rounded-lg p-2 ${metrics.detection.leftHandDetected ? 'bg-green-500/30' : 'bg-white/10'}`}>
            <div className="font-bold">Left Hand</div>
            <div>{metrics.detection.leftHandDetected ? '21' : '0'}</div>
          </div>
          <div className={`rounded-lg p-2 ${metrics.detection.rightHandDetected ? 'bg-green-500/30' : 'bg-white/10'}`}>
            <div className="font-bold">Right Hand</div>
            <div>{metrics.detection.rightHandDetected ? '21' : '0'}</div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Video Preview */}
        <div className="xl:col-span-2">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">Camera Preview</h3>
              <div className="flex items-center gap-2">
                {isMediaPipeReady && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    {metrics.fps} FPS
                  </span>
                )}
                {isRecording && (
                  <span className="text-xs text-red-600 flex items-center gap-1 px-2 py-1 bg-red-100 rounded-full">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    REC {formatTime(recordingTime)}
                  </span>
                )}
              </div>
            </div>

            {/* Video Container */}
            <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden mb-3">
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} playsInline muted />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ transform: 'scaleX(-1)' }} />
              
              {!isStreaming && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90">
                  <div className="text-center">
                    <Icon name="Video" className="w-12 h-12 text-slate-500 mx-auto mb-2" />
                    <p className="text-slate-400">Click "Start Camera" to begin</p>
                  </div>
                </div>
              )}

              {/* Overall Score Overlay */}
              {isStreaming && isMediaPipeReady && (
                <div className="absolute top-3 left-3 px-4 py-3 bg-black/80 backdrop-blur-sm rounded-xl border border-white/10">
                  <div className="text-xs text-white/60 mb-1">Interview Presence</div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-bold ${getScoreColor(metrics.scores.overall)}`}>
                      {metrics.scores.overall}
                    </span>
                    <span className="text-white/40 text-sm">/100</span>
                  </div>
                  <div className={`text-xs uppercase font-bold mt-1 ${getScoreColor(metrics.scores.level)}`}>
                    {metrics.scores.level.replace('needsImprovement', 'Improve')}
                  </div>
                  {/* Mini score bars */}
                  <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                    {[
                      { label: 'POS', score: metrics.scores.posture, color: '#A855F7' },
                      { label: 'EYE', score: metrics.scores.eyeContact, color: '#06B6D4' },
                      { label: 'EXP', score: metrics.scores.expression, color: '#EC4899' },
                      { label: 'HND', score: metrics.scores.hands, color: '#F97316' },
                      { label: 'STB', score: metrics.scores.stability, color: '#10B981' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2 text-xs">
                        <span className="text-white/50 w-6">{item.label}</span>
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${item.score}%`, backgroundColor: item.color }}
                          />
                        </div>
                        <span className="text-white/70 w-6 text-right font-mono">{item.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Display Toggles */}
            <div className="flex flex-wrap gap-2 mb-3 p-2 bg-slate-100 dark:bg-slate-900/50 rounded-lg text-sm">
              <label
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 cursor-pointer transition ${
                  showOverlay
                    ? 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200'
                    : 'border-transparent text-slate-700 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800/70'
                }`}
              >
                <input
                  type="checkbox"
                  checked={showOverlay}
                  onChange={(e) => setShowOverlay(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 bg-white text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-blue-400 dark:focus:ring-blue-400"
                />
                <span>Overlay</span>
              </label>
              <label
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 cursor-pointer transition ${
                  showPose
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200'
                    : 'border-transparent text-slate-700 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800/70'
                }`}
              >
                <input
                  type="checkbox"
                  checked={showPose}
                  onChange={(e) => setShowPose(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 bg-white text-emerald-600 focus:ring-2 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-emerald-400 dark:focus:ring-emerald-400"
                />
                <span className={showPose ? '' : 'text-emerald-600 dark:text-emerald-400'}>Pose</span>
              </label>
              <label
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 cursor-pointer transition ${
                  showFace
                    ? 'border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200'
                    : 'border-transparent text-slate-700 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800/70'
                }`}
              >
                <input
                  type="checkbox"
                  checked={showFace}
                  onChange={(e) => setShowFace(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 bg-white text-cyan-600 focus:ring-2 focus:ring-cyan-500 dark:border-slate-600 dark:bg-slate-800 dark:text-cyan-400 dark:focus:ring-cyan-400"
                />
                <span className={showFace ? '' : 'text-cyan-600 dark:text-cyan-400'}>Face</span>
              </label>
              <label
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 cursor-pointer transition ${
                  showHands
                    ? 'border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-200'
                    : 'border-transparent text-slate-700 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800/70'
                }`}
              >
                <input
                  type="checkbox"
                  checked={showHands}
                  onChange={(e) => setShowHands(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 bg-white text-orange-600 focus:ring-2 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-800 dark:text-orange-400 dark:focus:ring-orange-400"
                />
                <span className={showHands ? '' : 'text-orange-600 dark:text-orange-400'}>Hands</span>
              </label>
              <label
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 cursor-pointer transition ${
                  showMetrics
                    ? 'border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-200'
                    : 'border-transparent text-slate-700 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800/70'
                }`}
              >
                <input
                  type="checkbox"
                  checked={showMetrics}
                  onChange={(e) => setShowMetrics(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 bg-white text-violet-600 focus:ring-2 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-800 dark:text-violet-400 dark:focus:ring-violet-400"
                />
                <span>Metrics</span>
              </label>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap gap-2">
              {!isStreaming ? (
                <Button
                  onClick={startCamera}
                  variant="default"
                  className="border border-blue-500/60 dark:border-blue-400/40"
                >
                  <Icon name="Video" className="w-4 h-4 mr-2" />Start Camera
                </Button>
              ) : (
                <>
                  <Button onClick={stopCamera} variant="outline" disabled={isRecording || isSessionRecording}>
                    <Icon name="VideoOff" className="w-4 h-4 mr-2" />Stop
                  </Button>
                  {!isRecording ? (
                    <Button onClick={startRecording} className="bg-red-600 hover:bg-red-700 text-white">
                      <Icon name="Circle" className="w-4 h-4 mr-2" />Record Video
                    </Button>
                  ) : (
                    <Button
                      onClick={stopRecording}
                      variant="default"
                      className="border border-blue-500/60 dark:border-blue-400/40"
                    >
                      <Icon name="Square" className="w-4 h-4 mr-2" />Stop Recording
                    </Button>
                  )}
                  
                  {/* Session Recording for Research Data */}
                  <div className="border-l border-slate-300 dark:border-slate-600 mx-1" />
                  {!isSessionRecording ? (
                    <Button onClick={startSessionRecording} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      <Icon name="Database" className="w-4 h-4 mr-2" />Collect Data
                    </Button>
                  ) : (
                    <Button onClick={stopSessionRecording} className="bg-emerald-700 hover:bg-emerald-800 text-white">
                      <Icon name="StopCircle" className="w-4 h-4 mr-2" />Stop ({sessionData.length})
                    </Button>
                  )}
                </>
              )}
              {isMediaPipeLoading && (
                <span className="text-sm text-gray-500 flex items-center">
                  <Icon name="Loader2" className="w-4 h-4 animate-spin mr-2" />
                  {loadingStatus}
                </span>
              )}
            </div>

            {/* Research Data Export Panel */}
            {sessionData.length > 0 && (
              <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon name="Database" className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      Research Data: {sessionData.length} samples
                    </span>
                    {isSessionRecording && (
                      <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                        Recording...
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={exportToJSON}>
                      <Icon name="FileJson" className="w-3 h-3 mr-1" />JSON
                    </Button>
                    <Button size="sm" variant="outline" onClick={exportToCSV}>
                      <Icon name="FileSpreadsheet" className="w-3 h-3 mr-1" />CSV
                    </Button>
                    <Button size="sm" variant="outline" onClick={generateResearchReport}>
                      <Icon name="FileText" className="w-3 h-3 mr-1" />Report
                    </Button>
                  </div>
                </div>
                {sessionData.length > 0 && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">
                    Duration: {((sessionData[sessionData.length - 1]?.relativeTime || 0) / 1000).toFixed(1)}s | 
                    Avg Score: {(sessionData.reduce((sum, d) => sum + d.scores.overall, 0) / sessionData.length).toFixed(1)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Settings Panel */}
        <div className="space-y-4">
          {/* Category */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">Category</h4>
            <div className="space-y-1">
              {CATEGORIES.map((cat) => (
                <label key={cat.id} className={`flex items-center p-2 rounded-lg cursor-pointer transition ${category === cat.id ? 'bg-blue-100 dark:bg-blue-900/30' : 'hover:bg-slate-100 dark:hover:bg-slate-900/50'}`}>
                  <input type="radio" name="category" value={cat.id} checked={category === cat.id} onChange={(e) => setCategory(e.target.value)} className="sr-only" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{cat.label}</div>
                    <div className="text-xs text-gray-500">{cat.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">Example Type</h4>
            <div className="grid grid-cols-2 gap-2">
              {QUALITY_TYPES.map((q) => (
                <button key={q.id} onClick={() => setQuality(q.id)}
                  className={`p-3 rounded-lg text-center transition border ${
                    quality === q.id
                      ? (q.id === 'good'
                        ? 'bg-emerald-100 border-emerald-400 text-emerald-950'
                        : 'bg-rose-100 border-rose-400 text-rose-950')
                      : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                  }`}>
                  <Icon
                    name={q.id === 'good' ? 'ThumbsUp' : 'ThumbsDown'}
                    className={`w-5 h-5 mx-auto mb-1 ${
                      q.id === 'good'
                        ? (quality === q.id ? 'text-emerald-700' : 'text-emerald-600 dark:text-emerald-400')
                        : (quality === q.id ? 'text-rose-700' : 'text-red-600 dark:text-red-400')
                    }`}
                  />
                  <div className="text-sm font-medium">{q.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">Description</h4>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., slouching, good_posture" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
          </div>
        </div>
      </div>

      {/* Comprehensive Metrics Panel */}
      {showMetrics && isStreaming && isMediaPipeReady && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Metric Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {['overview', 'posture', 'face', 'hands', 'movement'].map((tab) => (
              <button key={tab} onClick={() => setActiveMetricTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${activeMetricTab === tab ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300'}`}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Overview Tab - Research-Grade Scores */}
          {activeMetricTab === 'overview' && (
            <div className="space-y-4">
              {/* Overall Score Card */}
              <div className="rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 p-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-bold">Overall Interview Presence Score</h4>
                    <p className="text-slate-400 text-sm mt-1">
                      Composite score based on weighted components
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-5xl font-bold ${getScoreColor(metrics.scores.overall)}`}>
                      {metrics.scores.overall}
                    </div>
                    <div className={`text-sm font-semibold uppercase mt-1 px-3 py-1 rounded-full inline-block ${
                      metrics.scores.level === 'excellent' ? 'bg-emerald-500/20 text-emerald-400' :
                      metrics.scores.level === 'good' ? 'bg-green-500/20 text-green-400' :
                      metrics.scores.level === 'fair' ? 'bg-yellow-500/20 text-yellow-400' :
                      metrics.scores.level === 'needsImprovement' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {metrics.scores.level.replace('needsImprovement', 'Needs Improvement')}
                    </div>
                  </div>
                </div>
                {/* Formula explanation */}
                <div className="mt-4 pt-4 border-t border-slate-700 text-xs text-slate-400">
                  <strong>Formula:</strong> (Posture×20%) + (Eye Contact×25%) + (Expression×20%) + (Hands×15%) + (Stability×20%)
                </div>
              </div>

              {/* Component Scores Grid */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {/* Posture */}
                <div className="rounded-xl p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase">Posture</span>
                    <span className="text-xs text-purple-500">20%</span>
                  </div>
                  <div className={`text-3xl font-bold ${getScoreColor(metrics.scores.posture)}`}>
                    {metrics.scores.posture}
                  </div>
                  <div className="w-full h-2 bg-purple-200 dark:bg-purple-900 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full transition-all duration-300" 
                         style={{ width: `${metrics.scores.posture}%` }} />
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between">
                      <span>Shoulders:</span>
                      <span className="font-mono">{metrics.posture.shoulders.score}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Spine:</span>
                      <span className="font-mono">{metrics.posture.spine.score}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Head:</span>
                      <span className="font-mono">{metrics.posture.head.status}</span>
                    </div>
                  </div>
                </div>

                {/* Eye Contact */}
                <div className="rounded-xl p-4 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase">Eye Contact</span>
                    <span className="text-xs text-cyan-500">25%</span>
                  </div>
                  <div className={`text-3xl font-bold ${getScoreColor(metrics.scores.eyeContact)}`}>
                    {metrics.scores.eyeContact}
                  </div>
                  <div className="w-full h-2 bg-cyan-200 dark:bg-cyan-900 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full transition-all duration-300" 
                         style={{ width: `${metrics.scores.eyeContact}%` }} />
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between">
                      <span>Orientation:</span>
                      <span className="font-mono">{metrics.face.orientation.score}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gaze:</span>
                      <span className="font-mono">{metrics.face.gaze.score}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>At Camera:</span>
                      <span className={metrics.face.gaze.isLookingAtCamera ? 'text-green-600' : 'text-red-500'}>
                        {metrics.face.gaze.isLookingAtCamera ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expression */}
                <div className="rounded-xl p-4 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-pink-600 dark:text-pink-400 uppercase">Expression</span>
                    <span className="text-xs text-pink-500">20%</span>
                  </div>
                  <div className={`text-3xl font-bold ${getScoreColor(metrics.scores.expression)}`}>
                    {metrics.scores.expression}
                  </div>
                  <div className="w-full h-2 bg-pink-200 dark:bg-pink-900 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-pink-500 rounded-full transition-all duration-300" 
                         style={{ width: `${metrics.scores.expression}%` }} />
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between">
                      <span>Smiling:</span>
                      <span className={metrics.face.expression.isSmiling ? 'text-green-600' : 'text-gray-500'}>
                        {metrics.face.expression.isSmiling ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Intensity:</span>
                      <span className="font-mono">{(metrics.face.expression.smileIntensity * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Mouth:</span>
                      <span className="capitalize">{metrics.face.mouth.openness}</span>
                    </div>
                  </div>
                </div>

                {/* Hands */}
                <div className="rounded-xl p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase">Hands</span>
                    <span className="text-xs text-orange-500">15%</span>
                  </div>
                  <div className={`text-3xl font-bold ${getScoreColor(metrics.scores.hands)}`}>
                    {metrics.scores.hands}
                  </div>
                  <div className="w-full h-2 bg-orange-200 dark:bg-orange-900 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full transition-all duration-300" 
                         style={{ width: `${metrics.scores.hands}%` }} />
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between">
                      <span>Visible:</span>
                      <span>
                        {metrics.detection.leftHandDetected && metrics.detection.rightHandDetected ? 'Both' :
                         metrics.detection.leftHandDetected ? 'Left' :
                         metrics.detection.rightHandDetected ? 'Right' : 'None'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>L Gesture:</span>
                      <span className="truncate max-w-[60px]">{metrics.leftHand.gesture}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>R Gesture:</span>
                      <span className="truncate max-w-[60px]">{metrics.rightHand.gesture}</span>
                    </div>
                  </div>
                </div>

                {/* Stability */}
                <div className="rounded-xl p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Stability</span>
                    <span className="text-xs text-emerald-500">20%</span>
                  </div>
                  <div className={`text-3xl font-bold ${getScoreColor(metrics.scores.stability)}`}>
                    {metrics.scores.stability}
                  </div>
                  <div className="w-full h-2 bg-emerald-200 dark:bg-emerald-900 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" 
                         style={{ width: `${metrics.scores.stability}%` }} />
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between">
                      <span>Stable:</span>
                      <span className={metrics.movement.isStable ? 'text-green-600' : 'text-red-500'}>
                        {metrics.movement.isStable ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fidgeting:</span>
                      <span className={metrics.movement.isFidgeting ? 'text-red-500' : 'text-green-600'}>
                        {metrics.movement.isFidgeting ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Movement:</span>
                      <span className="font-mono">{metrics.movement.avgMovement.toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scoring Methodology */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4">
                <h5 className="font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  <Icon name="BookOpen" className="w-4 h-4" />
                  Scoring Methodology
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs text-gray-600 dark:text-gray-400">
                  <div>
                    <strong className="text-purple-600">Posture (20%)</strong>
                    <ul className="mt-1 space-y-0.5">
                      <li>• Shoulders: 40%</li>
                      <li>• Spine: 40%</li>
                      <li>• Head: 20%</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="text-cyan-600">Eye Contact (25%)</strong>
                    <ul className="mt-1 space-y-0.5">
                      <li>• Orientation: 50%</li>
                      <li>• Gaze: 30%</li>
                      <li>• Openness: 20%</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="text-pink-600">Expression (20%)</strong>
                    <ul className="mt-1 space-y-0.5">
                      <li>• Natural: 40%</li>
                      <li>• Smile: 30%</li>
                      <li>• Mouth: 30%</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="text-orange-600">Hands (15%)</strong>
                    <ul className="mt-1 space-y-0.5">
                      <li>• Visible: 40%</li>
                      <li>• Steady: 35%</li>
                      <li>• Relaxed: 25%</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="text-emerald-600">Stability (20%)</strong>
                    <ul className="mt-1 space-y-0.5">
                      <li>• Body still</li>
                      <li>• No fidgeting</li>
                      <li>• Consistent</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Posture Tab */}
          {activeMetricTab === 'posture' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Shoulders */}
              <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 p-4">
                <h5 className="font-bold text-purple-700 dark:text-purple-300 mb-3 flex items-center gap-2">
                  <Icon name="User" className="w-4 h-4" /> Shoulders
                </h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Slope:</span><span className="font-mono">{metrics.posture.shoulders.slope.toFixed(4)}</span></div>
                  <div className="flex justify-between"><span>Width:</span><span className="font-mono">{metrics.posture.shoulders.width.toFixed(4)}</span></div>
                  <div className="flex justify-between"><span>Angle:</span><span className="font-mono">{metrics.posture.shoulders.angle.toFixed(1)}°</span></div>
                  <div className="flex justify-between"><span>Level:</span><span className={metrics.posture.shoulders.isLevel ? 'text-green-600' : 'text-red-600'}>{metrics.posture.shoulders.isLevel ? 'Yes' : 'No'}</span></div>
                  <div className="flex justify-between"><span>Status:</span><span className={getScoreColor(metrics.posture.shoulders.score)}>{metrics.posture.shoulders.status}</span></div>
                  <div className="flex justify-between"><span>Score:</span><span className="font-bold">{metrics.posture.shoulders.score}</span></div>
                </div>
              </div>

              {/* Spine */}
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-4">
                <h5 className="font-bold text-indigo-700 dark:text-indigo-300 mb-3">Spine/Back</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Forward Lean:</span><span className="font-mono">{metrics.posture.spine.forwardLean.toFixed(4)}</span></div>
                  <div className="flex justify-between"><span>Lateral Lean:</span><span className="font-mono">{metrics.posture.spine.lateralLean.toFixed(4)}</span></div>
                  <div className="flex justify-between"><span>Upright:</span><span className={metrics.posture.spine.isUpright ? 'text-green-600' : 'text-red-600'}>{metrics.posture.spine.isUpright ? 'Yes' : 'No'}</span></div>
                  <div className="flex justify-between"><span>Status:</span><span className={getScoreColor(metrics.posture.spine.score)}>{metrics.posture.spine.status}</span></div>
                  <div className="flex justify-between"><span>Score:</span><span className="font-bold">{metrics.posture.spine.score}</span></div>
                </div>
              </div>

              {/* Arms */}
              <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 p-4">
                <h5 className="font-bold text-violet-700 dark:text-violet-300 mb-3">Arms</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Left Elbow Angle:</span><span className="font-mono">{metrics.posture.arms.leftAngle.toFixed(1)}°</span></div>
                  <div className="flex justify-between"><span>Right Elbow Angle:</span><span className="font-mono">{metrics.posture.arms.rightAngle.toFixed(1)}°</span></div>
                  <div className="flex justify-between"><span>Head Tilt:</span><span className="font-mono">{metrics.posture.head.tilt.toFixed(4)}</span></div>
                  <div className="flex justify-between"><span>Head Forward:</span><span className="font-mono">{metrics.posture.head.forwardPosition.toFixed(4)}</span></div>
                  <div className="flex justify-between"><span>Body Symmetry:</span><span className="font-mono">{(metrics.posture.body.symmetry * 100).toFixed(1)}%</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Face Tab */}
          {activeMetricTab === 'face' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Eyes */}
              <div className="rounded-xl border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-900/20 p-4">
                <h5 className="font-bold text-cyan-700 dark:text-cyan-300 mb-3 flex items-center gap-2">
                  <Icon name="Eye" className="w-4 h-4" /> Eyes
                </h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Left EAR:</span><span className="font-mono">{metrics.face.eyes.leftEAR.toFixed(3)}</span></div>
                  <div className="flex justify-between"><span>Right EAR:</span><span className="font-mono">{metrics.face.eyes.rightEAR.toFixed(3)}</span></div>
                  <div className="flex justify-between"><span>Average EAR:</span><span className="font-mono">{metrics.face.eyes.avgEAR.toFixed(3)}</span></div>
                  <div className="flex justify-between"><span>Asymmetry:</span><span className="font-mono">{metrics.face.eyes.asymmetry.toFixed(4)}</span></div>
                  <div className="flex justify-between"><span>Blink Rate:</span><span className="font-mono">{metrics.face.eyes.blinkRate}/min</span></div>
                  <div className="flex justify-between"><span>Status:</span><span className={getScoreColor(metrics.face.eyes.score)}>{metrics.face.eyes.status}</span></div>
                </div>
              </div>

              {/* Orientation */}
              <div className="rounded-xl border border-pink-200 dark:border-pink-800 bg-pink-50 dark:bg-pink-900/20 p-4">
                <h5 className="font-bold text-pink-700 dark:text-pink-300 mb-3">Orientation</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Yaw (L/R):</span><span className="font-mono">{metrics.face.orientation.yaw.toFixed(1)}°</span></div>
                  <div className="flex justify-between"><span>Pitch (U/D):</span><span className="font-mono">{metrics.face.orientation.pitch.toFixed(1)}°</span></div>
                  <div className="flex justify-between"><span>Roll (Tilt):</span><span className="font-mono">{metrics.face.orientation.roll.toFixed(1)}°</span></div>
                  <div className="flex justify-between"><span>Combined:</span><span className="font-mono">{metrics.face.orientation.combined.toFixed(1)}°</span></div>
                  <div className="flex justify-between"><span>Status:</span><span className={getScoreColor(metrics.face.orientation.score)}>{metrics.face.orientation.status}</span></div>
                </div>
              </div>

              {/* Gaze */}
              <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 p-4">
                <h5 className="font-bold text-teal-700 dark:text-teal-300 mb-3">Gaze</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>At Camera:</span><span className={metrics.face.gaze.isLookingAtCamera ? 'text-green-600' : 'text-red-600'}>{metrics.face.gaze.isLookingAtCamera ? 'Yes' : 'No'}</span></div>
                  <div className="flex justify-between"><span>Direction:</span><span className="capitalize">{metrics.face.gaze.direction}</span></div>
                  <div className="flex justify-between"><span>Deviation:</span><span className="font-mono">{(metrics.face.gaze.deviation * 100).toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span>Status:</span><span className={getScoreColor(metrics.face.gaze.score)}>{metrics.face.gaze.status}</span></div>
                  <div className="flex justify-between"><span>Score:</span><span className="font-bold">{metrics.face.gaze.score}</span></div>
                </div>
              </div>

              {/* Mouth & Expression */}
              <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-4">
                <h5 className="font-bold text-rose-700 dark:text-rose-300 mb-3">Mouth & Expression</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>MAR:</span><span className="font-mono">{metrics.face.mouth.mar.toFixed(3)}</span></div>
                  <div className="flex justify-between"><span>Speaking:</span><span className={metrics.face.mouth.isSpeaking ? 'text-green-600' : 'text-gray-500'}>{metrics.face.mouth.isSpeaking ? 'Yes' : 'No'}</span></div>
                  <div className="flex justify-between"><span>Openness:</span><span className="capitalize">{metrics.face.mouth.openness}</span></div>
                  <div className="flex justify-between"><span>Smiling:</span><span className={metrics.face.expression.isSmiling ? 'text-green-600' : 'text-gray-500'}>{metrics.face.expression.isSmiling ? 'Yes' : 'No'}</span></div>
                  <div className="flex justify-between"><span>Intensity:</span><span className="font-mono">{(metrics.face.expression.smileIntensity * 100).toFixed(0)}%</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Hands Tab */}
          {activeMetricTab === 'hands' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Hand */}
              <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-4">
                <h5 className="font-bold text-orange-700 dark:text-orange-300 mb-3 flex items-center gap-2">
                  <Icon name="Hand" className="w-4 h-4" /> Left Hand
                  {metrics.leftHand.detected && <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">Detected</span>}
                </h5>
                {metrics.leftHand.detected ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between"><span>Openness:</span><span className="font-mono">{(metrics.leftHand.openness * 100).toFixed(0)}%</span></div>
                      <div className="flex justify-between"><span>Gesture:</span><span className="font-medium">{metrics.leftHand.gesture}</span></div>
                      <div className="flex justify-between"><span>Spread:</span><span className="font-mono">{metrics.leftHand.spread.toFixed(4)}</span></div>
                      <div className="flex justify-between"><span>Movement:</span><span className="font-mono">{metrics.leftHand.movement.toFixed(4)}</span></div>
                    </div>
                    <div className="border-t border-orange-200 dark:border-orange-700 pt-2">
                      <div className="text-xs font-medium mb-2">Finger Status:</div>
                      <div className="grid grid-cols-5 gap-1 text-xs text-center">
                        {['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].map((finger) => {
                          const key = finger.toLowerCase();
                          const data = metrics.leftHand.fingers[key];
                          return (
                            <div key={finger} className={`p-1 rounded ${data?.extended ? 'bg-green-200 dark:bg-green-900/50' : 'bg-red-200 dark:bg-red-900/50'}`}>
                              <div className="font-medium">{finger.charAt(0)}</div>
                              <div className="font-mono text-[10px]">{(data?.curl * 100 || 0).toFixed(0)}%</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Not detected - show left hand to camera</p>
                )}
              </div>

              {/* Right Hand */}
              <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
                <h5 className="font-bold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2">
                  <Icon name="Hand" className="w-4 h-4" /> Right Hand
                  {metrics.rightHand.detected && <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">Detected</span>}
                </h5>
                {metrics.rightHand.detected ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between"><span>Openness:</span><span className="font-mono">{(metrics.rightHand.openness * 100).toFixed(0)}%</span></div>
                      <div className="flex justify-between"><span>Gesture:</span><span className="font-medium">{metrics.rightHand.gesture}</span></div>
                      <div className="flex justify-between"><span>Spread:</span><span className="font-mono">{metrics.rightHand.spread.toFixed(4)}</span></div>
                      <div className="flex justify-between"><span>Movement:</span><span className="font-mono">{metrics.rightHand.movement.toFixed(4)}</span></div>
                    </div>
                    <div className="border-t border-blue-200 dark:border-blue-700 pt-2">
                      <div className="text-xs font-medium mb-2">Finger Status:</div>
                      <div className="grid grid-cols-5 gap-1 text-xs text-center">
                        {['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].map((finger) => {
                          const key = finger.toLowerCase();
                          const data = metrics.rightHand.fingers[key];
                          return (
                            <div key={finger} className={`p-1 rounded ${data?.extended ? 'bg-green-200 dark:bg-green-900/50' : 'bg-red-200 dark:bg-red-900/50'}`}>
                              <div className="font-medium">{finger.charAt(0)}</div>
                              <div className="font-mono text-[10px]">{(data?.curl * 100 || 0).toFixed(0)}%</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Not detected - show right hand to camera</p>
                )}
              </div>
            </div>
          )}

          {/* Movement Tab */}
          {activeMetricTab === 'movement' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4">
                <h5 className="font-bold text-emerald-700 dark:text-emerald-300 mb-3 flex items-center gap-2">
                  <Icon name="Activity" className="w-4 h-4" /> Body Stability
                </h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Stability:</span><span className="font-mono">{(metrics.movement.bodyStability * 100).toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span>Current Movement:</span><span className="font-mono">{metrics.movement.bodyMovement.toFixed(5)}</span></div>
                  <div className="flex justify-between"><span>Avg Movement:</span><span className="font-mono">{metrics.movement.avgMovement.toFixed(5)}</span></div>
                  <div className="flex justify-between"><span>Is Stable:</span><span className={metrics.movement.isStable ? 'text-green-600' : 'text-red-600'}>{metrics.movement.isStable ? 'Yes' : 'No'}</span></div>
                  <div className="flex justify-between"><span>Fidgeting:</span><span className={metrics.movement.isFidgeting ? 'text-red-600' : 'text-green-600'}>{metrics.movement.isFidgeting ? 'Yes' : 'No'}</span></div>
                  <div className="flex justify-between"><span>Score:</span><span className="font-bold">{metrics.movement.score}</span></div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4">
                <h5 className="font-bold text-slate-700 dark:text-slate-300 mb-3">Reference Values</h5>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <p><strong>Very Still:</strong> &lt; 0.005</p>
                  <p><strong>Stable:</strong> &lt; 0.012</p>
                  <p><strong>Normal:</strong> &lt; 0.025</p>
                  <p><strong>Active:</strong> &lt; 0.045</p>
                  <p><strong>Restless:</strong> &lt; 0.070</p>
                  <p><strong>Excessive:</strong> &gt; 0.100</p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Recordings List */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">Recordings ({recordings.length})</h3>
          {recordings.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => recordings.forEach(r => downloadRecording(r))}>
              <Icon name="Download" className="w-4 h-4 mr-1" />Download All
            </Button>
          )}
        </div>
        {recordings.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No recordings yet</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {recordings.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-8 rounded ${r.quality === 'good' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div>
                    <div className="text-sm font-medium">{r.filename}</div>
                    <div className="text-xs text-gray-500">{r.category} • {formatTime(r.duration)}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => downloadRecording(r)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded">
                    <Icon name="Download" className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteRecording(r.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded">
                    <Icon name="Trash2" className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3">
        <div className="flex items-start gap-2">
          <Icon name="Info" className="w-4 h-4 text-blue-600 mt-0.5" />
          <div className="text-xs text-blue-700 dark:text-blue-300">
            <span className="font-bold">Detection Legend:</span>
            <span className="ml-2">
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full" /> Pose (33)</span> •
              <span className="inline-flex items-center gap-1 ml-2"><span className="w-2 h-2 bg-cyan-500 rounded-full" /> Face (478)</span> •
              <span className="inline-flex items-center gap-1 ml-2"><span className="w-2 h-2 bg-orange-500 rounded-full" /> Left Hand (21)</span> •
              <span className="inline-flex items-center gap-1 ml-2"><span className="w-2 h-2 bg-blue-500 rounded-full" /> Right Hand (21)</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoRecorder;
