import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import LoadingState from '../../components/ui/LoadingState';
import { jsPDF } from 'jspdf';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import MaintenanceBanner from '../../components/ui/MaintenanceBanner';
import { useMaintenanceMode } from '../../hooks/useMaintenanceMode';
import VoiceSpeechAnalyzer from '../../components/ui/VoiceSpeechAnalyzer';
import ScoreExplainability from '../../components/ui/ScoreExplainability';

const formatCompanyLabel = (company) => {
  if (!company) return 'Practice Session';
  if (typeof company === 'string') return company;
  if (typeof company === 'object') {
    return (
      company.displayName
      || company.name
      || company.companyName
      || company.fullName
      || company.email
      || 'Practice Session'
    );
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
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-blue-600 dark:text-blue-400';
  return 'text-amber-600 dark:text-amber-400';
};

const getBarColor = (score) => {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#3b82f6';
  return '#f59e0b';
};

const buildRadarData = (evalObj, questions) => {
  const techScore = evalObj?.technicalSkills?.score ?? null;
  const commScore = evalObj?.communicationSkills?.score ?? null;
  const qScores = questions.filter((q) => q?.score != null).map((q) => {
    const s = typeof q.score === 'number' ? q.score : parseFloat(q.score);
    return Number.isFinite(s) ? (s > 10 ? s : s * 10) : null;
  }).filter((s) => s != null);
  const avgAnswerScore = qScores.length > 0 ? Math.round(qScores.reduce((a, b) => a + b, 0) / qScores.length) : null;
  const overallScore = evalObj?.overallScore ?? null;

  return [
    { dimension: 'Technical', score: techScore ?? avgAnswerScore ?? overallScore ?? 0 },
    { dimension: 'Communication', score: commScore ?? overallScore ?? 0 },
    { dimension: 'Answer Quality', score: avgAnswerScore ?? overallScore ?? 0 },
    { dimension: 'Overall', score: overallScore ?? 0 },
    {
      dimension: 'Consistency',
      score: qScores.length >= 2
        ? Math.max(0, 100 - Math.round(Math.sqrt(qScores.reduce((sum, s) => sum + Math.pow(s - (qScores.reduce((a, b) => a + b, 0) / qScores.length), 2), 0) / qScores.length) * 2))
        : overallScore ?? 0,
    },
  ];
};

const buildQuestionChartData = (questions) => {
  return questions
    .filter((q) => q?.score != null)
    .map((q, i) => {
      const raw = typeof q.score === 'number' ? q.score : parseFloat(q.score);
      const normalized = Number.isFinite(raw) ? (raw > 10 ? raw : raw * 10) : 0;
      return {
        name: `Q${i + 1}`,
        score: Math.round(normalized),
        question: q.question ? q.question.substring(0, 60) + (q.question.length > 60 ? '…' : '') : `Question ${i + 1}`,
      };
    });
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-2 shadow-lg text-xs">
        <p className="font-medium text-gray-900 dark:text-slate-100">{payload[0].payload.question || payload[0].name}</p>
        <p className="text-blue-600 dark:text-blue-400 mt-0.5">Score: {payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

const InterviewResultsPage = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();
  const printRef = useRef(null);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [interview, setInterview] = useState(null);
  const [evaluationData, setEvaluationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

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

  const handleGetShareLink = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl).catch(() => {});
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
      return;
    }
    setShareLoading(true);
    try {
      const res = await apiClient.interviews.getShareToken(interviewId);
      if (res?.success && res?.token) {
        const url = `${window.location.origin}/shared-results/${res.token}`;
        setShareUrl(url);
        await navigator.clipboard.writeText(url).catch(() => {});
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      }
    } catch {
      // silently fail - share is non-critical
    } finally {
      setShareLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = margin;

      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Interview Results', margin, y);
      y += 10;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`${jobRole} · ${companyName}`, margin, y);
      y += 6;
      if (completedAt) {
        doc.text(`Completed: ${new Date(completedAt).toLocaleDateString(undefined, { dateStyle: 'long' })}`, margin, y);
        y += 6;
      }
      y += 4;

      // Overall Score
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 3, 3, 'FD');
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(`Overall Score: ${overallScore != null ? Math.round(overallScore) + '%' : 'N/A'}`, margin + 8, y + 8);
      doc.text(`Grade: ${getGrade(overallScore)}`, margin + 100, y + 8);
      if (readinessLevel) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`Readiness: ${String(readinessLevel).replace(/_/g, ' ')}`, margin + 8, y + 16);
      }
      y += 30;

      // Performance Dimensions
      if (radarData.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Performance Dimensions', margin, y);
        y += 6;
        radarData.forEach((d) => {
          const barW = Math.round(((d.score || 0) / 100) * (pageWidth - margin * 2 - 60));
          doc.setFillColor(59, 130, 246);
          doc.rect(margin + 50, y, barW, 5, 'F');
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(30, 41, 59);
          doc.text(d.dimension, margin, y + 4);
          doc.setTextColor(100, 116, 139);
          doc.text(`${d.score}%`, margin + 50 + barW + 3, y + 4);
          y += 9;
        });
        y += 4;
      }

      // Strengths
      if (strengths.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Strengths', margin, y);
        y += 6;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        strengths.forEach((s) => {
          const lines = doc.splitTextToSize(`• ${s}`, pageWidth - margin * 2);
          lines.forEach((line) => {
            doc.setTextColor(30, 41, 59);
            doc.text(line, margin, y);
            y += 5;
          });
        });
        y += 4;
      }

      // Areas for Improvement
      if (weaknesses.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Areas for Improvement', margin, y);
        y += 6;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        weaknesses.forEach((w) => {
          const lines = doc.splitTextToSize(`• ${w}`, pageWidth - margin * 2);
          lines.forEach((line) => {
            doc.setTextColor(30, 41, 59);
            doc.text(line, margin, y);
            y += 5;
          });
        });
        y += 4;
      }

      // Per-question summary
      const scoredQs = questions.filter((q) => q?.score != null);
      if (scoredQs.length > 0) {
        if (y > 230) { doc.addPage(); y = margin; }
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Question Scores', margin, y);
        y += 6;
        scoredQs.forEach((q, i) => {
          if (y > 260) { doc.addPage(); y = margin; }
          const raw = typeof q.score === 'number' ? q.score : parseFloat(q.score);
          const norm = Number.isFinite(raw) ? (raw > 10 ? raw : raw * 10) : 0;
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 41, 59);
          const qText = doc.splitTextToSize(`Q${i + 1}: ${q.question || 'Question'}`, pageWidth - margin * 2 - 30);
          qText.forEach((line, li) => {
            doc.text(line, margin, y + li * 5);
          });
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          doc.text(`Score: ${Math.round(norm)}%`, pageWidth - margin - 25, y + 2, { align: 'right' });
          y += qText.length * 5 + 4;
        });
      }

      doc.save(`interview-results-${interviewId}.pdf`);
    } catch {
      // PDF generation failure is non-critical
    } finally {
      setPdfLoading(false);
    }
  };

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
              <Button onClick={loadData} variant="outline">Try Again</Button>
              <Button onClick={() => navigate('/candidate-dashboard')} variant="primary">Back to Dashboard</Button>
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
  const recommendations = Array.isArray(evalObj?.recommendations) ? evalObj.recommendations : [];
  const detailedFeedback = evalObj?.detailedFeedback || null;
  const pendingEvaluation = Boolean(evaluationData?.pendingEvaluation ?? interview.pendingEvaluation);
  const questions = Array.isArray(evaluationData?.questions)
    ? evaluationData.questions
    : Array.isArray(interview?.questions) ? interview.questions : [];
  const companyName = formatCompanyLabel(interview.organization || interview.company);
  const jobRole = interview.jobRole || interview.position || 'Interview';
  const completedAt = interview.endedAt || interview.completedAt || interview.updatedAt || interview.createdAt;

  const radarData = buildRadarData(evalObj, questions);
  const questionChartData = buildQuestionChartData(questions);
  const bestQuestion = questionChartData.length > 0 ? questionChartData.reduce((a, b) => a.score > b.score ? a : b) : null;
  const worstQuestion = questionChartData.length > 1 ? questionChartData.reduce((a, b) => a.score < b.score ? a : b) : null;

  const TABS = [
    { id: 'overview', label: 'Overview', icon: 'LayoutDashboard' },
    { id: 'analytics', label: 'Analytics', icon: 'BarChart2' },
    { id: 'questions', label: 'Questions', icon: 'MessageSquare' },
    { id: 'feedback', label: 'Feedback', icon: 'BookOpen' },
    { id: 'emotion', label: 'Emotion', icon: 'Brain' },
  ];

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-24 right-0 h-60 w-60 sm:h-80 sm:w-80 bg-gradient-to-br from-blue-400/30 to-purple-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-[-10%] h-[300px] w-[300px] sm:h-[420px] sm:w-[420px] bg-gradient-to-tr from-indigo-300/25 via-blue-200/20 to-transparent blur-[120px]" />
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
          <main className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${isNavCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'}`}>
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="container-responsive py-6 xs:py-8 sm:py-10 space-y-6"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">
                    Interview Results
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                    {jobRole}{companyName !== 'Practice Session' ? ` · ${companyName}` : ''}
                  </p>
                  {completedAt && (
                    <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
                      Completed {new Date(completedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadPDF}
                    loading={pdfLoading}
                    iconName="Download"
                    iconPosition="left"
                  >
                    Export PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGetShareLink}
                    loading={shareLoading}
                    iconName={shareCopied ? 'Check' : 'Share2'}
                    iconPosition="left"
                  >
                    {shareCopied ? 'Link Copied!' : 'Share Results'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/candidate-dashboard')}
                    iconName="ArrowLeft"
                    iconPosition="left"
                  >
                    Dashboard
                  </Button>
                </div>
              </div>

              {pendingEvaluation && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Evaluation is still being generated. Refresh this page in a few moments to see your full feedback.
                  </p>
                </div>
              )}

              {/* Score Hero Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 shadow-lg text-center">
                  <span className={`text-3xl font-bold ${getScoreColor(overallScore)}`}>
                    {overallScore != null ? `${Math.round(overallScore)}%` : '—'}
                  </span>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Overall Score</p>
                </div>
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 shadow-lg text-center">
                  <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                    {getGrade(overallScore)}
                  </span>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Grade</p>
                </div>
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 shadow-lg text-center">
                  <span className="text-lg font-semibold text-gray-900 dark:text-slate-100 capitalize">
                    {readinessLevel ? String(readinessLevel).replace(/_/g, ' ') : '—'}
                  </span>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Readiness</p>
                </div>
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 shadow-lg text-center">
                  <span className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                    {questions.filter((q) => q?.score != null).length}/{questions.length}
                  </span>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Questions Scored</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 bg-white/60 dark:bg-slate-800/60 rounded-xl p-1 border border-white/40 dark:border-slate-700/50 overflow-x-auto">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <Icon name={tab.icon} size={14} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {/* Strengths & Weaknesses */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {strengths.length > 0 && (
                      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-5 shadow-lg">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                          <Icon name="ThumbsUp" size={16} className="text-emerald-500" />
                          Strengths
                        </h2>
                        <ul className="space-y-1.5">
                          {strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-300">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {weaknesses.length > 0 && (
                      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-5 shadow-lg">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                          <Icon name="Target" size={16} className="text-blue-500" />
                          Areas for Improvement
                        </h2>
                        <ul className="space-y-1.5">
                          {weaknesses.map((w, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-300">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                              {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Best/Worst question highlights */}
                  {(bestQuestion || worstQuestion) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {bestQuestion && (
                        <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-700/40 bg-emerald-50/60 dark:bg-emerald-900/20 p-4">
                          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1 flex items-center gap-1.5">
                            <Icon name="TrendingUp" size={13} /> Best Answer
                          </p>
                          <p className="text-sm text-gray-800 dark:text-slate-200 font-medium">{bestQuestion.question}</p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">{bestQuestion.score}%</p>
                        </div>
                      )}
                      {worstQuestion && worstQuestion.name !== bestQuestion?.name && (
                        <div className="rounded-xl border border-amber-200/60 dark:border-amber-700/40 bg-amber-50/60 dark:bg-amber-900/20 p-4">
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1.5">
                            <Icon name="TrendingDown" size={13} /> Needs Most Work
                          </p>
                          <p className="text-sm text-gray-800 dark:text-slate-200 font-medium">{worstQuestion.question}</p>
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-semibold">{worstQuestion.score}%</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recommendations */}
                  {recommendations.length > 0 && (
                    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-5 shadow-lg">
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                        <Icon name="Lightbulb" size={16} className="text-yellow-500" />
                        Recommendations
                      </h2>
                      <ul className="space-y-1.5">
                        {recommendations.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-300">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-yellow-500 shrink-0" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ANALYTICS TAB */}
              {activeTab === 'analytics' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {/* Radar Chart */}
                  {radarData.some((d) => d.score > 0) && (
                    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <Icon name="Radar" size={16} className="text-blue-500" />
                        Performance Dimensions
                      </h2>
                      <div className="h-64 sm:h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                            <PolarGrid stroke="#e2e8f0" className="dark:stroke-slate-700" />
                            <PolarAngleAxis
                              dataKey="dimension"
                              tick={{ fontSize: 11, fill: '#64748b' }}
                            />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                            <Radar
                              name="Score"
                              dataKey="score"
                              stroke="#3b82f6"
                              fill="#3b82f6"
                              fillOpacity={0.25}
                              strokeWidth={2}
                            />
                            <Tooltip
                              formatter={(value) => [`${value}%`, 'Score']}
                              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                              labelStyle={{ color: '#f1f5f9' }}
                              itemStyle={{ color: '#93c5fd' }}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
                        {radarData.map((d) => (
                          <div key={d.dimension} className="text-center p-2 rounded-lg bg-blue-50/50 dark:bg-blue-900/20">
                            <p className={`text-lg font-bold ${getScoreColor(d.score)}`}>{d.score}%</p>
                            <p className="text-xs text-gray-500 dark:text-slate-400">{d.dimension}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Per-question bar chart */}
                  {questionChartData.length > 0 && (
                    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <Icon name="BarChart2" size={16} className="text-purple-500" />
                        Score Per Question
                      </h2>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={questionChartData} margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                              {questionChartData.map((entry) => (
                                <Cell key={entry.name} fill={getBarColor(entry.score)} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Skill breakdown */}
                  {(evalObj?.technicalSkills?.score != null || evalObj?.communicationSkills?.score != null) && (
                    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <Icon name="Layers" size={16} className="text-indigo-500" />
                        Skill Breakdown
                      </h2>
                      <div className="space-y-4">
                        {evalObj?.technicalSkills?.score != null && (
                          <div>
                            <div className="flex justify-between text-sm mb-1.5">
                              <span className="text-gray-700 dark:text-slate-300 font-medium">Technical Skills</span>
                              <span className={`font-semibold ${getScoreColor(evalObj.technicalSkills.score)}`}>
                                {evalObj.technicalSkills.score}%
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-blue-500 transition-all duration-700"
                                style={{ width: `${evalObj.technicalSkills.score}%` }}
                              />
                            </div>
                            {evalObj.technicalSkills.feedback && (
                              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{evalObj.technicalSkills.feedback}</p>
                            )}
                          </div>
                        )}
                        {evalObj?.communicationSkills?.score != null && (
                          <div>
                            <div className="flex justify-between text-sm mb-1.5">
                              <span className="text-gray-700 dark:text-slate-300 font-medium">Communication Skills</span>
                              <span className={`font-semibold ${getScoreColor(evalObj.communicationSkills.score)}`}>
                                {evalObj.communicationSkills.score}%
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-purple-500 transition-all duration-700"
                                style={{ width: `${evalObj.communicationSkills.score}%` }}
                              />
                            </div>
                            {evalObj.communicationSkills.feedback && (
                              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{evalObj.communicationSkills.feedback}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Voice & Speech Analysis */}
                  <VoiceSpeechAnalyzer
                    transcript={interview?.transcript || interview?.conversationHistory || questions}
                    durationSeconds={interview?.duration ? interview.duration * 60 : null}
                  />
                </motion.div>
              )}

              {/* QUESTIONS TAB */}
              {activeTab === 'questions' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {questions.filter((q) => q?.score != null || q?.feedback).length > 0 ? (
                    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4">Question Breakdown</h2>
                      <div className="space-y-4">
                        {questions.map((q, i) => {
                          if (q?.score == null && !q?.feedback) return null;
                          const raw = typeof q.score === 'number' ? q.score : parseFloat(q.score);
                          const normalized = Number.isFinite(raw) ? (raw > 10 ? raw : raw * 10) : null;
                          return (
                            <div
                              key={q?.id || i}
                              className="rounded-xl border border-white/40 dark:border-slate-700/50 p-3 sm:p-4 bg-white/50 dark:bg-slate-900/50"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 flex-1">
                                  Q{i + 1}: {q?.question || 'Question'}
                                </p>
                                {normalized != null && (
                                  <span className={`text-sm font-semibold shrink-0 ${getScoreColor(normalized)}`}>
                                    {Math.round(normalized)}%
                                  </span>
                                )}
                              </div>
                              {normalized != null && (
                                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden mt-2">
                                  <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${normalized}%`, backgroundColor: getBarColor(normalized) }}
                                  />
                                </div>
                              )}
                              {q?.feedback && (
                                <p className="text-xs text-gray-600 dark:text-slate-400 mt-2">
                                  {typeof q.feedback === 'string' ? q.feedback : q.feedback?.detailedFeedback || ''}
                                </p>
                              )}
                              {Array.isArray(q?.strengths) && q.strengths.length > 0 && (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                                  <span className="font-medium">Strengths:</span> {q.strengths.join('; ')}
                                </p>
                              )}
                              {Array.isArray(q?.weaknesses) && q.weaknesses.length > 0 && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                  <span className="font-medium">Improve:</span> {q.weaknesses.join('; ')}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-16 text-gray-400 dark:text-slate-500">
                      <Icon name="MessageSquare" size={40} className="mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No per-question scoring available for this interview.</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* FEEDBACK TAB */}
              {activeTab === 'feedback' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {/* Score Explainability */}
                  <ScoreExplainability evaluation={evalObj} questions={questions} />
                  {detailedFeedback && (
                    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                        <Icon name="BookOpen" size={16} className="text-indigo-500" />
                        Detailed Feedback
                      </h2>
                      <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                        {detailedFeedback}
                      </p>
                    </div>
                  )}

                  {evalObj?.technicalSkills?.feedback && (
                    <div className="rounded-xl border border-blue-100 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-900/10 p-4">
                      <h3 className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-2">Technical Skills</h3>
                      <p className="text-sm text-gray-700 dark:text-slate-300">{evalObj.technicalSkills.feedback}</p>
                    </div>
                  )}

                  {evalObj?.communicationSkills?.feedback && (
                    <div className="rounded-xl border border-purple-100 dark:border-purple-800/40 bg-purple-50/50 dark:bg-purple-900/10 p-4">
                      <h3 className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide mb-2">Communication Skills</h3>
                      <p className="text-sm text-gray-700 dark:text-slate-300">{evalObj.communicationSkills.feedback}</p>
                    </div>
                  )}

                  {recommendations.length > 0 && (
                    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-5 shadow-lg">
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                        <Icon name="Lightbulb" size={16} className="text-yellow-500" />
                        Next Steps & Recommendations
                      </h2>
                      <ol className="space-y-2">
                        {recommendations.map((r, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-gray-700 dark:text-slate-300">
                            <span className="shrink-0 h-5 w-5 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 text-xs font-bold flex items-center justify-center">
                              {i + 1}
                            </span>
                            {r}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {!detailedFeedback && !evalObj?.technicalSkills?.feedback && !evalObj?.communicationSkills?.feedback && recommendations.length === 0 && (
                    <div className="text-center py-16 text-gray-400 dark:text-slate-500">
                      <Icon name="BookOpen" size={40} className="mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Detailed feedback will appear here once evaluation is complete.</p>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'emotion' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-1 flex items-center gap-2">
                      <Icon name="Brain" size={16} className="text-purple-500" />
                      Emotion & Sentiment Analysis
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
                      Emotion data is captured during the live interview session via facial landmark analysis. Results below reflect the session recording.
                    </p>
                    {interview?.emotionSummary ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div className="rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 p-3 text-center">
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{interview.emotionSummary.avgEngagement ?? '—'}%</p>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Engagement</p>
                          </div>
                          <div className="rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30 p-3 text-center">
                            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 capitalize">{interview.emotionSummary.dominant ?? '—'}</p>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Dominant Emotion</p>
                          </div>
                          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 p-3 text-center">
                            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{interview.emotionSummary.avgSentiment ?? '—'}%</p>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Sentiment Score</p>
                          </div>
                        </div>
                        {interview.emotionSummary.avgScores && (
                          <div className="space-y-2">
                            {Object.entries(interview.emotionSummary.avgScores).map(([emotion, score]) => (
                              <div key={emotion} className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 dark:text-slate-400 capitalize w-16 shrink-0">{emotion}</span>
                                <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${score}%` }} />
                                </div>
                                <span className="text-xs text-gray-500 w-7 text-right">{score}%</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-400 dark:text-slate-500">
                        <Icon name="Brain" size={40} className="mx-auto mb-3 opacity-40" />
                        <p className="text-sm">No emotion data available for this session.</p>
                        <p className="text-xs mt-1">Emotion tracking is captured during live AI interview sessions.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Bottom Actions */}
              <div className="flex flex-wrap justify-center gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => navigate('/practice-interview-setup')}
                  iconName="RefreshCw"
                  iconPosition="left"
                >
                  Practice Again
                </Button>
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
