import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import LoadingState from '../../../components/ui/LoadingState';
import apiClient from '../../../services/apiClient.js';

const InterviewReviewEnhanced = ({ interviewId, onClose }) => {
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
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadInterview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  const loadInterview = async () => {
    try {
      setLoading(true);
      const result = await apiClient.interviews.getInterview(interviewId);
      if (result.success) {
        setInterview(result.interview);
        // Load existing review if any
        await loadExistingReview();
      }
    } catch (err) {
      console.error('Failed to load interview:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingReview = async () => {
    try {
      const result = await apiClient.reviews.getReviewForInterview(interviewId);
      if (result.success && result.review) {
        setReview({
          rating: result.review.rating || 0,
          technicalScore: result.review.technicalScore || 0,
          communicationScore: result.review.communicationScore || 0,
          problemSolvingScore: result.review.problemSolvingScore || 0,
          culturalFitScore: result.review.culturalFitScore || 0,
          notes: result.review.notes || '',
          recommendation: result.review.recommendation || 'UNDECIDED',
        });
      }
    } catch (err) {
      // No existing review, that's fine
    }
  };

  const handleSubmitReview = async () => {
    if (!review.notes.trim()) {
      alert('Please provide review notes');
      return;
    }

    try {
      setSubmitting(true);
      const result = await apiClient.reviews.submitReview({
        interviewId,
        ...review,
      });

      if (result.success) {
        alert('Review submitted successfully!');
        if (onClose) onClose();
      }
    } catch (err) {
      alert('Failed to submit review: ' + err.message);
    } finally {
      setSubmitting(false);
    }
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
        className={`w-full h-2 rounded-lg appearance-none cursor-pointer bg-gradient-to-r from-gray-200 to-${color}-600 dark:from-slate-700 dark:to-${color}-600`}
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
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            Interview Review
          </h2>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
            {interview.candidate?.fullName || 'Candidate'} • {interview.jobRole}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Icon name="X" className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Interview Info Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800">
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
            {interview.overallScore || 'N/A'}
          </p>
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
                  <video
                    controls
                    className="w-full"
                    src={interview.recordingUrl}
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
            </div>
          )}

          {/* AI Evaluation Tab */}
          {activeTab === 'evaluation' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                AI-Generated Evaluation
              </h3>

              {interview.evaluation ? (
                <>
                  {/* Overall Score */}
                  <div className="p-6 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                        Overall Score
                      </p>
                      <div className="text-5xl font-bold text-purple-600 dark:text-purple-400">
                        {interview.overallScore || 'N/A'}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">
                        Readiness: {interview.readinessLevel || 'Not assessed'}
                      </p>
                    </div>
                  </div>

                  {/* Evaluation Content */}
                  <div className="p-6 rounded-xl bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                    <pre className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                      {typeof interview.evaluation === 'string'
                        ? interview.evaluation
                        : JSON.stringify(interview.evaluation, null, 2)}
                    </pre>
                  </div>
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

              {/* Recommendation */}
              <div className="p-6 rounded-xl bg-white dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">
                  Hiring Recommendation
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'STRONG_YES', label: 'Strong Yes', color: 'green' },
                    { value: 'YES', label: 'Yes', color: 'blue' },
                    { value: 'MAYBE', label: 'Maybe', color: 'yellow' },
                    { value: 'NO', label: 'No', color: 'red' },
                    { value: 'STRONG_NO', label: 'Strong No', color: 'red' },
                    { value: 'UNDECIDED', label: 'Undecided', color: 'gray' },
                  ].map((rec) => (
                    <button
                      key={rec.value}
                      onClick={() => setReview({ ...review, recommendation: rec.value })}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        review.recommendation === rec.value
                          ? `border-${rec.color}-600 bg-${rec.color}-50 dark:bg-${rec.color}-900/20`
                          : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <p className={`text-sm font-medium ${
                        review.recommendation === rec.value
                          ? `text-${rec.color}-700 dark:text-${rec.color}-300`
                          : 'text-gray-700 dark:text-slate-300'
                      }`}>
                        {rec.label}
                      </p>
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

