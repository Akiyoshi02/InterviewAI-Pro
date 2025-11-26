import React from 'react';
import Icon from '../../../components/AppIcon';
import { cn } from '../../../utils/cn';

const QuestionProgressIndicator = ({ 
  currentQuestion = 1,
  totalQuestions = 20,
  estimatedTimeRemaining = 15,
  questionType = 'behavioral',
  className = ''
}) => {
  const progress = (currentQuestion / totalQuestions) * 100;
  
  const getQuestionTypeInfo = (type) => {
    const types = {
      behavioral: { icon: 'MessageCircle', color: 'text-primary', bg: 'bg-primary' },
      technical: { icon: 'Code', color: 'text-secondary', bg: 'bg-secondary' },
      situational: { icon: 'Users', color: 'text-accent', bg: 'bg-accent' },
      general: { icon: 'HelpCircle', color: 'text-muted-foreground', bg: 'bg-muted-foreground' }
    };
    return types?.[type] || types?.general;
  };

  const typeInfo = getQuestionTypeInfo(questionType);

  const formatTime = (minutes) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-4 sm:p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur",
        className
      )}
    >
      <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_10%_10%,rgba(59,130,246,0.1),transparent_40%),radial-gradient(circle_at_90%_0%,rgba(147,51,234,0.15),transparent_45%)]" />
      <div className="relative z-10 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Icon name="BarChart3" size={18} className="text-white sm:w-[18px] sm:h-[18px]" />
          </div>
          <span className="font-semibold text-gray-900 dark:text-slate-100 text-sm sm:text-base">Progress</span>
        </div>
        
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          <Icon name={typeInfo?.icon} size={14} className={cn(typeInfo?.color, "sm:w-4 sm:h-4")} />
          <span className={cn("text-xs sm:text-sm font-medium capitalize", typeInfo?.color)}>
            {questionType}
          </span>
        </div>
      </div>
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <span className="text-gray-500 dark:text-slate-400">Question Progress</span>
          <span className="font-semibold text-gray-900 dark:text-slate-100">
            {currentQuestion} of {totalQuestions}
          </span>
        </div>
        
        <div className="w-full bg-gray-200 dark:bg-slate-800 rounded-full h-2 sm:h-2.5">
          <div 
            className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 h-full rounded-full transition-all duration-500 ease-out shadow-[0_5px_15px_rgba(99,102,241,0.35)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <div className="flex justify-between text-[10px] sm:text-xs text-gray-500 dark:text-slate-400">
          <span className="font-medium text-gray-600 dark:text-slate-300">Started</span>
          <span className="font-semibold text-blue-600">{Math.round(progress)}% Complete</span>
          <span className="font-medium text-gray-600">Finish</span>
        </div>
      </div>
      {/* Time Information */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="text-center p-3 sm:p-4 rounded-2xl border border-white/40 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 shadow-inner">
          <div className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">
            {formatTime(estimatedTimeRemaining)}
          </div>
          <div className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400">Est. Remaining</div>
        </div>
        
        <div className="text-center p-3 sm:p-4 rounded-2xl border border-white/40 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/60 shadow-inner">
          <div className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">
            {totalQuestions - currentQuestion}
          </div>
          <div className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400">Questions Left</div>
        </div>
      </div>
      {/* Question Categories */}
      <div className="space-y-3 pt-2 border-t border-white/40 dark:border-slate-700/60">
        <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-slate-100">Question Categories</div>
        
        <div className="space-y-1">
          {[
            { type: 'behavioral', completed: 3, total: 8 },
            { type: 'technical', completed: 2, total: 7 },
            { type: 'situational', completed: 1, total: 3 },
            { type: 'general', completed: 2, total: 2 }
          ]?.map((category) => {
            const categoryInfo = getQuestionTypeInfo(category?.type);
            const categoryProgress = (category?.completed / category?.total) * 100;
            
            return (
              <div key={category?.type} className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full shadow ${categoryInfo?.bg}`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="capitalize text-gray-800 dark:text-slate-100 font-medium">
                      {category?.type}
                    </span>
                    <span className="text-gray-500 dark:text-slate-400 font-medium">
                      {category?.completed}/{category?.total}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-slate-800 rounded-full h-1 mt-1">
                    <div 
                      className={`h-1 rounded-full ${categoryInfo?.bg}`}
                      style={{ width: `${categoryProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Next Question Preview */}
      <div className="pt-4 border-t border-white/40 dark:border-slate-700/60">
        <div className="flex items-center space-x-2 text-sm">
          <Icon name="ArrowRight" size={14} className="text-gray-400 dark:text-slate-500" />
          <span className="text-gray-500 dark:text-slate-400">Next:</span>
          <span className="text-gray-900 dark:text-slate-100 font-semibold">Technical Assessment</span>
        </div>
      </div>
      </div>
    </div>
  );
};

export default QuestionProgressIndicator;