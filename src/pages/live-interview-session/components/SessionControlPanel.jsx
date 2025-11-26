import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { cn } from '../../../utils/cn';

const SessionControlPanel = ({ 
  sessionDuration = 0,
  isPaused = false,
  isRecording = true,
  onPause,
  onResume,
  onEndSession,
  onTechnicalSupport,
  onEmergencyExit,
  className = ''
}) => {
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins?.toString()?.padStart(2, '0')}:${secs?.toString()?.padStart(2, '0')}`;
    }
    return `${mins?.toString()?.padStart(2, '0')}:${secs?.toString()?.padStart(2, '0')}`;
  };

  const handleEndSession = () => {
    if (showEndConfirm) {
      onEndSession?.();
      setShowEndConfirm(false);
    } else {
      setShowEndConfirm(true);
      setTimeout(() => setShowEndConfirm(false), 5000);
    }
  };

  const handleEmergencyExit = () => {
    if (showEmergencyConfirm) {
      onEmergencyExit?.();
      setShowEmergencyConfirm(false);
    } else {
      setShowEmergencyConfirm(true);
      setTimeout(() => setShowEmergencyConfirm(false), 5000);
    }
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 shadow-[0_25px_70px_rgba(15,23,42,0.12)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.4)] backdrop-blur",
        className
      )}
    >
      <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
      <div className="relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/30 dark:border-slate-700/60">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="flex items-center space-x-2">
            <div className={cn(
              "w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full",
              isPaused ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'
              )} />
            <span className="font-semibold text-gray-900 dark:text-slate-100 text-sm sm:text-base">
              {isPaused ? 'Session Paused' : 'Live Session'}
            </span>
          </div>
          
          {isRecording && (
            <div className="flex items-center space-x-1 bg-error/10 text-error px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-error rounded-full animate-pulse" />
              <span className="text-[10px] sm:text-xs font-medium">Recording</span>
            </div>
          )}
        </div>
        
        <div className="font-mono text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">
          {formatDuration(sessionDuration)}
        </div>
      </div>

      {/* Main Controls */}
      <div className="p-4 space-y-4">
        {/* Primary Actions */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <Button
            variant={isPaused ? "default" : "outline"}
            fullWidth
            iconName={isPaused ? "Play" : "Pause"}
            iconPosition="left"
            onClick={isPaused ? onResume : onPause}
            className="text-xs sm:text-sm h-9 sm:h-10"
          >
            {isPaused ? 'Resume' : 'Pause'}
          </Button>
          
          <Button
            variant={showEndConfirm ? "destructive" : "outline"}
            fullWidth
            iconName="Square"
            iconPosition="left"
            onClick={handleEndSession}
            className="text-xs sm:text-sm h-9 sm:h-10"
          >
            <span className="hidden sm:inline">{showEndConfirm ? 'Confirm End' : 'End Session'}</span>
            <span className="sm:hidden">{showEndConfirm ? 'Confirm' : 'End'}</span>
          </Button>
        </div>

        {/* Session Info */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-white/60 dark:bg-slate-900/60 border border-white/40 dark:border-slate-700/60 rounded-2xl">
          <div className="text-center">
            <div className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">8</div>
            <div className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400">Questions Asked</div>
          </div>
          <div className="text-center">
            <div className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">12</div>
            <div className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400">Remaining</div>
          </div>
        </div>

        {/* Technical Controls */}
        <div className="space-y-2">
          <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">Technical Support</div>
          
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            <Button
              variant="ghost"
              size="sm"
              iconName="HelpCircle"
              iconPosition="left"
              onClick={onTechnicalSupport}
              className="text-xs h-8 sm:h-9"
            >
              Get Help
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              iconName="RefreshCw"
              iconPosition="left"
              className="text-xs h-8 sm:h-9"
            >
              <span className="hidden sm:inline">Restart Audio</span>
              <span className="sm:hidden">Restart</span>
            </Button>
          </div>
        </div>

        {/* Emergency Controls */}
        <div className="pt-3 border-t border-white/30 dark:border-slate-700/60">
          <Button
            variant={showEmergencyConfirm ? "destructive" : "ghost"}
            size="sm"
            fullWidth
            iconName="AlertTriangle"
            iconPosition="left"
            onClick={handleEmergencyExit}
            className="text-xs sm:text-sm h-8 sm:h-9"
          >
            <span className="hidden sm:inline">{showEmergencyConfirm ? 'Confirm Emergency Exit' : 'Emergency Exit'}</span>
            <span className="sm:hidden">{showEmergencyConfirm ? 'Confirm Exit' : 'Emergency'}</span>
          </Button>
          
          {showEmergencyConfirm && (
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 text-center">
              This will immediately end the session and cannot be undone
            </p>
          )}
        </div>
      </div>

      {/* Session Status */}
      <div className="p-4 border-t border-white/30 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/70 rounded-b-3xl">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2 text-gray-500 dark:text-slate-400">
            <Icon name="Wifi" size={14} />
            <span>Connection: Excellent</span>
          </div>
          
          <div className="flex items-center space-x-2 text-gray-500 dark:text-slate-400">
            <Icon name="Database" size={14} />
            <span>Auto-save: On</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default SessionControlPanel;