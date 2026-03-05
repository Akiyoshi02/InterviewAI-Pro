import React from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import { cn } from '../../../utils/cn';

const AIInterviewerPanel = ({
  isActive = true,
  currentQuestion = '',
  isSpeaking = false,
  isProcessing = false,
  questionProgress = {},
  interviewerName = null,
  className = ''
}) => {
  const displayQuestion = currentQuestion || "Welcome! I'm ready to begin the interview when you are.";
  const displayName = interviewerName || 'AI Interviewer';

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow-[0_25px_70px_rgba(15,23,42,0.12)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.4)] backdrop-blur min-h-[240px] sm:min-h-[280px] md:min-h-[320px]",
        className
      )}
    >
      <div className="absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.15),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.15),transparent_40%)]" />
      <div className="relative z-10 flex flex-col gap-3 p-3 sm:p-4 md:p-5">
        {/* AI Interviewer Avatar */}
        <div className="flex items-center justify-center pt-1 sm:pt-2">
          <div className="relative">
            <div className={cn(
              "w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-2 sm:border-[3px] transition-all duration-300 shadow-lg",
              isSpeaking
                ? 'border-blue-500 shadow-blue-500/30'
                : isProcessing
                ? 'border-amber-400 shadow-amber-400/30'
                : 'border-white/50'
            )}>
              <Image
                src="https://images.unsplash.com/photo-1532442312344-38696bc5294d"
                alt="Professional AI interviewer avatar"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Speaking Animation Indicator */}
            {isSpeaking && (
              <div className="absolute -bottom-4 sm:-bottom-5 left-1/2 transform -translate-x-1/2">
                <div className="flex space-x-0.5 sm:space-x-1">
                  {[...Array(4)]?.map((_, i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary animate-pulse"
                      style={{ animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Processing/Thinking Indicator */}
            {isProcessing && !isSpeaking && (
              <div className="absolute -bottom-4 sm:-bottom-5 left-1/2 transform -translate-x-1/2">
                <div className="flex items-center space-x-1 bg-warning/20 px-2 py-1 rounded-full">
                  <div className="w-1 h-1 bg-warning rounded-full animate-bounce" />
                  <div className="w-1 h-1 bg-warning rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-1 h-1 bg-warning rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <span className="text-[10px] text-warning font-medium ml-1">Thinking...</span>
                </div>
              </div>
            )}

            {/* Status Indicator */}
            <div className="absolute top-1 right-1 sm:top-2 sm:right-2">
              <div className={cn(
                "w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 border-white/80",
                isActive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400 dark:bg-slate-500'
              )} />
            </div>
          </div>
        </div>

        {/* Question Display */}
        <div className="bg-white/90 dark:bg-slate-900/85 backdrop-blur-sm border border-white/40 dark:border-slate-700/60 rounded-2xl p-2 sm:p-3 md:p-4">
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                <Icon name="MessageSquare" size={14} className="text-white sm:w-4 sm:h-4" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-slate-100">{displayName}</span>
              {isSpeaking && (
                <div className="flex items-center space-x-0.5 sm:space-x-1">
                  <div className="w-1 h-1 bg-primary rounded-full animate-bounce" />
                  <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              )}
              {isProcessing && !isSpeaking && (
                <span className="text-xs text-warning animate-pulse">Processing...</span>
              )}
            </div>

            <p className="text-xs sm:text-sm md:text-base text-gray-700 dark:text-slate-300 leading-relaxed">
              {displayQuestion}
            </p>
          </div>
        </div>
      </div>
      
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="w-full h-full bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,0.2),transparent_55%)]" />
      </div>
    </div>
  );
};

export default AIInterviewerPanel;
