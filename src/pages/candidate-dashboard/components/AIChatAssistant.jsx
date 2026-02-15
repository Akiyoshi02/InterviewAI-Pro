import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import DashboardLiveChatTab from '../../../components/live-chat/DashboardLiveChatTab';
import Button from '../../../components/ui/Button';
import LoadingIndicator from '../../../components/ui/LoadingIndicator';
import useLLM from '../../../hooks/useLLM';
import audioRecorderService from '../../../services/audioRecorderService';
import { transcribeWithFallback } from '../../../services/localWhisperService';
import { isLoadingScreenActive, subscribeLoadingScreen } from '../../../utils/loadingScreenState';
import { FLOATING_BUTTON_MOTION } from '../../../utils/floatingButtonMotion';

const CHAT_SIZE_PRESETS = {
  compact: {
    label: 'Compact',
    shortLabel: 'S',
    container: 'w-80 h-[520px]',
    bodyAssistant: 'text-sm',
    bodyUser: 'text-sm',
    heading2: 'text-base',
    heading3: 'text-xs',
    heading4: 'text-xs',
    messageSpacing: 'space-y-1.5',
    listSpacing: 'space-y-1',
    inputText: 'text-sm',
    statusText: 'text-xs'
  },
  cozy: {
    label: 'Cozy',
    shortLabel: 'M',
    container: 'w-96 h-[600px]',
    bodyAssistant: 'text-sm',
    bodyUser: 'text-sm',
    heading2: 'text-lg',
    heading3: 'text-sm',
    heading4: 'text-xs',
    messageSpacing: 'space-y-2',
    listSpacing: 'space-y-1.5',
    inputText: 'text-base',
    statusText: 'text-xs'
  },
  spacious: {
    label: 'Spacious',
    shortLabel: 'L',
    container: 'w-[30rem] h-[700px]',
    bodyAssistant: 'text-base',
    bodyUser: 'text-base',
    heading2: 'text-xl',
    heading3: 'text-base',
    heading4: 'text-sm',
    messageSpacing: 'space-y-3',
    listSpacing: 'space-y-2',
    inputText: 'text-base',
    statusText: 'text-sm'
  }
};

const AIChatAssistant = ({ 
  isOpen = false,
  onToggle,
  className = ''
}) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingError, setRecordingError] = useState(null);
  const [chatSize, setChatSize] = useState('cozy');
  const [activeTab, setActiveTab] = useState('assistant');
  const [voiceStatus, setVoiceStatus] = useState('idle');
  const messagesEndRef = useRef(null);
  const loadingScreenActive = useSyncExternalStore(
    subscribeLoadingScreen,
    isLoadingScreenActive,
    isLoadingScreenActive
  );
  
  // OpenAI integration
  const { 
    generateSummary, 
    createStudyPlan, 
    getCareerAssistantResponse,
    loading: aiLoading, 
    error: aiError, 
    clearError 
  } = useLLM();

  const sizeSettings = CHAT_SIZE_PRESETS[chatSize] || CHAT_SIZE_PRESETS.cozy;
  const sizeOptions = Object.entries(CHAT_SIZE_PRESETS);
  const isAssistantTab = activeTab === 'assistant';

  useEffect(() => {
    return () => {
      audioRecorderService?.abort?.();
      setIsRecording(false);
      setIsTranscribing(false);
      setVoiceStatus('idle');
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('ai-assistant-toggle', { detail: { open: isOpen } }));
    return () => {
      window.dispatchEvent(new CustomEvent('ai-assistant-toggle', { detail: { open: false } }));
    };
  }, [isOpen]);

  // Initialize with welcome message
  useEffect(() => {
    if (messages?.length === 0) {
      setMessages([{
        id: 1,
        type: 'assistant',
        content: "Hi! I'm your AI career assistant. I can help you with interview preparation, analyze your recent session performance, create study plans, and answer career-related questions. How can I help you today?",
        timestamp: new Date()
      }]);
    }
  }, [messages?.length]);

  const scrollToBottom = () => {
    messagesEndRef?.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isOpen || !isAssistantTab) return;
    scrollToBottom();
  }, [messages, isOpen, isAssistantTab]);

  const buildConversationHistory = (history = []) => {
    return history
      ?.filter((message) => ['assistant', 'user'].includes(message?.type))
      ?.slice(-12)
      ?.map((message) => ({
        role: message?.type === 'assistant' ? 'assistant' : 'user',
        content: message?.content || ''
      })) || [];
  };

  const getAssistantContext = () => {
    if (typeof window === 'undefined') {
      return { userProfile: {}, recentPerformance: {} };
    }

    try {
      const profile = JSON.parse(window.localStorage.getItem('candidateProfile') || '{}');
      const lastSession = JSON.parse(window.localStorage.getItem('lastInterviewSession') || '{}');
      const feedbackHistory = JSON.parse(window.localStorage.getItem('interviewFeedback') || '[]');
      const latestFeedback = Array.isArray(feedbackHistory) && feedbackHistory.length > 0
        ? feedbackHistory[feedbackHistory.length - 1]
        : null;

      return {
        userProfile: profile || {},
        recentPerformance: {
          lastSession: lastSession || {},
          latestFeedback: latestFeedback || null
        }
      };
    } catch (error) {
      console.warn('AI Assistant context error:', error);
      return { userProfile: {}, recentPerformance: {} };
    }
  };

  // Handle predefined actions
  const handleQuickAction = async (action) => {
    clearError?.();

    const userMessage = {
      id: messages?.length + 1,
      type: 'user', 
      content: getQuickActionText(action),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      let aiResponse = '';
      
      switch (action) {
        case 'analyze_session':
          const sessionData = JSON.parse(localStorage.getItem('lastInterviewSession') || '{}');
          if (Object.keys(sessionData)?.length > 0) {
            const summary = await generateSummary(sessionData);
            aiResponse = formatSessionAnalysis(summary);
          } else {
            aiResponse = "I don't see any recent interview sessions to analyze. Complete an interview session first, and I'll provide detailed feedback on your performance.";
          }
          break;
          
        case 'create_study_plan':
          const feedbackData = JSON.parse(localStorage.getItem('interviewFeedback') || '[]');
          if (feedbackData?.length > 0) {
            const latestFeedback = feedbackData?.[feedbackData?.length - 1];
            const studyPlan = await createStudyPlan({
              weaknesses: latestFeedback?.feedback?.areasForImprovement || [],
              jobRole: 'Software Engineer',
              experienceLevel: 'Mid-Level',
              targetCompanies: ['Google', 'Microsoft', 'Amazon']
            });
            aiResponse = formatStudyPlan(studyPlan);
          } else {
            aiResponse = "I need some performance data to create a personalized study plan. Complete an interview session first, and I'll analyze your responses to recommend specific areas for improvement.";
          }
          break;
          
        case 'interview_tips':
          aiResponse = `Here are some key interview tips based on best practices:

**Before the Interview:**
• Research the company and role thoroughly
• Practice common behavioral questions using the STAR method
• Prepare specific examples from your experience
• Review technical concepts relevant to the position

**During the Interview:**
• Listen carefully to each question before responding
• Structure your answers clearly with concrete examples
• Ask thoughtful questions about the role and company
• Maintain good eye contact and confident body language

**Technical Interviews:**
• Think out loud when solving problems
• Start with clarifying questions
• Consider edge cases and error handling
• Explain your thought process step by step

Would you like me to elaborate on any of these areas?`;
          break;
          
        default:
          aiResponse = "I'm here to help with interview preparation and career guidance. What specific area would you like to focus on?";
      }

      // Simulate typing delay
      setTimeout(() => {
        const assistantMessage = {
          id: messages?.length + 2,
          type: 'assistant',
          content: aiResponse,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        setIsTyping(false);
      }, 1000 + Math.random() * 2000);
      
    } catch (error) {
      console.error('AI Assistant Error:', error);
      setIsTyping(false);
      
      const errorMessage = {
        id: messages?.length + 2,
        type: 'assistant',
        content: "I'm sorry, I encountered an error while processing your request. Please try again or ask a different question.",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleSendMessage = async (overrideText = null) => {
    if (isTyping || aiLoading) return;
    if (isTranscribing && !overrideText) return;

    const messageContent = (overrideText ?? inputValue)?.trim();
    if (!messageContent) return;

    clearError?.();

    const userMessage = {
      id: messages?.length + 1,
      type: 'user',
      content: messageContent,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setIsTyping(true);

    try {
      const { userProfile, recentPerformance } = getAssistantContext();
      const aiResponse = await getCareerAssistantResponse({
        conversation: buildConversationHistory(updatedMessages),
        userProfile,
        recentPerformance
      });
      
      const assistantMessage = {
        id: updatedMessages?.length + 1,
        type: 'assistant',
        content: aiResponse || "I'm still processing that request. Could you rephrase or provide more detail?",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI Assistant Error:', error);
      const errorMessage = {
        id: updatedMessages?.length + 1,
        type: 'assistant',
        content: "I ran into an issue generating a response. Please ensure your local AI service (Ollama) is running and try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const stopRecordingAndTranscribe = async () => {
    setRecordingError(null);
    try {
      setVoiceStatus('transcribing');
      const audioBlob = await audioRecorderService.stop();
      setIsRecording(false);

      if (!audioBlob || audioBlob.size === 0) {
        setRecordingError('I could not capture any audio. Please try again.');
        setVoiceStatus('idle');
        return;
      }

      setIsTranscribing(true);
      const transcription = await transcribeWithFallback(audioBlob, { language: 'en' });
      const transcriptText = transcription?.text?.trim()
        || transcription?.segments?.map((segment) => segment?.text || '').join(' ').trim();

      if (transcriptText) {
        if (inputValue?.trim()) {
          setInputValue(prev => `${prev} ${transcriptText}`.trim());
          setVoiceStatus('idle');
        } else {
          setVoiceStatus('processing');
          await handleSendMessage(transcriptText);
          setVoiceStatus('idle');
        }
      } else {
        setRecordingError('I did not catch that. Could you try again?');
        setVoiceStatus('idle');
      }
    } catch (error) {
      console.error('Voice input error:', error);
      setRecordingError(error?.message || 'Transcription failed. Please try again.');
      setVoiceStatus('idle');
    } finally {
      setIsRecording(false);
      setIsTranscribing(false);
      if (!isTyping) {
        setVoiceStatus('idle');
      }
    }
  };

  const handleMicClick = async () => {
    if (isTranscribing) return;

    if (isRecording) {
      await stopRecordingAndTranscribe();
      return;
    }

    setRecordingError(null);

    try {
      const started = await audioRecorderService.start();
      if (started) {
        setIsRecording(true);
        setVoiceStatus('recording');
      } else {
        setRecordingError('Microphone unavailable. Please check your permissions.');
        setVoiceStatus('idle');
      }
    } catch (error) {
      console.error('Microphone access error:', error);
      setRecordingError(error?.message || 'Unable to access microphone.');
      setIsRecording(false);
      setVoiceStatus('idle');
    }
  };

  const getQuickActionText = (action) => {
    switch (action) {
      case 'analyze_session': return 'Analyze my recent interview session performance';
      case 'create_study_plan': return 'Create a personalized study plan for me';
      case 'interview_tips': return 'Give me general interview tips and best practices';
      default: return '';
    }
  };

  const formatSessionAnalysis = (summary) => {
    return `## Interview Session Analysis

**Overall Score:** ${summary?.overallScore || 0}/100 (${summary?.readinessLevel || 'Assessment Pending'})

**Key Strengths:**
${summary?.strengths?.map(s => `• ${s}`)?.join('\n') || '• Analysis in progress...'}

**Areas for Improvement:**
${summary?.weaknesses?.map(w => `• ${w}`)?.join('\n') || '• Analysis in progress...'}

**Recommendations:**
${summary?.recommendations?.map(r => `• ${r}`)?.join('\n') || '• Analysis in progress...'}

**Next Steps:**
${summary?.nextSteps?.map(s => `• ${s}`)?.join('\n') || '• Analysis in progress...'}

${summary?.detailedFeedback || 'Complete analysis will be available after your next session.'}`;
  };

  const formatStudyPlan = (plan) => {
    return `## Personalized Study Plan

**30-Day Focus:**
• ${plan?.thirtyDayPlan?.focus || 'Foundation building and core concepts review'}
• ${plan?.thirtyDayPlan?.activities || 'Daily practice sessions and concept reinforcement'}

**60-Day Objectives:**
• ${plan?.sixtyDayPlan?.focus || 'Advanced topics and mock interviews'}
• ${plan?.sixtyDayPlan?.activities || 'System design practice and behavioral preparation'}

**90-Day Goals:**
• ${plan?.ninetyDayPlan?.focus || 'Interview readiness and confidence building'}
• ${plan?.ninetyDayPlan?.activities || 'Company-specific preparation and final assessments'}

**Recommended Resources:**
${plan?.resources?.slice(0, 3)?.map(r => `• ${r?.title || 'Resource'}: ${r?.description || 'Comprehensive preparation material'}`)?.join('\n') || '• Curated learning materials based on your needs'}

This plan is tailored to your current skill level and target companies. Would you like me to elaborate on any specific area?`;
  };

  const formatTime = (timestamp) => {
    return timestamp?.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderInlineFormatting = (text = '', type = 'assistant') => {
    if (!text) return null;

    const pattern = /(\*\*[^*]+\*\*|__[^_]+__|_[^_]+_|`[^`]+`)/g;
    const segments = [];
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
      }

      const token = match[0];
      if (token.startsWith('**')) {
        segments.push({ type: 'bold', value: token.slice(2, -2) });
      } else if (token.startsWith('__')) {
        segments.push({ type: 'underline', value: token.slice(2, -2) });
      } else if (token.startsWith('_')) {
        segments.push({ type: 'italic', value: token.slice(1, -1) });
      } else if (token.startsWith('`')) {
        segments.push({ type: 'code', value: token.slice(1, -1) });
      }
      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < text.length) {
      segments.push({ type: 'text', value: text.slice(lastIndex) });
    }

    return segments.map((segment, index) => {
      const key = `${segment.type}-${type}-${index}`;
      const baseColor = type === 'user' ? 'text-white' : 'text-slate-900 dark:text-slate-100';

      switch (segment.type) {
        case 'bold':
          return (
            <span key={key} className={`${baseColor} font-semibold`}>
              {segment.value}
            </span>
          );
        case 'italic':
          return (
            <span key={key} className={`${baseColor} italic`}>
              {segment.value}
            </span>
          );
        case 'underline':
          return (
            <span key={key} className={`${baseColor} underline decoration-dashed decoration-2`}>
              {segment.value}
            </span>
          );
        case 'code':
          return (
            <code
              key={key}
              className={`font-mono text-xs px-1.5 py-0.5 rounded border ${
                type === 'user'
                  ? 'bg-white/20 border-white/20 text-white'
                  : 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
              }`}
            >
              {segment.value}
            </code>
          );
        default:
          return (
            <span key={key} className={type === 'user' ? 'text-white' : 'text-slate-800 dark:text-slate-100'}>
              {segment.value}
            </span>
          );
      }
    });
  };

  const renderMessageContent = (content = '', type = 'assistant', sizeProfile = sizeSettings) => {
    const currentSize = sizeProfile || sizeSettings;
    const lines = content.split('\n');
    const blocks = [];
    let currentList = null;

    const headingBase = type === 'user'
      ? {
          2: 'font-semibold text-white',
          3: 'font-semibold text-white/90 uppercase tracking-wide',
          4: 'font-semibold text-white/80'
        }
      : {
          2: 'font-semibold text-slate-900 dark:text-slate-100',
          3: 'font-semibold text-blue-600 dark:text-blue-300 uppercase tracking-wide',
          4: 'font-semibold text-slate-500 dark:text-slate-400'
        };

    const bodyColor = type === 'user'
      ? 'text-white/90'
      : 'text-slate-700 dark:text-slate-200';

    const bodySize = type === 'user' ? currentSize.bodyUser : currentSize.bodyAssistant;
    const paragraphClass = `${bodySize} leading-relaxed ${bodyColor}`;
    const listSpacing = currentSize.listSpacing || 'space-y-1.5';

    const flushList = () => {
      if (!currentList || currentList.items.length === 0) return;
      const ListTag = currentList.type === 'ol' ? 'ol' : 'ul';
      blocks.push(
        <ListTag
          key={`list-${blocks.length}`}
          className={`${currentList.type === 'ol' ? 'list-decimal' : 'list-disc'} pl-5 ${listSpacing} ${bodySize} ${bodyColor}`}
        >
          {currentList.items.map((item, idx) => (
            <li key={`list-item-${blocks.length}-${idx}`}>
              {renderInlineFormatting(item, type)}
            </li>
          ))}
        </ListTag>
      );
      currentList = null;
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      if (!trimmed) {
        flushList();
        blocks.push(<div key={`spacer-${idx}`} className="h-2" aria-hidden="true" />);
        return;
      }

      const headingMatch = trimmed.match(/^(#{2,4})\s+(.*)$/);
      if (headingMatch) {
        flushList();
        const level = headingMatch[1].length;
        const headingText = headingMatch[2];
        const sizeClass = currentSize[`heading${level}`] || currentSize.heading2 || '';
        const headingClass = `${sizeClass} ${headingBase[level] || ''} leading-snug`;

        blocks.push(
          <p key={`heading-${idx}`} className={headingClass}>
            {renderInlineFormatting(headingText, type)}
          </p>
        );
        return;
      }

      const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
      if (bulletMatch) {
        if (!currentList || currentList.type !== 'ul') {
          flushList();
          currentList = { type: 'ul', items: [] };
        }
        currentList.items.push(bulletMatch[1]);
        return;
      }

      const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
      if (orderedMatch) {
        if (!currentList || currentList.type !== 'ol') {
          flushList();
          currentList = { type: 'ol', items: [] };
        }
        currentList.items.push(orderedMatch[1]);
        return;
      }

      flushList();
      blocks.push(
        <p
          key={`paragraph-${idx}`}
          className={paragraphClass}
        >
          {renderInlineFormatting(trimmed, type)}
        </p>
      );
    });

    flushList();
    return blocks;
  };

  const micButtonDisabled = !isRecording && (aiLoading || isTyping || isTranscribing || voiceStatus === 'processing');
  const micStatusMessage = {
    recording: 'Listening... tap the mic again to send your question.',
    transcribing: 'Transcribing with Whisper...',
    processing: 'Sending your question to the assistant...'
  }[voiceStatus] || null;
  const { initial, animate, transition } = FLOATING_BUTTON_MOTION;

  if (loadingScreenActive) {
    return null;
  }

  if (!isOpen) {
    return (
      <motion.button
        onClick={onToggle}
        className="fixed bottom-20 lg:bottom-8 right-4 lg:right-6 w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl shadow-blue-500/40 hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center z-50"
        initial={initial}
        animate={animate}
        transition={transition}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Icon name="MessageCircle" size={24} />
      </motion.button>
    );
  }

  return (
    <div className={`fixed bottom-20 lg:bottom-8 right-4 lg:right-6 ${sizeSettings.container} max-w-[calc(100vw-2rem)] max-h-[calc(100vh-8rem)] lg:max-h-[700px] rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur shadow-[0_30px_80px_rgba(15,23,42,0.3)] dark:shadow-[0_30px_80px_rgba(0,0,0,0.6)] z-50 flex flex-col overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/30 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <Icon name={isAssistantTab ? 'Bot' : 'MessageCircle'} size={16} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">
              {isAssistantTab ? 'AI Career Assistant' : 'Live Chat'}
            </h3>
            <p className="text-xs text-white/80">
              {isAssistantTab ? (isTyping ? 'Typing...' : 'Online') : 'We typically reply fast'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-white/10 rounded-full px-1 py-0.5">
            {sizeOptions.map(([sizeKey, preset]) => (
              <button
                key={sizeKey}
                type="button"
                onClick={() => setChatSize(sizeKey)}
                title={`${preset.label} chat size`}
                aria-label={`${preset.label} chat size`}
                className={`text-xs font-semibold px-2 py-0.5 rounded-full border border-white/20 transition ${
                  chatSize === sizeKey
                    ? 'bg-white/40 text-blue-900 shadow-sm'
                    : 'text-white/80 hover:bg-white/20'
                }`}
              >
                {preset.shortLabel}
              </button>
            ))}
        </div>
        
        <Button variant="ghost" size="icon" onClick={onToggle} className="text-white hover:text-white">
          <Icon name="X" size={16} color="white" />
        </Button>
        </div>
      </div>
      <div className="px-4 py-2 border-b border-white/30 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/70">
        <div className="flex items-center justify-center">
          <div className="flex items-center space-x-1 rounded-full bg-white/80 dark:bg-slate-800/80 border border-white/40 dark:border-slate-700/60 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('assistant')}
              className={`text-xs font-semibold px-3 py-1 rounded-full transition ${
                isAssistantTab
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/80'
              }`}
              aria-pressed={isAssistantTab}
            >
              AI Assistant
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`text-xs font-semibold px-3 py-1 rounded-full transition ${
                !isAssistantTab
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/80'
              }`}
              aria-pressed={!isAssistantTab}
            >
              Live Chat
            </button>
          </div>
        </div>
      </div>
      {isAssistantTab ? (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white/60 dark:bg-slate-900/60">
            {messages?.map((message) => (
              <div
                key={message?.id}
                className={`flex ${message?.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] rounded-lg p-3 ${
                  message?.type === 'user'
                    ?'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                    :'bg-white dark:bg-slate-800 border border-white/40 dark:border-slate-700/50 text-gray-800 dark:text-slate-200 shadow-sm'
                }`}>
                  <div className={sizeSettings.messageSpacing}>
                    {renderMessageContent(message?.content || '', message?.type, sizeSettings)}
                  </div>
                  <div className={`text-xs mt-2 ${
                    message?.type === 'user' ? 'text-white/80' : 'text-gray-400 dark:text-slate-500'
                  }`}>
                    {formatTime(message?.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-muted text-foreground rounded-lg p-3">
                  <div className="flex space-x-1">
                    {[...Array(3)]?.map((_, i) => (
                      <div
                        key={i}
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.2}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          {/* Quick Actions */}
          <div className="p-4 border-t border-border dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/80">
            <div className="grid grid-cols-1 gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                iconName="TrendingUp"
                iconPosition="left"
                onClick={() => handleQuickAction('analyze_session')}
                disabled={isTyping || aiLoading}
                className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
              >
                Analyze Session
              </Button>
              <Button
                variant="outline"
                size="sm"
                iconName="BookOpen"
                iconPosition="left"
                onClick={() => handleQuickAction('create_study_plan')}
                disabled={isTyping || aiLoading}
                className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
              >
                Study Plan
              </Button>
              <Button
                variant="outline"
                size="sm"
                iconName="Lightbulb"
                iconPosition="left"
                onClick={() => handleQuickAction('interview_tips')}
                disabled={isTyping || aiLoading}
                className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
              >
                Interview Tips
              </Button>
            </div>

            {/* Message Input */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e?.target?.value)}
                onKeyPress={(e) => e?.key === 'Enter' && handleSendMessage()}
                placeholder="Ask me anything..."
                className={`flex-1 px-3 py-2 border border-white/40 dark:border-slate-700/60 rounded-full ${sizeSettings.inputText} bg-white/80 dark:bg-slate-800/80 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500`}
                disabled={isTyping || aiLoading || isTranscribing}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleMicClick}
                disabled={micButtonDisabled}
                aria-pressed={isRecording}
                aria-label={isRecording ? 'Stop recording' : 'Record a question'}
                className={`rounded-full border border-white/40 dark:border-slate-700/60 backdrop-blur text-blue-600 dark:text-blue-300 hover:text-purple-500 dark:hover:text-purple-300 transition ${
                  isRecording
                    ? 'bg-red-600 text-white shadow-lg shadow-red-500/40 animate-pulse'
                    : ''
                }`}
              >
                {isTranscribing ? (
                  <LoadingIndicator size={18} tone="current" />
                ) : (
                  <Icon name={isRecording ? 'Square' : 'Mic'} size={18} />
                )}
              </Button>
              <Button
                size="sm"
                iconName="Send"
                onClick={handleSendMessage}
                disabled={!inputValue?.trim() || isTyping || aiLoading || isTranscribing}
                className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white border-none shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
              />
            </div>
            {micStatusMessage && (
              <p className={`mt-2 ${sizeSettings.statusText} text-blue-600 dark:text-blue-300`}>
                {micStatusMessage}
              </p>
            )}
            {recordingError && (
              <p className={`mt-2 ${sizeSettings.statusText} text-amber-500 dark:text-amber-400`}>
                {recordingError}
              </p>
            )}
            {aiError && (
              <p className={`mt-2 ${sizeSettings.statusText} text-red-500`}>
                {aiError}
              </p>
            )}
          </div>
        </>
      ) : (
        <DashboardLiveChatTab sizeSettings={sizeSettings} isActive={isOpen} />
      )}
    </div>
  );
};

export default AIChatAssistant;
