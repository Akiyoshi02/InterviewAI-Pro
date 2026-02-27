import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import LoadingState from '../../../components/ui/LoadingState';
import apiClient from '../../../services/apiClient.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useInterviewRealtimeFeed } from '../../../hooks/useInterviewRealtimeFeed';
import {
  INTERVIEW_FEED_EVENTS,
  combineRealtimeEventTypes,
} from '../../../constants/realtimeFeedEvents.js';

/** Rubric criteria for AI evaluation (explainable output for recruiters/SMEs). */
const EVALUATION_RUBRIC_CRITERIA = [
  { key: 'technicalSkills', label: 'Technical Skills', icon: 'Code' },
  { key: 'communicationSkills', label: 'Communication Skills', icon: 'MessageSquare' },
  { key: 'problemSolving', label: 'Problem Solving', icon: 'Puzzle' },
  { key: 'culturalFit', label: 'Cultural Fit', icon: 'Users' },
];

/** STAR component labels for per-answer scaffolding (NFR4: explain in terms consistent with STAR). */
const STAR_COMPONENTS = [
  { key: 'situation', label: 'Situation', icon: 'MapPin' },
  { key: 'task', label: 'Task', icon: 'Target' },
  { key: 'action', label: 'Action', icon: 'Zap' },
  { key: 'result', label: 'Result', icon: 'Award' },
];

const InterviewReviewEnhanced = ({ interviewId, onClose }) => {
  const { user } = useAuth();
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [review, setReview] = useState({
    rating: 0,
    technicalScore: 0,
    communicationScore: 0,
    problemSolvingScore: 0,
    culturalFitScore: 0,
    notes: '',
    recommendation: 'UNDECIDED',
    overrideOverall: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [reviewFormError, setReviewFormError] = useState('');
  const [reviewFormSuccess, setReviewFormSuccess] = useState('');
  const [evaluationError, setEvaluationError] = useState('');
  const [recordingPlaybackUrl, setRecordingPlaybackUrl] = useState('');
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [recordingError, setRecordingError] = useState('');
  const [runningEvaluation, setRunningEvaluation] = useState(false);
  const loadInterviewRef = useRef(null);
  const realtimeRefreshTimeoutRef = useRef(null);

  const loadInterview = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiClient.interviews.getInterview(interviewId);
      if (result.success) {
        setInterview(result.interview);
        // Load existing review if any
        await loadExistingReview();
      }
    } catch {
      // Error state handled by interview === null check in render
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  useEffect(() => {
    loadInterview();
  }, [loadInterview]);

  useEffect(() => {
    loadInterviewRef.current = loadInterview;
  }, [loadInterview]);

  useEffect(() => {
    let cancelled = false;

    const hydrateRecordingUrl = async () => {
      if (!interview?.id || !interview?.recordingUrl) {
        setRecordingPlaybackUrl('');
        setRecordingError('');
        return;
      }

      setRecordingLoading(true);
      setRecordingError('');
      try {
        const signed = await apiClient.interviews.getRecordingUrl(interview.id);
        if (!cancelled && signed?.success && signed?.recordingUrl) {
          setRecordingPlaybackUrl(signed.recordingUrl);
          return;
        }

        const fallback = await apiClient.uploads.getDownloadUrl(interview.recordingUrl);
        if (!cancelled) {
          setRecordingPlaybackUrl(fallback || interview.recordingUrl);
        }
      } catch (error) {
        if (!cancelled) {
          setRecordingError(error?.message || 'Unable to resolve recording playback URL.');
          const fallback = await apiClient.uploads.getDownloadUrl(interview.recordingUrl);
          setRecordingPlaybackUrl(fallback || interview.recordingUrl);
        }
      } finally {
        if (!cancelled) {
          setRecordingLoading(false);
        }
      }
    };

    void hydrateRecordingUrl();
    return () => {
      cancelled = true;
    };
  }, [interview?.id, interview?.recordingUrl]);

  useInterviewRealtimeFeed({
    userId: user?.id,
    enabled: Boolean(user?.id && interviewId),
    eventTypes: combineRealtimeEventTypes(
      INTERVIEW_FEED_EVENTS.lifecycle,
      INTERVIEW_FEED_EVENTS.pipeline,
      INTERVIEW_FEED_EVENTS.reviews,
    ),
    onFeedUpdate: (feed = {}, { initial }) => {
      if (initial) return;
      if (!feed?.[interviewId]) return;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        loadInterviewRef.current?.();
      }, 300);
    },
  });

  useEffect(() => () => {
    if (realtimeRefreshTimeoutRef.current) {
      clearTimeout(realtimeRefreshTimeoutRef.current);
    }
  }, []);

  const loadExistingReview = async () => {
    try {
      const result = await apiClient.reviews.getReviewForInterview(interviewId);
      if (result.success && result.review) {
        const r = result.review;
        setReview({
          rating: r.rating ?? 0,
          technicalScore: r.technicalScore ?? 0,
          communicationScore: r.communicationScore ?? 0,
          problemSolvingScore: r.problemSolvingScore ?? 0,
          culturalFitScore: r.culturalFitScore ?? 0,
          notes: r.notes || '',
          recommendation: r.recommendation || r.decision || 'UNDECIDED',
          overrideOverall: Boolean(r.overrideOverall),
        });
      }
    } catch (err) {
      // No existing review, that's fine
    }
  };

  const handleSubmitReview = async () => {
    setReviewFormError('');
    setReviewFormSuccess('');
    if (!review.notes.trim()) {
      setReviewFormError('Please provide review notes before submitting.');
      return;
    }

    try {
      setSubmitting(true);
      const result = await apiClient.reviews.submitReview({
        interviewId,
        ...review,
        overrideOverall: review.overrideOverall,
      });

      if (result.success) {
        setReviewFormSuccess('Review submitted successfully!');
        const interviewResult = await apiClient.interviews.getInterview(interviewId);
        if (interviewResult.success && interviewResult.interview) {
          setInterview(interviewResult.interview);
        }
        setTimeout(() => {
          if (onClose) onClose();
        }, 1200);
      }
    } catch (err) {
      setReviewFormError('Failed to submit review: ' + (err.message || 'Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunEvaluationNow = async () => {
    setEvaluationError('');
    try {
      setRunningEvaluation(true);
      const result = await apiClient.interviews.runEvaluation(interviewId);
      if (result?.success && result?.interview) {
        setInterview(result.interview);
      } else {
        const refreshed = await apiClient.interviews.getInterview(interviewId);
        if (refreshed?.success && refreshed?.interview) {
          setInterview(refreshed.interview);
        }
      }
    } catch (error) {
      setEvaluationError(error?.message || 'Failed to run evaluation right now.');
    } finally {
      setRunningEvaluation(false);
    }
  };

  const SLIDER_TRACK_CLASSES = {
    purple: 'bg-gradient-to-r from-gray-200 to-purple-600 dark:from-slate-700 dark:to-purple-600',
    blue: 'bg-gradient-to-r from-gray-200 to-blue-600 dark:from-slate-700 dark:to-blue-600',
    green: 'bg-gradient-to-r from-gray-200 to-green-600 dark:from-slate-700 dark:to-green-600',
    orange: 'bg-gradient-to-r from-gray-200 to-orange-500 dark:from-slate-700 dark:to-orange-500',
    pink: 'bg-gradient-to-r from-gray-200 to-pink-500 dark:from-slate-700 dark:to-pink-500',
  };

  const ScoreSlider = ({ label, value, onChange, color = 'purple' }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
          {label}
        </label>
        <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
          {value}/10
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="10"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${SLIDER_TRACK_CLASSES[color] || SLIDER_TRACK_CLASSES.purple}`}
      />
      <div className="flex justify-between text-xs text-gray-500 dark:text-slate-500">
        <span>Poor</span>
        <span>Average</span>
        <span>Excellent</span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <LoadingState
        title="Loading interview review"
        message="Pulling interview details and AI evaluation."
        variant="card"
        tone="secondary"
      />
    );
  }

  if (!interview) {
    return (
      <div className="text-center py-12">
        <Icon name="AlertCircle" className="w-12 h-12 text-red-600 mx-auto mb-3" />
        <p className="text-gray-900 dark:text-slate-100">Interview not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            Interview Review
          </h2>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
            {interview.candidate?.fullName || 'Candidate'} • {interview.jobRole}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const report = {
                schemaVersion: '1.0',
                exportDate: new Date().toISOString(),
                interviewId: interview.id,
                candidate: {
                  id: interview.candidateId,
                  fullName: interview.candidate?.fullName,
                  email: interview.candidate?.email,
                },
                jobRole: interview.jobRole,
                startedAt: interview.startedAt,
                endedAt: interview.endedAt,
                status: interview.status,
                overallScore: interview.overallScore,
                finalOverallScore: interview.finalOverallScore ?? interview.overallScore,
                finalScoreSource: interview.finalScoreSource || 'AI',
                readinessLevel: interview.readinessLevel,
                evaluation: interview.evaluation
                  ? (typeof interview.evaluation === 'object'
                    ? {
                        technicalSkills: interview.evaluation.technicalSkills,
                        communicationSkills: interview.evaluation.communicationSkills,
                        problemSolving: interview.evaluation.problemSolving,
                        culturalFit: interview.evaluation.culturalFit,
                        strengths: interview.evaluation.strengths,
                        weaknesses: interview.evaluation.weaknesses,
                        recommendations: interview.evaluation.recommendations,
                        detailedFeedback: interview.evaluation.detailedFeedback,
                      }
                    : null)
                  : null,
                perQuestionEvaluation: Array.isArray(interview.questions)
                  ? interview.questions
                      .filter((q) => q?.feedback)
                      .map((q) => ({
                        questionId: q.id,
                        question: q.question,
                        answer: q.answer,
                        score: q.feedback?.score,
                        starAnalysis: q.feedback?.starAnalysis,
                        strengths: q.feedback?.strengths,
                        weaknesses: q.feedback?.weaknesses,
                      }))
                  : [],
                reviewSummary: {
                  rating: review.rating,
                  technicalScore: review.technicalScore,
                  communicationScore: review.communicationScore,
                  problemSolvingScore: review.problemSolvingScore,
                  culturalFitScore: review.culturalFitScore,
                  recommendation: review.recommendation,
                  overrideOverall: review.overrideOverall,
                  notesExcerpt: review.notes ? review.notes.slice(0, 200) : null,
                },
              };
              const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `interview-evaluation-${interviewId}-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Icon name="Download" className="w-4 h-4 mr-2" />
            Export report
          </Button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Icon name="X" className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Interview Info Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800">
        <div>
          <p className="text-xs text-gray-600 dark:text-slate-400">Duration</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            {interview.duration || 30} min
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-600 dark:text-slate-400">Status</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            {interview.status || 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-600 dark:text-slate-400">AI Score</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            {interview.overallScore != null ? interview.overallScore : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-600 dark:text-slate-400">Final Score</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            {interview.finalOverallScore != null
              ? interview.finalOverallScore
              : interview.overallScore != null
                ? interview.overallScore
                : 'N/A'}
          </p>
          {interview.finalScoreSource === 'SME' && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">SME override</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-600 dark:text-slate-400">Date</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            {interview.startedAt ? new Date(interview.startedAt).toLocaleDateString() : 'N/A'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-slate-700">
        <div className="flex gap-4">
          {[
            { id: 'overview', label: 'Overview', icon: 'LayoutDashboard' },
            { id: 'calibration', label: 'AI vs SME', icon: 'Scale' },
            { id: 'transcript', label: 'Transcript', icon: 'FileText' },
            { id: 'video', label: 'Recording', icon: 'Video' },
            { id: 'evaluation', label: 'AI Evaluation', icon: 'Brain' },
            { id: 'review', label: 'My Review', icon: 'Star' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon name={tab.icon} className="w-4 h-4" />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className="min-h-[400px]"
        >
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Candidate Info */}
                <div className="p-6 rounded-xl bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Icon name="User" className="w-5 h-5 text-purple-600" />
                    Candidate Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-600 dark:text-slate-400">Name</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        {interview.candidate?.fullName || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-slate-400">Email</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        {interview.candidate?.email || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-slate-400">Experience Level</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        {interview.experienceLevel || 'N/A'}
                      </p>
                    </div>
                    {interview.candidate?.skills && interview.candidate.skills.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-600 dark:text-slate-400 mb-2">Skills</p>
                        <div className="flex flex-wrap gap-2">
                          {interview.candidate.skills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs text-blue-700 dark:text-blue-300"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Interview Details */}
                <div className="p-6 rounded-xl bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Icon name="Briefcase" className="w-5 h-5 text-purple-600" />
                    Interview Details
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-600 dark:text-slate-400">Position</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        {interview.jobRole || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-slate-400">Interview Types</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {interview.interviewTypes && interview.interviewTypes.length > 0 ? (
                          interview.interviewTypes.map((type, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-xs text-purple-700 dark:text-purple-300"
                            >
                              {type}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-600 dark:text-slate-400">N/A</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-slate-400">Duration</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        {interview.duration || 30} minutes
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-slate-400">Started At</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        {interview.startedAt
                          ? new Date(interview.startedAt).toLocaleString()
                          : 'Not started'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={() => setActiveTab('transcript')}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Icon name="FileText" className="w-4 h-4 mr-2" />
                  View Transcript
                </Button>
                <Button
                  onClick={() => setActiveTab('review')}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  <Icon name="Star" className="w-4 h-4 mr-2" />
                  Submit Review
                </Button>
              </div>
            </div>
          )}

          {/* Calibration Tab: AI vs SME comparison */}
          {activeTab === 'calibration' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                AI vs SME Calibration
              </h3>
              <p className="text-sm text-gray-600 dark:text-slate-400">
                Compare AI-generated scores with your (SME) ratings. Use &quot;My Review&quot; to submit or update your scores, and optionally override the final score with your assessment.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-xl bg-white dark:bg-slate-900/50 border border-purple-200 dark:border-purple-800">
                  <h4 className="text-base font-semibold text-purple-700 dark:text-purple-300 mb-4 flex items-center gap-2">
                    <Icon name="Brain" className="w-5 h-5" />
                    AI Evaluation
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-slate-500">Overall Score</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                        {interview.overallScore != null ? interview.overallScore : 'N/A'}
                      </p>
                    </div>
                    {interview.evaluation && typeof interview.evaluation === 'object' && (
                      <>
                        {interview.evaluation.technicalSkills?.score != null && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-slate-500">Technical</p>
                            <p className="text-lg font-medium">{interview.evaluation.technicalSkills.score}</p>
                          </div>
                        )}
                        {interview.evaluation.communicationSkills?.score != null && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-slate-500">Communication</p>
                            <p className="text-lg font-medium">{interview.evaluation.communicationSkills.score}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="p-6 rounded-xl bg-white dark:bg-slate-900/50 border border-amber-200 dark:border-amber-800">
                  <h4 className="text-base font-semibold text-amber-700 dark:text-amber-300 mb-4 flex items-center gap-2">
                    <Icon name="UserCheck" className="w-5 h-5" />
                    SME (Your) Review
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-slate-500">Overall (0–10 → 0–100)</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                        {review.rating != null ? review.rating * 10 : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-slate-500">Technical</p>
                      <p className="text-lg font-medium">{review.technicalScore}/10</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-slate-500">Communication</p>
                      <p className="text-lg font-medium">{review.communicationScore}/10</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-slate-500">Problem Solving</p>
                      <p className="text-lg font-medium">{review.problemSolvingScore}/10</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-slate-500">Cultural Fit</p>
                      <p className="text-lg font-medium">{review.culturalFitScore}/10</p>
                    </div>
                  </div>
                </div>
              </div>

              {(interview.overallScore != null || review.rating > 0) && (
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
                    Agreement: AI overall {interview.overallScore != null ? interview.overallScore : 'N/A'} vs SME overall {review.rating != null ? review.rating * 10 : '—'}
                    {interview.overallScore != null && review.rating != null && (
                      <span className="ml-2 text-gray-500 dark:text-slate-500">
                        (diff: {Math.abs(interview.overallScore - review.rating * 10).toFixed(0)} pts)
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Transcript Tab */}
          {activeTab === 'transcript' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                  Interview Transcript
                </h3>
                {interview.transcript && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const blob = new Blob([interview.transcript], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `interview-transcript-${interviewId}.txt`;
                      a.click();
                    }}
                  >
                    <Icon name="Download" className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>

              {interview.transcript ? (
                <div className="p-6 rounded-xl bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 max-h-[600px] overflow-y-auto">
                  <pre className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                    {interview.transcript}
                  </pre>
                </div>
              ) : (
                <div className="p-12 text-center rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                  <Icon name="FileText" className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-slate-400">
                    Transcript not available for this interview
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Video Tab */}
          {activeTab === 'video' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                Interview Recording
              </h3>

              {interview.recordingUrl ? (
                <div className="rounded-xl overflow-hidden bg-black">
                  {recordingLoading && (
                    <div className="px-4 py-3 text-sm text-blue-200 bg-blue-900/40">
                      Resolving secure recording URL...
                    </div>
                  )}
                  {recordingError && (
                    <div className="px-4 py-3 text-xs text-amber-200 bg-amber-900/50 border-b border-amber-700/40">
                      {recordingError}
                    </div>
                  )}
                  <video
                    controls
                    className="w-full"
                    src={recordingPlaybackUrl || interview.recordingUrl}
                  >
                    Your browser does not support video playback.
                  </video>
                </div>
              ) : (
                <div className="p-12 text-center rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                  <Icon name="Video" className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-slate-400 mb-2">
                    Video recording not available
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-500">
                    This interview may not have been recorded or the recording is still processing
                  </p>
                </div>
              )}

              {interview.recording && (
                <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">Recording Metadata</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600 dark:text-slate-400">
                    <div>
                      <span className="font-medium text-gray-900 dark:text-slate-200">Path:</span>{' '}
                      <span className="break-all">{interview.recording.path || interview.recordingUrl}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-900 dark:text-slate-200">Mime Type:</span>{' '}
                      {interview.recording.mimeType || 'UNKNOWN'}
                    </div>
                    <div>
                      <span className="font-medium text-gray-900 dark:text-slate-200">Size:</span>{' '}
                      {Number.isFinite(Number(interview.recording.size))
                        ? `${Math.round(Number(interview.recording.size) / 1024)} KB`
                        : 'UNKNOWN'}
                    </div>
                    <div>
                      <span className="font-medium text-gray-900 dark:text-slate-200">Created At:</span>{' '}
                      {interview.recording.createdAt
                        ? new Date(interview.recording.createdAt).toLocaleString()
                        : 'UNKNOWN'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Evaluation Tab — rubric-tied explainability for recruiters/SMEs */}
          {activeTab === 'evaluation' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                  AI-Generated Evaluation
                </h3>
                {(interview?.pendingEvaluation || interview?.llmUnavailable) && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleRunEvaluationNow}
                    disabled={runningEvaluation}
                    className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white"
                  >
                    {runningEvaluation ? 'Deep Analysis Running...' : 'Run AI Evaluation Now'}
                  </Button>
                )}
              </div>

              {evaluationError && (
                <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                  {evaluationError}
                </div>
              )}

              {interview.evaluation ? (
                <>
                  {/* Overall Score */}
                  <div className="p-6 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                        Overall Score
                      </p>
                      <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                        {interview.overallScore != null ? interview.overallScore : 'N/A'}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">
                        Readiness: {interview.readinessLevel || 'Not assessed'}
                      </p>
                    </div>
                  </div>

                  {/* Rubric-tied criteria: score + feedback per criterion */}
                  {typeof interview.evaluation === 'object' && interview.evaluation !== null && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {EVALUATION_RUBRIC_CRITERIA.map(({ key, label, icon }) => {
                          const criterion = interview.evaluation[key];
                          if (!criterion || (criterion.score == null && !criterion.feedback)) return null;
                          const score = criterion.score != null ? criterion.score : null;
                          const feedback = typeof criterion.feedback === 'string' ? criterion.feedback : null;
                          return (
                            <div
                              key={key}
                              className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700"
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <Icon name={icon} className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                <h4 className="font-semibold text-gray-900 dark:text-slate-100">{label}</h4>
                              </div>
                              {score != null && (
                                <p className="text-sm text-gray-600 dark:text-slate-400 mb-1">
                                  <span className="font-medium text-gray-900 dark:text-slate-100">Score: </span>
                                  {score}/100
                                </p>
                              )}
                              {feedback && (
                                <p className="text-sm text-gray-700 dark:text-slate-300 mt-2 leading-relaxed">
                                  {feedback}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Strengths */}
                      {Array.isArray(interview.evaluation.strengths) && interview.evaluation.strengths.length > 0 && (
                        <div className="p-5 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                          <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
                            <Icon name="ThumbsUp" className="w-4 h-4" />
                            Strengths
                          </h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-green-800 dark:text-green-200">
                            {interview.evaluation.strengths.map((s, i) => (
                              <li key={i}>{typeof s === 'string' ? s : String(s)}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Weaknesses */}
                      {Array.isArray(interview.evaluation.weaknesses) && interview.evaluation.weaknesses.length > 0 && (
                        <div className="p-5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                          <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                            <Icon name="AlertCircle" className="w-4 h-4" />
                            Areas for Improvement
                          </h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-amber-800 dark:text-amber-200">
                            {interview.evaluation.weaknesses.map((w, i) => (
                              <li key={i}>{typeof w === 'string' ? w : String(w)}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Recommendations */}
                      {Array.isArray(interview.evaluation.recommendations) && interview.evaluation.recommendations.length > 0 && (
                        <div className="p-5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                          <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                            <Icon name="Lightbulb" className="w-4 h-4" />
                            Recommendations
                          </h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
                            {interview.evaluation.recommendations.map((r, i) => (
                              <li key={i}>{typeof r === 'string' ? r : String(r)}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Detailed feedback */}
                      {interview.evaluation.detailedFeedback && (
                        <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                          <h4 className="font-semibold text-gray-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                            <Icon name="FileText" className="w-4 h-4" />
                            Detailed Feedback
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {interview.evaluation.detailedFeedback}
                          </p>
                        </div>
                      )}

                      {/* Per-answer STAR component assessment (2.6.4 i, NFR4: explain in terms consistent with STAR) */}
                      {Array.isArray(interview.questions) &&
                        interview.questions.some((q) => q?.feedback?.starAnalysis && typeof q.feedback.starAnalysis === 'object') && (
                        <div className="p-5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                          <h4 className="font-semibold text-indigo-900 dark:text-indigo-100 mb-2 flex items-center gap-2">
                            <Icon name="ListOrdered" className="w-4 h-4" />
                            Per-answer STAR component assessment
                          </h4>
                          <p className="text-xs text-indigo-700 dark:text-indigo-300 mb-4">
                            Explanations are aligned with the STAR method (Situation, Task, Action, Result) for each answered question.
                          </p>
                          <div className="space-y-4">
                            {interview.questions
                              .filter((q) => q?.feedback?.starAnalysis && typeof q.feedback.starAnalysis === 'object')
                              .map((q, idx) => {
                                const sa = q.feedback.starAnalysis;
                                return (
                                  <div
                                    key={q.id || idx}
                                    className="p-4 rounded-lg bg-white dark:bg-slate-800/50 border border-indigo-100 dark:border-indigo-800"
                                  >
                                    <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1">
                                      Question {idx + 1}
                                    </p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-2 line-clamp-2">
                                      {q.question}
                                    </p>
                                    {q.answer && (
                                      <p className="text-xs text-gray-600 dark:text-slate-400 mb-3 line-clamp-2">
                                        Answer: {q.answer}
                                      </p>
                                    )}
                                    {q.feedback?.score != null && (
                                      <p className="text-xs text-gray-500 dark:text-slate-500 mb-2">
                                        Score: {q.feedback.score}/10
                                      </p>
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {STAR_COMPONENTS.map(({ key, label, icon }) => {
                                        const comp = sa[key];
                                        if (!comp || (comp.present == null && !comp.quality && !comp.feedback))
                                          return null;
                                        const present = comp.present;
                                        const quality = comp.quality;
                                        const feedback = typeof comp.feedback === 'string' ? comp.feedback : null;
                                        return (
                                          <div
                                            key={key}
                                            className="p-2 rounded bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
                                          >
                                            <div className="flex items-center gap-1.5 mb-1">
                                              <Icon name={icon} className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                              <span className="text-xs font-semibold text-gray-900 dark:text-slate-100">
                                                {label}
                                              </span>
                                              {present != null && (
                                                <span
                                                  className={`text-xs ${present ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}
                                                >
                                                  {present ? 'Present' : 'Missing'}
                                                </span>
                                              )}
                                            </div>
                                            {quality && (
                                              <p className="text-xs text-gray-600 dark:text-slate-400">Quality: {quality}</p>
                                            )}
                                            {feedback && (
                                              <p className="text-xs text-gray-700 dark:text-slate-300 mt-1 leading-relaxed">
                                                {feedback}
                                              </p>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {/* Raw evaluation (collapsible for transparency) */}
                      <details className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                        <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-slate-300">
                          Raw evaluation (JSON)
                        </summary>
                        <pre className="mt-3 text-xs text-gray-600 dark:text-slate-400 whitespace-pre-wrap font-mono overflow-x-auto">
                          {JSON.stringify(interview.evaluation, null, 2)}
                        </pre>
                      </details>
                    </>
                  )}

                  {/* Legacy: evaluation as string or unknown shape */}
                  {(typeof interview.evaluation !== 'object' || interview.evaluation === null) && (
                    <div className="p-6 rounded-xl bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                      <pre className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                        {typeof interview.evaluation === 'string'
                          ? interview.evaluation
                          : JSON.stringify(interview.evaluation, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-12 text-center rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                  <Icon name="Brain" className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-slate-400">
                    AI evaluation not available for this interview
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Review Tab */}
          {activeTab === 'review' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                Submit Your Review
              </h3>

              {/* Overall Rating */}
              <div className="p-6 rounded-xl bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">
                  Overall Rating
                </h4>
                <ScoreSlider
                  label="Overall Performance"
                  value={review.rating}
                  onChange={(val) => setReview({ ...review, rating: val })}
                  color="purple"
                />
              </div>

              {/* Category Scores */}
              <div className="p-6 rounded-xl bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 space-y-6">
                <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100">
                  Category Ratings
                </h4>
                
                <ScoreSlider
                  label="Technical Skills"
                  value={review.technicalScore}
                  onChange={(val) => setReview({ ...review, technicalScore: val })}
                  color="blue"
                />
                
                <ScoreSlider
                  label="Communication"
                  value={review.communicationScore}
                  onChange={(val) => setReview({ ...review, communicationScore: val })}
                  color="green"
                />
                
                <ScoreSlider
                  label="Problem Solving"
                  value={review.problemSolvingScore}
                  onChange={(val) => setReview({ ...review, problemSolvingScore: val })}
                  color="orange"
                />
                
                <ScoreSlider
                  label="Cultural Fit"
                  value={review.culturalFitScore}
                  onChange={(val) => setReview({ ...review, culturalFitScore: val })}
                  color="pink"
                />
              </div>

              {/* SME Override (calibration) */}
              <div className="p-6 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={review.overrideOverall}
                    onChange={(e) => setReview({ ...review, overrideOverall: e.target.checked })}
                    className="mt-1 h-5 w-5 rounded-full border-slate-300 dark:border-slate-600 text-amber-600 focus:ring-amber-500 dark:bg-slate-800"
                  />
                  <span className="text-sm text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-slate-100">
                    <strong>Use my overall score as the final score (override AI).</strong> When checked, the interview&apos;s final score will be your overall rating (0–10 scaled to 0–100) instead of the AI score. This supports SME calibration and human oversight.
                  </span>
                </label>
              </div>

              {/* Recommendation */}
              <div className="p-6 rounded-xl bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">
                  Hiring Recommendation
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'STRONG_YES', label: 'Strong Yes', activeClass: 'border-green-600 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' },
                    { value: 'YES', label: 'Yes', activeClass: 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' },
                    { value: 'MAYBE', label: 'Maybe', activeClass: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' },
                    { value: 'NO', label: 'No', activeClass: 'border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' },
                    { value: 'STRONG_NO', label: 'Strong No', activeClass: 'border-red-700 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' },
                    { value: 'UNDECIDED', label: 'Undecided', activeClass: 'border-gray-500 bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300' },
                  ].map((rec) => (
                    <button
                      key={rec.value}
                      onClick={() => setReview({ ...review, recommendation: rec.value })}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        review.recommendation === rec.value
                          ? rec.activeClass
                          : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <p className="text-sm font-medium">{rec.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Review Notes */}
              <div className="p-6 rounded-xl bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">
                  Review Notes *
                </h4>
                <textarea
                  value={review.notes}
                  onChange={(e) => setReview({ ...review, notes: e.target.value })}
                  placeholder="Provide detailed feedback on the candidate's performance..."
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-2">
                  Include specific examples and observations from the interview
                </p>
              </div>

              {reviewFormError && (
                <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                  {reviewFormError}
                </div>
              )}
              {reviewFormSuccess && (
                <div className="rounded-xl border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-300">
                  {reviewFormSuccess}
                </div>
              )}

              {/* Submit Button */}
              <div className="flex gap-3">
                <Button
                  onClick={() => setActiveTab('overview')}
                  variant="outline"
                  className="flex-1"
                >
                  Back to Overview
                </Button>
                <Button
                  onClick={handleSubmitReview}
                  loading={submitting}
                  disabled={submitting || !review.notes.trim()}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {!submitting && <Icon name="CheckCircle" className="w-4 h-4 mr-2" />}
                  {submitting ? 'Submitting...' : 'Submit Review'}
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default InterviewReviewEnhanced;

