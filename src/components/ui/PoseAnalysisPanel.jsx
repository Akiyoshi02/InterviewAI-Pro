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
        return 'text-green-600 bg-green-50';
      case 'fair':
        return 'text-yellow-600 bg-yellow-50';
      case 'poor':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getHeadPositionColor = (position) => {
    return position === 'centered' ? 'text-green-600 bg-green-50' : 'text-yellow-600 bg-yellow-50';
  };

  const getEyeContactColor = (contact) => {
    switch (contact) {
      case 'good':
        return 'text-green-600 bg-green-50';
      case 'fair':
        return 'text-yellow-600 bg-yellow-50';
      case 'poor':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getConfidenceColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBarColor = (score) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
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
    <div className={cn('bg-white rounded-lg shadow-lg p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-lg font-semibold text-gray-800">Body Language</h3>
        <span className="text-xs text-gray-500">{getTimeSinceUpdate()}</span>
      </div>

      {/* Overall Confidence Score */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Confidence</span>
          <span className={cn('text-2xl font-bold', getConfidenceColor(confidence))}>
            {confidence}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={cn('h-3 rounded-full transition-all duration-500', getConfidenceBarColor(confidence))}
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>

      {/* Posture */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Posture</span>
          <span className={cn('text-xs font-semibold px-2 py-1 rounded-full uppercase', getPostureColor(posture))}>
            {posture}
          </span>
        </div>
        <div className="flex items-center space-x-2 text-xs text-gray-600">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={cn('h-2 rounded-full transition-all duration-500', getPostureColor(posture).includes('green') ? 'bg-green-500' : getPostureColor(posture).includes('yellow') ? 'bg-yellow-500' : 'bg-red-500')}
              style={{ width: `${postureScore}%` }}
            />
          </div>
          <span className="min-w-[35px] text-right">{postureScore}%</span>
        </div>
        {slouching && (
          <p className="text-xs text-red-600 flex items-center mt-1">
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
          <span className="text-sm font-medium text-gray-700">Head Position</span>
          <span className={cn('text-xs font-semibold px-2 py-1 rounded-full uppercase', getHeadPositionColor(headPosition))}>
            {headPosition}
          </span>
        </div>
        {headPosition !== 'centered' && (
          <p className="text-xs text-yellow-600 flex items-center">
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
          <span className="text-sm font-medium text-gray-700">Eye Contact</span>
          <span className={cn('text-xs font-semibold px-2 py-1 rounded-full uppercase', getEyeContactColor(eyeContact))}>
            {eyeContact}
          </span>
        </div>
        {eyeContact !== 'good' && (
          <p className="text-xs text-yellow-600 flex items-center">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            Look towards the camera
          </p>
        )}
      </div>

      {/* Fidgeting Warning */}
      {fidgeting && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
          <p className="text-xs text-yellow-700 flex items-center">
            <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Excessive hand movement detected. Try to stay calm and composed.
          </p>
        </div>
      )}

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-3">
        <p className="text-xs text-blue-700 font-medium mb-1">💡 Body Language Tips</p>
        <ul className="text-xs text-blue-600 space-y-1 ml-4 list-disc">
          <li>Sit upright with shoulders back</li>
          <li>Keep head level and face camera</li>
          <li>Maintain steady eye contact</li>
          <li>Use natural hand gestures</li>
        </ul>
      </div>
    </div>
  );
};

export default PoseAnalysisPanel;
