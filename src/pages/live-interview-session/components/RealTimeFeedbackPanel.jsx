import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import useLLM from '../../../hooks/useLLM';
import { cn } from '../../../utils/cn';

const RealTimeFeedbackPanel = ({
  isActive = true,
  currentAnswer = '',
  currentQuestion = '',
  onFeedbackGenerated,
  interviewId = null,
  difficulty = 'medium',
  enabled = true,
  className = ''
}) => {
  const [feedback, setFeedback] = useState(null);
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [currentScore, setCurrentScore] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { evaluateAnswer, loading: aiLoading, error: aiError, clearError } = useLLM();

  const storageKey = interviewId ? `interviewFeedback:${interviewId}` : 'interviewFeedback';

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-success';
    if (score >= 6) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreLabel = (score) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Needs Improvement';
  };

  const persistFeedbackHistory = (history) => {
    localStorage.setItem(storageKey, JSON.stringify(history));
    // Keep legacy key updated with latest session data for older readers.
    localStorage.setItem('interviewFeedback', JSON.stringify(history));
  };

  const analyzeCurrentAnswer = async (answer, question) => {
    if (!answer || !question || !enabled || !isActive) return;

    setIsAnalyzing(true);
    clearError?.();

    try {
      const analysisData = {
        question,
        answer,
        expectedCriteria: [
          'Technical accuracy',
          'Problem-solving approach',
          'Communication clarity',
          'Practical examples',
        ],
        difficulty,
      };

      const result = await evaluateAnswer(analysisData);
      if (!result) return;

      setFeedback(result);
      setCurrentScore(result?.score || 0);

      const newFeedbackEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        interviewId,
        question,
        answer,
        feedback: result,
      };

      setFeedbackHistory((prev) => {
        const updated = [...prev, newFeedbackEntry];
        persistFeedbackHistory(updated);
        return updated;
      });

      onFeedbackGenerated?.(result);
    } catch (error) {
      console.error('Failed to analyze answer:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (!enabled) return undefined;
    if (currentAnswer && currentQuestion && currentAnswer.length > 50) {
      const timeoutId = setTimeout(() => {
        void analyzeCurrentAnswer(currentAnswer, currentQuestion);
      }, 1500);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [enabled, currentAnswer, currentQuestion]);

  useEffect(() => {
    if (!enabled) return;
    const savedFeedback = localStorage.getItem(storageKey);
    if (!savedFeedback) return;
    try {
      const parsed = JSON.parse(savedFeedback);
      if (!Array.isArray(parsed)) return;
      setFeedbackHistory(parsed);
      if (parsed.length > 0) {
        const latestFeedback = parsed[parsed.length - 1];
        setFeedback(latestFeedback?.feedback || null);
        setCurrentScore(latestFeedback?.feedback?.score || 0);
      }
    } catch (error) {
      console.error('Failed to load feedback history:', error);
    }
  }, [enabled, storageKey]);

  const clearFeedbackHistory = () => {
    setFeedbackHistory([]);
    setFeedback(null);
    setCurrentScore(0);
    localStorage.removeItem(storageKey);
    if (storageKey !== 'interviewFeedback') {
      localStorage.removeItem('interviewFeedback');
    }
  };

  if (!enabled) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 shadow-[0_25px_70px_rgba(15,23,42,0.12)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.4)] backdrop-blur p-4",
          className
        )}
      >
        <div className="text-sm text-gray-600 dark:text-slate-300">
          Real-time feedback is disabled for this interview configuration.
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 shadow-[0_25px_70px_rgba(15,23,42,0.12)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.4)] backdrop-blur flex flex-col",
        className
      )}
    >
      <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-white/40 dark:border-slate-700/60">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Icon name="TrendingUp" size={16} className="text-white sm:w-[18px] sm:h-[18px]" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-slate-100 text-sm sm:text-base">Real-time Feedback</h3>
            {(isAnalyzing || aiLoading) && (
              <div className="flex items-center space-x-1">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-purple-500 rounded-full animate-pulse" />
                <span className="text-xs sm:text-sm text-purple-600 dark:text-purple-400 font-medium">Deep Analysis...</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <div className="text-xs sm:text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded-full">
              Score - {Number(currentScore || 0).toFixed(1)}/10
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearFeedbackHistory}
              disabled={isAnalyzing || aiLoading}
              className="h-8 w-8 sm:h-9 sm:w-9"
            >
              <Icon name="Trash2" size={14} className="sm:w-4 sm:h-4" />
            </Button>
          </div>
        </div>

        {aiError && (
          <div className="mx-4 mt-3 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/60 rounded-2xl">
            <div className="flex items-center space-x-2">
              <Icon name="AlertTriangle" size={14} className="text-destructive sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm text-destructive">Analysis Error: {aiError}</span>
            </div>
          </div>
        )}

        {feedback && (
          <div className="p-4 border-b border-white/30 dark:border-slate-700/60">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-400">Current Answer Score</span>
              <span className={cn("font-bold text-base sm:text-lg", getScoreColor(currentScore))}>
                {Number(currentScore || 0).toFixed(1)}/10
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-slate-800 rounded-full h-2 sm:h-2.5 mb-2">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500 shadow-[0_6px_18px_rgba(52,211,153,0.35)]",
                  currentScore >= 8 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : currentScore >= 6 ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-rose-500 to-red-600'
                )}
                style={{ width: `${(Number(currentScore || 0) / 10) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] sm:text-sm text-gray-500 dark:text-slate-400">
              <span>Performance</span>
              <span className={getScoreColor(currentScore)}>{getScoreLabel(currentScore)}</span>
            </div>
          </div>
        )}

        <div className="p-4 space-y-4 max-h-64 overflow-y-auto flex-1">
          {feedback ? (
            <>
              {feedback?.strengths?.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Icon name="CheckCircle" size={16} className="sm:w-4 sm:h-4" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">Strengths</span>
                  </div>
                  <ul className="space-y-1 ml-6 list-disc">
                    {feedback?.strengths?.map((strength, index) => (
                      <li key={index} className="text-xs sm:text-sm text-gray-700 dark:text-slate-300">{strength}</li>
                    ))}
                  </ul>
                </div>
              )}

              {feedback?.areasForImprovement?.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Icon name="AlertCircle" size={16} className="sm:w-4 sm:h-4" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400">Areas for Improvement</span>
                  </div>
                  <ul className="space-y-1 ml-6 list-disc">
                    {feedback?.areasForImprovement?.map((area, index) => (
                      <li key={index} className="text-xs sm:text-sm text-gray-700 dark:text-slate-300">{area}</li>
                    ))}
                  </ul>
                </div>
              )}

              {feedback?.detailedFeedback && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Icon name="MessageSquare" size={16} className="sm:w-4 sm:h-4" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400">Detailed Analysis</span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-700 dark:text-slate-300 leading-relaxed ml-6">{feedback?.detailedFeedback}</p>
                </div>
              )}

              {feedback?.suggestions?.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <Icon name="Lightbulb" size={16} className="sm:w-4 sm:h-4" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-purple-600 dark:text-purple-400">Suggestions</span>
                  </div>
                  <ul className="space-y-1 ml-6 list-disc">
                    {feedback?.suggestions?.map((suggestion, index) => (
                      <li key={index} className="text-xs sm:text-sm text-gray-700 dark:text-slate-300">{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              <Icon name="MessageCircle" size={40} className="text-gray-400 dark:text-slate-500 mx-auto mb-2" />
              <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">Answer a question to see feedback here.</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/30 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/70">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs sm:text-sm text-gray-500 dark:text-slate-400 gap-2 sm:gap-0">
            <div className="flex items-center gap-3">
              <span className="font-medium text-gray-600 dark:text-slate-300">Feedback: {aiLoading || isAnalyzing ? 'Deep Analysis in Progress' : 'Ready'}</span>
              <span>|</span>
              <span>Answers Analyzed: <span className="font-semibold text-gray-800 dark:text-slate-100">{feedbackHistory?.length}</span></span>
            </div>
            <div className="flex items-center space-x-2">
              <Icon name="TrendingUp" size={14} />
              <span>Performance Tracking</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeFeedbackPanel;

