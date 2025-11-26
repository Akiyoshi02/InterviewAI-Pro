import React, { useState, useEffect, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { cn } from '../../../utils/cn';

const TranscriptionPanel = ({ 
  isListening = false,
  isAudioEnabled = true,
  onToggleListening,
  onAnswerComplete,
  currentQuestion = '',
  isSpeaking = false,
  isProcessing = false,
  conversationHistory = [],
  currentTranscript = '',
  canCandidateSpeak = false,
  whisperAvailable = false,
  isTranscribing = false,
  className = ''
}) => {
  const scrollRef = useRef(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollRef?.current) {
      scrollRef.current.scrollTop = scrollRef?.current?.scrollHeight;
    }
  }, [conversationHistory, currentTranscript]);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getConfidenceColor = (conf) => {
    if (conf >= 0.9) return 'text-success';
    if (conf >= 0.7) return 'text-warning';
    return 'text-error';
  };

  // Clear transcripts function
  const clearTranscripts = () => {
    // This would need to be handled by parent component
    // For now, we'll just log it
    console.log('Clear conversation requested');
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 shadow-[0_25px_70px_rgba(15,23,42,0.12)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.4)] backdrop-blur flex flex-col",
        className
      )}
    >
      <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
      <div className="relative z-10 flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-white/30 dark:border-slate-700 gap-2 sm:gap-0">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Icon name="MessageSquare" size={18} className="text-white sm:w-5 sm:h-5" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 text-sm sm:text-base">Live Conversation</h3>
          
          {/* Status Indicators */}
          {isSpeaking && (
            <div className="flex items-center space-x-1 sm:space-x-1.5">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary rounded-full animate-pulse" />
              <span className="text-xs sm:text-sm text-primary font-medium">AI Speaking</span>
            </div>
          )}
          {isListening && (
            <div className="flex items-center space-x-1 sm:space-x-1.5">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-success rounded-full animate-pulse" />
              <span className="text-xs sm:text-sm text-success font-medium">Listening...</span>
            </div>
          )}
          {isTranscribing && (
            <div className="flex items-center space-x-1 sm:space-x-1.5">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-warning rounded-full animate-pulse" />
              <span className="text-xs sm:text-sm text-warning font-medium">Transcribing...</span>
            </div>
          )}
          {!isListening && !isSpeaking && whisperAvailable && (
            <div className="flex items-center space-x-1 sm:space-x-1.5">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary rounded-full" />
              <span className="text-[10px] sm:text-xs text-primary font-medium">Whisper Ready</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* Microphone Toggle Button */}
          {canCandidateSpeak && onToggleListening && !isTranscribing && (
            <Button 
              variant={isListening ? "default" : "outline"}
              size="sm"
              onClick={onToggleListening}
              className={`h-8 sm:h-9 ${isListening ? 'bg-success hover:bg-success/90' : ''}`}
            >
              <Icon name={isListening ? "MicOff" : "Mic"} size={14} className="sm:w-4 sm:h-4 mr-1.5" />
              <span className="text-xs sm:text-sm">
                {isListening ? 'Stop' : 'Speak'}
              </span>
            </Button>
          )}
          {isTranscribing && (
            <Button disabled variant="outline" size="sm" className="h-8 sm:h-9 opacity-70">
              <Icon name="Loader2" size={14} className="sm:w-4 sm:h-4 mr-1.5 animate-spin" />
              <span className="text-xs sm:text-sm">Processing</span>
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            size="icon"
            onClick={clearTranscripts}
            className="h-8 w-8 sm:h-9 sm:w-9"
          >
            <Icon name="Trash2" size={14} className="sm:w-4 sm:h-4" />
          </Button>
        </div>
      </div>

      {/* Transcription Content */}
      <div 
        ref={scrollRef}
        className="h-64 sm:h-80 md:h-96 lg:h-[473px] overflow-y-auto p-4 space-y-3 sm:space-y-4"
      >
        {conversationHistory?.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <Icon name="MessageSquare" size={48} className="text-gray-300 dark:text-slate-600 mb-4" />
            <p className="text-gray-500 dark:text-slate-400 text-sm">
              The conversation will appear here once the interview starts.
            </p>
          </div>
        )}

        {conversationHistory?.map((entry, index) => (
          <div
            key={`${entry.timestamp}-${index}`}
            className={`flex space-x-3 ${
              entry.role === 'interviewer' ? 'justify-start' : 'justify-end'
            }`}
          >
            <div className={`max-w-[80%] ${
              entry.role === 'interviewer' ? 'order-2' : 'order-1'
            }`}>
              <div
                className={`rounded-2xl p-4 backdrop-blur ${
                  entry.role === 'interviewer'
                    ? 'bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 border border-blue-200/60 dark:border-blue-700/50'
                    : 'bg-white/80 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700/50 shadow'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${
                    entry.role === 'interviewer' ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'
                  }`}>
                    {entry.role === 'interviewer' ? 'AI Interviewer' : 'You'}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-slate-500">
                    {formatTime(entry.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-gray-800 dark:text-slate-200 leading-relaxed">
                  {entry.message}
                </p>
              </div>
            </div>
            
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 shadow ${
                entry.role === 'interviewer'
                  ? 'bg-blue-600 text-white order-1'
                  : 'bg-purple-600 text-white order-2'
              }`}
            >
              <Icon 
                name={entry.role === 'interviewer' ? 'Bot' : 'User'} 
                size={16} 
              />
            </div>
          </div>
        ))}

        {/* Current Transcript (being spoken by candidate) */}
        {isListening && currentTranscript && !isTranscribing && (
          <div className="flex space-x-3 justify-end">
            <div className="max-w-[80%] order-1">
              <div className="rounded-2xl p-3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200/60 dark:border-purple-700/50 border-dashed">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                    You (speaking...)
                  </span>
                  <div className="flex space-x-0.5">
                    <div className="w-1 h-1 bg-success rounded-full animate-bounce" />
                    <div className="w-1 h-1 bg-success rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-1 h-1 bg-success rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
                <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed italic">
                  {currentTranscript}
                </p>
              </div>
            </div>
            
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 bg-purple-600/20 text-purple-700 order-2 animate-pulse">
              <Icon name="Mic" size={16} />
            </div>
          </div>
        )}
        {isTranscribing && (
          <div className="flex space-x-3 justify-end">
            <div className="max-w-[80%] order-1">
              <div className="rounded-2xl p-3 bg-amber-50 border border-amber-200/70">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-amber-600">Converting speech...</span>
                  <Icon name="Loader2" size={14} className="animate-spin" />
                </div>
                <p className="text-xs text-amber-600">Audio captured. Waiting for Whisper transcription.</p>
              </div>
            </div>
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 bg-amber-500/20 text-amber-600 order-2 animate-pulse">
              <Icon name="Waveform" size={16} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/30 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/70 rounded-b-3xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs sm:text-sm text-gray-500 dark:text-slate-400 gap-2 sm:gap-0">
          <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-1">
            <span className="text-[10px] sm:text-xs">
              {conversationHistory?.length > 0 
                ? `${conversationHistory.length} messages` 
                : 'Ready to start'}
            </span>
            {isProcessing && !isTranscribing && (
              <span className="text-[10px] sm:text-xs text-amber-600 flex items-center gap-1">
                <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse" />
                AI is thinking...
              </span>
            )}
            {isTranscribing && (
              <span className="text-[10px] sm:text-xs text-amber-600 flex items-center gap-1">
                <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse" />
                Transcribing (Whisper)...
              </span>
            )}
            {!isProcessing && !canCandidateSpeak && !isSpeaking && (
              <span className="text-[10px] sm:text-xs text-warning">
                Waiting for AI...
              </span>
            )}
            {canCandidateSpeak && !isListening && !isProcessing && (
              <span className="text-[10px] sm:text-xs text-emerald-600">
                Your turn to speak
              </span>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default TranscriptionPanel;