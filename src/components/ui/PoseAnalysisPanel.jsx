/**
 * Pose Analysis Panel
 * Displays real-time body language metrics during interview
 * Shows posture, head position, eye contact, and confidence score
 */

import React from 'react';
import { cn } from '../../utils/cn';

const PoseAnalysisPanel = ({ poseMetrics, className }) => {
  const {
    posture,
    postureScore,
    headPosition,
    eyeContact,
    confidence,
    slouching,
    fidgeting,
    lastUpdated,
  } = poseMetrics;

  // Determine colors based on metric values
  const getPostureColor = (status) => {
    switch (status) {
      case 'good':
        return 'text-green-700 bg-green-50 dark:text-emerald-300 dark:bg-emerald-500/10';
      case 'fair':
        return 'text-yellow-700 bg-yellow-50 dark:text-amber-300 dark:bg-amber-500/10';
      case 'poor':
        return 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-500/10';
      default:
        return 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-700/40';
    }
  };

  const getHeadPositionColor = (position) => {
    return position === 'centered'
      ? 'text-green-700 bg-green-50 dark:text-emerald-300 dark:bg-emerald-500/10'
      : 'text-yellow-700 bg-yellow-50 dark:text-amber-300 dark:bg-amber-500/10';
  };

  const getEyeContactColor = (contact) => {
    switch (contact) {
      case 'good':
        return 'text-green-700 bg-green-50 dark:text-emerald-300 dark:bg-emerald-500/10';
      case 'fair':
        return 'text-yellow-700 bg-yellow-50 dark:text-amber-300 dark:bg-amber-500/10';
      case 'poor':
        return 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-500/10';
      default:
        return 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-700/40';
    }
  };

  const getConfidenceColor = (score) => {
    if (score >= 80) return 'text-green-600 dark:text-emerald-400';
    if (score >= 60) return 'text-yellow-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getConfidenceBarColor = (score) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getPostureBarColor = (status) => {
    switch (status) {
      case 'good':
        return 'bg-green-500';
      case 'fair':
        return 'bg-yellow-500';
      case 'poor':
        return 'bg-red-500';
      default:
        return 'bg-slate-400';
    }
  };

  // Format last updated time
  const getTimeSinceUpdate = () => {
    if (!lastUpdated) return 'Not active';
    const seconds = Math.floor((Date.now() - lastUpdated) / 1000);
    if (seconds < 2) return 'Live';
    if (seconds < 60) return `${seconds}s ago`;
    return 'Inactive';
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-4 sm:p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur',
        className
      )}
    >
      <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_10%_10%,rgba(59,130,246,0.1),transparent_40%),radial-gradient(circle_at_90%_0%,rgba(147,51,234,0.15),transparent_45%)]" />
      <div className="relative z-10 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/40 dark:border-slate-700/60 pb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Body Language</h3>
          <span className="text-xs font-medium text-gray-500 dark:text-slate-400 bg-gray-100/70 dark:bg-slate-900/60 px-2.5 py-1 rounded-full">
            {getTimeSinceUpdate()}
          </span>
        </div>

      {/* Overall Confidence Score */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Confidence</span>
          <span className={cn('text-2xl font-bold', getConfidenceColor(confidence))}>
            {confidence}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3">
          <div
            className={cn('h-3 rounded-full transition-all duration-500', getConfidenceBarColor(confidence))}
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>

      {/* Posture */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Posture</span>
          <span className={cn('text-xs font-semibold px-2 py-1 rounded-full uppercase', getPostureColor(posture))}>
            {posture}
          </span>
        </div>
        <div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-slate-400">
          <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className={cn('h-2 rounded-full transition-all duration-500', getPostureBarColor(posture))}
              style={{ width: `${postureScore}%` }}
            />
          </div>
          <span className="min-w-[35px] text-right">{postureScore}%</span>
        </div>
        {slouching && (
          <p className="text-xs text-red-600 dark:text-red-400 flex items-center mt-1">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Slouching detected
          </p>
        )}
      </div>

      {/* Head Position */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Head Position</span>
          <span className={cn('text-xs font-semibold px-2 py-1 rounded-full uppercase', getHeadPositionColor(headPosition))}>
            {headPosition}
          </span>
        </div>
        {headPosition !== 'centered' && (
          <p className="text-xs text-yellow-600 dark:text-amber-400 flex items-center">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            Keep head level and upright
          </p>
        )}
      </div>

      {/* Eye Contact */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Eye Contact</span>
          <span className={cn('text-xs font-semibold px-2 py-1 rounded-full uppercase', getEyeContactColor(eyeContact))}>
            {eyeContact}
          </span>
        </div>
        {eyeContact !== 'good' && (
          <p className="text-xs text-yellow-600 dark:text-amber-400 flex items-center">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            Look towards the camera
          </p>
        )}
      </div>

      {/* Fidgeting Warning */}
      {fidgeting && (
        <div className="bg-yellow-50 border border-yellow-200 dark:bg-amber-500/10 dark:border-amber-500/30 rounded-lg p-2">
          <p className="text-xs text-yellow-700 dark:text-amber-200 flex items-center">
            <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Excessive hand movement detected. Try to stay calm and composed.
          </p>
        </div>
      )}

      {/* Tips */}
        <div className="bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-lg p-3 mt-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-200 mb-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M9 21h6v-1H9v1zm3-20a7 7 0 00-4.67 12.24c.5.44.78 1.05.78 1.7V17a2 2 0 002 2h3.78a2 2 0 002-2v-2.06c0-.65.28-1.26.78-1.7A7 7 0 0012 1zm3.2 11.24A3.08 3.08 0 0014 14.62V17h-4v-2.38a3.08 3.08 0 00-1.2-2.38A5 5 0 1115.2 12.24z" />
            </svg>
          </span>
          Body Language Tips
        </div>
        <ul className="text-xs text-blue-600 dark:text-blue-200/80 space-y-1 ml-4 list-disc">
          <li>Sit upright with shoulders back</li>
          <li>Keep head level and face camera</li>
          <li>Maintain steady eye contact</li>
          <li>Use natural hand gestures</li>
        </ul>
      </div>
      </div>
    </div>
  );
};

export default PoseAnalysisPanel;
