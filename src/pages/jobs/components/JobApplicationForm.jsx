import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import apiClient from '../../../services/apiClient.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const normalizeUploadsPath = (value) => {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('uploads/')) {
    return `/${trimmed}`;
  }
  const uploadDirs = ['profile-photos/', 'company-logos/', 'company-verifications/', 'resumes/'];
  const matched = uploadDirs.find((dir) => lower.startsWith(dir));
  if (matched) {
    return `/uploads/${trimmed}`;
  }
  return '';
};

const JobApplicationForm = ({ job, onClose, onSuccess }) => {
  const { user, setAuthenticatedUser } = useAuth();
  const [formData, setFormData] = useState({
    coverLetter: '',
    answers: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [isUpdatingResume, setIsUpdatingResume] = useState(false);
  const [resumeStatus, setResumeStatus] = useState(null);
  const resumeInputRef = useRef(null);

  const handleAnswerChange = (questionId, value) => {
    setFormData((prev) => {
      const existingIndex = prev.answers.findIndex((a) => a.questionId === questionId);
      const newAnswers = [...prev.answers];
      
      if (existingIndex >= 0) {
        newAnswers[existingIndex] = { questionId, answer: value };
      } else {
        newAnswers.push({ questionId, answer: value });
      }
      
      return { ...prev, answers: newAnswers };
    });
  };

  const getAnswer = (questionId) => {
    const answer = formData.answers.find((a) => a.questionId === questionId);
    return answer?.answer || '';
  };

  const validateForm = () => {
    // Check required custom questions
    if (job.applicationQuestions) {
      for (const question of job.applicationQuestions) {
        if (question.required && !getAnswer(question.id)) {
          setError(`Please answer: ${question.question}`);
          return false;
        }
      }
    }
    return true;
  };

  const handleResumeFileChange = (event) => {
    const file = event?.target?.files?.[0];
    if (!file) {
      setResumeFile(null);
      return;
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      setResumeStatus({
        type: 'error',
        message: 'Resume must be a PDF or Word document.',
      });
      setResumeFile(null);
      if (resumeInputRef.current) {
        resumeInputRef.current.value = '';
      }
      return;
    }

    // Validate file size (10 MB max)
    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      setResumeStatus({
        type: 'error',
        message: 'Resume must be 10 MB or less.',
      });
      setResumeFile(null);
      if (resumeInputRef.current) {
        resumeInputRef.current.value = '';
      }
      return;
    }

    setResumeStatus(null);
    setResumeFile(file);
  };

  const handleUpdateResume = async () => {
    if (!resumeFile) return;
    setResumeStatus(null);
    setIsUpdatingResume(true);
    try {
      const response = await apiClient.auth.updateResume(resumeFile);
      if (!response?.success || !response?.user) {
        throw new Error('Unable to update the resume. Please try again.');
      }
      setAuthenticatedUser(response.user);
      setResumeFile(null);
      if (resumeInputRef.current) {
        resumeInputRef.current.value = '';
      }
      setResumeStatus({
        type: 'success',
        message: 'Resume updated successfully. Your profile resume has been updated.',
      });
    } catch (error) {
      setResumeStatus({
        type: 'error',
        message: error?.message || 'Failed to update resume.',
      });
    } finally {
      setIsUpdatingResume(false);
    }
  };

  const handleViewResume = () => {
    if (!user?.resumeUrl) return;
    const resumeUrl = `${API_BASE_URL}${normalizeUploadsPath(user.resumeUrl)}`;
    window.open(resumeUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Build payload, only including fields that have values
      const payload = {
        answers: Array.isArray(formData.answers) ? formData.answers : [],
      };
      
      // Only include resumeUrl if it exists
      if (user?.resumeUrl) {
        payload.resumeUrl = user.resumeUrl;
      }
      
      // Only include coverLetter if it has content
      if (formData.coverLetter && formData.coverLetter.trim()) {
        payload.coverLetter = formData.coverLetter.trim();
      }

      const result = await apiClient.applications.submit(job.id, payload);

      if (result.success) {
        if (onSuccess) onSuccess(result.application);
      } else {
        setError(result.error || 'Failed to submit application');
      }
    } catch (err) {
      console.error('Application submission error:', err);
      setError(err.message || 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full my-8"
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Icon name="FileText" className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                  Apply to {job.title}
                </h2>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  {job.department} • {job.location}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Icon name="X" className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Resume Section */}
            <div className="space-y-4">
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4">
                <div className="flex items-start gap-3">
                  <Icon name="FileCheck" className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-1">
                      Resume / CV
                    </h3>
                    {user?.resumeUrl ? (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600 dark:text-slate-400">
                          Your profile resume will be submitted with this application
                          {user.resumeOriginalName && (
                            <span className="block text-xs mt-1 font-medium">
                              Current file: {user.resumeOriginalName}
                            </span>
                          )}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleViewResume}
                            disabled={submitting || isUpdatingResume}
                            className="text-xs"
                          >
                            <Icon name="Eye" className="w-3.5 h-3.5 mr-1.5" />
                            View Current Resume
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => resumeInputRef.current?.click()}
                            disabled={submitting || isUpdatingResume}
                            className="text-xs"
                          >
                            <Icon name="Upload" className="w-3.5 h-3.5 mr-1.5" />
                            Update Resume
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-red-600 dark:text-red-400">
                          No resume on file. Please upload a resume to apply.
                        </p>
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={() => resumeInputRef.current?.click()}
                          disabled={submitting || isUpdatingResume}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Icon name="Upload" className="w-3.5 h-3.5 mr-1.5" />
                          Upload Resume
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Resume Update Section */}
              {resumeFile && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-4"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <Icon name="FileText" className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        New Resume: {resumeFile.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
                        This will update your profile resume for all future applications
                      </p>
                    </div>
                  </div>
                  
                  {resumeStatus && (
                    <div className={`mb-3 p-2 rounded text-xs ${
                      resumeStatus.type === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                    }`}>
                      {resumeStatus.message}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={handleUpdateResume}
                      loading={isUpdatingResume}
                      disabled={isUpdatingResume || submitting}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <div className="flex items-center gap-1.5">
                        {!isUpdatingResume && <Icon name="Check" className="w-3.5 h-3.5" />}
                        <span>{isUpdatingResume ? 'Updating...' : 'Save & Update Resume'}</span>
                      </div>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setResumeFile(null);
                        setResumeStatus(null);
                        if (resumeInputRef.current) {
                          resumeInputRef.current.value = '';
                        }
                      }}
                      disabled={isUpdatingResume || submitting}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </motion.div>
              )}

              <input
                ref={resumeInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleResumeFileChange}
                className="hidden"
              />
            </div>

            {/* Cover Letter (Optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Cover Letter <span className="text-gray-500">(Optional)</span>
              </label>
              <textarea
                value={formData.coverLetter}
                onChange={(e) => setFormData((prev) => ({ ...prev, coverLetter: e.target.value }))}
                placeholder="Tell us why you're a great fit for this role..."
                rows={6}
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 resize-none"
              />
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                Share your experience, skills, and why you're interested in this position
              </p>
            </div>

            {/* Custom Application Questions */}
            {job.applicationQuestions && job.applicationQuestions.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  <Icon name="HelpCircle" className="w-4 h-4" />
                  Additional Questions
                </h3>
                {job.applicationQuestions.map((question, index) => (
                  <div key={question.id || index}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      {question.question}
                      {question.required && <span className="text-red-600 ml-1">*</span>}
                    </label>
                    
                    {question.type === 'TEXTAREA' ? (
                      <textarea
                        value={getAnswer(question.id)}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        required={question.required}
                        disabled={submitting}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 resize-none"
                      />
                    ) : question.type === 'SELECT' ? (
                      <div className="relative group">
                        <select
                          value={getAnswer(question.id)}
                          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                          required={question.required}
                          disabled={submitting}
                          className="w-full appearance-none px-3 pr-10 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                        >
                          <option value="">Select an option...</option>
                          {question.options?.map((option, i) => (
                            <option key={i} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <Icon
                          name="ChevronDown"
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-slate-400 pointer-events-none transition-transform duration-200 group-focus-within:rotate-180"
                        />
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={getAnswer(question.id)}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        required={question.required}
                        disabled={submitting}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                <div className="flex items-start gap-2">
                  <Icon name="AlertCircle" className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !user?.resumeUrl}
                loading={submitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <div className="flex items-center gap-2">
                  {!submitting && <Icon name="Send" className="w-4 h-4" />}
                  <span>{submitting ? 'Submitting...' : 'Submit Application'}</span>
                </div>
              </Button>
            </div>

            {!user?.resumeUrl && (
              <p className="text-xs text-center text-red-600 dark:text-red-400">
                Please upload a resume to your profile before submitting an application
              </p>
            )}
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default JobApplicationForm;

