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
import InterviewAnalyticsPanel from '../../components/ui/InterviewAnalyticsPanel';
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

const isBackendInterviewId = (id) => Boolean(id && !/^interview_\d+$/.test(id));
const RECORDING_MIN_BYTES = Math.max(
  1024,
  Number.parseInt(import.meta.env.VITE_RECORDING_MIN_BYTES || '51200', 10) || 51200,
);

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
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [sessionNotice, setSessionNotice] = useState('');

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
    error: aiError
  } = useAIInterviewer();
  
  const [sessionState, setSessionState] = useState({
    isActive: true,
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
    isSpeaking: false,
    currentQuestion: "",
    isListening: true,
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

  // Full analytics metrics (including face-mesh data)
  const [analyticsMetrics, setAnalyticsMetrics] = useState(null);
  const poseMetricsRef = useRef(poseMetrics);
  const lastRealtimeEventRef = useRef('');

  useEffect(() => {
    poseMetricsRef.current = poseMetrics;
  }, [poseMetrics]);

  // Initialize AI Interviewer when component mounts
  useEffect(() => {
    const loadInterviewConfig = async () => {
      try {
        // Load interview configuration from localStorage
        const configStr = localStorage.getItem('interviewConfig');
        const config = configStr ? JSON.parse(configStr) : {
          jobRole: 'Software Engineer',
          company: 'Tech Company',
          experienceLevel: 'Mid-level',
          industry: 'Technology',
          totalQuestions: 10
        };

        // Add interviewId to config if available from URL
        const idFromUrl = interviewId.current;
        if (isBackendInterviewId(idFromUrl)) {
          config.interviewId = idFromUrl;
        }

        // Initialize the AI interviewer
        await initializeInterview(config);
        
        // Update session state with AI config
        setSessionState(prev => ({
          ...prev,
          totalQuestions: config.totalQuestions || 10
        }));
      } catch (error) {
        console.error('Failed to initialize AI interviewer:', error);
      }
    };

    loadInterviewConfig();
  }, []);

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

  const handlePauseSession = () => {
    setSessionState(prev => ({ ...prev, isPaused: true }));
  };

  const handleResumeSession = () => {
    setSessionState(prev => ({ ...prev, isPaused: false }));
  };

  const handleEndSession = async () => {
    setSessionState(prev => ({ ...prev, isActive: false }));
    
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
      
      // Store interview summary
      localStorage.setItem('lastInterviewSummary', JSON.stringify(interviewSummary));

      if (backendInterview?.pendingEvaluation || backendInterview?.llmUnavailable) {
        const pendingMessage = 'AI scoring unavailable; session saved, scoring pending.';
        setSessionNotice(pendingMessage);
        localStorage.setItem('lastInterviewNotice', pendingMessage);
        window.alert(pendingMessage);
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
      
      console.log('Interview completed:', { interviewSummary, poseSummary });
    } catch (error) {
      console.error('Failed to finalize interview:', error);
    }
    
    // Navigate to feedback/results page
    navigate('/candidate-dashboard');
  };

  const handleEmergencyExit = () => {
    setSessionState(prev => ({ ...prev, isActive: false }));
    
    // Stop pose snapshot interval
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
    }

    void stopSessionRecording();
    
    navigate('/candidate-dashboard');
  };

  const handleTechnicalSupport = () => {
    // Open technical support modal or chat
    console.log('Technical support requested');
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
        console.log('Please wait for AI to finish speaking');
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
        await sendIntroduction(answer);
      } else if (interviewPhase === 'questions') {
        const response = await sendAnswer(answer);
        
        // Update session progress
        setSessionState(prev => ({
          ...prev,
          currentQuestion: questionsAsked
        }));
      } else if (interviewPhase === 'candidate_questions') {
        await askQuestion(answer);
      }
    } catch (error) {
      console.error('Failed to process answer:', error);
    }
  };

  const handleFeedbackGenerated = (feedback) => {
    // Handle feedback from real-time analysis
    console.log('Feedback generated:', feedback);
  };

  const handleToggleScreenShare = () => {
    setScreenShareState(prev => ({ 
      ...prev, 
      isScreenSharing: !prev?.isScreenSharing 
    }));
  };

  const handleWhiteboardToggle = (isActive) => {
    setScreenShareState(prev => ({ 
      ...prev, 
      isWhiteboardActive: isActive 
    }));
  };

  const handlePoseMetricsUpdate = (metrics, fullMetrics = null) => {
    setPoseMetrics(metrics);
    
    // Update full analytics metrics if provided
    if (fullMetrics) {
      setAnalyticsMetrics(fullMetrics);
    }
    
    // Save to session storage for current session tracking
    saveSessionPoseData({
      interviewId: interviewId.current,
      currentMetrics: metrics,
      fullMetrics: fullMetrics,
      lastUpdated: Date.now(),
    });
  };

  const handleRecordingConsentGiven = async (data) => {
    const key = `recording_consent_${interviewId.current}`;
    sessionStorage.setItem(key, JSON.stringify({
      recordingConsentGivenAt: data.recordingConsentGivenAt,
      recordingConsentVersion: data.recordingConsentVersion,
    }));
    const id = interviewId.current;
    if (isBackendInterviewId(id)) {
      try {
        await apiClient.interviews.recordRecordingConsent(id, {
          recordingConsentGivenAt: data.recordingConsentGivenAt,
          recordingConsentVersion: data.recordingConsentVersion,
        });
      } catch (err) {
        console.error('Failed to persist recording consent to server:', err);
      }
    }
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

        const saved = savePoseSnapshot(interviewId.current, latestPoseMetrics);
        if (saved) {
          console.log('Pose snapshot saved to localStorage');
        }
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

      {/* Explicit recording consent (FR2) – must agree before interview UI and recording */}
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
              questionProgress={{
                currentQuestion: questionsAsked,
                totalQuestions: aiTotalQuestions
              }}
            />
            <SessionControlPanel
              sessionDuration={sessionState?.sessionDuration}
              isPaused={sessionState?.isPaused}
              isRecording={sessionState?.isRecording}
              onPause={handlePauseSession}
              onResume={handleResumeSession}
              onEndSession={handleEndSession}
              onTechnicalSupport={handleTechnicalSupport}
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
                className="h-full"
              />
            </div>
          </div>

          {/* Right Column - Progress & Feedback */}
          <div className="lg:col-span-3 xl:col-span-3 flex flex-col gap-3 xl:gap-4">
            <QuestionProgressIndicator
              currentQuestion={questionsAsked}
              totalQuestions={aiTotalQuestions}
              estimatedTimeRemaining={15}
              questionType={sessionState?.questionType}
            />
            {nonverbalFeedbackEnabled && <PoseAnalysisPanel poseMetrics={poseMetrics} className="flex-shrink-0" />}
            <div className="flex-1 min-h-[300px]">
              <RealTimeFeedbackPanel
                isActive={sessionState?.isActive}
                currentAnswer={aiState?.currentAnswer}
                currentQuestion={currentMessage}
                onFeedbackGenerated={handleFeedbackGenerated}
                className="h-full"
              />
            </div>
            <ScreenSharingPanel
              isScreenSharing={screenShareState?.isScreenSharing}
              onToggleScreenShare={handleToggleScreenShare}
              onWhiteboardToggle={handleWhiteboardToggle}
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
                className="h-full"
              />
            </div>
            <SessionControlPanel
              sessionDuration={sessionState?.sessionDuration}
              isPaused={sessionState?.isPaused}
              isRecording={sessionState?.isRecording}
              onPause={handlePauseSession}
              onResume={handleResumeSession}
              onEndSession={handleEndSession}
              onTechnicalSupport={handleTechnicalSupport}
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
            />
            <QuestionProgressIndicator
              currentQuestion={questionsAsked}
              totalQuestions={aiTotalQuestions}
              estimatedTimeRemaining={15}
              questionType={sessionState?.questionType}
            />
            {nonverbalFeedbackEnabled && <PoseAnalysisPanel poseMetrics={poseMetrics} className="flex-shrink-0" />}
            <div className="flex-1 min-h-[250px]">
              <RealTimeFeedbackPanel
                isActive={sessionState?.isActive}
                currentAnswer={aiState?.currentAnswer}
                currentQuestion={currentMessage}
                onFeedbackGenerated={handleFeedbackGenerated}
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
            onQuestionComplete={handleQuestionComplete}
            interviewConfig={aiState?.interviewConfig}
            questionProgress={{
              currentQuestion: sessionState?.currentQuestion,
              totalQuestions: sessionState?.totalQuestions
            }}
          />

          {/* Compact Progress Bar */}
          <QuestionProgressIndicator
            currentQuestion={questionsAsked}
            totalQuestions={aiTotalQuestions}
            estimatedTimeRemaining={15}
            questionType={sessionState?.questionType}
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
              className="h-full"
            />
          </div>

          {/* Feedback Panel */}
          <div className="min-h-[160px] xs:min-h-[200px]">
            <RealTimeFeedbackPanel
              isActive={sessionState?.isActive}
              currentAnswer={aiState?.currentAnswer}
              currentQuestion={aiState?.currentQuestion}
              onFeedbackGenerated={handleFeedbackGenerated}
              className="h-full"
            />
          </div>

          {/* Session Controls - Mobile Optimized */}
          <SessionControlPanel
            sessionDuration={sessionState?.sessionDuration}
            isPaused={sessionState?.isPaused}
            isRecording={sessionState?.isRecording}
            onPause={handlePauseSession}
            onResume={handleResumeSession}
            onEndSession={handleEndSession}
            onTechnicalSupport={handleTechnicalSupport}
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
