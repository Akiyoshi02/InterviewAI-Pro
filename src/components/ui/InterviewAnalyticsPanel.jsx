/**
 * Interview Analytics Panel
 * 
 * Comprehensive dashboard showing real-time body language analytics including:
 * - Overall interview presence score
 * - Posture analysis with detailed breakdown
 * - Eye contact and attention metrics
 * - Face orientation visualization
 * - Body language composure
 * - Real-time feedback and tips
 * 
 * Enhanced version of PoseAnalysisPanel with face-mesh integration
 */

import React, { useMemo } from 'react';
import { cn } from '../../utils/cn';
import { FEEDBACK_THRESHOLDS, getScoreLevel } from '../../config/mediapipeReferenceData';

/**
 * Circular Progress Indicator
 */
const CircularProgress = ({ value, size = 80, strokeWidth = 6, color = 'blue' }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  
  const colorClasses = {
    green: 'stroke-green-500',
    yellow: 'stroke-yellow-500',
    red: 'stroke-red-500',
    blue: 'stroke-blue-500',
    purple: 'stroke-purple-500',
  };
  
  const getColorFromScore = (score) => {
    if (score >= 80) return 'green';
    if (score >= 60) return 'yellow';
    return 'red';
  };
  
  const actualColor = color === 'auto' ? getColorFromScore(value) : color;
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          className="stroke-gray-200 dark:stroke-slate-700"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress circle */}
        <circle
          className={cn('transition-all duration-500', colorClasses[actualColor])}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-gray-900 dark:text-slate-100">{value}</span>
      </div>
    </div>
  );
};

/**
 * Score Bar Component
 */
const ScoreBar = ({ label, value, maxValue = 100, showPercentage = true }) => {
  const percentage = Math.round((value / maxValue) * 100);
  
  const getBarColor = (pct) => {
    if (pct >= 80) return 'bg-green-500';
    if (pct >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700 dark:text-slate-300">{label}</span>
        {showPercentage && (
          <span className="text-gray-500 dark:text-slate-400">{percentage}%</span>
        )}
      </div>
      <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', getBarColor(percentage))}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Status Badge Component
 */
const StatusBadge = ({ status, variant = 'default' }) => {
  const variants = {
    good: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-emerald-300',
    fair: 'bg-yellow-100 text-yellow-700 dark:bg-amber-500/10 dark:text-amber-300',
    poor: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300',
    default: 'bg-gray-100 text-gray-700 dark:bg-slate-700/40 dark:text-slate-300',
    direct: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-emerald-300',
    slight: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    moderate: 'bg-yellow-100 text-yellow-700 dark:bg-amber-500/10 dark:text-amber-300',
    away: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300',
    centered: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-emerald-300',
    tilted: 'bg-yellow-100 text-yellow-700 dark:bg-amber-500/10 dark:text-amber-300',
    lowered: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  };
  
  return (
    <span className={cn(
      'px-2 py-0.5 rounded-full text-xs font-semibold uppercase',
      variants[status] || variants.default
    )}>
      {status}
    </span>
  );
};

/**
 * Metric Card Component
 */
const MetricCard = ({ title, icon, children, className }) => (
  <div className={cn(
    'bg-white/50 dark:bg-slate-900/30 rounded-xl p-3 border border-gray-100 dark:border-slate-700/50',
    className
  )}>
    <div className="flex items-center gap-2 mb-2">
      <span className="text-lg">{icon}</span>
      <h4 className="text-sm font-semibold text-gray-800 dark:text-slate-200">{title}</h4>
    </div>
    {children}
  </div>
);

/**
 * Face Orientation Indicator
 */
const FaceOrientationIndicator = ({ yaw, pitch, roll }) => {
  // Clamp values for display
  const clampedYaw = Math.max(-45, Math.min(45, yaw));
  const clampedPitch = Math.max(-45, Math.min(45, pitch));
  
  // Calculate position (center is 50%, range is ±25%)
  const xPos = 50 + (clampedYaw / 45) * 25;
  const yPos = 50 + (clampedPitch / 45) * 25;
  
  return (
    <div className="relative w-full aspect-square max-w-[100px] mx-auto">
      {/* Grid background */}
      <div className="absolute inset-0 border-2 border-gray-300 dark:border-slate-600 rounded-lg">
        {/* Center lines */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-300 dark:bg-slate-600" />
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300 dark:bg-slate-600" />
        
        {/* Target zone */}
        <div className="absolute top-1/4 left-1/4 right-1/4 bottom-1/4 border-2 border-dashed border-green-400/50 rounded-lg" />
      </div>
      
      {/* Face position indicator */}
      <div
        className="absolute w-4 h-4 bg-blue-500 rounded-full shadow-lg transition-all duration-100 transform -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${xPos}%`, top: `${yPos}%` }}
      >
        {/* Rotation indicator */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: `rotate(${roll}deg)` }}
        >
          <div className="w-0.5 h-2 bg-white rounded-full" />
        </div>
      </div>
      
      {/* Labels */}
      <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 text-[10px] text-gray-500">Up</div>
      <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-[10px] text-gray-500">Down</div>
      <div className="absolute top-1/2 -left-6 transform -translate-y-1/2 text-[10px] text-gray-500">L</div>
      <div className="absolute top-1/2 -right-6 transform -translate-y-1/2 text-[10px] text-gray-500">R</div>
    </div>
  );
};

/**
 * Main Interview Analytics Panel
 */
const InterviewAnalyticsPanel = ({ 
  metrics,
  className,
  compact = false,
}) => {
  const {
    pose = {},
    face = {},
    bodyLanguage = {},
    scores = {},
    feedback = {},
    lastUpdated,
  } = metrics || {};

  // Format last updated time
  const getTimeSinceUpdate = () => {
    if (!lastUpdated) return 'Not active';
    const seconds = Math.floor((Date.now() - lastUpdated) / 1000);
    if (seconds < 2) return 'Live';
    if (seconds < 60) return `${seconds}s ago`;
    return 'Inactive';
  };

  // Overall status
  const overallLevel = getScoreLevel(scores.overall || 0);

  if (compact) {
    // Compact view for smaller spaces
    return (
      <div className={cn(
        'relative overflow-hidden rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-4 shadow-lg backdrop-blur',
        className
      )}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Analytics</h3>
          <StatusBadge status={overallLevel} />
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <ScoreBar label="Posture" value={scores.posture || 0} />
          <ScoreBar label="Attention" value={scores.attention || 0} />
          <ScoreBar label="Composure" value={scores.bodyLanguage || 0} />
          <ScoreBar label="Overall" value={scores.overall || 0} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'relative overflow-hidden rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-4 sm:p-5 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur',
      className
    )}>
      {/* Background gradient */}
      <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_10%_10%,rgba(59,130,246,0.1),transparent_40%),radial-gradient(circle_at_90%_0%,rgba(147,51,234,0.15),transparent_45%)]" />
      
      <div className="relative z-10 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200/60 dark:border-slate-700/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Interview Analytics
            </h3>
          </div>
          <span className="text-xs font-medium text-gray-500 dark:text-slate-400 bg-gray-100/70 dark:bg-slate-900/60 px-2.5 py-1 rounded-full">
            {getTimeSinceUpdate()}
          </span>
        </div>

        {/* Overall Score */}
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10 rounded-2xl p-4 border border-blue-100 dark:border-blue-500/20">
          <div className="flex-1">
            <h4 className="text-sm font-medium text-gray-600 dark:text-slate-400 mb-1">
              Interview Presence Score
            </h4>
            <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {scores.overall || 0}
              <span className="text-sm font-normal text-gray-500 ml-1">/ 100</span>
            </p>
            <StatusBadge status={overallLevel} />
          </div>
          <CircularProgress value={scores.overall || 0} size={80} color="auto" />
        </div>

        {/* Score Breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard title="Posture" icon="🧍">
            <ScoreBar label="Alignment" value={pose.shoulderAlignment || 0} />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-slate-400">Status</span>
              <StatusBadge status={pose.posture || 'good'} />
            </div>
            {pose.slouching && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <span>⚠️</span> Slouching detected
              </p>
            )}
          </MetricCard>

          <MetricCard title="Eye Contact" icon="👁️">
            <ScoreBar label="Attention" value={face.eyeContactScore || scores.attention || 0} />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-slate-400">Status</span>
              <StatusBadge status={face.eyeContactStatus || 'good'} />
            </div>
            {face.isSpeaking && (
              <p className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <span>🎤</span> Speaking
              </p>
            )}
          </MetricCard>
        </div>

        {/* Face Orientation */}
        {face.yaw !== undefined && (
          <MetricCard title="Face Orientation" icon="🎯" className="col-span-2">
            <div className="flex items-center gap-4">
              <FaceOrientationIndicator 
                yaw={face.yaw || 0} 
                pitch={face.pitch || 0} 
                roll={face.roll || 0} 
              />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-slate-400">Yaw (L/R)</span>
                  <span className="font-mono">{(face.yaw || 0).toFixed(1)}°</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-slate-400">Pitch (U/D)</span>
                  <span className="font-mono">{(face.pitch || 0).toFixed(1)}°</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-slate-400">Roll (Tilt)</span>
                  <span className="font-mono">{(face.roll || 0).toFixed(1)}°</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 dark:text-slate-400">Looking</span>
                  <StatusBadge status={face.faceOrientationStatus || 'direct'} />
                </div>
              </div>
            </div>
          </MetricCard>
        )}

        {/* Body Language */}
        <MetricCard title="Body Language" icon="🤲">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-gray-600 dark:text-slate-400">Head Position</span>
              <div className="mt-1">
                <StatusBadge status={pose.headPosition || 'centered'} />
              </div>
            </div>
            <div>
              <span className="text-xs text-gray-600 dark:text-slate-400">Composure</span>
              <div className="mt-1">
                <StatusBadge status={bodyLanguage.fidgeting ? 'fidgeting' : 'calm'} variant={bodyLanguage.fidgeting ? 'poor' : 'good'} />
              </div>
            </div>
          </div>
          {bodyLanguage.fidgeting && (
            <div className="mt-3 bg-yellow-50 dark:bg-amber-500/10 border border-yellow-200 dark:border-amber-500/30 rounded-lg p-2">
              <p className="text-xs text-yellow-700 dark:text-amber-200 flex items-center gap-1">
                <span>⚠️</span> Excessive movement detected - try to stay calm
              </p>
            </div>
          )}
        </MetricCard>

        {/* Feedback Section */}
        {(feedback.posture || feedback.eyeContact || feedback.composure) && (
          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">💡</span>
              <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-200">
                Real-time Feedback
              </h4>
            </div>
            <ul className="space-y-1.5 text-xs text-blue-600 dark:text-blue-200/80">
              {feedback.posture && <li>• {feedback.posture}</li>}
              {feedback.eyeContact && <li>• {feedback.eyeContact}</li>}
              {feedback.composure && <li>• {feedback.composure}</li>}
            </ul>
          </div>
        )}

        {/* Quick Tips */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 border border-green-200 dark:border-green-500/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">✨</span>
            <h4 className="text-sm font-semibold text-green-700 dark:text-green-200">
              Pro Tips
            </h4>
          </div>
          <ul className="grid grid-cols-2 gap-1.5 text-xs text-green-600 dark:text-green-200/80">
            <li className="flex items-center gap-1">
              <span>📐</span> Sit upright
            </li>
            <li className="flex items-center gap-1">
              <span>👀</span> Look at camera
            </li>
            <li className="flex items-center gap-1">
              <span>😊</span> Stay relaxed
            </li>
            <li className="flex items-center gap-1">
              <span>🤚</span> Steady hands
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default InterviewAnalyticsPanel;
