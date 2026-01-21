import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './Button';
import Icon from '../AppIcon';
import LoadingIndicator from './LoadingIndicator';

const ConfirmDialog = ({
  open = false,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'OK',
  cancelText = 'Cancel',
  variant = 'warning', // 'warning', 'danger', 'info'
  isLoading = false,
}) => {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
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
    warning: {
      icon: 'AlertTriangle',
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      buttonGradient: 'from-amber-600 to-orange-600',
      buttonHover: 'hover:from-amber-700 hover:to-orange-700',
    },
    danger: {
      icon: 'AlertCircle',
      iconColor: 'text-red-600 dark:text-red-400',
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      buttonGradient: 'from-red-600 to-rose-600',
      buttonHover: 'hover:from-red-700 hover:to-rose-700',
    },
    info: {
      icon: 'Info',
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      buttonGradient: 'from-blue-600 to-purple-600',
      buttonHover: 'hover:from-blue-700 hover:to-purple-700',
    },
  };

  const config = variantConfig[variant] || variantConfig.warning;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
  };

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
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
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
                  id="confirm-dialog-title"
                  className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 text-center mb-3"
                >
                  {title}
                </h2>

                {/* Message */}
                <p
                  id="confirm-dialog-message"
                  className="text-sm sm:text-base text-gray-600 dark:text-slate-400 text-center mb-6 leading-relaxed"
                >
                  {message}
                </p>

                {/* Actions */}
                <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-center">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={isLoading}
                    className="flex-1 sm:flex-initial rounded-full border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    {cancelText}
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={isLoading}
                    className={`flex-1 sm:flex-initial rounded-full bg-gradient-to-r ${config.buttonGradient} ${config.buttonHover} text-white shadow-lg shadow-blue-500/30`}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <LoadingIndicator size={16} tone="current" />
                        <span>Processing...</span>
                      </div>
                    ) : (
                      confirmText
                    )}
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

export default ConfirmDialog;

