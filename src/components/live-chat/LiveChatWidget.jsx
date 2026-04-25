import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ref,
  push,
  onValue,
  query,
  orderByChild,
  limitToLast,
  serverTimestamp,
  update,
  set,
} from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, authHelpers, realtimeDb } from '../../config/firebase.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Button from '../ui/Button.jsx';
import LoadingIndicator from '../ui/LoadingIndicator.jsx';
import Icon from '../AppIcon.jsx';
import { useToast } from '../ui/Toast.jsx';
import { useLLM } from '../../hooks/useLLM.js';
import { FLOATING_BUTTON_MOTION } from '../../utils/floatingButtonMotion';
import audioRecorderService from '../../services/audioRecorderService.js';
import { transcribeWithFallback } from '../../services/localWhisperService.js';
import LiveChatUnavailableState from './LiveChatUnavailableState.jsx';
import { getSupportContactEmail } from '../../constants/support.js';

const CHAT_ROOT = 'liveChats';
const CHAT_SESSION_KEY = 'liveChatSessionId';
const CHAT_NAME_KEY = 'liveChatDisplayName';
const CHAT_NAME_OVERRIDE_KEY = 'liveChatDisplayNameOverride';
const CHAT_LAST_ACCOUNT_TYPE_KEY = 'liveChatLastAccountType';
const MAX_MESSAGE_LENGTH = 1000;
const CHAT_SIZE_PRESETS = {
  compact: {
    label: 'Compact',
    shortLabel: 'S',
    container: 'w-80 h-[520px]',
    bodyAssistant: 'text-[13px]',
    bodyUser: 'text-[13px]',
    heading2: 'text-[16px]',
    heading3: 'text-xs',
    heading4: 'text-[11px]',
    messageSpacing: 'space-y-1.5',
    listSpacing: 'space-y-1',
    inputText: 'text-sm',
    statusText: 'text-[11px]'
  },
  cozy: {
    label: 'Cozy',
    shortLabel: 'M',
    container: 'w-96 h-[600px]',
    bodyAssistant: 'text-[14px]',
    bodyUser: 'text-[14px]',
    heading2: 'text-lg',
    heading3: 'text-sm',
    heading4: 'text-xs',
    messageSpacing: 'space-y-2',
    listSpacing: 'space-y-1.5',
    inputText: 'text-[15px]',
    statusText: 'text-xs'
  },
  spacious: {
    label: 'Spacious',
    shortLabel: 'L',
    container: 'w-[30rem] h-[700px]',
    bodyAssistant: 'text-[15px]',
    bodyUser: 'text-[15px]',
    heading2: 'text-xl',
    heading3: 'text-base',
    heading4: 'text-sm',
    messageSpacing: 'space-y-3',
    listSpacing: 'space-y-2',
    inputText: 'text-base',
    statusText: 'text-sm'
  }
};

const PUBLIC_ASSISTANT_QUICK_ACTIONS = [
  {
    key: 'platform_overview',
    label: 'Platform Overview',
    icon: 'BrandBrain',
    prompt: 'Give me a quick overview of InterviewAI Pro for candidates and companies.'
  },
  {
    key: 'get_started',
    label: 'Getting Started',
    icon: 'Rocket',
    prompt: 'How do I get started on InterviewAI Pro as a candidate or a company?'
  },
  {
    key: 'support_access',
    label: 'Support & Access',
    icon: 'LifeBuoy',
    prompt: 'I need help with account access or support. What should I do?'
  }
];

const getStorageValue = (key, fallback = '', storageType = 'session') => {
  if (typeof window === 'undefined') return fallback;
  const storage = storageType === 'local' ? window.localStorage : window.sessionStorage;
  return storage.getItem(key) || fallback;
};

const setStorageValue = (key, value, storageType = 'session') => {
  if (typeof window === 'undefined') return;
  const storage = storageType === 'local' ? window.localStorage : window.sessionStorage;
  storage.setItem(key, value);
};

const clearStorageValue = (key, storageType = 'session') => {
  if (typeof window === 'undefined') return;
  const storage = storageType === 'local' ? window.localStorage : window.sessionStorage;
  storage.removeItem(key);
};

const getCompanyName = (user) =>
  user?.companyName ||
  user?.organizationContext?.organization?.displayName ||
  user?.organizationContext?.organization?.name ||
  '';

const getAccountDisplayName = (user) => {
  if (!user) return '';
  const baseName = user.fullName || user.email || 'InterviewAI Member';
  const accountType = (user.accountType || '').toUpperCase();
  if (accountType === 'COMPANY') {
    const company = getCompanyName(user);
    return company ? `${baseName} - ${company}` : baseName;
  }
  return baseName;
};

const formatTimestamp = (value) => {
  if (!value) return '';
  const timestamp = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(timestamp)) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const shouldHideOnRoute = (pathname) => {
  const hiddenPrefixes = [
    '/candidate-',
    '/company-',
    '/system-admin-dashboard',
    '/live-interview-session',
    '/interview-lobby',
    '/login',
    '/register',
    '/accept-team-invite',
    '/reset-password',
    '/verify-email',
    '/onboarding',
  ];
  return hiddenPrefixes.some((prefix) => pathname.startsWith(prefix));
};

const LiveChatWidget = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { error: showError, success: showSuccess } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState(getStorageValue(CHAT_SESSION_KEY, ''));
  const [chatStatus, setChatStatus] = useState('open');
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [chatRecording, setChatRecording] = useState(false);
  const [chatTranscribing, setChatTranscribing] = useState(false);
  const [chatRecordingError, setChatRecordingError] = useState(null);
  const [chatVoiceStatus, setChatVoiceStatus] = useState('idle');
  const [displayName, setDisplayName] = useState(getStorageValue(CHAT_NAME_KEY, '', 'local'));
  const [nameDraft, setNameDraft] = useState(displayName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameOverride, setNameOverride] = useState(getStorageValue(CHAT_NAME_OVERRIDE_KEY, '', 'local') === 'true');
  const [chatSize, setChatSize] = useState('cozy');
  const [activeTab, setActiveTab] = useState('chat');
  const [assistantMessages, setAssistantMessages] = useState([]);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantTyping, setAssistantTyping] = useState(false);
  const [assistantRecording, setAssistantRecording] = useState(false);
  const [assistantTranscribing, setAssistantTranscribing] = useState(false);
  const [assistantRecordingError, setAssistantRecordingError] = useState(null);
  const [assistantVoiceStatus, setAssistantVoiceStatus] = useState('idle');
  const messagesEndRef = useRef(null);
  const assistantMessagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const guestNameInputRef = useRef(null);
  const suggestionsTimerRef = useRef(null);
  const lastSuggestionKeyRef = useRef('');
  const [suggestions, setSuggestions] = useState([]);
  const lastAccountTypeRef = useRef(getStorageValue(CHAT_LAST_ACCOUNT_TYPE_KEY, 'ANONYMOUS', 'local'));
  const { getChatSuggestions, loading: suggestionsLoading } = useLLM();
  const {
    getWebsiteAssistantResponse,
    loading: assistantLoading,
    error: assistantError,
    clearError: clearAssistantError
  } = useLLM();
  const canStartChat = Boolean((nameDraft || guestNameInputRef.current?.value || '').trim());
  const sizeSettings = CHAT_SIZE_PRESETS[chatSize] || CHAT_SIZE_PRESETS.cozy;
  const sizeOptions = Object.entries(CHAT_SIZE_PRESETS);
  const { initial, animate, exit, transition } = FLOATING_BUTTON_MOTION;
  const isAssistantTab = activeTab === 'assistant';
  const assistantMicDisabled = !assistantRecording
    && (assistantLoading || assistantTyping || assistantTranscribing || assistantVoiceStatus === 'processing');
  const assistantMicStatusMessage = {
    recording: 'Listening... tap the mic again to send your question.',
    transcribing: 'Transcribing with Whisper...',
    processing: 'Sending your question to the assistant...'
  }[assistantVoiceStatus] || null;
  const chatMicDisabled = !chatRecording
    && (
      isLoading
      || chatTranscribing
      || chatVoiceStatus === 'processing'
      || assistantRecording
      || assistantTranscribing
    );
  const chatMicStatusMessage = {
    recording: 'Listening... tap the mic again to send your message.',
    transcribing: 'Transcribing with Whisper...',
    processing: 'Sending your message...'
  }[chatVoiceStatus] || null;

  const accountDisplayName = useMemo(() => getAccountDisplayName(user), [user]);
  const accountType = (user?.accountType || 'ANONYMOUS').toUpperCase();
  const isRealtimeChatAvailable = Boolean(realtimeDb);
  const isLiveChatVisible = !shouldHideOnRoute(location.pathname) && accountType !== 'SYSTEM_ADMIN';

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const isPanelOpen = isLiveChatVisible && isOpen;
    window.dispatchEvent(new CustomEvent('live-chat-toggle', { detail: { open: isPanelOpen } }));
    return () => {
      window.dispatchEvent(new CustomEvent('live-chat-toggle', { detail: { open: false } }));
    };
  }, [isLiveChatVisible, isOpen]);

  useEffect(() => {
    const normalizedAccountType = accountType || 'ANONYMOUS';
    const previousAccountType = lastAccountTypeRef.current || 'ANONYMOUS';
    const hasAccountName = Boolean(accountDisplayName);
    const accountTypeChanged = normalizedAccountType !== previousAccountType;

    if (normalizedAccountType === 'SYSTEM_ADMIN') {
      lastAccountTypeRef.current = normalizedAccountType;
      setStorageValue(CHAT_LAST_ACCOUNT_TYPE_KEY, normalizedAccountType, 'local');
      return;
    }

    if (accountTypeChanged) {
      lastAccountTypeRef.current = normalizedAccountType;
      setStorageValue(CHAT_LAST_ACCOUNT_TYPE_KEY, normalizedAccountType, 'local');
      if (normalizedAccountType !== 'ANONYMOUS' && hasAccountName) {
        setDisplayName(accountDisplayName);
        setNameDraft(accountDisplayName);
        setNameOverride(false);
        setStorageValue(CHAT_NAME_OVERRIDE_KEY, 'false', 'local');
        setStorageValue(CHAT_NAME_KEY, accountDisplayName, 'local');
        if (chatSessionId && realtimeDb) {
          update(ref(realtimeDb, `${CHAT_ROOT}/${chatSessionId}/user`), {
            displayName: accountDisplayName,
            accountType: normalizedAccountType
          }).catch(() => {});
        }
      }
      return;
    }

    if (normalizedAccountType !== 'ANONYMOUS' && hasAccountName && !nameOverride && displayName !== accountDisplayName) {
      setDisplayName(accountDisplayName);
      setNameDraft(accountDisplayName);
      setStorageValue(CHAT_NAME_KEY, accountDisplayName, 'local');
      if (chatSessionId && realtimeDb) {
        update(ref(realtimeDb, `${CHAT_ROOT}/${chatSessionId}/user`), {
          displayName: accountDisplayName,
          accountType: normalizedAccountType
        }).catch(() => {});
      }
    }
  }, [accountDisplayName, accountType, chatSessionId, displayName, nameOverride]);

  useEffect(() => {
    const openHandler = () => setIsOpen(true);
    window.addEventListener('open-live-chat', openHandler);
    return () => window.removeEventListener('open-live-chat', openHandler);
  }, []);

  useEffect(() => {
    return () => {
      audioRecorderService?.abort?.();
    };
  }, []);

  useEffect(() => {
    if (!chatSessionId || !realtimeDb) return;
    const chatRef = ref(realtimeDb, `${CHAT_ROOT}/${chatSessionId}`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      setChatStatus(data.status || 'open');
    });
    return () => unsubscribe();
  }, [chatSessionId]);

  useEffect(() => {
    if (!chatSessionId || !realtimeDb) return;
    const messagesRef = query(
      ref(realtimeDb, `${CHAT_ROOT}/${chatSessionId}/messages`),
      orderByChild('createdAt'),
      limitToLast(50),
    );
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const value = snapshot.val();
      if (!value) {
        setMessages([]);
        return;
      }
      const nextMessages = Object.entries(value)
        .map(([id, message]) => ({ id, ...message }))
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setMessages(nextMessages);
    });
    return () => unsubscribe();
  }, [chatSessionId]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'chat') return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isOpen, activeTab]);

  useEffect(() => {
    if (assistantMessages.length === 0) {
      setAssistantMessages([{
        id: 1,
        type: 'assistant',
        content: "Hi! I'm your AI website assistant for InterviewAI Pro. I can answer questions about the platform, features, and how to get started. How can I help you today?",
        timestamp: Date.now()
      }]);
    }
  }, [assistantMessages.length]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'assistant') return;
    assistantMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [assistantMessages, isOpen, activeTab]);

  const resizeMessageInput = useCallback(() => {
    if (typeof window === 'undefined') return;
    const input = messageInputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    const minHeight = parseFloat(window.getComputedStyle(input).minHeight || '0');
    input.style.height = `${Math.max(input.scrollHeight, minHeight)}px`;
  }, []);

  useEffect(() => {
    if (!isOpen || activeTab !== 'chat') return;
    resizeMessageInput();
  }, [messageDraft, isOpen, activeTab, resizeMessageInput]);

  const conversationForLLM = useMemo(() => (
    messages
      .filter((message) => message?.text)
      .map((message) => ({
        role: message?.sender?.role === 'user' ? 'user' : 'assistant',
        content: message.text
      }))
  ), [messages]);

  const lastMessageRole = messages.length > 0 ? messages[messages.length - 1]?.sender?.role : null;
  const shouldShowSuggestions = messages.length === 0 || lastMessageRole !== 'user';

  const fallbackSuggestions = useMemo(() => ([
    'Hi! I need help getting started with InterviewAI Pro.',
    'Can you guide me on practice interviews or live sessions?',
    'I have a question about accounts or dashboards.'
  ]), []);

  useEffect(() => {
    if (!isOpen || activeTab !== 'chat') return;
    if (!shouldShowSuggestions) {
      setSuggestions([]);
      return;
    }
    const suggestionKey = `${conversationForLLM.length}:${conversationForLLM.map((msg) => `${msg.role}:${msg.content}`).join('|')}`;
    if (suggestionKey === lastSuggestionKeyRef.current) return;
    lastSuggestionKeyRef.current = suggestionKey;

    if (suggestionsTimerRef.current) {
      clearTimeout(suggestionsTimerRef.current);
    }

    suggestionsTimerRef.current = setTimeout(async () => {
      try {
        const result = await getChatSuggestions({
          role: 'visitor',
          audience: accountType,
          conversation: conversationForLLM
        });
        if (result?.suggestions?.length) {
          setSuggestions(result.suggestions);
        } else {
          setSuggestions(fallbackSuggestions);
        }
      } catch (error) {
        setSuggestions(fallbackSuggestions);
      }
    }, 500);

    return () => {
      if (suggestionsTimerRef.current) {
        clearTimeout(suggestionsTimerRef.current);
      }
    };
  }, [conversationForLLM, fallbackSuggestions, getChatSuggestions, isOpen, shouldShowSuggestions, activeTab]);

  const resetSession = useCallback(() => {
    clearStorageValue(CHAT_SESSION_KEY);
    setChatSessionId('');
    setMessages([]);
    setChatStatus('open');
  }, []);

  const ensureAuthUser = useCallback(async () => {
    if (auth.currentUser) return auth.currentUser;
    const currentUser = await new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
        unsubscribe();
        resolve(nextUser);
      });
    });
    if (currentUser) return currentUser;
    const result = await authHelpers.signInAnonymously();
    if (result?.error) {
      throw result.error;
    }
    return auth.currentUser;
  }, []);

  const ensureChatSession = useCallback(async (overrideName = '') => {
    if (!isRealtimeChatAvailable) {
      throw new Error(`Live chat is unavailable right now. Please email ${getSupportContactEmail()}.`);
    }
    if (chatSessionId) return chatSessionId;

    const trimmedName = (overrideName || displayName).trim();
    if (!trimmedName) {
      throw new Error('Please enter your name to start the chat.');
    }

    const authUser = await ensureAuthUser();
    const chatRef = push(ref(realtimeDb, CHAT_ROOT));
    const companyName = accountType === 'COMPANY' ? getCompanyName(user) : '';

    const payload = {
      status: 'open',
      createdAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      lastMessagePreview: 'Session started',
      user: {
        uid: authUser.uid,
        displayName: trimmedName,
        accountType,
        email: user?.email || null,
        companyName: companyName || null,
        userId: user?.id || null,
      },
    };

    await set(chatRef, payload);
    const newChatId = chatRef.key;
    setChatSessionId(newChatId);
    setStorageValue(CHAT_SESSION_KEY, newChatId);
    setChatStatus('open');
    return newChatId;
  }, [accountType, chatSessionId, displayName, ensureAuthUser, isRealtimeChatAvailable, user]);

  const updateDisplayName = useCallback(async () => {
    const trimmedName = nameDraft.trim();
    if (!trimmedName) {
      showError('Please enter a valid name.');
      return;
    }
    setDisplayName(trimmedName);
    setStorageValue(CHAT_NAME_KEY, trimmedName, 'local');
    setStorageValue(CHAT_NAME_OVERRIDE_KEY, 'true', 'local');
    setNameOverride(true);
    setIsEditingName(false);

    if (chatSessionId && realtimeDb) {
      await update(ref(realtimeDb, `${CHAT_ROOT}/${chatSessionId}/user`), {
        displayName: trimmedName,
      });
    }
  }, [chatSessionId, nameDraft, showError]);

  const handleStartChat = useCallback(async () => {
    try {
      setIsLoading(true);
      const resolvedName = guestNameInputRef.current?.value || nameDraft;
      const trimmedName = resolvedName.trim();
      if (!trimmedName) {
        showError('Please enter your name to start the chat.');
        return;
      }
      setNameDraft(trimmedName);
      setDisplayName(trimmedName);
      setStorageValue(CHAT_NAME_KEY, trimmedName, 'local');
      setStorageValue(CHAT_NAME_OVERRIDE_KEY, 'true', 'local');
      setNameOverride(true);
      await ensureChatSession(trimmedName);
      showSuccess('Chat session started.');
    } catch (error) {
      showError(error?.message || 'Unable to start chat.');
    } finally {
      setIsLoading(false);
    }
  }, [ensureChatSession, nameDraft, showError, showSuccess]);

  const handleSendMessage = useCallback(async (overrideText = null) => {
    const trimmedMessage = (typeof overrideText === 'string' ? overrideText : messageDraft).trim();
    if (!trimmedMessage) return;
    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      showError(`Message is too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }

    try {
      setIsLoading(true);
      const chatId = await ensureChatSession();
      const authUser = await ensureAuthUser();

      const messageRef = push(ref(realtimeDb, `${CHAT_ROOT}/${chatId}/messages`));
      await set(messageRef, {
        text: trimmedMessage,
        createdAt: serverTimestamp(),
        sender: {
          uid: authUser.uid,
          role: 'user',
          displayName: displayName.trim(),
        },
      });

      await update(ref(realtimeDb, `${CHAT_ROOT}/${chatId}`), {
        lastMessageAt: serverTimestamp(),
        lastMessagePreview: trimmedMessage.slice(0, 160),
        status: 'open',
      });

      setMessageDraft('');
    } catch (error) {
      showError(error?.message || 'Failed to send message.');
    } finally {
      setIsLoading(false);
    }
  }, [displayName, ensureAuthUser, ensureChatSession, messageDraft, showError]);

  const handleEndSession = useCallback(async () => {
    if (!chatSessionId || !realtimeDb) {
      resetSession();
      return;
    }
    try {
      setIsLoading(true);
      await update(ref(realtimeDb, `${CHAT_ROOT}/${chatSessionId}`), {
        status: 'closed',
        closedAt: serverTimestamp(),
      });
      resetSession();
    } catch (error) {
      showError(error?.message || 'Unable to close the session.');
    } finally {
      setIsLoading(false);
    }
  }, [chatSessionId, resetSession, showError]);

  const handleMessageKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestionClick = (text) => {
    setMessageDraft(text);
    requestAnimationFrame(() => {
      resizeMessageInput();
      if (messageInputRef.current) {
        messageInputRef.current.focus();
        const length = messageInputRef.current.value.length;
        messageInputRef.current.setSelectionRange(length, length);
      }
    });
  };

  const stopChatRecordingAndTranscribe = useCallback(async () => {
    setChatRecordingError(null);
    try {
      setChatVoiceStatus('transcribing');
      const audioBlob = await audioRecorderService.stop();
      setChatRecording(false);

      if (!audioBlob || audioBlob.size === 0) {
        setChatRecordingError('I could not capture any audio. Please try again.');
        setChatVoiceStatus('idle');
        return;
      }

      setChatTranscribing(true);
      const transcription = await transcribeWithFallback(audioBlob, { language: 'en' });
      const transcriptText = transcription?.text?.trim()
        || transcription?.segments?.map((segment) => segment?.text || '').join(' ').trim();

      if (transcriptText) {
        if (messageDraft?.trim()) {
          setMessageDraft((prev) => `${prev} ${transcriptText}`.trim());
          setChatVoiceStatus('idle');
          requestAnimationFrame(() => {
            resizeMessageInput();
            if (messageInputRef.current) {
              messageInputRef.current.focus();
              const length = messageInputRef.current.value.length;
              messageInputRef.current.setSelectionRange(length, length);
            }
          });
        } else {
          setChatVoiceStatus('processing');
          await handleSendMessage(transcriptText);
          setChatVoiceStatus('idle');
        }
      } else {
        setChatRecordingError('I did not catch that. Could you try again?');
        setChatVoiceStatus('idle');
      }
    } catch (error) {
      console.error('Live chat voice input error:', error);
      setChatRecordingError(error?.message || 'Transcription failed. Please try again.');
      setChatVoiceStatus('idle');
    } finally {
      setChatRecording(false);
      setChatTranscribing(false);
      setChatVoiceStatus('idle');
    }
  }, [handleSendMessage, messageDraft, resizeMessageInput]);

  const handleChatMicClick = useCallback(async () => {
    if (chatTranscribing) return;

    if (chatRecording) {
      await stopChatRecordingAndTranscribe();
      return;
    }

    setChatRecordingError(null);

    try {
      const started = await audioRecorderService.start();
      if (started) {
        setChatRecording(true);
        setChatVoiceStatus('recording');
      } else {
        setChatRecordingError('Microphone unavailable. Please check your permissions.');
        setChatVoiceStatus('idle');
      }
    } catch (error) {
      console.error('Live chat microphone access error:', error);
      setChatRecordingError(error?.message || 'Unable to access microphone.');
      setChatRecording(false);
      setChatVoiceStatus('idle');
    }
  }, [chatRecording, chatTranscribing, stopChatRecordingAndTranscribe]);

  const buildAssistantConversation = useCallback((history = []) => (
    history
      .filter((message) => ['assistant', 'user'].includes(message?.type))
      .slice(-12)
      .map((message) => ({
        role: message?.type === 'assistant' ? 'assistant' : 'user',
        content: message?.content || ''
      }))
  ), []);

  const renderAssistantInlineFormatting = (text = '', type = 'assistant') => {
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

  const renderAssistantMessageContent = (content = '', type = 'assistant', sizeProfile = sizeSettings) => {
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
              {renderAssistantInlineFormatting(item, type)}
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
            {renderAssistantInlineFormatting(headingText, type)}
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
          {renderAssistantInlineFormatting(trimmed, type)}
        </p>
      );
    });

    flushList();
    return blocks;
  };

  const handleAssistantSendMessage = useCallback(async (overrideText = null) => {
    if (assistantTyping || assistantLoading) return;
    if (assistantTranscribing && !overrideText) return;

    const messageContent = (overrideText ?? assistantInput).trim();
    if (!messageContent) return;

    clearAssistantError?.();

    const userMessage = {
      id: assistantMessages.length + 1,
      type: 'user',
      content: messageContent,
      timestamp: Date.now()
    };

    const updatedMessages = [...assistantMessages, userMessage];
    setAssistantMessages(updatedMessages);
    setAssistantInput('');
    setAssistantTyping(true);

    try {
      const aiResponse = await getWebsiteAssistantResponse({
        conversation: buildAssistantConversation(updatedMessages),
        pageContext: location.pathname
      });

      const assistantMessage = {
        id: updatedMessages.length + 1,
        type: 'assistant',
        content: aiResponse || "I'm still processing that request. Could you rephrase or share more detail?",
        timestamp: Date.now()
      };

      setAssistantMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage = {
        id: updatedMessages.length + 1,
        type: 'assistant',
        content: "I ran into an issue generating a response. Please ensure Ollama is running locally with the required models installed. Try running `ollama list` to verify.",
        timestamp: Date.now()
      };
      setAssistantMessages((prev) => [...prev, errorMessage]);
    } finally {
      setAssistantTyping(false);
    }
  }, [
    assistantInput,
    assistantLoading,
    assistantMessages,
    assistantTranscribing,
    assistantTyping,
    buildAssistantConversation,
    clearAssistantError,
    getWebsiteAssistantResponse,
    location.pathname
  ]);

  const stopAssistantRecordingAndTranscribe = useCallback(async () => {
    setAssistantRecordingError(null);
    try {
      setAssistantVoiceStatus('transcribing');
      const audioBlob = await audioRecorderService.stop();
      setAssistantRecording(false);

      if (!audioBlob || audioBlob.size === 0) {
        setAssistantRecordingError('I could not capture any audio. Please try again.');
        setAssistantVoiceStatus('idle');
        return;
      }

      setAssistantTranscribing(true);
      const transcription = await transcribeWithFallback(audioBlob, { language: 'en' });
      const transcriptText = transcription?.text?.trim()
        || transcription?.segments?.map((segment) => segment?.text || '').join(' ').trim();

      if (transcriptText) {
        if (assistantInput?.trim()) {
          setAssistantInput((prev) => `${prev} ${transcriptText}`.trim());
          setAssistantVoiceStatus('idle');
        } else {
          setAssistantVoiceStatus('processing');
          await handleAssistantSendMessage(transcriptText);
          setAssistantVoiceStatus('idle');
        }
      } else {
        setAssistantRecordingError('I did not catch that. Could you try again?');
        setAssistantVoiceStatus('idle');
      }
    } catch (error) {
      console.error('Voice input error:', error);
      setAssistantRecordingError(error?.message || 'Transcription failed. Please try again.');
      setAssistantVoiceStatus('idle');
    } finally {
      setAssistantRecording(false);
      setAssistantTranscribing(false);
      if (!assistantTyping) {
        setAssistantVoiceStatus('idle');
      }
    }
  }, [assistantInput, assistantTyping, handleAssistantSendMessage]);

  const handleAssistantMicClick = useCallback(async () => {
    if (assistantTranscribing) return;

    if (assistantRecording) {
      await stopAssistantRecordingAndTranscribe();
      return;
    }

    setAssistantRecordingError(null);

    try {
      const started = await audioRecorderService.start();
      if (started) {
        setAssistantRecording(true);
        setAssistantVoiceStatus('recording');
      } else {
        setAssistantRecordingError('Microphone unavailable. Please check your permissions.');
        setAssistantVoiceStatus('idle');
      }
    } catch (error) {
      console.error('Microphone access error:', error);
      setAssistantRecordingError(error?.message || 'Unable to access microphone.');
      setAssistantRecording(false);
      setAssistantVoiceStatus('idle');
    }
  }, [assistantRecording, assistantTranscribing, stopAssistantRecordingAndTranscribe]);

  if (!isLiveChatVisible) {
    return null;
  }

  if (!isOpen) {
    return (
      <motion.button
        type="button"
        onClick={() => setIsOpen(true)}
        initial={initial}
        animate={animate}
        transition={transition}
        className="fixed bottom-20 lg:bottom-8 right-4 lg:right-6 w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl shadow-blue-500/40 hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center z-[120]"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Open live chat"
        title="Live Chat"
      >
        <Icon name="MessageCircle" size={24} />
      </motion.button>
    );
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-panel"
            initial={initial}
            animate={animate}
            exit={exit}
            transition={transition}
            className={`fixed bottom-20 lg:bottom-8 right-4 lg:right-6 ${sizeSettings.container} max-w-[calc(100vw-2rem)] max-h-[calc(100vh-8rem)] lg:max-h-[700px] rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur shadow-[0_30px_80px_rgba(15,23,42,0.3)] dark:shadow-[0_30px_80px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col z-[120]`}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/30 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <Icon name={isAssistantTab ? 'Bot' : 'MessageCircle'} size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">
                    {isAssistantTab ? 'AI Website Assistant' : 'Live Chat'}
                  </h3>
                  <p className="text-xs text-white/80">
                    {isAssistantTab
                      ? (assistantTyping ? 'Typing...' : 'Online')
                      : (chatStatus === 'closed' ? 'Session closed' : 'We typically reply fast')}
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
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border border-white/20 transition ${
                        chatSize === sizeKey
                          ? 'bg-white/40 text-blue-900 shadow-sm'
                          : 'text-white/80 hover:bg-white/20'
                      }`}
                    >
                      {preset.shortLabel}
                    </button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="text-white hover:text-white"
                  aria-label="Close support panel"
                >
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
                    className={`text-[11px] font-semibold px-3 py-1 rounded-full transition ${
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
                    className={`text-[11px] font-semibold px-3 py-1 rounded-full transition ${
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
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white/60 dark:bg-slate-900/60">
                  {assistantMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message?.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] rounded-lg p-3 ${
                        message?.type === 'user'
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                          : 'bg-white dark:bg-slate-800 border border-white/40 dark:border-slate-700/50 text-gray-800 dark:text-slate-200 shadow-sm'
                      }`}>
                        <div className={sizeSettings.messageSpacing}>
                          {renderAssistantMessageContent(message?.content || '', message?.type, sizeSettings)}
                        </div>
                        <div className={`text-xs mt-2 ${message?.type === 'user' ? 'text-white/80' : 'text-gray-400 dark:text-slate-500'}`}>
                          {formatTimestamp(message?.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}

                  {assistantTyping && (
                    <div className="flex justify-start">
                      <div className="bg-muted text-foreground rounded-lg p-3">
                        <div className="flex space-x-1">
                          {[...Array(3)].map((_, index) => (
                            <div
                              key={`typing-${index}`}
                              className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                              style={{ animationDelay: `${index * 0.2}s` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={assistantMessagesEndRef} />
                </div>

                <div className="p-4 border-t border-border dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/80">
                  <div className="grid grid-cols-1 gap-2 mb-4">
                    {PUBLIC_ASSISTANT_QUICK_ACTIONS.map((action) => (
                      <Button
                        key={action.key}
                        variant="outline"
                        size="sm"
                        iconName={action.icon}
                        iconPosition="left"
                        onClick={() => handleAssistantSendMessage(action.prompt)}
                        disabled={assistantTyping || assistantLoading}
                        className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={assistantInput}
                      onChange={(event) => setAssistantInput(event.target.value)}
                      onKeyPress={(event) => event.key === 'Enter' && handleAssistantSendMessage()}
                      placeholder="Ask about InterviewAI Pro..."
                      className={`flex-1 px-3 py-2 border border-white/40 dark:border-slate-700/60 rounded-full ${sizeSettings.inputText} bg-white/80 dark:bg-slate-800/80 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500`}
                      disabled={assistantTyping || assistantLoading || assistantTranscribing}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleAssistantMicClick}
                      disabled={assistantMicDisabled}
                      aria-pressed={assistantRecording}
                      aria-label={assistantRecording ? 'Stop recording' : 'Record a question'}
                      className={`rounded-full border border-white/40 dark:border-slate-700/60 backdrop-blur text-blue-600 dark:text-blue-300 hover:text-purple-500 dark:hover:text-purple-300 transition ${
                        assistantRecording
                          ? 'bg-red-600 text-white shadow-lg shadow-red-500/40 animate-pulse'
                          : ''
                      }`}
                    >
                      {assistantTranscribing ? (
                        <LoadingIndicator size={18} tone="current" />
                      ) : (
                        <Icon name={assistantRecording ? 'Square' : 'Mic'} size={18} />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      iconName="Send"
                      onClick={() => handleAssistantSendMessage()}
                      disabled={!assistantInput.trim() || assistantTyping || assistantLoading || assistantTranscribing}
                      className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white border-none shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
                    />
                  </div>
                  {assistantMicStatusMessage && (
                    <p className={`mt-2 ${sizeSettings.statusText} text-blue-600 dark:text-blue-300`}>
                      {assistantMicStatusMessage}
                    </p>
                  )}
                  {assistantRecordingError && (
                    <p className={`mt-2 ${sizeSettings.statusText} text-amber-500 dark:text-amber-400`}>
                      {assistantRecordingError}
                    </p>
                  )}
                  {assistantError && (
                    <p className={`mt-2 ${sizeSettings.statusText} text-red-500`}>
                      {assistantError}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="p-4 border-b border-white/30 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/70">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`${sizeSettings.heading4} uppercase tracking-wide text-gray-400 dark:text-slate-500`}>
                        Your name
                      </p>
                      {!isEditingName ? (
                        <p className={`${sizeSettings.heading3} font-semibold text-gray-900 dark:text-slate-100`}>
                          {displayName || 'Guest'}
                        </p>
                      ) : (
                        <input
                          type="text"
                          value={nameDraft}
                          onChange={(event) => setNameDraft(event.target.value)}
                          className={`mt-2 w-full rounded-full border border-white/40 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 px-3 py-2 ${sizeSettings.inputText} text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500`}
                        />
                      )}
                      <p className={`${sizeSettings.heading4} text-gray-500 dark:text-slate-400`}>
                        {accountType === 'ANONYMOUS' ? 'Guest visitor' : accountType.replace('_', ' ')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {isEditingName ? (
                        <button
                          type="button"
                          onClick={updateDisplayName}
                          className={`${sizeSettings.heading4} font-semibold text-blue-600 hover:text-blue-700`}
                        >
                          Save
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsEditingName(true)}
                          className={`${sizeSettings.heading4} font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-slate-200`}
                        >
                          Edit
                        </button>
                      )}
                      {chatSessionId && chatStatus !== 'closed' && (
                        <button
                          type="button"
                          onClick={handleEndSession}
                          className={`${sizeSettings.heading4} font-semibold px-2 py-1 rounded-full border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-rose-300 hover:text-rose-600 dark:hover:text-rose-300 transition`}
                        >
                          End chat
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white/60 dark:bg-slate-900/60">
                  {!isRealtimeChatAvailable ? (
                    <LiveChatUnavailableState compact />
                  ) : messages.length === 0 && (
                    <div className={`text-center ${sizeSettings.bodyAssistant} text-gray-500 dark:text-slate-400`}>
                      {chatSessionId ? 'Say hello! We are here to help.' : 'Start a chat to connect with support.'}
                    </div>
                  )}

                  {isRealtimeChatAvailable && messages.map((message) => {
                    const isUser = message?.sender?.role === 'user';
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            isUser
                              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                              : 'bg-white dark:bg-slate-800 border border-white/40 dark:border-slate-700/50 text-gray-800 dark:text-slate-200 shadow-sm'
                          }`}
                        >
                          <p className={`text-xs font-semibold ${isUser ? 'text-white/85' : 'text-gray-500 dark:text-slate-400'}`}>
                            {isUser ? 'You' : message?.sender?.displayName || 'Support'}
                          </p>
                          <p className={`${isUser ? sizeSettings.bodyUser : sizeSettings.bodyAssistant} whitespace-pre-wrap text-left`}>{message.text}</p>
                          <p className={`text-xs mt-2 ${isUser ? 'text-white/80' : 'text-gray-400 dark:text-slate-500'}`}>
                            {formatTimestamp(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {isRealtimeChatAvailable && (
                <div className="p-4 border-t border-border dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/80">
                  {chatStatus === 'closed' ? (
                    <div className="space-y-3 text-center">
                      <p className={`${sizeSettings.statusText} text-gray-500 dark:text-slate-400`}>
                        This session is closed. Start a new chat to reconnect.
                      </p>
                      <Button
                        onClick={resetSession}
                        className="w-full rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white border-none shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
                      >
                        Start New Chat
                      </Button>
                    </div>
                  ) : (
                    <>
                      {!chatSessionId && !displayName.trim() ? (
                        <div className="space-y-3">
                          <p className={`${sizeSettings.statusText} text-gray-500 dark:text-slate-400`}>
                            Tell us your name to get started.
                          </p>
                          <input
                            ref={guestNameInputRef}
                            type="text"
                            value={nameDraft}
                            onChange={(event) => setNameDraft(event.target.value)}
                            onInput={(event) => setNameDraft(event.currentTarget.value)}
                            placeholder="Your name"
                            className={`w-full rounded-full border border-white/40 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 px-3 py-2 ${sizeSettings.inputText} text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500`}
                          />
                          <Button
                            onClick={handleStartChat}
                            loading={isLoading}
                            disabled={isLoading || !canStartChat}
                            className="w-full rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white border-none shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
                          >
                            Start Chat
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {shouldShowSuggestions && (
                          <div className="flex flex-wrap items-center gap-2">
                            {suggestionsLoading ? (
                              <span className="text-[11px] text-gray-500 dark:text-slate-400">
                                Generating suggestions...
                              </span>
                            ) : (
                              suggestions.map((suggestion, index) => (
                                <Button
                                  key={`${suggestion}-${index}`}
                                  type="button"
                                  onClick={() => handleSuggestionClick(suggestion)}
                                  variant="outline"
                                  size="xs"
                                  className="max-w-full whitespace-normal break-words text-left rounded-full border border-gray-200 dark:border-slate-700 text-[11px] leading-snug text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
                                >
                                  {suggestion}
                                </Button>
                              ))
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <textarea
                            ref={messageInputRef}
                            rows={1}
                            value={messageDraft}
                            onChange={(event) => setMessageDraft(event.target.value)}
                            onKeyDown={handleMessageKeyDown}
                            placeholder="Write a message..."
                            className={`flex-1 min-w-0 resize-none overflow-hidden rounded-full border border-white/40 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 px-3 py-3 ${sizeSettings.inputText} text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 h-14`}
                            style={{ lineHeight: '1.5' }}
                            disabled={chatTranscribing}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={handleChatMicClick}
                            disabled={chatMicDisabled}
                            aria-pressed={chatRecording}
                            aria-label={chatRecording ? 'Stop voice input' : 'Record a message'}
                            className={`shrink-0 w-14 h-14 rounded-full border border-white/40 dark:border-slate-700/60 backdrop-blur text-blue-600 dark:text-blue-300 hover:text-purple-500 dark:hover:text-purple-300 transition ${
                              chatRecording
                                ? 'bg-red-600 text-white shadow-lg shadow-red-500/40 animate-pulse'
                                : ''
                            }`}
                          >
                            {chatTranscribing ? (
                              <LoadingIndicator size={18} tone="current" />
                            ) : (
                              <Icon name={chatRecording ? 'Square' : 'Mic'} size={18} />
                            )}
                          </Button>
                          <Button
                            onClick={handleSendMessage}
                            loading={isLoading}
                            iconName="Send"
                            size="icon"
                            disabled={isLoading || chatTranscribing || !messageDraft.trim()}
                            className="shrink-0 w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white border-none shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
                            aria-label="Send message"
                          />
                        </div>
                        {chatMicStatusMessage && (
                          <p className={`mt-2 ${sizeSettings.statusText} text-blue-600 dark:text-blue-300`}>
                            {chatMicStatusMessage}
                          </p>
                        )}
                        {chatRecordingError && (
                          <p className={`mt-2 ${sizeSettings.statusText} text-amber-500 dark:text-amber-400`}>
                            {chatRecordingError}
                          </p>
                        )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default LiveChatWidget;
