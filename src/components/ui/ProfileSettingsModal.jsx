import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';
import Icon from '../AppIcon';
import ProfileSettingsPanel from './ProfileSettingsPanel';

const ProfileSettingsModal = ({ open = false, onClose, userType = 'candidate' }) => {
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

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Profile settings"
        className="relative w-full max-w-6xl max-h-[calc(100vh-2rem)] overflow-hidden"
      >
        <div className="relative rounded-[32px] border border-white/40 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/90 shadow-[0_40px_120px_rgba(15,23,42,0.35)] backdrop-blur-xl">
          <div className="max-h-[calc(100vh-2rem)] overflow-y-auto p-4 sm:p-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <ProfileSettingsPanel
              userType={userType}
              variant="plain"
              density="compact"
              headerAction={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="rounded-full border border-white/40 dark:border-slate-700/50 hover:bg-white/70 dark:hover:bg-slate-800/70"
                  aria-label="Close profile settings"
                >
                  <Icon name="X" size={18} />
                </Button>
              }
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProfileSettingsModal;
