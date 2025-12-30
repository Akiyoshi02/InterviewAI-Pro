import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { useAuth } from '../../contexts/AuthContext.jsx';
import { 
  savePoseSnapshot, 
  finalizePoseAnalytics,
  saveSessionPoseData 
} from '../../services/poseAnalyticsStorage';
import { useAIInterviewer } from '../../hooks/useAIInterviewer';

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
  const interviewId = useRef(searchParams.get('id') || `interview_${Date.now()}`);
  const snapshotIntervalRef = useRef(null);
  
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
        if (idFromUrl && idFromUrl !== `interview_${Date.now()}`) {
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
    
    // Conclude AI interview and get summary
    try {
      const interviewSummary = await concludeAIInterview();
      
      // Store interview summary
      localStorage.setItem('lastInterviewSummary', JSON.stringify(interviewSummary));
      
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

  const handlePoseMetricsUpdate = (metrics) => {
    setPoseMetrics(metrics);
    
    // Save to session storage for current session tracking
    saveSessionPoseData({
      interviewId: interviewId.current,
      currentMetrics: metrics,
      lastUpdated: Date.now(),
    });
  };

  // Save pose snapshots every 5 seconds to localStorage
  useEffect(() => {
    if (sessionState?.isActive && !sessionState?.isPaused && poseMetrics?.lastUpdated) {
      // Clear any existing interval
      if (snapshotIntervalRef.current) {
        clearInterval(snapshotIntervalRef.current);
      }

      // Start saving snapshots every 5 seconds
      snapshotIntervalRef.current = setInterval(() => {
        const saved = savePoseSnapshot(interviewId.current, poseMetrics);
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
  }, [sessionState?.isActive, sessionState?.isPaused, poseMetrics]);

  if (status === 'loading' || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading your session...</p>
        </div>
      </div>
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
              enablePoseDetection={true}
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
            <PoseAnalysisPanel poseMetrics={poseMetrics} className="flex-shrink-0" />
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
              enablePoseDetection={true}
            />
            <QuestionProgressIndicator
              currentQuestion={questionsAsked}
              totalQuestions={aiTotalQuestions}
              estimatedTimeRemaining={15}
              questionType={sessionState?.questionType}
            />
            <PoseAnalysisPanel poseMetrics={poseMetrics} className="flex-shrink-0" />
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
            enablePoseDetection={true}
          />

          {/* Pose Analysis Panel - Mobile */}
          <PoseAnalysisPanel poseMetrics={poseMetrics} />

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
    </div>
  );
};

export default LiveInterviewSession;