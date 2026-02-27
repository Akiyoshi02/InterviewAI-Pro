import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { onValue, ref as realtimeRef } from 'firebase/database';
import Header from '../../components/ui/Header';
import InterviewSessionControls from '../../components/ui/InterviewSessionControls';
import AIInterviewerPanel from './components/AIInterviewerPanel';
import CandidateVideoFeed from './components/CandidateVideoFeed';
import TranscriptionPanel from './components/TranscriptionPanel';
import SessionControlPanel from './components/SessionControlPanel';
import RealTimeFeedbackPanel from './components/RealTimeFeedbackPanel';
import QuestionProgressIndicator from './components/QuestionProgressIndicator';
import ScreenSharingPanel from './components/ScreenSharingPanel';
import PoseAnalysisPanel from '../../components/ui/PoseAnalysisPanel';
import EmotionDetector from '../../components/ui/EmotionDetector';
import LoadingState from '../../components/ui/LoadingState';
import RecordingConsentScreen from './components/RecordingConsentScreen';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { 
  savePoseSnapshot, 
  finalizePoseAnalytics,
  saveSessionPoseData 
} from '../../services/poseAnalyticsStorage';
import { useAIInterviewer } from '../../hooks/useAIInterviewer';
import apiClient from '../../services/apiClient';
import { realtimeDb } from '../../config/firebase.js';
import { InterviewDatasetCollector } from '../../services/interviewDatasetService';

const isBackendInterviewId = (id) => Boolean(id && !/^interview_\d+$/.test(id));
const RECORDING_MIN_BYTES = Math.max(
  1024,
  Number.parseInt(import.meta.env.VITE_RECORDING_MIN_BYTES || '51200', 10) || 51200,
);

const DEFAULT_INTERVIEW_CONFIG = {
  jobRole: 'Software Engineer',
  company: 'Tech Company',
  experienceLevel: 'Mid-level',
  industry: 'Technology',
  interviewTypes: ['behavioral', 'technical'],
  totalQuestions: 10,
  personality: null,
  voice: null,
  interviewerName: null,
  advancedSettings: {
    skillFocus: [],
    language: 'en',
    realTimeFeedback: false,
    followUpQuestions: true,
    recordSession: true,
    practiceMode: false,
    difficulty: 'medium',
  },
};

const LiveInterviewSession = () => {
  const navigate = useNavigate();
  const { user, logout, status } = useAuth();
  const viewportConfig = { once: true, amount: 0.2 };
  const sectionReveal = {
    hidden: { opacity: 0, y: 48 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.65, ease: 'easeOut' }
    }
  };
  const fadeUpChild = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: 'easeOut' }
    }
  };
  const [searchParams] = useSearchParams();
  // Support both ?interviewId= and ?id= (practice flow uses interviewId)
  const interviewId = useRef(
    searchParams.get('interviewId') || searchParams.get('id') || `interview_${Date.now()}`
  );
  const snapshotIntervalRef = useRef(null);
  const datasetCollectorRef = useRef(null);
  const analyticsDataRef = useRef({ collectedData: [], interviewId: null });
  const mediaStreamRef = useRef(null);
  const emotionVideoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const hasInitializedInterviewRef = useRef(false);
  const screenShareStreamRef = useRef(null);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [sessionNotice, setSessionNotice] = useState('');
  const [activeInterviewConfig, setActiveInterviewConfig] = useState(DEFAULT_INTERVIEW_CONFIG);
  const [screenShareStream, setScreenShareStream] = useState(null);

  useEffect(() => {
    if (!sessionNotice || isUploadingRecording) return undefined;
    const timeoutId = setTimeout(() => setSessionNotice(''), 5000);
    return () => clearTimeout(timeoutId);
  }, [sessionNotice, isUploadingRecording]);

  // Explicit recording consent (FR2). Restore from session so refresh doesn't re-prompt.
  const [recordingConsentGiven, setRecordingConsentGiven] = useState(() => {
    try {
      const id = searchParams.get('interviewId') || searchParams.get('id') || '';
      if (!id) return false;
      const stored = sessionStorage.getItem(`recording_consent_${id}`);
      if (!stored) return false;
      const parsed = JSON.parse(stored);
      return Boolean(parsed?.recordingConsentGivenAt);
    } catch {
      return false;
    }
  });

  // Configurable multimodal: nonverbal (body language) feedback only when enabled (2.7.3 defensible feedback).
  const [nonverbalFeedbackEnabled, setNonverbalFeedbackEnabled] = useState(true);
  useEffect(() => {
    let unsubSettings = null;
    let cancelled = false;

    const fetchPublicConfigFallback = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const response = await fetch(`${API_URL}/api/public/config`);
        const data = await response.json();
        if (!cancelled && data.success && typeof data.nonverbalFeedbackEnabled === 'boolean') {
          setNonverbalFeedbackEnabled(data.nonverbalFeedbackEnabled);
        }
      } catch {
        // Keep default enabled if config cannot be fetched
      }
    };

    try {
      if (realtimeDb) {
        const settingsRef = realtimeRef(realtimeDb, 'public/systemSettings');
        unsubSettings = onValue(
          settingsRef,
          (snapshot) => {
            const data = snapshot.val();
            if (!cancelled && data && typeof data.nonverbalFeedbackEnabled === 'boolean') {
              setNonverbalFeedbackEnabled(data.nonverbalFeedbackEnabled);
              return;
            }
            void fetchPublicConfigFallback();
          },
          () => {
            void fetchPublicConfigFallback();
          },
        );
      } else {
        void fetchPublicConfigFallback();
      }
    } catch {
      void fetchPublicConfigFallback();
    }

    return () => {
      cancelled = true;
      if (typeof unsubSettings === 'function') {
        unsubSettings();
      }
    };
  }, []);

  // AI Interviewer Hook
  const {
    initializeInterview,
    sendIntroduction,
    sendAnswer,
    askQuestion,
    endInterview: concludeAIInterview,
    currentMessage,
    phase: interviewPhase,
    isProcessing: isAIProcessing,
    isSpeaking: isAISpeaking,
    isListening: isAIListening,
    currentTranscript,
    canCandidateSpeak,
    conversationHistory,
    questionsAsked,
    totalQuestions: aiTotalQuestions,
    currentScore,
    startListening,
    stopListening,
    whisperAvailable,
    isTranscribing,
    clearConversation,
  } = useAIInterviewer();
  
  const [sessionState, setSessionState] = useState({
    isActive: false,
    isPaused: false,
    isRecording: true,
    sessionDuration: 0,
    currentQuestion: 0,
    totalQuestions: 20,
    questionType: 'behavioral'
  });

  const [videoState, setVideoState] = useState({
    isVideoEnabled: true,
    isAudioEnabled: true,
    isMuted: false,
    isVideoOff: false
  });

  const [aiState, setAiState] = useState({
    currentAnswer: ""
  });

  const [screenShareState, setScreenShareState] = useState({
    isScreenSharing: false,
    isWhiteboardActive: false
  });

  const [poseMetrics, setPoseMetrics] = useState({
    posture: 'good',
    postureScore: 100,
    headPosition: 'centered',
    eyeContact: 'good',
    confidence: 85,
    slouching: false,
    fidgeting: false,
    lastUpdated: null,
  });

  const poseMetricsRef = useRef(poseMetrics);
  const lastRealtimeEventRef = useRef('');

  useEffect(() => {
    poseMetricsRef.current = poseMetrics;
  }, [poseMetrics]);

  const advancedSettings = activeInterviewConfig?.advancedSettings || DEFAULT_INTERVIEW_CONFIG.advancedSettings;
  const realTimeFeedbackEnabled = Boolean(advancedSettings?.realTimeFeedback);
  const practiceModeEnabled = Boolean(advancedSettings?.practiceMode);
  const interviewTypes = Array.isArray(activeInterviewConfig?.interviewTypes) && activeInterviewConfig.interviewTypes.length > 0
    ? activeInterviewConfig.interviewTypes
    : DEFAULT_INTERVIEW_CONFIG.interviewTypes;
  const effectiveTotalQuestions = Math.max(aiTotalQuestions || sessionState?.totalQuestions || 0, 1);
  const estimatedTimeRemaining = Math.max((effectiveTotalQuestions - Math.max(questionsAsked, 0)) * 3, 0);

  const getQuestionCategoryProgress = useCallback(() => {
    const types = interviewTypes;
    const total = effectiveTotalQuestions;
    const completed = Math.min(Math.max(questionsAsked, 0), total);
    const base = Math.floor(total / types.length);
    let remainder = total % types.length;
    let remainingCompleted = completed;

    return types.map((type) => {
      const bucketTotal = base + (remainder > 0 ? 1 : 0);
      remainder = Math.max(remainder - 1, 0);
      const bucketCompleted = Math.min(remainingCompleted, bucketTotal);
      remainingCompleted = Math.max(remainingCompleted - bucketCompleted, 0);

      return {
        type,
        completed: bucketCompleted,
        total: bucketTotal,
      };
    });
  }, [interviewTypes, effectiveTotalQuestions, questionsAsked]);

  const getNextQuestionType = useCallback(() => {
    if (!interviewTypes.length) return sessionState?.questionType || 'general';
    const index = Math.max(questionsAsked, 0) % interviewTypes.length;
    return interviewTypes[index] || sessionState?.questionType || 'general';
  }, [interviewTypes, questionsAsked, sessionState?.questionType]);

  // Initialize AI interviewer only after explicit recording consent.
  useEffect(() => {
    if (!recordingConsentGiven || hasInitializedInterviewRef.current) return;
    hasInitializedInterviewRef.current = true;

    const loadInterviewConfig = async () => {
      try {
        const configStr = localStorage.getItem('interviewConfig');
        const parsedConfig = configStr ? JSON.parse(configStr) : {};
        const idFromUrl = interviewId.current;
        let backendInterview = null;
        if (isBackendInterviewId(idFromUrl)) {
          try {
            const interviewResponse = await apiClient.interviews.getById(idFromUrl);
            backendInterview = interviewResponse?.interview || null;
          } catch (fetchError) {
            console.warn('Unable to load backend interview config, falling back to local config.', fetchError);
          }
        }

        const backendStoredConfig = backendInterview?.config && typeof backendInterview.config === 'object'
          ? backendInterview.config
          : {};
        const resolvedDuration = Math.max(
          Number(
            backendInterview?.duration
            || parsedConfig?.duration
            || parsedConfig?.sessionDuration
            || DEFAULT_INTERVIEW_CONFIG.totalQuestions * 3,
          ) || 30,
          15,
        );
        const resolvedInterviewTypes = Array.isArray(backendInterview?.interviewTypes) && backendInterview.interviewTypes.length > 0
          ? backendInterview.interviewTypes
          : (
            Array.isArray(parsedConfig?.interviewTypes) && parsedConfig.interviewTypes.length > 0
              ? parsedConfig.interviewTypes
              : DEFAULT_INTERVIEW_CONFIG.interviewTypes
          );
        const resolvedSkillFocus = Array.isArray(backendInterview?.skillFocus)
          ? backendInterview.skillFocus
          : (
            Array.isArray(parsedConfig?.skillFocus)
              ? parsedConfig.skillFocus
              : (Array.isArray(parsedConfig?.advancedSettings?.skillFocus)
                ? parsedConfig.advancedSettings.skillFocus
                : [])
          );
        const mergedAdvancedSettings = {
          ...DEFAULT_INTERVIEW_CONFIG.advancedSettings,
          ...(parsedConfig?.advancedSettings || {}),
          ...(backendStoredConfig?.advancedSettings || {}),
        };
        const resolvedTotalQuestions = Array.isArray(backendInterview?.questions) && backendInterview.questions.length > 0
          ? backendInterview.questions.length
          : Math.max(
            Number(
              parsedConfig?.totalQuestions
              || Math.floor(resolvedDuration / 3)
              || DEFAULT_INTERVIEW_CONFIG.totalQuestions,
            ) || DEFAULT_INTERVIEW_CONFIG.totalQuestions,
            1,
          );

        const config = {
          ...DEFAULT_INTERVIEW_CONFIG,
          ...parsedConfig,
          jobRole: backendInterview?.jobRole || parsedConfig?.jobRole || DEFAULT_INTERVIEW_CONFIG.jobRole,
          experienceLevel: backendInterview?.experienceLevel || parsedConfig?.experienceLevel || DEFAULT_INTERVIEW_CONFIG.experienceLevel,
          industry: backendInterview?.industry || parsedConfig?.industry || DEFAULT_INTERVIEW_CONFIG.industry,
          interviewTypes: resolvedInterviewTypes,
          skillFocus: resolvedSkillFocus,
          duration: resolvedDuration,
          totalQuestions: resolvedTotalQuestions,
          personality: backendStoredConfig?.personality ?? parsedConfig?.personality ?? DEFAULT_INTERVIEW_CONFIG.personality,
          voice: backendStoredConfig?.voice ?? parsedConfig?.voice ?? DEFAULT_INTERVIEW_CONFIG.voice,
          interviewerName: backendStoredConfig?.interviewerName ?? parsedConfig?.interviewerName ?? DEFAULT_INTERVIEW_CONFIG.interviewerName,
          advancedSettings: mergedAdvancedSettings,
          interviewId: isBackendInterviewId(idFromUrl)
            ? idFromUrl
            : (parsedConfig?.interviewId || idFromUrl),
        };

        localStorage.setItem('interviewConfig', JSON.stringify(config));

        // GAP: Save prep notes to first question when we have questions (e.g. after start or from lobby)
        const prepNotes = parsedConfig?.prepNotes || '';
        if (
          idFromUrl &&
          isBackendInterviewId(idFromUrl) &&
          prepNotes.trim() &&
          Array.isArray(backendInterview?.questions) &&
          backendInterview.questions.length > 0
        ) {
          try {
            await apiClient.interviews.saveQuestionNotes(
              idFromUrl,
              backendInterview.questions[0].id,
              prepNotes.trim()
            );
          } catch (saveNotesErr) {
            console.warn('Could not save prep notes to question:', saveNotesErr);
          }
        }

        await initializeInterview(config);
        setActiveInterviewConfig(config);

        datasetCollectorRef.current = new InterviewDatasetCollector({
          ...config,
          interviewId: interviewId.current,
          sessionId: `session_${Date.now()}`,
        });

        setSessionState((prev) => ({
          ...prev,
          isActive: true,
          isPaused: false,
          totalQuestions: config.totalQuestions || 10,
          currentQuestion: 0,
          questionType: config.interviewTypes?.[0] || 'behavioral',
          isRecording: config?.advancedSettings?.recordSession ?? true,
        }));
      } catch (error) {
        console.error('Failed to initialize AI interviewer:', error);
        hasInitializedInterviewRef.current = false;
        setSessionNotice('Unable to initialize interview. Please refresh and try again.');
      }
    };

    void loadInterviewConfig();
  }, [recordingConsentGiven]);

  // Realtime interview lifecycle synchronization for backend interviews.
  useEffect(() => {
    if (!realtimeDb || !isBackendInterviewId(interviewId.current)) {
      return undefined;
    }

    const lastEventRef = realtimeRef(realtimeDb, `sessions/${interviewId.current}/lastEvent`);
    const unsubscribe = onValue(
      lastEventRef,
      (snapshot) => {
        const event = snapshot.val();
        if (!event || !event.eventType) return;

        const eventKey = `${event.eventType}:${event.timestamp || ''}`;
        if (lastRealtimeEventRef.current === eventKey) {
          return;
        }
        lastRealtimeEventRef.current = eventKey;

        if (event.eventType === 'interview-started') {
          setSessionState((prev) => ({
            ...prev,
            isActive: true,
            isPaused: false,
          }));
          return;
        }

        if (event.eventType === 'question-asked') {
          setSessionState((prev) => ({
            ...prev,
            currentQuestion: Math.min(
              (prev?.currentQuestion || 0) + 1,
              prev?.totalQuestions || (prev?.currentQuestion || 0) + 1,
            ),
          }));
          return;
        }

        if (event.eventType === 'interview-ended') {
          setSessionState((prev) => (
            prev?.isActive ? { ...prev, isActive: false, isPaused: false } : prev
          ));
        }
      },
      () => {
        // Fail open if realtime session updates are unavailable.
      },
    );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user?.id]);

  // Session timer
  useEffect(() => {
    let interval;
    if (sessionState?.isActive && !sessionState?.isPaused) {
      interval = setInterval(() => {
        setSessionState(prev => ({
          ...prev,
          sessionDuration: prev?.sessionDuration + 1
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [sessionState?.isActive, sessionState?.isPaused]);

  const handleMediaStreamReady = useCallback((stream) => {
    mediaStreamRef.current = stream || null;
    // Attach stream to hidden video for emotion analysis
    if (stream && emotionVideoRef.current) {
      emotionVideoRef.current.srcObject = stream;
      emotionVideoRef.current.play().catch(() => {});
    }
  }, []);

  const startSessionRecording = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (!stream || typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
      return;
    }

    if (mediaRecorderRef.current?.state === 'recording') return;

    try {
      const preferredTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'audio/webm',
      ];
      const supportedType = preferredTypes.find((type) => window.MediaRecorder.isTypeSupported?.(type));
      const recorder = supportedType
        ? new window.MediaRecorder(stream, { mimeType: supportedType })
        : new window.MediaRecorder(stream);

      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
    } catch (error) {
      console.error('Failed to start session recorder:', error);
    }
  }, []);

  const stopSessionRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return null;

    return new Promise((resolve) => {
      const finalize = () => {
        const chunks = recordingChunksRef.current || [];
        recordingChunksRef.current = [];
        mediaRecorderRef.current = null;
        if (!chunks.length) {
          resolve(null);
          return;
        }
        const blobType = chunks[0]?.type || recorder.mimeType || 'video/webm';
        resolve(new Blob(chunks, { type: blobType }));
      };

      if (recorder.state === 'inactive') {
        finalize();
        return;
      }

      recorder.onstop = finalize;
      recorder.stop();
    });
  }, []);

  useEffect(() => {
    if (recordingConsentGiven && sessionState?.isActive && sessionState?.isRecording) {
      startSessionRecording();
      return;
    }

    if (!sessionState?.isRecording && mediaRecorderRef.current?.state === 'recording') {
      void stopSessionRecording();
    }
  }, [
    recordingConsentGiven,
    sessionState?.isActive,
    sessionState?.isRecording,
    startSessionRecording,
    stopSessionRecording,
  ]);

  useEffect(() => () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        // ignore cleanup errors
      }
    }
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
  }, []);

  useEffect(() => () => {
    const stream = screenShareStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    screenShareStreamRef.current = null;
  }, []);

  const handlePauseSession = () => {
    if (!practiceModeEnabled) {
      setSessionNotice('Pause is disabled unless Practice Mode is enabled in setup.');
      return;
    }
    setSessionState(prev => ({ ...prev, isPaused: true }));
  };

  const handleResumeSession = () => {
    if (!practiceModeEnabled) return;
    setSessionState(prev => ({ ...prev, isPaused: false }));
  };

  const handleEndSession = async () => {
    setSessionState(prev => ({ ...prev, isActive: false }));
    stopScreenShare();
    
    // Stop pose snapshot interval
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
    }

    let recordingBlob = null;
    try {
      recordingBlob = await stopSessionRecording();
    } catch (recordingError) {
      console.error('Failed to stop session recording:', recordingError);
    }
    
    // Conclude AI interview and get summary
    try {
      const interviewSummary = await concludeAIInterview();
      const backendInterview = interviewSummary?.backendInterview || null;
      
      // Store interview summary under both current and legacy keys.
      localStorage.setItem('lastInterviewSummary', JSON.stringify(interviewSummary));
      localStorage.setItem('lastInterviewSession', JSON.stringify(interviewSummary));
      localStorage.setItem('lastInterviewId', String(interviewId.current || ''));

      if (backendInterview?.pendingEvaluation || backendInterview?.llmUnavailable) {
        const pendingMessage = 'AI deep evaluation unavailable right now; session saved, scoring will be completed when the AI service is back online.';
        setSessionNotice(pendingMessage);
        localStorage.setItem('lastInterviewNotice', pendingMessage);
      }

      if (isBackendInterviewId(interviewId.current) && recordingBlob && recordingBlob.size > 0) {
        try {
          if (recordingBlob.size < RECORDING_MIN_BYTES) {
            setSessionNotice('Recording was too short/small to upload. Please ensure camera/mic were active.');
          } else {
            setIsUploadingRecording(true);
            const mimeType = recordingBlob.type || 'video/webm';
            const extension = mimeType.includes('mp4')
              ? 'mp4'
              : mimeType.includes('ogg')
                ? 'ogg'
                : 'webm';
            const recordingFile = new File(
              [recordingBlob],
              `session_${Date.now()}.${extension}`,
              { type: mimeType },
            );
            await apiClient.interviews.uploadRecording(interviewId.current, recordingFile);
          }
        } catch (uploadError) {
          console.error('Failed to upload full-session recording:', uploadError);
          setSessionNotice('Session ended, but recording upload failed.');
        } finally {
          setIsUploadingRecording(false);
        }
      }
      
      // Finalize pose analytics and save to localStorage
      const poseSummary = finalizePoseAnalytics(interviewId.current, {
        sessionDuration: sessionState?.sessionDuration,
        questionsAnswered: questionsAsked,
        totalQuestions: aiTotalQuestions,
      });

      // POST MediaPipe analytics data to backend for calibration
      const analyticsPayload = analyticsDataRef.current;
      if (analyticsPayload?.collectedData?.length > 0) {
        try {
          const avgPosture = analyticsPayload.collectedData.reduce((s, d) => s + (d.scores?.posture || 0), 0) / analyticsPayload.collectedData.length;
          const avgOverall = analyticsPayload.collectedData.reduce((s, d) => s + (d.scores?.overall || 0), 0) / analyticsPayload.collectedData.length;
          await apiClient.datasets.saveAnalytics({
            sessionId: `session_${Date.now()}`,
            interviewId: interviewId.current,
            dataPoints: analyticsPayload.collectedData,
            summary: {
              totalFrames: analyticsPayload.collectedData.length,
              averagePostureScore: Math.round(avgPosture),
              averageOverallScore: Math.round(avgOverall),
              sessionDuration: sessionState?.sessionDuration,
            },
            config: { enablePose: true, enableFace: true, detectionInterval: 100 },
          });
        } catch (analyticsError) {
          console.error('Failed to save analytics dataset:', analyticsError);
        }
      }
      
      // Finalize dataset collection and POST training data to backend
      if (datasetCollectorRef.current) {
        try {
          const collector = datasetCollectorRef.current;
          const conversationTurns = collector.conversationTurns || [];
          const questionAnswerPairs = collector.questionAnswerPairs || [];
          if (conversationTurns.length > 0) {
            const datasetResult = collector.finalizeSession();
            await apiClient.datasets.saveInterview({
              sessionId: datasetResult.sessionId,
              interviewId: interviewId.current,
              config: datasetResult.config,
              conversationTurns,
              questionAnswerPairs,
              trainingData: datasetResult.trainingData || [],
              statistics: datasetResult.statistics,
              summary: datasetResult,
            });
          } else {
            collector.finalizeSession();
          }
        } catch (datasetError) {
          console.error('Failed to save training dataset:', datasetError);
        }
      }

    } catch (error) {
      console.error('Failed to finalize interview:', error);
    }

    // Navigate to results page when we have a backend interview ID, otherwise dashboard
    const id = interviewId.current;
    if (id && isBackendInterviewId(id)) {
      navigate(`/interview-results/${id}`);
    } else {
      navigate('/candidate-dashboard');
    }
  };

  const handleEmergencyExit = () => {
    setSessionState(prev => ({ ...prev, isActive: false }));
    
    // Stop pose snapshot interval
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
    }

    void stopSessionRecording();
    stopScreenShare();
    
    navigate('/candidate-dashboard');
  };

  const handleTechnicalSupport = () => {
    setSessionNotice('For technical support, please contact support@interviewai.pro or refresh your browser.');
    setTimeout(() => setSessionNotice(''), 6000);
  };

  const handleRestartAudio = () => {
    setVideoState((prev) => ({
      ...prev,
      isAudioEnabled: false,
      isMuted: true,
    }));
    setTimeout(() => {
      setVideoState((prev) => ({
        ...prev,
        isAudioEnabled: true,
        isMuted: false,
      }));
    }, 250);
    setSessionNotice('Audio restarted.');
  };

  const handleToggleVideo = () => {
    setVideoState(prev => ({ 
      ...prev, 
      isVideoEnabled: !prev?.isVideoEnabled,
      isVideoOff: prev?.isVideoEnabled  // Fixed: should be the SAME as current state (opposite of new state)
    }));
  };

  const handleToggleAudio = () => {
    setVideoState(prev => ({ 
      ...prev, 
      isAudioEnabled: !prev?.isAudioEnabled,
      isMuted: prev?.isAudioEnabled  // Fixed: should be the SAME as current state (opposite of new state)
    }));
  };

  const handleToggleRecording = () => {
    setSessionState(prev => ({ ...prev, isRecording: !prev?.isRecording }));
  };

  const handleToggleListening = async () => {
    if (isAIListening) {
      // Stop listening and get the transcript (might be async with Whisper)
      const transcript = await stopListening();
      if (transcript && transcript.trim()) {
        await handleAnswerComplete(transcript.trim());
      }
    } else {
      // Start listening
      if (canCandidateSpeak) {
        await startListening();
      } else {
        setSessionNotice('Please wait for the AI interviewer to finish speaking before responding.');
        setTimeout(() => setSessionNotice(''), 3000);
      }
    }
  };

  const handleQuestionComplete = () => {
    // Update session state when moving to next question
    setSessionState(prev => ({
      ...prev,
      currentQuestion: questionsAsked
    }));
  };

  const handleAnswerComplete = async (answer) => {
    try {
      // Store the answer
      setAiState(prev => ({ ...prev, currentAnswer: answer }));
      
      // Determine which phase we're in and send to AI
      if (interviewPhase === 'introduction') {
        const response = await sendIntroduction(answer);
        setSessionState((prev) => ({
          ...prev,
          currentQuestion: response?.questionNumber || 1,
          questionType: response?.questionType || prev?.questionType,
        }));
      } else if (interviewPhase === 'questions') {
        const questionText = currentMessage || '';
        const response = await sendAnswer(answer);

        // Record Q&A pair for training data collection
        if (datasetCollectorRef.current && questionText) {
          datasetCollectorRef.current.addInterviewerMessage(questionText, {
            questionNumber: questionsAsked,
            phase: 'questions',
          });
          datasetCollectorRef.current.addCandidateMessage(answer);
          datasetCollectorRef.current.recordQAPair(
            { text: questionText, type: sessionState?.questionType || 'behavioral' },
            { text: answer },
            {
              score: response?.evaluation?.score ?? null,
              starAnalysis: response?.evaluation?.starAnalysis ?? null,
              strengths: response?.evaluation?.strengths ?? [],
              weaknesses: response?.evaluation?.weaknesses ?? [],
              feedback: response?.evaluation?.feedback ?? '',
            },
          );
        }
        
        // Update session progress
        setSessionState(prev => ({
          ...prev,
          currentQuestion: response?.questionNumber ?? questionsAsked,
          questionType: response?.questionType || prev?.questionType,
        }));
      } else if (interviewPhase === 'candidate_questions') {
        await askQuestion(answer);
      }
    } catch (error) {
      console.error('Failed to process answer:', error);
    }
  };

  const handleFeedbackGenerated = (_feedback) => {
    // Real-time feedback is surfaced via session state
  };

  const stopScreenShare = useCallback(() => {
    const stream = screenShareStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    screenShareStreamRef.current = null;
    setScreenShareStream(null);
    setScreenShareState((prev) => ({
      ...prev,
      isScreenSharing: false,
    }));
  }, []);

  const requestScreenShare = useCallback(async (preferWindow = false) => {
    if (!navigator?.mediaDevices?.getDisplayMedia) {
      throw new Error('Screen sharing is not supported by this browser');
    }

    const constraints = preferWindow
      ? { video: { displaySurface: 'window' }, audio: false }
      : { video: true, audio: false };
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia(constraints);
    } catch (error) {
      if (preferWindow) {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      } else {
        throw error;
      }
    }
    const [videoTrack] = stream.getVideoTracks();
    if (videoTrack) {
      videoTrack.addEventListener('ended', () => {
        stopScreenShare();
      }, { once: true });
    }

    screenShareStreamRef.current = stream;
    setScreenShareStream(stream);
    setScreenShareState((prev) => ({
      ...prev,
      isScreenSharing: true,
    }));
  }, [stopScreenShare]);

  const handleToggleScreenShare = async () => {
    if (screenShareState?.isScreenSharing) {
      stopScreenShare();
      return;
    }

    try {
      await requestScreenShare(false);
    } catch (error) {
      console.error('Failed to start screen sharing:', error);
      setSessionNotice('Unable to start screen sharing.');
      setScreenShareState((prev) => ({
        ...prev,
        isScreenSharing: false,
      }));
    }
  };

  const handleShareWindow = async () => {
    try {
      if (screenShareState?.isScreenSharing) {
        stopScreenShare();
      }
      await requestScreenShare(true);
    } catch (error) {
      console.error('Failed to share specific window:', error);
      setSessionNotice('Unable to share selected window.');
    }
  };

  const handleWhiteboardToggle = (isActive) => {
    setScreenShareState(prev => ({ 
      ...prev, 
      isWhiteboardActive: isActive 
    }));
  };

  const handleClearConversation = useCallback(() => {
    clearConversation();
    setAiState({ currentAnswer: '' });
  }, [clearConversation]);

  const handlePoseMetricsUpdate = (metrics, fullMetrics = null) => {
    setPoseMetrics(metrics);
    
    // Save to session storage for current session tracking
    saveSessionPoseData({
      interviewId: interviewId.current,
      currentMetrics: metrics,
      fullMetrics: fullMetrics,
      lastUpdated: Date.now(),
    });
  };

  const handleRecordingConsentGiven = async (data) => {
    const consentPayload = {
      recordingConsentGivenAt: data.recordingConsentGivenAt,
      recordingConsentVersion: data.recordingConsentVersion,
    };
    const id = interviewId.current;
    if (isBackendInterviewId(id)) {
      try {
        await apiClient.interviews.recordRecordingConsent(id, consentPayload);
      } catch (err) {
        console.error('Failed to persist recording consent to server:', err);
        setSessionNotice('Failed to save recording consent. Please check your connection and try again.');
        return;
      }
    }
    const key = `recording_consent_${id}`;
    sessionStorage.setItem(key, JSON.stringify(consentPayload));
    setRecordingConsentGiven(true);
  };

  // Save pose snapshots every 5 seconds to localStorage
  useEffect(() => {
    const isSessionRunning = sessionState?.isActive && !sessionState?.isPaused;
    if (isSessionRunning) {
      // Clear any existing interval
      if (snapshotIntervalRef.current) {
        clearInterval(snapshotIntervalRef.current);
      }

      // Start saving snapshots every 5 seconds
      snapshotIntervalRef.current = setInterval(() => {
        const latestPoseMetrics = poseMetricsRef.current;
        if (!latestPoseMetrics?.lastUpdated) {
          return;
        }

        savePoseSnapshot(interviewId.current, latestPoseMetrics);
      }, 5000); // Save every 5 seconds
    }

    return () => {
      if (snapshotIntervalRef.current) {
        clearInterval(snapshotIntervalRef.current);
      }
    };
  }, [sessionState?.isActive, sessionState?.isPaused]);

  if (status === 'loading' || !user) {
    return (
      <LoadingState
        title="Preparing your interview room"
        message="Syncing your session, AI interviewer, and live tools."
        variant="fullscreen"
        tone="primary"
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 overflow-hidden transition-colors duration-300">
      <div className="pointer-events-none absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_5%_5%,rgba(59,130,246,0.1),transparent_45%),radial-gradient(circle_at_95%_0%,rgba(147,51,234,0.12),transparent_40%),radial-gradient(circle_at_50%_90%,rgba(56,189,248,0.12),transparent_45%)]" />
      <Header 
        userType="candidate" 
        isAuthenticated
        onLogout={async () => {
          await logout();
          navigate('/login');
        }}
      />
      {/* Spacer for fixed header */}
      <div className="h-14 xs:h-16" />
      {(isUploadingRecording || sessionNotice) && (
        <div className="relative z-20 mx-auto max-w-[1200px] px-3 sm:px-4 mb-3">
          <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-4 py-3 text-sm text-blue-800 dark:text-blue-200">
            {isUploadingRecording
              ? 'Finalizing interview recording upload...'
              : sessionNotice}
          </div>
        </div>
      )}

      {/* Explicit recording consent (FR2) - must agree before interview UI and recording */}
      <AnimatePresence mode="wait">
        {!recordingConsentGiven && (
          <RecordingConsentScreen onConsentGiven={handleRecordingConsentGiven} />
        )}
      </AnimatePresence>

      {/* Interview UI only after consent */}
      {recordingConsentGiven && (
        <>
      {/* Responsive Interview Layout */}
      <motion.main
        variants={sectionReveal}
        initial="hidden"
        whileInView="visible"
        viewport={viewportConfig}
        className="relative z-10 mx-auto max-w-[1800px] px-2 xs:px-3 sm:px-4 md:px-5 lg:px-6 py-3 xs:py-4 md:py-6 pb-24 lg:pb-6"
      >
        
        {/* Desktop Layout (3 columns) */}
        <motion.div
          variants={fadeUpChild}
          className="hidden lg:grid lg:grid-cols-12 gap-3 xl:gap-4"
        >
          {/* Left Column - AI Interviewer & Controls */}
          <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-3 xl:gap-4">
            <AIInterviewerPanel
              isActive={sessionState?.isActive}
              currentQuestion={currentMessage}
              isSpeaking={isAISpeaking}
              isProcessing={isAIProcessing}
              interviewerName={activeInterviewConfig?.interviewerName}
              questionProgress={{
                currentQuestion: questionsAsked,
                totalQuestions: aiTotalQuestions
              }}
            />
            <SessionControlPanel
              sessionDuration={sessionState?.sessionDuration}
              isPaused={sessionState?.isPaused}
              isRecording={sessionState?.isRecording}
              questionsAsked={questionsAsked}
              totalQuestions={aiTotalQuestions || sessionState?.totalQuestions}
              canPause={practiceModeEnabled}
              onPause={handlePauseSession}
              onResume={handleResumeSession}
              onEndSession={handleEndSession}
              onTechnicalSupport={handleTechnicalSupport}
              onRestartAudio={handleRestartAudio}
              onEmergencyExit={handleEmergencyExit}
            />
          </div>

          {/* Center Column - Video & Transcription */}
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-3 xl:gap-4">
            <CandidateVideoFeed
              isVideoEnabled={videoState?.isVideoEnabled}
              isAudioEnabled={videoState?.isAudioEnabled}
              onToggleVideo={handleToggleVideo}
              onToggleAudio={handleToggleAudio}
              onPoseMetricsUpdate={handlePoseMetricsUpdate}
              onMediaStreamReady={handleMediaStreamReady}
              enablePoseDetection={nonverbalFeedbackEnabled}
              interviewId={interviewId.current}
              analyticsDataRef={analyticsDataRef}
            />
            <div className="flex-1 min-h-[400px]">
              <TranscriptionPanel
                isListening={isAIListening}
                isAudioEnabled={videoState?.isAudioEnabled}
                isSpeaking={isAISpeaking}
                isProcessing={isAIProcessing}
                currentQuestion={currentMessage}
                conversationHistory={conversationHistory}
                currentTranscript={currentTranscript}
                canCandidateSpeak={canCandidateSpeak}
                whisperAvailable={whisperAvailable}
                isTranscribing={isTranscribing}
                onToggleListening={handleToggleListening}
                onAnswerComplete={handleAnswerComplete}
                onClearConversation={handleClearConversation}
                className="h-full"
              />
            </div>
          </div>

          {/* Right Column - Progress & Feedback */}
          <div className="lg:col-span-3 xl:col-span-3 flex flex-col gap-3 xl:gap-4">
            <QuestionProgressIndicator
              currentQuestion={questionsAsked}
              totalQuestions={aiTotalQuestions}
              estimatedTimeRemaining={estimatedTimeRemaining}
              questionType={sessionState?.questionType}
              categoryProgress={getQuestionCategoryProgress()}
              nextQuestionType={getNextQuestionType()}
            />
            {nonverbalFeedbackEnabled && <PoseAnalysisPanel poseMetrics={poseMetrics} className="flex-shrink-0" />}
            {/* Hidden video for emotion analysis */}
            <video ref={emotionVideoRef} muted playsInline className="hidden" />
            <EmotionDetector
              videoRef={emotionVideoRef}
              interviewId={interviewId.current}
              isActive={!!(sessionState?.isActive && !sessionState?.isPaused)}
              onUpdate={(summary) => { if (analyticsDataRef.current) analyticsDataRef.current.emotionSummary = summary; }}
            />
            <div className="flex-1 min-h-[300px]">
              <RealTimeFeedbackPanel
                isActive={sessionState?.isActive}
                currentAnswer={aiState?.currentAnswer}
                currentQuestion={currentMessage}
                onFeedbackGenerated={handleFeedbackGenerated}
                interviewId={interviewId.current}
                difficulty={advancedSettings?.difficulty || 'medium'}
                enabled={realTimeFeedbackEnabled}
                className="h-full"
              />
            </div>
            <ScreenSharingPanel
              isScreenSharing={screenShareState?.isScreenSharing}
              onToggleScreenShare={handleToggleScreenShare}
              onShareWindow={handleShareWindow}
              onWhiteboardToggle={handleWhiteboardToggle}
              screenShareStream={screenShareStream}
            />
          </div>
        </motion.div>

        {/* Tablet Layout (2 columns) */}
        <motion.div
          variants={fadeUpChild}
          className="hidden md:grid lg:hidden md:grid-cols-12 gap-2 xs:gap-3"
        >
          {/* Left Column - 7 cols */}
          <div className="md:col-span-7 flex flex-col gap-2 xs:gap-3">
            <AIInterviewerPanel
              isActive={sessionState?.isActive}
              currentQuestion={currentMessage}
              isSpeaking={isAISpeaking}
              isProcessing={isAIProcessing}
              interviewerName={activeInterviewConfig?.interviewerName}
              questionProgress={{
                currentQuestion: questionsAsked,
                totalQuestions: aiTotalQuestions
              }}
            />
            <div className="flex-1 min-h-[300px] xs:min-h-[350px]">
              <TranscriptionPanel
                isListening={isAIListening}
                isAudioEnabled={videoState?.isAudioEnabled}
                isSpeaking={isAISpeaking}
                isProcessing={isAIProcessing}
                currentQuestion={currentMessage}
                conversationHistory={conversationHistory}
                currentTranscript={currentTranscript}
                canCandidateSpeak={canCandidateSpeak}
                whisperAvailable={whisperAvailable}
                isTranscribing={isTranscribing}
                onToggleListening={handleToggleListening}
                onAnswerComplete={handleAnswerComplete}
                onClearConversation={handleClearConversation}
                className="h-full"
              />
            </div>
            <SessionControlPanel
              sessionDuration={sessionState?.sessionDuration}
              isPaused={sessionState?.isPaused}
              isRecording={sessionState?.isRecording}
              questionsAsked={questionsAsked}
              totalQuestions={aiTotalQuestions || sessionState?.totalQuestions}
              canPause={practiceModeEnabled}
              onPause={handlePauseSession}
              onResume={handleResumeSession}
              onEndSession={handleEndSession}
              onTechnicalSupport={handleTechnicalSupport}
              onRestartAudio={handleRestartAudio}
              onEmergencyExit={handleEmergencyExit}
            />
          </div>

          {/* Right Column - 5 cols */}
          <div className="md:col-span-5 flex flex-col gap-3">
            <CandidateVideoFeed
              isVideoEnabled={videoState?.isVideoEnabled}
              isAudioEnabled={videoState?.isAudioEnabled}
              onToggleVideo={handleToggleVideo}
              onToggleAudio={handleToggleAudio}
              onPoseMetricsUpdate={handlePoseMetricsUpdate}
              onMediaStreamReady={handleMediaStreamReady}
              enablePoseDetection={nonverbalFeedbackEnabled}
              interviewId={interviewId.current}
              analyticsDataRef={analyticsDataRef}
            />
            <QuestionProgressIndicator
              currentQuestion={questionsAsked}
              totalQuestions={aiTotalQuestions}
              estimatedTimeRemaining={estimatedTimeRemaining}
              questionType={sessionState?.questionType}
              categoryProgress={getQuestionCategoryProgress()}
              nextQuestionType={getNextQuestionType()}
            />
            {nonverbalFeedbackEnabled && <PoseAnalysisPanel poseMetrics={poseMetrics} className="flex-shrink-0" />}
            <div className="flex-1 min-h-[250px]">
              <RealTimeFeedbackPanel
                isActive={sessionState?.isActive}
                currentAnswer={aiState?.currentAnswer}
                currentQuestion={currentMessage}
                onFeedbackGenerated={handleFeedbackGenerated}
                interviewId={interviewId.current}
                difficulty={advancedSettings?.difficulty || 'medium'}
                enabled={realTimeFeedbackEnabled}
                className="h-full"
              />
            </div>
          </div>
        </motion.div>

        {/* Mobile Layout (Single Column) */}
        <motion.div
          variants={fadeUpChild}
          className="md:hidden flex flex-col gap-2 xs:gap-3"
        >
          {/* Question Display - Priority 1 */}
          <AIInterviewerPanel
            isActive={sessionState?.isActive}
            currentQuestion={currentMessage}
            isSpeaking={isAISpeaking}
            isProcessing={isAIProcessing}
            interviewerName={activeInterviewConfig?.interviewerName}
            onQuestionComplete={handleQuestionComplete}
            questionProgress={{
              currentQuestion: sessionState?.currentQuestion,
              totalQuestions: sessionState?.totalQuestions
            }}
          />

          {/* Compact Progress Bar */}
          <QuestionProgressIndicator
            currentQuestion={questionsAsked}
            totalQuestions={aiTotalQuestions}
            estimatedTimeRemaining={estimatedTimeRemaining}
            questionType={sessionState?.questionType}
            categoryProgress={getQuestionCategoryProgress()}
            nextQuestionType={getNextQuestionType()}
          />

          {/* Video Feed - Compact */}
          <CandidateVideoFeed
            isVideoEnabled={videoState?.isVideoEnabled}
            isAudioEnabled={videoState?.isAudioEnabled}
            onToggleVideo={handleToggleVideo}
            onToggleAudio={handleToggleAudio}
            onPoseMetricsUpdate={handlePoseMetricsUpdate}
            onMediaStreamReady={handleMediaStreamReady}
            enablePoseDetection={nonverbalFeedbackEnabled}
            interviewId={interviewId.current}
            analyticsDataRef={analyticsDataRef}
          />

          {/* Pose Analysis Panel - Mobile */}
          {nonverbalFeedbackEnabled && <PoseAnalysisPanel poseMetrics={poseMetrics} />}

          {/* Transcription Panel */}
          <div className="min-h-[220px] xs:min-h-[280px]">
            <TranscriptionPanel
              isListening={isAIListening}
              isAudioEnabled={videoState?.isAudioEnabled}
              isSpeaking={isAISpeaking}
              isProcessing={isAIProcessing}
              currentQuestion={currentMessage}
              conversationHistory={conversationHistory}
              currentTranscript={currentTranscript}
              canCandidateSpeak={canCandidateSpeak}
              whisperAvailable={whisperAvailable}
              isTranscribing={isTranscribing}
              onToggleListening={handleToggleListening}
              onAnswerComplete={handleAnswerComplete}
              onClearConversation={handleClearConversation}
              className="h-full"
            />
          </div>

          {/* Feedback Panel */}
          <div className="min-h-[160px] xs:min-h-[200px]">
            <RealTimeFeedbackPanel
              isActive={sessionState?.isActive}
              currentAnswer={aiState?.currentAnswer}
              currentQuestion={currentMessage}
              onFeedbackGenerated={handleFeedbackGenerated}
              interviewId={interviewId.current}
              difficulty={advancedSettings?.difficulty || 'medium'}
              enabled={realTimeFeedbackEnabled}
              className="h-full"
            />
          </div>

          {/* Session Controls - Mobile Optimized */}
          <SessionControlPanel
            sessionDuration={sessionState?.sessionDuration}
            isPaused={sessionState?.isPaused}
            isRecording={sessionState?.isRecording}
            questionsAsked={questionsAsked}
            totalQuestions={aiTotalQuestions || sessionState?.totalQuestions}
            canPause={practiceModeEnabled}
            onPause={handlePauseSession}
            onResume={handleResumeSession}
            onEndSession={handleEndSession}
            onTechnicalSupport={handleTechnicalSupport}
            onRestartAudio={handleRestartAudio}
            onEmergencyExit={handleEmergencyExit}
          />
        </motion.div>
      </motion.main>      {/* Floating Session Controls - Hidden on mobile to avoid overlap */}
      <div className="hidden md:block">
        <InterviewSessionControls
          isActive={sessionState?.isActive}
          isRecording={sessionState?.isRecording}
          isMuted={videoState?.isMuted}
          isVideoOff={videoState?.isVideoOff}
          sessionDuration={sessionState?.sessionDuration}
          onToggleRecording={handleToggleRecording}
          onToggleMute={handleToggleAudio}
          onToggleVideo={handleToggleVideo}
          onEndSession={handleEndSession}
          onEmergencyExit={handleEmergencyExit}
        />
      </div>
        </>
      )}
    </div>
  );
};

export default LiveInterviewSession;
