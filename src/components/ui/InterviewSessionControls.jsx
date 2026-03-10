import React, { useState, useEffect } from 'react';
import Icon from '../AppIcon';
import Button from './Button';

const InterviewSessionControls = ({ 
  isActive = false,
  isRecording = false,
  isMuted = false,
  isVideoOff = false,
  sessionDuration = 0,
  onToggleRecording,
  onToggleMute,
  onToggleVideo,
  onEndSession,
  onEmergencyExit,
  className = ''
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins?.toString()?.padStart(2, '0')}:${secs?.toString()?.padStart(2, '0')}`;
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

  if (!isActive) return null;

  return (
    <div className={`fixed bottom-4 sm:bottom-6 left-1/2 transform -translate-x-1/2 z-[100] transition-all duration-300 w-[calc(100%-1rem)] sm:w-auto max-w-[600px] ${className}`}>
      {/* Main Controls */}
      <div className={`bg-card border border-border rounded-xl sm:rounded-2xl shadow-elevated transition-all duration-300 ${
        isMinimized ? 'w-14 h-14 sm:w-16 sm:h-16' : 'px-3 py-3 sm:px-6 sm:py-4'
      }`}>
        {isMinimized ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(false)}
            className="w-full h-full rounded-xl sm:rounded-2xl hover:rounded-xl sm:hover:rounded-2xl"
          >
            <Icon name="ChevronUp" size={20} className="sm:w-6 sm:h-6" />
          </Button>
        ) : (
          <div className="flex items-center justify-between sm:space-x-4">
            {/* Session Timer */}
            <div className="flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm font-mono">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-success rounded-full animate-pulse"></div>
              <span className="text-foreground font-medium">
                {formatDuration(sessionDuration)}
              </span>
            </div>

            {/* Core Controls */}
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <Button
                variant={isMuted ? "destructive" : "outline"}
                size="icon"
                onClick={onToggleMute}
                title={isMuted ? "Unmute" : "Mute"}
                className="h-9 w-9 sm:h-10 sm:w-10"
              >
                <Icon name={isMuted ? "MicOff" : "Mic"} size={18} className="sm:w-5 sm:h-5" />
              </Button>

              <Button
                variant={isVideoOff ? "destructive" : "outline"}
                size="icon"
                onClick={onToggleVideo}
                title={isVideoOff ? "Turn on camera" : "Turn off camera"}
                className="h-9 w-9 sm:h-10 sm:w-10"
              >
                <Icon name={isVideoOff ? "VideoOff" : "Video"} size={18} className="sm:w-5 sm:h-5" />
              </Button>

              <Button
                variant={isRecording ? "success" : "outline"}
                size="icon"
                onClick={onToggleRecording}
                title={isRecording ? "Stop recording" : "Start recording"}
                className="h-9 w-9 sm:h-10 sm:w-10"
              >
                <Icon name={isRecording ? "Square" : "Circle"} size={18} className="sm:w-5 sm:h-5" />
              </Button>
            </div>

            {/* Session Actions */}
            <div className="flex items-center space-x-1.5 sm:space-x-2 border-l border-border pl-2 sm:pl-4">
              <Button
                variant="outline"
                size="sm"
                onClick={onEndSession}
                iconName="PhoneOff"
                iconPosition="left"
                className="hidden sm:inline-flex text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4"
              >
                <span className="hidden md:inline">End Session</span>
                <span className="md:hidden">End</span>
              </Button>

              {/* Mobile: Icon only end button */}
              <Button
                variant="outline"
                size="icon"
                onClick={onEndSession}
                title="End Session"
                className="sm:hidden h-9 w-9"
              >
                <Icon name="PhoneOff" size={18} />
              </Button>

              <Button
                variant={showEmergencyConfirm ? "destructive" : "ghost"}
                size="icon"
                onClick={handleEmergencyExit}
                title="Emergency exit"
                className="h-9 w-9 sm:h-10 sm:w-10"
              >
                <Icon name="AlertTriangle" size={18} className="sm:w-5 sm:h-5" />
              </Button>
            </div>

            {/* Minimize Button - Hidden on small mobile */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMinimized(true)}
              className="hidden sm:flex items-center justify-center border-l border-border h-10 w-10"
            >
              <Icon name="ChevronDown" size={20} className="sm:w-5 sm:h-5" />
            </Button>
          </div>
        )}
      </div>

      {/* Emergency Confirmation */}
      {showEmergencyConfirm && (
        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-destructive text-destructive-foreground px-3 py-2 sm:px-4 sm:py-2 rounded-lg shadow-elevated text-xs sm:text-sm font-medium whitespace-nowrap">
          Click again to emergency exit
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-destructive"></div>
        </div>
      )}
    </div>
  );
};

export default InterviewSessionControls;