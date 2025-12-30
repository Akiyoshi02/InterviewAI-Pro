import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../AppIcon';
import { cn } from '../../utils/cn';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random();
    const toast = { id, message, type, duration };
    
    setToasts(prev => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const success = useCallback((message, duration) => showToast(message, 'success', duration), [showToast]);
  const error = useCallback((message, duration) => showToast(message, 'error', duration), [showToast]);
  const info = useCallback((message, duration) => showToast(message, 'info', duration), [showToast]);
  const warning = useCallback((message, duration) => showToast(message, 'warning', duration), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const ToastContainer = ({ toasts, onRemove }) => {
  return (
    <div className="fixed top-2 xs:top-3 sm:top-4 right-2 xs:right-3 sm:right-4 left-2 xs:left-auto z-[9999] flex flex-col gap-2 xs:gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            toast={toast}
            onRemove={onRemove}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

const Toast = ({ toast, onRemove }) => {
  const { id, message, type } = toast;

  const typeConfig = {
    success: {
      icon: 'CheckCircle2',
      bgGradient: 'from-emerald-500 to-teal-600',
      bgLight: 'bg-emerald-50 dark:bg-emerald-900/30',
      borderColor: 'border-emerald-200 dark:border-emerald-700/50',
      textColor: 'text-emerald-700 dark:text-emerald-300',
      iconBg: 'bg-emerald-600 dark:bg-emerald-500',
    },
    error: {
      icon: 'AlertCircle',
      bgGradient: 'from-red-500 to-rose-600',
      bgLight: 'bg-red-50 dark:bg-red-900/30',
      borderColor: 'border-red-200 dark:border-red-700/50',
      textColor: 'text-red-700 dark:text-red-300',
      iconBg: 'bg-red-600 dark:bg-red-500',
    },
    warning: {
      icon: 'AlertTriangle',
      bgGradient: 'from-amber-500 to-orange-600',
      bgLight: 'bg-amber-50 dark:bg-amber-900/30',
      borderColor: 'border-amber-200 dark:border-amber-700/50',
      textColor: 'text-amber-700 dark:text-amber-300',
      iconBg: 'bg-amber-600 dark:bg-amber-500',
    },
    info: {
      icon: 'Info',
      bgGradient: 'from-blue-500 to-purple-600',
      bgLight: 'bg-blue-50 dark:bg-blue-900/30',
      borderColor: 'border-blue-200 dark:border-blue-700/50',
      textColor: 'text-blue-700 dark:text-blue-300',
      iconBg: 'bg-blue-600 dark:bg-blue-500',
    },
  };

  const config = typeConfig[type] || typeConfig.success;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        "pointer-events-auto relative overflow-hidden rounded-xl xs:rounded-2xl border",
        config.bgLight,
        config.borderColor,
        "shadow-lg backdrop-blur-sm w-full xs:w-auto xs:max-w-sm"
      )}
    >
      <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.1),transparent_45%)]" />
      <div className="relative z-10 flex items-start gap-2 xs:gap-3 p-3 xs:p-4">
        <div className={cn(
          "w-8 h-8 xs:w-10 xs:h-10 rounded-lg xs:rounded-xl flex items-center justify-center flex-shrink-0 shadow-md",
          config.iconBg,
          "text-white"
        )}>
          <Icon name={config.icon} size={16} className="xs:w-[18px] xs:h-[18px] text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-xs xs:text-sm font-semibold leading-relaxed",
            config.textColor
          )}>
            {message}
          </p>
        </div>
        <button
          onClick={() => onRemove(id)}
          className={cn(
            "flex-shrink-0 w-7 h-7 xs:w-6 xs:h-6 rounded-lg flex items-center justify-center touch-manipulation",
            "hover:bg-white/20 dark:hover:bg-black/20 active:bg-white/30 transition-colors",
            config.textColor,
            "opacity-70 hover:opacity-100"
          )}
          aria-label="Close"
        >
          <Icon name="X" size={14} />
        </button>
      </div>
    </motion.div>
  );
};

export default Toast;

