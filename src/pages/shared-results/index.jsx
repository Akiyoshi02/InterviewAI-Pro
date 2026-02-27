import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import apiClient from '../../services/apiClient.js';

const getGrade = (score) => {
  if (score == null) return 'N/A';
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'C+';
  if (score >= 65) return 'C';
  return 'D';
};

const getScoreColor = (score) => {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-blue-600';
  return 'text-amber-600';
};

const buildRadarData = (evalObj, questions) => {
  const techScore = evalObj?.technicalSkills?.score ?? null;
  const commScore = evalObj?.communicationSkills?.score ?? null;
  const qScores = (questions || []).filter((q) => q?.score != null).map((q) => {
    const s = typeof q.score === 'number' ? q.score : parseFloat(q.score);
    return Number.isFinite(s) ? (s > 10 ? s : s * 10) : null;
  }).filter((s) => s != null);
  const avg = qScores.length > 0 ? Math.round(qScores.reduce((a, b) => a + b, 0) / qScores.length) : null;
  const overall = evalObj?.overallScore ?? null;
  return [
    { dimension: 'Technical', score: techScore ?? avg ?? overall ?? 0 },
    { dimension: 'Communication', score: commScore ?? overall ?? 0 },
    { dimension: 'Answer Quality', score: avg ?? overall ?? 0 },
    { dimension: 'Overall', score: overall ?? 0 },
  ];
};

const SharedResultsPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) { setError('Invalid link.'); setLoading(false); return; }
    apiClient.interviews.getSharedResults(token)
      .then((res) => {
        if (res?.success) { setData(res.interview); }
        else { setError(res?.error || 'Results not found.'); }
      })
      .catch(() => setError('Failed to load shared results.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <LoadingState title="Loading shared results" message="Please wait..." variant="fullscreen" />;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
        <div className="text-center max-w-md">
          <Icon name="AlertCircle" size={48} className="mx-auto text-amber-500 mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Results unavailable</h1>
          <p className="text-gray-600 mb-6">{error || 'This shared link may have expired.'}</p>
          <Button onClick={() => navigate('/')} variant="primary">Go to Homepage</Button>
        </div>
      </div>
    );
  }

  const evalObj = data.evaluation || {};
  const overallScore = data.overallScore ?? evalObj?.overallScore ?? null;
  const readinessLevel = data.readinessLevel ?? evalObj?.readinessLevel ?? null;
  const strengths = Array.isArray(evalObj?.strengths) ? evalObj.strengths : [];
  const weaknesses = Array.isArray(evalObj?.weaknesses) ? evalObj.weaknesses : [];
  const questions = Array.isArray(data.questions) ? data.questions : [];
  const radarData = buildRadarData(evalObj, questions);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium mb-3">
              <Icon name="Share2" size={12} /> Shared Interview Results
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{data.jobRole || 'Interview'}</h1>
            {data.completedAt && (
              <p className="text-sm text-gray-500 mt-1">
                Completed {new Date(data.completedAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
              </p>
            )}
          </div>

          {/* Score Cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-2xl bg-white border border-gray-100 shadow p-4 text-center">
              <p className={`text-3xl font-bold ${getScoreColor(overallScore)}`}>
                {overallScore != null ? `${Math.round(overallScore)}%` : '—'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Score</p>
            </div>
            <div className="rounded-2xl bg-white border border-gray-100 shadow p-4 text-center">
              <p className="text-3xl font-bold text-purple-600">{getGrade(overallScore)}</p>
              <p className="text-xs text-gray-500 mt-1">Grade</p>
            </div>
            <div className="rounded-2xl bg-white border border-gray-100 shadow p-4 text-center">
              <p className="text-base font-semibold text-gray-900 capitalize">
                {readinessLevel ? String(readinessLevel).replace(/_/g, ' ') : '—'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Readiness</p>
            </div>
          </div>

          {/* Radar */}
          {radarData.some((d) => d.score > 0) && (
            <div className="rounded-2xl bg-white border border-gray-100 shadow p-5 mb-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Performance Dimensions</h2>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                    <Radar dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} />
                    <Tooltip formatter={(v) => [`${v}%`, 'Score']} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {strengths.length > 0 && (
              <div className="rounded-2xl bg-white border border-gray-100 shadow p-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                  <Icon name="ThumbsUp" size={14} className="text-emerald-500" /> Strengths
                </h2>
                <ul className="space-y-1">
                  {strengths.map((s, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {weaknesses.length > 0 && (
              <div className="rounded-2xl bg-white border border-gray-100 shadow p-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                  <Icon name="Target" size={14} className="text-amber-500" /> Areas to Improve
                </h2>
                <ul className="space-y-1">
                  {weaknesses.map((w, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />{w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="text-center pt-2">
            <p className="text-sm text-gray-500 mb-3">Want to practice your own interview?</p>
            <Button onClick={() => navigate('/register')} variant="primary" iconName="ArrowRight" iconPosition="right">
              Get Started Free
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SharedResultsPage;
