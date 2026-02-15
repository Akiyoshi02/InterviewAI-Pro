import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ref,
  onValue,
  query,
  orderByChild,
  limitToLast,
  push,
  set,
  update,
  serverTimestamp,
} from 'firebase/database';
import { auth, realtimeDb } from '../../../config/firebase.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import Button from '../../../components/ui/Button.jsx';
import Icon from '../../../components/AppIcon.jsx';
import UnifiedFilterPanel, {
  UnifiedFilterSelect,
  UnifiedSearchField,
} from '../../../components/ui/UnifiedFilterPanel.jsx';
import apiClient from '../../../services/apiClient.js';
import { useLLM } from '../../../hooks/useLLM.js';
import {
  ADMIN_LIVE_CHAT_ACTIVITY_FILTER_OPTIONS,
  ADMIN_LIVE_CHAT_RESPONSE_FILTER_OPTIONS,
  ADMIN_LIVE_CHAT_SORT_FILTER_OPTIONS,
  ADMIN_LIVE_CHAT_STATUS_FILTER_OPTIONS,
  DEFAULT_ADMIN_LIVE_CHAT_FILTERS,
  buildAdminLiveChatFilterOptions,
  countActiveAdminLiveChatFilters,
  filterAdminLiveChats,
} from '../utils/adminDashboardFilters.js';

const CHAT_ROOT = 'liveChats';

const formatTimestamp = (value) => {
  if (!value) return '';
  const timestamp = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(timestamp)) return '';
  return new Date(timestamp).toLocaleString();
};

const LiveChatManager = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatFilters, setChatFilters] = useState(DEFAULT_ADMIN_LIVE_CHAT_FILTERS);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const messagesContainerRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);
  const draftInputRef = useRef(null);
  const suggestionsTimerRef = useRef(null);
  const lastSuggestionKeyRef = useRef('');
  const [suggestions, setSuggestions] = useState([]);
  const { getChatSuggestions, loading: suggestionsLoading } = useLLM();

  const adminName = user?.fullName || user?.email || 'System Admin';

  useEffect(() => {
    let isMounted = true;
    const registerAdmin = async () => {
      try {
        await apiClient.admin.registerLiveChatAdmin();
      } catch (error) {
        console.error('Failed to register live chat admin:', error);
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    };
    registerAdmin();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!realtimeDb || !isReady) return;
    const chatsQuery = query(ref(realtimeDb, CHAT_ROOT), orderByChild('lastMessageAt'), limitToLast(200));
    const unsubscribe = onValue(chatsQuery, (snapshot) => {
      const value = snapshot.val();
      if (!value) {
        setChats([]);
        setSelectedChatId(null);
        return;
      }
      const nextChats = Object.entries(value)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
      setChats(nextChats);
    });
    return () => unsubscribe();
  }, [isReady]);

  useEffect(() => {
    shouldStickToBottomRef.current = true;
  }, [selectedChatId]);

  const resizeDraftInput = useCallback(() => {
    if (typeof window === 'undefined') return;
    const input = draftInputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    const minHeight = parseFloat(window.getComputedStyle(input).minHeight || '0');
    input.style.height = `${Math.max(input.scrollHeight, minHeight)}px`;
  }, []);

  useEffect(() => {
    resizeDraftInput();
  }, [draft, selectedChatId, resizeDraftInput]);

  useEffect(() => {
    if (!selectedChatId || !realtimeDb || !isReady) {
      setSelectedChat(null);
      setMessages([]);
      return;
    }
    const chatRef = ref(realtimeDb, `${CHAT_ROOT}/${selectedChatId}`);
    const messagesRef = query(
      ref(realtimeDb, `${CHAT_ROOT}/${selectedChatId}/messages`),
      orderByChild('createdAt'),
      limitToLast(200),
    );

    const unsubscribeChat = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setSelectedChat(null);
        return;
      }
      setSelectedChat({ id: selectedChatId, ...data });
    });

    const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setMessages([]);
        return;
      }
      const nextMessages = Object.entries(data)
        .map(([id, message]) => ({ id, ...message }))
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setMessages(nextMessages);
    });

    return () => {
      unsubscribeChat();
      unsubscribeMessages();
    };
  }, [selectedChatId, isReady]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !shouldStickToBottomRef.current) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 80;
  };

  const filteredChats = useMemo(
    () => filterAdminLiveChats(chats, chatFilters),
    [chats, chatFilters],
  );

  const chatFilterOptions = useMemo(
    () => buildAdminLiveChatFilterOptions(chats),
    [chats],
  );

  const activeFilterCount = useMemo(
    () => countActiveAdminLiveChatFilters(chatFilters),
    [chatFilters],
  );

  const openCount = useMemo(
    () => chats.filter((chat) => chat.status !== 'closed').length,
    [chats],
  );
  const closedCount = useMemo(
    () => chats.filter((chat) => chat.status === 'closed').length,
    [chats],
  );

  useEffect(() => {
    if (filteredChats.length === 0) {
      setSelectedChatId(null);
      return;
    }
    if (!selectedChatId || !filteredChats.some((chat) => chat.id === selectedChatId)) {
      setSelectedChatId(filteredChats[0].id);
    }
  }, [filteredChats, selectedChatId]);

  const clearFilters = () => {
    setChatFilters(DEFAULT_ADMIN_LIVE_CHAT_FILTERS);
  };

  const handleSendMessage = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || !selectedChatId || !realtimeDb) return;
    try {
      setIsSending(true);
      const adminUser = auth.currentUser;
      const messageRef = push(ref(realtimeDb, `${CHAT_ROOT}/${selectedChatId}/messages`));
      await set(messageRef, {
        text: trimmed,
        createdAt: serverTimestamp(),
        sender: {
          uid: adminUser?.uid || null,
          role: 'admin',
          displayName: adminName,
        },
      });
      await update(ref(realtimeDb, `${CHAT_ROOT}/${selectedChatId}`), {
        lastMessageAt: serverTimestamp(),
        lastMessagePreview: trimmed.slice(0, 160),
        status: 'open',
        respondedAt: serverTimestamp(),
        respondedBy: adminName,
      });
      setDraft('');
    } catch (error) {
      console.error('Failed to send admin message:', error);
    } finally {
      setIsSending(false);
    }
  }, [adminName, draft, selectedChatId]);

  const handleCloseChat = useCallback(async () => {
    if (!selectedChatId || !realtimeDb) return;
    try {
      const adminUser = auth.currentUser;
      await update(ref(realtimeDb, `${CHAT_ROOT}/${selectedChatId}`), {
        status: 'closed',
        closedAt: serverTimestamp(),
        closedBy: {
          uid: adminUser?.uid || null,
          name: adminName,
        },
      });
    } catch (error) {
      console.error('Failed to close chat:', error);
    }
  }, [adminName, selectedChatId]);

  const handleMessageKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const conversationForLLM = useMemo(() => (
    messages
      .filter((message) => message?.text)
      .map((message) => ({
        role: message?.sender?.role === 'user' ? 'user' : 'assistant',
        content: message.text
      }))
  ), [messages]);

  const lastMessageRole = messages.length > 0 ? messages[messages.length - 1]?.sender?.role : null;
  const shouldShowSuggestions = messages.length === 0 || lastMessageRole !== 'admin';

  const fallbackSuggestions = useMemo(() => ([
    'Thanks for reaching out. How can I help with InterviewAI Pro today?',
    'Which dashboard are you using (candidate or company)?',
    'Share any details about the interview or invitation issue.'
  ]), []);

  useEffect(() => {
    if (!selectedChatId) return;
    if (!shouldShowSuggestions) {
      setSuggestions([]);
      return;
    }
    const suggestionKey = `${selectedChatId}:${conversationForLLM.length}:${conversationForLLM.map((msg) => `${msg.role}:${msg.content}`).join('|')}`;
    if (suggestionKey === lastSuggestionKeyRef.current) return;
    lastSuggestionKeyRef.current = suggestionKey;

    if (suggestionsTimerRef.current) {
      clearTimeout(suggestionsTimerRef.current);
    }

    suggestionsTimerRef.current = setTimeout(async () => {
      try {
        const result = await getChatSuggestions({
          role: 'admin',
          audience: selectedChat?.user?.accountType || 'ANONYMOUS',
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
  }, [conversationForLLM, fallbackSuggestions, getChatSuggestions, selectedChatId, shouldShowSuggestions]);

  const handleSuggestionClick = (text) => {
    setDraft(text);
    requestAnimationFrame(() => {
      resizeDraftInput();
      if (draftInputRef.current) {
        draftInputRef.current.focus();
        const length = draftInputRef.current.value.length;
        draftInputRef.current.setSelectionRange(length, length);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Live Chat Console
            </h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              Reply to website visitors and manage support sessions in real time.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              Open: {openCount}
            </div>
            <div className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700/40 text-slate-600 dark:text-slate-200 text-xs font-semibold">
              Closed: {closedCount}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-4 shadow-lg h-full">
          <UnifiedFilterPanel
            className="mb-4 p-3 sm:p-4"
            title="Chat Filters"
            description="Filter by session status, response urgency, audience, and activity."
            activeCount={activeFilterCount}
            onClear={clearFilters}
            clearLabel="Clear Filters"
          >
            <div className="grid grid-cols-1 gap-3">
              <UnifiedSearchField
                label="Search"
                type="text"
                value={chatFilters.searchQuery}
                onChange={(event) => setChatFilters((prev) => ({ ...prev, searchQuery: event.target.value }))}
                placeholder="Visitor, message text, or account type"
              />
              <UnifiedFilterSelect
                label="Chat Status"
                value={chatFilters.statusFilter}
                onChange={(value) => setChatFilters((prev) => ({ ...prev, statusFilter: value }))}
                options={ADMIN_LIVE_CHAT_STATUS_FILTER_OPTIONS}
                placeholder="All statuses"
              />
              <UnifiedFilterSelect
                label="Response State"
                value={chatFilters.responseStateFilter}
                onChange={(value) => setChatFilters((prev) => ({ ...prev, responseStateFilter: value }))}
                options={ADMIN_LIVE_CHAT_RESPONSE_FILTER_OPTIONS}
                placeholder="All response states"
              />
              <UnifiedFilterSelect
                label="Audience"
                value={chatFilters.audienceFilter}
                onChange={(value) => setChatFilters((prev) => ({ ...prev, audienceFilter: value }))}
                options={chatFilterOptions.audienceOptions}
                placeholder="All audiences"
              />
              <UnifiedFilterSelect
                label="Activity Window"
                value={chatFilters.activityPreset}
                onChange={(value) => setChatFilters((prev) => ({ ...prev, activityPreset: value }))}
                options={ADMIN_LIVE_CHAT_ACTIVITY_FILTER_OPTIONS}
                placeholder="All activity windows"
              />
              <UnifiedFilterSelect
                label="Sort By"
                value={chatFilters.sortBy}
                onChange={(value) => setChatFilters((prev) => ({ ...prev, sortBy: value }))}
                options={ADMIN_LIVE_CHAT_SORT_FILTER_OPTIONS}
                placeholder="Sort chats"
              />
            </div>
          </UnifiedFilterPanel>
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {filteredChats.length === 0 ? (
              <div className="text-center text-xs text-gray-500 dark:text-slate-400 py-6">
                No chats found.
              </div>
            ) : (
              filteredChats.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => setSelectedChatId(chat.id)}
                  className={`w-full text-left rounded-2xl border px-3 py-3 transition ${
                    selectedChatId === chat.id
                      ? 'border-purple-300 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-600'
                      : 'border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                        {chat.user?.displayName || 'Guest Visitor'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {chat.user?.accountType || 'ANONYMOUS'}
                        {chat.user?.companyName ? ` - ${chat.user.companyName}` : ''}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        chat.status === 'closed'
                          ? 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-200'
                          : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300'
                      }`}
                    >
                      {chat.status === 'closed' ? 'Closed' : 'Open'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-slate-400 line-clamp-2">
                    {chat.lastMessagePreview || 'Session started.'}
                  </p>
                  <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">
                    {formatTimestamp(chat.lastMessageAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur shadow-[0_30px_80px_rgba(15,23,42,0.3)] dark:shadow-[0_30px_80px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden h-[600px] max-h-[calc(100vh-8rem)]">
          {!selectedChat ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500 dark:text-slate-400 p-6">
              <Icon name="MessageSquare" className="w-10 h-10 text-purple-400 mb-3" />
              <p className="text-sm font-medium">Select a chat session</p>
              <p className="text-xs mt-1">Choose a visitor to view the conversation.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 border-b border-white/30 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <Icon name="MessageSquare" size={16} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">
                      {selectedChat.user?.displayName || 'Guest Visitor'}
                    </h3>
                    <p className="text-xs text-white/80">
                      {selectedChat.user?.email || 'No email provided'}
                    </p>
                    <p className="text-xs text-white/70">
                      {selectedChat.user?.accountType || 'ANONYMOUS'}
                      {selectedChat.user?.companyName ? ` - ${selectedChat.user.companyName}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      selectedChat.status === 'closed'
                        ? 'bg-white/15 text-white/80'
                        : 'bg-white/25 text-white'
                    }`}
                  >
                    {selectedChat.status === 'closed' ? 'Closed' : 'Open'}
                  </span>
                  {selectedChat.status !== 'closed' && (
                    <button
                      type="button"
                      onClick={handleCloseChat}
                      className="text-xs font-semibold px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 transition"
                    >
                      Close Chat
                    </button>
                  )}
                </div>
              </div>

              <div className="px-4 py-2 text-xs text-gray-500 dark:text-slate-400 bg-white/70 dark:bg-slate-900/70 border-b border-white/30 dark:border-slate-700/50">
                Started: {formatTimestamp(selectedChat.createdAt)} | Last activity:{' '}
                {formatTimestamp(selectedChat.lastMessageAt)}
              </div>

              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-white/60 dark:bg-slate-900/60"
              >
                {messages.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 dark:text-slate-400 py-8">
                    No messages yet.
                  </div>
                ) : (
                  messages.map((message) => {
                    const isAdmin = message?.sender?.role === 'admin';
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            isAdmin
                              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                              : 'bg-white dark:bg-slate-800 border border-white/40 dark:border-slate-700/50 text-gray-800 dark:text-slate-200 shadow-sm'
                          }`}
                        >
                          <p className={`text-xs font-semibold ${isAdmin ? 'text-white/85' : 'text-gray-500 dark:text-slate-400'}`}>
                            {isAdmin ? 'System Admin' : message?.sender?.displayName || 'Visitor'}
                          </p>
                          <p className="text-sm whitespace-pre-wrap text-left">{message.text}</p>
                          <p className={`text-xs mt-2 ${isAdmin ? 'text-white/80' : 'text-gray-400 dark:text-slate-500'}`}>
                            {formatTimestamp(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-4 border-t border-border dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/80">
                {selectedChat.status === 'closed' && (
                  <div className="text-center text-xs text-gray-500 dark:text-slate-400 mb-3">
                    Session closed. Send a reply to reopen.
                  </div>
                )}
                <div className="space-y-3">
                  {shouldShowSuggestions && (
                    <div className="flex flex-wrap items-center gap-2">
                      {suggestionsLoading ? (
                        <span className="text-xs text-gray-500 dark:text-slate-400">
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
                            className="max-w-full whitespace-normal break-words text-left rounded-full border border-gray-200 dark:border-slate-700 text-xs leading-snug text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            {suggestion}
                          </Button>
                        ))
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <textarea
                      ref={draftInputRef}
                      rows={1}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={handleMessageKeyDown}
                      placeholder="Reply to the visitor..."
                      className="min-w-0 w-full resize-none overflow-hidden rounded-full border border-white/40 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 px-3 py-2 text-base text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 min-h-[44px]"
                    />
                    <Button
                      size="icon"
                      iconName="Send"
                      loading={isSending}
                      onClick={handleSendMessage}
                      disabled={isSending || !draft.trim()}
                      className="shrink-0 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white border-none shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
                      aria-label="Send reply"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveChatManager;
