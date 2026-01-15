import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './Button';
import Icon from '../AppIcon';

const MessageDialog = ({
  open = false,
  onClose,
  title = 'Message',
  message = '',
  buttonText = 'OK',
  variant = 'success', // 'success', 'error', 'warning', 'info'
}) => {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' || event.key === 'Enter') {
        onClose?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const variantConfig = {
    success: {
      icon: 'CheckCircle',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      buttonGradient: 'from-emerald-600 to-teal-600',
      buttonHover: 'hover:from-emerald-700 hover:to-teal-700',
    },
    error: {
      icon: 'AlertCircle',
      iconColor: 'text-red-600 dark:text-red-400',
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      buttonGradient: 'from-red-600 to-rose-600',
      buttonHover: 'hover:from-red-700 hover:to-rose-700',
    },
    warning: {
      icon: 'AlertTriangle',
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      buttonGradient: 'from-amber-600 to-orange-600',
      buttonHover: 'hover:from-amber-700 hover:to-orange-700',
    },
    info: {
      icon: 'Info',
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      buttonGradient: 'from-blue-600 to-purple-600',
      buttonHover: 'hover:from-blue-700 hover:to-purple-700',
    },
  };

  const config = variantConfig[variant] || variantConfig.success;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="message-dialog-title"
            aria-describedby="message-dialog-message"
            className="relative w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative rounded-2xl border border-white/40 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 shadow-[0_40px_120px_rgba(15,23,42,0.35)] backdrop-blur-xl">
              <div className="p-6 sm:p-8">
                {/* Icon */}
                <div className={`w-14 h-14 rounded-2xl ${config.iconBg} flex items-center justify-center mx-auto mb-4`}>
                  <Icon name={config.icon} size={28} className={config.iconColor} />
                </div>

                {/* Title */}
                <h2
                  id="message-dialog-title"
                  className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 text-center mb-3"
                >
                  {title}
                </h2>

                {/* Message */}
                <p
                  id="message-dialog-message"
                  className="text-sm sm:text-base text-gray-600 dark:text-slate-400 text-center mb-6 leading-relaxed"
                >
                  {message}
                </p>

                {/* Action Button */}
                <div className="flex justify-center">
                  <Button
                    onClick={onClose}
                    className={`rounded-full bg-gradient-to-r ${config.buttonGradient} ${config.buttonHover} text-white shadow-lg shadow-blue-500/30 min-w-[120px]`}
                  >
                    {buttonText}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default MessageDialog;

