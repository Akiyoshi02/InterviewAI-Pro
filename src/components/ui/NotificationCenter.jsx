import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../AppIcon';
import apiClient from '../../services/apiClient.js';

const NOTIFICATION_ICONS = {
  interview_completed: { icon: 'CheckCircle', color: 'text-emerald-500' },
  evaluation_ready: { icon: 'Star', color: 'text-yellow-500' },
  application_status: { icon: 'FileText', color: 'text-blue-500' },
  invitation_received: { icon: 'Mail', color: 'text-purple-500' },
  review_submitted: { icon: 'ClipboardCheck', color: 'text-indigo-500' },
  org_approved: { icon: 'Building2', color: 'text-emerald-500' },
  org_rejected: { icon: 'XCircle', color: 'text-rose-500' },
  interview_candidate_message: { icon: 'MessageCircle', color: 'text-blue-500' },
  default: { icon: 'Bell', color: 'text-gray-500' },
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const NotificationCenter = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.notifications.list({ limit: 20 });
      if (res?.success) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll for unread count every 60s
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(async () => {
      try {
        const res = await apiClient.notifications.list({ unreadOnly: true, limit: 1 });
        if (res?.success) setUnreadCount(res.unreadCount || 0);
      } catch {
        // silent
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleToggle = () => {
    setOpen((prev) => {
      if (!prev) loadNotifications();
      return !prev;
    });
  };

  const handleMarkRead = async (id) => {
    try {
      await apiClient.notifications.markRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.notifications.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await apiClient.notifications.delete(id);
      const n = notifications.find((x) => x.id === id);
      setNotifications((prev) => prev.filter((x) => x.id !== id));
      if (n && !n.read) setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.read) handleMarkRead(notification.id);
    if (notification.link) {
      navigate(notification.link);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="relative flex items-center justify-center w-9 h-9 rounded-full border border-gray-200/60 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 text-gray-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Icon name="Bell" size={17} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Icon name="Bell" size={15} className="text-gray-500 dark:text-slate-400" />
                <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-semibold">
                    {unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <Icon name="BellOff" size={32} className="mx-auto text-gray-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-slate-400">No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const typeConfig = NOTIFICATION_ICONS[n.type] || NOTIFICATION_ICONS.default;
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 dark:border-slate-800/50 last:border-b-0 cursor-pointer transition-colors ${
                        n.read
                          ? 'hover:bg-gray-50 dark:hover:bg-slate-800/40'
                          : 'bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                      }`}
                    >
                      <div className={`mt-0.5 shrink-0 ${typeConfig.color}`}>
                        <Icon name={typeConfig.icon} size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${n.read ? 'text-gray-700 dark:text-slate-300' : 'text-gray-900 dark:text-slate-100'}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{formatTime(n.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                        )}
                        <button
                          onClick={(e) => handleDelete(n.id, e)}
                          className="opacity-0 group-hover:opacity-100 hover:opacity-100 text-gray-300 hover:text-gray-500 dark:hover:text-slate-300 transition-all p-0.5"
                          aria-label="Delete notification"
                        >
                          <Icon name="X" size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationCenter;
