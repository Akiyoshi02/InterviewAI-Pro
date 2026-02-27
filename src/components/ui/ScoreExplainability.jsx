/**
 * ScoreExplainability
 *
 * Renders evidence-backed justifications for each dimension of a candidate's
 * interview score. For each scored dimension, it:
 * - Shows the score with a colour-coded badge.
 * - Lists the specific evidence quotes from the transcript that support the score.
 * - Provides an AI-generated reasoning excerpt if available.
 * - Shows improvement suggestions for below-threshold scores.
 *
 * Evidence is extracted from the question-level feedback and answer text.
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../AppIcon';

const DIMENSIONS = [
  { key: 'technicalSkills', label: 'Technical Skills', icon: 'Code2', color: 'blue' },
  { key: 'communicationSkills', label: 'Communication', icon: 'MessageSquare', color: 'purple' },
  { key: 'problemSolving', label: 'Problem Solving', icon: 'Brain', color: 'indigo' },
  { key: 'overallScore', label: 'Overall', icon: 'Star', color: 'yellow' },
];

const COLOR_CLASSES = {
  blue: { badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800/40', icon: 'text-blue-500' },
  purple: { badge: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800/40', icon: 'text-purple-500' },
  indigo: { badge: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800/40', icon: 'text-indigo-500' },
  yellow: { badge: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300', border: 'border-yellow-200 dark:border-yellow-800/40', icon: 'text-yellow-500' },
  emerald: { badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800/40', icon: 'text-emerald-500' },
  red: { badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800/40', icon: 'text-red-500' },
};

const getScoreRating = (score) => {
  if (score == null) return { label: 'Not rated', color: 'indigo' };
  if (score >= 80) return { label: 'Excellent', color: 'emerald' };
  if (score >= 65) return { label: 'Good', color: 'blue' };
  if (score >= 50) return { label: 'Average', color: 'yellow' };
  return { label: 'Needs improvement', color: 'red' };
};

// Extract relevant answer snippets for a dimension
const extractEvidence = (evaluation, questions, dimensionKey) => {
  const evidence = [];

  // Direct feedback from evaluation
  const dimFeedback = evaluation?.[dimensionKey]?.feedback;
  if (dimFeedback) {
    evidence.push({ type: 'reasoning', text: dimFeedback, source: 'AI Evaluation' });
  }

  // Extract from question answers
  if (Array.isArray(questions)) {
    questions.slice(0, 5).forEach((q, i) => {
      if (!q?.answer) return;
      const qFeedback = q.feedback || q.feedbackText;
      const answerSnippet = q.answer.length > 150 ? q.answer.slice(0, 150) + '…' : q.answer;

      if (dimensionKey === 'technicalSkills' && (
        q.questionType?.toLowerCase()?.includes('technical') ||
        /algorithm|code|implement|design|system|architecture|pattern/i.test(q.question || '')
      )) {
        evidence.push({ type: 'quote', text: answerSnippet, source: `Q${i + 1}: ${(q.question || '').slice(0, 60)}…` });
        if (qFeedback) evidence.push({ type: 'feedback', text: qFeedback, source: `AI feedback for Q${i + 1}` });
      }

      if (dimensionKey === 'communicationSkills' && (
        q.questionType?.toLowerCase()?.includes('behavioral') ||
        /explain|describe|tell me|communication|teamwork|conflict/i.test(q.question || '')
      )) {
        evidence.push({ type: 'quote', text: answerSnippet, source: `Q${i + 1}: ${(q.question || '').slice(0, 60)}…` });
      }

      // General evidence for overall score
      if (dimensionKey === 'overallScore' && q.score != null) {
        const s = typeof q.score === 'number' ? q.score : parseFloat(q.score);
        if (Number.isFinite(s)) {
          evidence.push({ type: 'data', text: `Score: ${s > 10 ? s : Math.round(s * 10)}% – ${(q.question || '').slice(0, 80)}`, source: `Q${i + 1}` });
        }
      }
    });
  }

  return evidence.slice(0, 4);
};

const IMPROVEMENT_TIPS = {
  technicalSkills: [
    'Review core computer science fundamentals and data structures.',
    'Practice whiteboard coding and algorithmic thinking.',
    'Work through system design case studies.',
  ],
  communicationSkills: [
    'Use the STAR method (Situation, Task, Action, Result) for structured answers.',
    'Practice speaking clearly and concisely without filler words.',
    'Prepare concrete examples for common behavioural questions.',
  ],
  problemSolving: [
    'Think out loud when approaching problems to show your reasoning.',
    'Break problems into smaller steps before jumping to a solution.',
    'Ask clarifying questions to ensure you understand the problem.',
  ],
  overallScore: [
    'Review feedback from each question carefully.',
    'Focus on dimensions with the lowest individual scores.',
    'Book a follow-up practice session to reinforce weak areas.',
  ],
};

const EvidenceItem = ({ item }) => {
  const typeConfig = {
    reasoning: { icon: 'Cpu', label: 'AI Reasoning', bgClass: 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/30' },
    quote: { icon: 'Quote', label: 'Answer Quote', bgClass: 'bg-gray-50 dark:bg-slate-700/20 border-gray-100 dark:border-slate-700' },
    feedback: { icon: 'MessageSquare', label: 'AI Feedback', bgClass: 'bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-800/30' },
    data: { icon: 'BarChart2', label: 'Score Data', bgClass: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' },
  };
  const config = typeConfig[item.type] || typeConfig.quote;

  return (
    <div className={`rounded-xl border p-3 ${config.bgClass}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon name={config.icon} size={11} className="text-gray-400" />
        <span className="text-xs font-medium text-gray-500 dark:text-slate-400">{config.label}</span>
        <span className="text-xs text-gray-400 dark:text-slate-500 ml-auto truncate max-w-[140px]">{item.source}</span>
      </div>
      <p className="text-xs text-gray-700 dark:text-slate-300 leading-relaxed">{item.text}</p>
    </div>
  );
};

const ScoreExplainability = ({ evaluation, questions = [], showAll = false }) => {
  const [expandedKey, setExpandedKey] = useState(null);

  const dimensions = useMemo(() => {
    return DIMENSIONS.map((dim) => {
      const rawScore = dim.key === 'overallScore'
        ? evaluation?.overallScore
        : evaluation?.[dim.key]?.score;
      const score = rawScore != null ? (rawScore > 10 ? rawScore : Math.round(rawScore * 10)) : null;
      const rating = getScoreRating(score);
      const evidence = extractEvidence(evaluation, questions, dim.key);
      const tips = score != null && score < 65 ? IMPROVEMENT_TIPS[dim.key] || [] : [];
      return { ...dim, score, rating, evidence, tips };
    }).filter((d) => d.score != null || d.evidence.length > 0 || showAll);
  }, [evaluation, questions, showAll]);

  if (dimensions.length === 0) {
    return (
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 text-center">
        <Icon name="HelpCircle" size={32} className="mx-auto mb-2 text-gray-300 dark:text-slate-600" />
        <p className="text-sm text-gray-400 dark:text-slate-500">Score explainability data is not yet available for this session.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2">
        <Icon name="Lightbulb" size={16} className="text-yellow-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Score Explainability</h2>
        <span className="text-xs text-gray-400 dark:text-slate-500 ml-1">Evidence-backed justifications</span>
      </div>
      <div className="p-4 space-y-2">
        {dimensions.map((dim) => {
          const colCls = COLOR_CLASSES[dim.color] || COLOR_CLASSES.blue;
          const isExpanded = expandedKey === dim.key;
          return (
            <div key={dim.key} className={`rounded-xl border ${colCls.border} overflow-hidden`}>
              <button
                type="button"
                onClick={() => setExpandedKey(isExpanded ? null : dim.key)}
                className="w-full flex items-center justify-between gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-700/20 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <Icon name={dim.icon} size={15} className={colCls.icon} />
                  <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{dim.label}</span>
                  {dim.evidence.length > 0 && (
                    <span className="text-xs text-gray-400">{dim.evidence.length} evidence item{dim.evidence.length !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {dim.score != null && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${COLOR_CLASSES[dim.rating.color]?.badge || colCls.badge}`}>
                      {dim.score}% · {dim.rating.label}
                    </span>
                  )}
                  <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={14} className="text-gray-400" />
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-gray-100 dark:border-slate-700"
                  >
                    <div className="p-3 space-y-3">
                      {dim.evidence.length > 0 ? (
                        <div className="space-y-2">
                          {dim.evidence.map((ev, i) => (
                            <EvidenceItem key={i} item={ev} />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-slate-500 italic">No specific evidence quotes available for this dimension.</p>
                      )}

                      {dim.tips.length > 0 && (
                        <div className="mt-3 rounded-xl bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-800/30 p-3">
                          <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-2 flex items-center gap-1.5">
                            <Icon name="Lightbulb" size={12} />
                            Improvement Suggestions
                          </p>
                          <ul className="space-y-1.5">
                            {dim.tips.map((tip, i) => (
                              <li key={i} className="text-xs text-gray-700 dark:text-slate-300 flex items-start gap-1.5">
                                <span className="text-yellow-500 mt-0.5 shrink-0">-</span>
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScoreExplainability;
