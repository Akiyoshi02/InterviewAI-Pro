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
  className = ''
}) => {
  const [feedback, setFeedback] = useState(null);
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [currentScore, setCurrentScore] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // OpenAI integration
  const { evaluateAnswer, loading: aiLoading, error: aiError, clearError } = useLLM();

  // Mock feedback data for demo
  const mockFeedback = {
    score: 7.5,
    strengths: [
      "Clear problem-solving approach",
      "Good technical depth in explanation",
      "Structured answer format"
    ],
    areasForImprovement: [
      "Could provide more specific examples",
      "Consider mentioning error handling",
      "Add discussion of scalability"
    ],
    detailedFeedback: "Your answer demonstrates a solid understanding of the technical concepts and shows good problem-solving skills. The approach you described is logical and well-structured. To strengthen your response, consider providing more specific examples from your experience and discussing potential challenges or error handling scenarios.",
    suggestions: [
      "Practice using the STAR method (Situation, Task, Action, Result)",
      "Prepare specific metrics or outcomes from your projects",
      "Think about edge cases and how you would handle them"
    ]
  };

  // Analyze answer using OpenAI when new answer is received
  const analyzeCurrentAnswer = async (answer, question) => {
    if (!answer || !question) return;

    setIsAnalyzing(true);
    clearError();

    try {
      const analysisData = {
        question: question,
        answer: answer,
        expectedCriteria: [
          "Technical accuracy",
          "Problem-solving approach", 
          "Communication clarity",
          "Practical examples"
        ],
        difficulty: "medium"
      };

      const result = await evaluateAnswer(analysisData);
      
      if (result) {
        setFeedback(result);
        setCurrentScore(result?.score || 0);
        
        // Add to feedback history
        const newFeedbackEntry = {
          id: feedbackHistory?.length + 1,
          timestamp: new Date(),
          question: question,
          answer: answer,
          feedback: result
        };
        
        setFeedbackHistory(prev => [...prev, newFeedbackEntry]);
        
        // Store in localStorage for session tracking
        const sessionFeedback = JSON.parse(localStorage.getItem('interviewFeedback') || '[]');
        sessionFeedback?.push(newFeedbackEntry);
        localStorage.setItem('interviewFeedback', JSON.stringify(sessionFeedback));
        
        // Notify parent component
        onFeedbackGenerated?.(result);
      }
    } catch (error) {
      console.error('Failed to analyze answer:', error);
      
      // Fallback to mock feedback for demo
      setFeedback(mockFeedback);
      setCurrentScore(mockFeedback?.score);
      
      const mockFeedbackEntry = {
        id: feedbackHistory?.length + 1,
        timestamp: new Date(),
        question: question || "Sample question",
        answer: answer || "Sample answer",
        feedback: mockFeedback
      };
      
      setFeedbackHistory(prev => [...prev, mockFeedbackEntry]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Effect to trigger analysis when answer changes
  useEffect(() => {
    if (currentAnswer && currentQuestion && currentAnswer?.length > 50) {
      // Debounce the analysis to avoid too frequent calls
      const timeoutId = setTimeout(() => {
        analyzeCurrentAnswer(currentAnswer, currentQuestion);
      }, 2000);

      return () => clearTimeout(timeoutId);
    }
  }, [currentAnswer, currentQuestion]);

  // Load existing feedback from localStorage
  useEffect(() => {
    const savedFeedback = localStorage.getItem('interviewFeedback');
    if (savedFeedback) {
      try {
        const feedback = JSON.parse(savedFeedback);
        setFeedbackHistory(feedback);
        
        // Set current feedback to the latest one
        if (feedback?.length > 0) {
          const latestFeedback = feedback?.[feedback?.length - 1];
          setFeedback(latestFeedback?.feedback);
          setCurrentScore(latestFeedback?.feedback?.score || 0);
        }
      } catch (error) {
        console.error('Failed to load feedback history:', error);
      }
    } else {
      // Initialize with mock data for demo
      setFeedback(mockFeedback);
      setCurrentScore(mockFeedback?.score);
    }
  }, []);

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

  const clearFeedbackHistory = () => {
    setFeedbackHistory([]);
    setFeedback(null);
    setCurrentScore(0);
    localStorage.removeItem('interviewFeedback');
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
      <div className="flex items-center justify-between p-4 border-b border-white/40 dark:border-slate-700/60">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Icon name="TrendingUp" size={16} className="text-white sm:w-[18px] sm:h-[18px]" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 text-sm sm:text-base">Real-time Feedback</h3>
          {(isAnalyzing || aiLoading) && (
            <div className="flex items-center space-x-1">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-warning rounded-full animate-pulse" />
              <span className="text-xs sm:text-sm text-warning font-medium">Analyzing...</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-2">
          <div className="text-xs sm:text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded-full">
            Score · {currentScore.toFixed(1)}/10
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

      {/* AI Error Display */}
      {aiError && (
        <div className="mx-4 mt-3 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/60 rounded-2xl">
          <div className="flex items-center space-x-2">
            <Icon name="AlertTriangle" size={14} className="text-destructive sm:w-4 sm:h-4" />
            <span className="text-xs sm:text-sm text-destructive">Analysis Error: {aiError}</span>
          </div>
        </div>
      )}

      {/* Current Score */}
      {feedback && (
        <div className="p-4 border-b border-white/30 dark:border-slate-700/60">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-400">Current Answer Score</span>
            <span className={cn("font-bold text-base sm:text-lg", getScoreColor(currentScore))}>
              {currentScore?.toFixed(1)}/10
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-slate-800 rounded-full h-2 sm:h-2.5 mb-2">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500 shadow-[0_6px_18px_rgba(52,211,153,0.35)]",
                currentScore >= 8 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : currentScore >= 6 ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-rose-500 to-red-600'
              )}
              style={{ width: `${(currentScore / 10) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] sm:text-sm text-gray-500 dark:text-slate-400">
            <span>Performance</span>
            <span className={getScoreColor(currentScore)}>{getScoreLabel(currentScore)}</span>
          </div>
        </div>
      )}

      {/* Feedback Content */}
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
                <ul className="space-y-1 ml-6">
                  {feedback?.strengths?.map((strength, index) => (
                    <li key={index} className="text-xs sm:text-sm text-gray-700 dark:text-slate-300">• {strength}</li>
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
                <ul className="space-y-1 ml-6">
                  {feedback?.areasForImprovement?.map((area, index) => (
                    <li key={index} className="text-xs sm:text-sm text-gray-700 dark:text-slate-300">• {area}</li>
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
                <ul className="space-y-1 ml-6">
                  {feedback?.suggestions?.map((suggestion, index) => (
                    <li key={index} className="text-xs sm:text-sm text-gray-700 dark:text-slate-300">• {suggestion}</li>
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

      {/* Footer */}
      <div className="p-4 border-t border-white/30 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/70">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs sm:text-sm text-gray-500 dark:text-slate-400 gap-2 sm:gap-0">
          <div className="flex items-center gap-3">
            <span className="font-medium text-gray-600 dark:text-slate-300">Feedback: {aiLoading || isAnalyzing ? 'Analyzing' : 'Ready'}</span>
            <span>•</span>
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