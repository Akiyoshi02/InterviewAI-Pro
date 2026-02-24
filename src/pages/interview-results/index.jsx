import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import LoadingState from '../../components/ui/LoadingState';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import MaintenanceBanner from '../../components/ui/MaintenanceBanner';
import { useMaintenanceMode } from '../../hooks/useMaintenanceMode';

const formatCompanyLabel = (company) => {
  if (!company) return 'Practice Session';
  if (typeof company === 'string') return company;
  if (typeof company === 'object') {
    return company.companyName || company.fullName || company.email || 'Practice Session';
  }
  return 'Practice Session';
};

const getGrade = (score) => {
  if (score == null || score === 0) return 'N/A';
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'C+';
  if (score >= 65) return 'C';
  return 'D';
};

const getScoreColor = (score) => {
  if (score >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 70) return 'text-blue-600 dark:text-blue-400';
  return 'text-amber-600 dark:text-amber-400';
};

const InterviewResultsPage = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [interview, setInterview] = useState(null);
  const [evaluationData, setEvaluationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const loadData = useCallback(async () => {
    if (!interviewId) {
      setError('Missing interview ID');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [interviewRes, evalRes] = await Promise.allSettled([
        apiClient.interviews.getById(interviewId),
        apiClient.interviews.getEvaluation(interviewId),
      ]);

      const interviewPayload = interviewRes.status === 'fulfilled' && interviewRes.value?.success
        ? interviewRes.value.interview
        : null;
      const evalPayload = evalRes.status === 'fulfilled' && evalRes.value?.success
        ? evalRes.value.evaluation
        : null;

      if (!interviewPayload) {
        setError('Interview not found or you do not have access.');
        setInterview(null);
        setEvaluationData(null);
        setLoading(false);
        return;
      }

      setInterview(interviewPayload);
      setEvaluationData(evalPayload);

      if (interviewPayload.candidateId && user?.id && interviewPayload.candidateId !== user.id) {
        setError('You do not have access to this interview.');
      }
    } catch (err) {
      setError(err?.message || 'Failed to load results.');
      setInterview(null);
      setEvaluationData(null);
    } finally {
      setLoading(false);
    }
  }, [interviewId, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const userType = user?.accountType === 'COMPANY' ? 'company' : 'candidate';
  if (userType !== 'candidate') {
    return null;
  }

  if (loading) {
    return (
      <LoadingState
        title="Loading interview results"
        message="Fetching your evaluation and feedback."
        variant="fullscreen"
        tone="primary"
      />
    );
  }

  if (error || !interview) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 flex flex-col">
        <Header userType="candidate" isAuthenticated onLogout={handleLogout} />
        <div className="h-14 xs:h-16" />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <Icon name="AlertCircle" size={48} className="mx-auto text-amber-500 dark:text-amber-400 mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">Unable to load results</h1>
            <p className="text-gray-600 dark:text-slate-400 mb-6">{error || 'Interview not found.'}</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button onClick={loadData} variant="outline">
                Try Again
              </Button>
              <Button onClick={() => navigate('/candidate-dashboard')} variant="primary">
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const evalObj = evaluationData?.evaluation || interview.evaluation || {};
  const overallScore = evaluationData?.overallScore ?? interview.overallScore ?? evalObj?.overallScore ?? null;
  const readinessLevel = evaluationData?.readinessLevel ?? interview.readinessLevel ?? evalObj?.readinessLevel ?? null;
  const strengths = Array.isArray(evalObj?.strengths) ? evalObj.strengths : [];
  const weaknesses = Array.isArray(evalObj?.weaknesses) ? evalObj.weaknesses : [];
  const pendingEvaluation = Boolean(evaluationData?.pendingEvaluation ?? interview.pendingEvaluation);
  const questions = Array.isArray(interview?.questions) ? interview.questions : [];
  const companyName = formatCompanyLabel(interview.company);
  const jobRole = interview.jobRole || interview.position || 'Interview';
  const completedAt = interview.completedAt || interview.updatedAt || interview.createdAt;

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-24 right-0 h-60 w-60 sm:h-80 sm:w-80 bg-gradient-to-br from-blue-400/30 to-purple-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-[-10%] h-[300px] w-[300px] sm:h-[420px] sm:w-[420px] bg-gradient-to-tr from-indigo-300/25 via-blue-200/20 to-transparent blur-[120px]" />
        <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
      </div>

      <Header userType="candidate" isAuthenticated onLogout={handleLogout} />
      {maintenanceMode && <MaintenanceBanner />}
      <div className="h-14 xs:h-16" />

      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType="candidate"
            isCollapsed={isNavCollapsed}
            onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)}
          />
          <main
            className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${
              isNavCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'
            }`}
          >
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="container-responsive py-6 xs:py-8 sm:py-10 space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">
                    Interview Results
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                    {jobRole} {companyName !== 'Practice Session' ? ` · ${companyName}` : ''}
                  </p>
                  {completedAt && (
                    <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
                      Completed {new Date(completedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate('/candidate-dashboard')}
                  iconName="ArrowLeft"
                  iconPosition="left"
                >
                  Back to Dashboard
                </Button>
              </div>

              {pendingEvaluation && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Evaluation is still being generated. Refresh this page in a few moments to see your full feedback.
                  </p>
                </div>
              )}

              {/* Score & grade */}
              <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Overall performance</h2>
                <div className="flex flex-wrap items-center gap-6">
                  {overallScore != null && (
                    <div>
                      <span className={`text-3xl sm:text-4xl font-bold ${getScoreColor(overallScore)}`}>
                        {Math.round(overallScore)}%
                      </span>
                      <span className="block text-sm text-gray-500 dark:text-slate-400">Score</span>
                    </div>
                  )}
                  <div>
                    <span className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {getGrade(overallScore)}
                    </span>
                    <span className="block text-sm text-gray-500 dark:text-slate-400">Grade</span>
                  </div>
                  {readinessLevel && (
                    <div>
                      <span className="text-lg font-semibold text-gray-900 dark:text-slate-100 capitalize">
                        {String(readinessLevel).replace(/_/g, ' ')}
                      </span>
                      <span className="block text-sm text-gray-500 dark:text-slate-400">Readiness</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Strengths */}
              {strengths.length > 0 && (
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <Icon name="ThumbsUp" size={18} className="text-emerald-500" />
                    Strengths
                  </h2>
                  <ul className="list-disc list-inside space-y-1.5 text-sm text-gray-700 dark:text-slate-300">
                    {strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Areas for improvement */}
              {weaknesses.length > 0 && (
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <Icon name="Target" size={18} className="text-blue-500" />
                    Areas for improvement
                  </h2>
                  <ul className="list-disc list-inside space-y-1.5 text-sm text-gray-700 dark:text-slate-300">
                    {weaknesses.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Per-question breakdown */}
              {questions.filter((q) => q?.score != null || q?.feedback).length > 0 && (
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Question breakdown</h2>
                  <div className="space-y-4">
                    {questions.map((q, i) => {
                      if (q?.score == null && !q?.feedback) return null;
                      return (
                        <div
                          key={q?.id || i}
                          className="rounded-xl border border-white/40 dark:border-slate-700/50 p-3 sm:p-4 bg-white/50 dark:bg-slate-900/50"
                        >
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-1">
                            Q{i + 1}: {q?.question || 'Question'}
                          </p>
                          {q?.score != null && (
                            <p className={`text-sm font-semibold ${getScoreColor(q.score)}`}>
                              Score: {typeof q.score === 'number' ? Math.round(q.score) : q.score}
                            </p>
                          )}
                          {q?.feedback && (
                            <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">{q.feedback}</p>
                          )}
                          {Array.isArray(q?.strengths) && q.strengths.length > 0 && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                              Strengths: {q.strengths.join('; ')}
                            </p>
                          )}
                          {Array.isArray(q?.weaknesses) && q.weaknesses.length > 0 && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                              Improve: {q.weaknesses.join('; ')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-center pt-4">
                <Button
                  variant="primary"
                  onClick={() => navigate('/candidate-dashboard')}
                  iconName="LayoutDashboard"
                  iconPosition="left"
                >
                  Back to Dashboard
                </Button>
              </div>
            </motion.section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default InterviewResultsPage;
