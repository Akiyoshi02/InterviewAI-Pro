import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useToast } from '../ui/Toast.jsx';
import { useLLM } from '../../hooks/useLLM.js';

const CHAT_ROOT = 'liveChats';
const CHAT_SESSION_KEY = 'liveChatSessionId';
const CHAT_NAME_KEY = 'liveChatDisplayName';
const CHAT_NAME_OVERRIDE_KEY = 'liveChatDisplayNameOverride';
const CHAT_LAST_ACCOUNT_TYPE_KEY = 'liveChatLastAccountType';
const MAX_MESSAGE_LENGTH = 1000;

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

const DashboardLiveChatTab = ({ sizeSettings, isActive = true }) => {
  const { user } = useAuth();
  const { error: showError, success: showSuccess } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState(getStorageValue(CHAT_SESSION_KEY, ''));
  const [chatStatus, setChatStatus] = useState('open');
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [displayName, setDisplayName] = useState(getStorageValue(CHAT_NAME_KEY, '', 'local'));
  const [nameDraft, setNameDraft] = useState(displayName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameOverride, setNameOverride] = useState(getStorageValue(CHAT_NAME_OVERRIDE_KEY, '', 'local') === 'true');
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const guestNameInputRef = useRef(null);
  const suggestionsTimerRef = useRef(null);
  const lastSuggestionKeyRef = useRef('');
  const [suggestions, setSuggestions] = useState([]);
  const lastAccountTypeRef = useRef(getStorageValue(CHAT_LAST_ACCOUNT_TYPE_KEY, 'ANONYMOUS', 'local'));
  const { getChatSuggestions, loading: suggestionsLoading } = useLLM();
  const canStartChat = Boolean((nameDraft || guestNameInputRef.current?.value || '').trim());

  const accountDisplayName = useMemo(() => getAccountDisplayName(user), [user]);
  const accountType = (user?.accountType || 'ANONYMOUS').toUpperCase();

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
    if (!isActive) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isActive]);

  const resizeMessageInput = useCallback(() => {
    if (typeof window === 'undefined') return;
    const input = messageInputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    const minHeight = parseFloat(window.getComputedStyle(input).minHeight || '0');
    input.style.height = `${Math.max(input.scrollHeight, minHeight)}px`;
  }, []);

  useEffect(() => {
    if (!isActive) return;
    resizeMessageInput();
  }, [messageDraft, isActive, resizeMessageInput]);

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
    if (!isActive) return;
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
  }, [conversationForLLM, fallbackSuggestions, getChatSuggestions, isActive, shouldShowSuggestions, accountType]);

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
    if (!realtimeDb) {
      throw new Error('Realtime database is not configured.');
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
  }, [accountType, chatSessionId, displayName, ensureAuthUser, user]);

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

  const handleSendMessage = useCallback(async () => {
    const trimmedMessage = messageDraft.trim();
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

  return (
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
        {messages.length === 0 && (
          <div className={`text-center ${sizeSettings.bodyAssistant} text-gray-500 dark:text-slate-400`}>
            {chatSessionId ? 'Say hello! We are here to help.' : 'Start a chat to connect with support.'}
          </div>
        )}

        {messages.map((message) => {
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
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <textarea
                  ref={messageInputRef}
                  rows={1}
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  onKeyDown={handleMessageKeyDown}
                  placeholder="Write a message..."
                  className={`min-w-0 w-full resize-none overflow-hidden rounded-full border border-white/40 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 px-3 py-2 ${sizeSettings.inputText} text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 min-h-[44px]`}
                />
                <Button
                  onClick={handleSendMessage}
                  loading={isLoading}
                  iconName="Send"
                  size="icon"
                  disabled={isLoading || !messageDraft.trim()}
                  className="shrink-0 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white border-none shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
                  aria-label="Send message"
                />
              </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default DashboardLiveChatTab;
