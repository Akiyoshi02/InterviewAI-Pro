import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import LoadingState from '../../components/ui/LoadingState';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';

const InterviewLobby = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();

  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    loadInterview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  const loadInterview = async () => {
    if (!interviewId) {
      setError('No interview ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await apiClient.interviews.getInterview(interviewId);
      if (result.success) {
        setInterview(result.interview);
      } else {
        setError('Failed to load interview details');
      }
    } catch (err) {
      setError(err.message || 'Failed to load interview');
    } finally {
      setLoading(false);
    }
  };

  const handleStartInterview = () => {
    setStarting(true);
    // Redirect to live interview session
    navigate(`/live-interview-session?interviewId=${interviewId}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
        <Header
          userType={user?.accountType?.toLowerCase() === 'company' ? 'company' : 'candidate'}
          isAuthenticated={isAuthenticated}
          onLogout={handleLogout}
        />
        <div className="h-14 xs:h-16" />
        <div className="flex items-center justify-center py-20 px-4">
          <LoadingState
            title="Loading interview details"
            message="Confirming the session setup."
            variant="card"
            tone="secondary"
          />
        </div>
      </div>
    );
  }

  if (error || !interview) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
        <Header
          userType={user?.accountType?.toLowerCase() === 'company' ? 'company' : 'candidate'}
          isAuthenticated={isAuthenticated}
          onLogout={handleLogout}
        />
        <div className="h-14 xs:h-16" />
        <div className="flex items-center justify-center py-20 px-4">
          <div className="max-w-md w-full text-center">
            <Icon name="AlertCircle" className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              Unable to Load Interview
            </h2>
            <p className="text-gray-600 dark:text-slate-400 mb-6">
              {error || 'Interview not found'}
            </p>
            <Button onClick={() => navigate('/candidate-dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      {/* Background Effects */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-24 right-0 h-60 w-60 sm:h-80 sm:w-80 bg-gradient-to-br from-blue-400/30 to-purple-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-[-10%] h-[300px] w-[300px] sm:h-[420px] sm:w-[420px] bg-gradient-to-tr from-indigo-300/25 via-blue-200/20 to-transparent blur-[120px]" />
      </div>

      <Header
        userType={user?.accountType?.toLowerCase() === 'company' ? 'company' : 'candidate'}
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
      />

      <div className="h-14 xs:h-16" />

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-8 text-white">
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <Icon name="Video" className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Interview Lobby</h1>
                <p className="text-blue-100 text-sm mt-1">Your interview is ready to begin</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8 space-y-8">
            {/* Interview Details */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <Icon name="Info" className="w-5 h-5 text-blue-600" />
                Interview Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                  <p className="text-xs text-gray-600 dark:text-slate-400 mb-1">Position</p>
                  <p className="font-semibold text-gray-900 dark:text-slate-100">
                    {interview.jobRole || 'Not specified'}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                  <p className="text-xs text-gray-600 dark:text-slate-400 mb-1">Experience Level</p>
                  <p className="font-semibold text-gray-900 dark:text-slate-100">
                    {interview.experienceLevel || 'Not specified'}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                  <p className="text-xs text-gray-600 dark:text-slate-400 mb-1">Duration</p>
                  <p className="font-semibold text-gray-900 dark:text-slate-100">
                    {interview.duration || 30} minutes
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                  <p className="text-xs text-gray-600 dark:text-slate-400 mb-1">Interview Type</p>
                  <p className="font-semibold text-gray-900 dark:text-slate-100">
                    {interview.interviewTypes?.join(', ') || 'Standard'}
                  </p>
                </div>
              </div>
            </div>

            {/* Before You Start */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <Icon name="CheckCircle" className="w-5 h-5 text-green-600" />
                Before You Start
              </h2>
              <div className="space-y-3">
                {[
                  'Ensure your camera and microphone are working properly',
                  'Find a quiet location with good lighting',
                  'Have a stable internet connection',
                  'Keep a copy of your resume handy for reference',
                  'Be prepared to answer behavioral and technical questions',
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <Icon name="Check" className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-gray-700 dark:text-slate-300">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical Requirements */}
            <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-3">
                <Icon name="AlertTriangle" className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                    Important
                  </p>
                  <p className="text-xs text-yellow-800 dark:text-yellow-200">
                    The interview session will use your device's camera and microphone. Please grant permissions when prompted.
                    Make sure you're using a supported browser (Chrome, Edge, or Safari recommended).
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-200 dark:border-slate-700">
              <Button
                onClick={() => navigate('/candidate-dashboard')}
                variant="outline"
                className="flex-1"
              >
                <Icon name="ArrowLeft" className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <Button
                onClick={handleStartInterview}
                loading={starting}
                disabled={starting}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
              >
                {!starting && <Icon name="Video" className="w-4 h-4 mr-2" />}
                {starting ? 'Starting...' : 'Start Interview'}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-6 text-center text-sm text-gray-600 dark:text-slate-400"
        >
          <p>Having technical issues? Contact support for assistance.</p>
        </motion.div>
      </div>
    </div>
  );
};

export default InterviewLobby;

