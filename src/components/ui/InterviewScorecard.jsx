import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../AppIcon';
import Button from './Button';

const DEFAULT_CRITERIA = [
  { id: 'technical', label: 'Technical Knowledge', weight: 25, score: null, notes: '' },
  { id: 'communication', label: 'Communication Skills', weight: 20, score: null, notes: '' },
  { id: 'problemsolving', label: 'Problem Solving', weight: 20, score: null, notes: '' },
  { id: 'cultural', label: 'Cultural Fit', weight: 15, score: null, notes: '' },
  { id: 'motivation', label: 'Motivation & Drive', weight: 10, score: null, notes: '' },
  { id: 'experience', label: 'Relevant Experience', weight: 10, score: null, notes: '' },
];

const PRESET_RUBRICS = {
  engineering: {
    name: 'Engineering Role',
    criteria: [
      { id: 'coding', label: 'Coding & Algorithms', weight: 30, score: null, notes: '' },
      { id: 'system', label: 'System Design', weight: 25, score: null, notes: '' },
      { id: 'debugging', label: 'Debugging & Problem Solving', weight: 20, score: null, notes: '' },
      { id: 'communication', label: 'Communication & Collaboration', weight: 15, score: null, notes: '' },
      { id: 'bestpractices', label: 'Best Practices & Code Quality', weight: 10, score: null, notes: '' },
    ],
  },
  management: {
    name: 'Management / Leadership',
    criteria: [
      { id: 'leadership', label: 'Leadership & Vision', weight: 30, score: null, notes: '' },
      { id: 'communication', label: 'Communication', weight: 25, score: null, notes: '' },
      { id: 'decisionmaking', label: 'Decision Making', weight: 20, score: null, notes: '' },
      { id: 'teambuilding', label: 'Team Building', weight: 15, score: null, notes: '' },
      { id: 'strategy', label: 'Strategic Thinking', weight: 10, score: null, notes: '' },
    ],
  },
  sales: {
    name: 'Sales / Business Development',
    criteria: [
      { id: 'persuasion', label: 'Persuasion & Influencing', weight: 30, score: null, notes: '' },
      { id: 'resilience', label: 'Resilience & Persistence', weight: 20, score: null, notes: '' },
      { id: 'product', label: 'Product Knowledge', weight: 20, score: null, notes: '' },
      { id: 'customerfit', label: 'Customer Focus', weight: 20, score: null, notes: '' },
      { id: 'communication', label: 'Communication', weight: 10, score: null, notes: '' },
    ],
  },
};

const SCORE_OPTIONS = [
  { value: 1, label: '1 - Poor' },
  { value: 2, label: '2 - Below Average' },
  { value: 3, label: '3 - Average' },
  { value: 4, label: '4 - Good' },
  { value: 5, label: '5 - Excellent' },
];

const generateId = () => `crit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const InterviewScorecard = ({ jobTitle, onSubmit, readOnly = false, initialData = null }) => {
  const [criteria, setCriteria] = useState(
    initialData?.criteria || DEFAULT_CRITERIA.map((c) => ({ ...c }))
  );
  const [recommendation, setRecommendation] = useState(initialData?.recommendation || 'no_decision');
  const [overallNotes, setOverallNotes] = useState(initialData?.overallNotes || '');
  const [editing, setEditing] = useState(false);
  const [newCriterion, setNewCriterion] = useState({ label: '', weight: 10 });
  const [submitted, setSubmitted] = useState(false);
  const [selectedRubric, setSelectedRubric] = useState('');

  const totalWeight = criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

  const weightedScore = criteria.reduce((sum, c) => {
    if (c.score == null) return sum;
    return sum + (c.score * (Number(c.weight) || 0));
  }, 0) / (totalWeight || 1);

  const scoredCount = criteria.filter((c) => c.score != null).length;

  const updateCriterion = (id, field, value) => {
    setCriteria((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const addCriterion = () => {
    if (!newCriterion.label.trim()) return;
    setCriteria((prev) => [...prev, { ...newCriterion, id: generateId(), score: null, notes: '' }]);
    setNewCriterion({ label: '', weight: 10 });
  };

  const removeCriterion = (id) => {
    setCriteria((prev) => prev.filter((c) => c.id !== id));
  };

  const applyRubric = (key) => {
    if (!key || !PRESET_RUBRICS[key]) return;
    setCriteria(PRESET_RUBRICS[key].criteria.map((c) => ({ ...c })));
    setSelectedRubric(key);
  };

  const handleSubmit = () => {
    if (scoredCount === 0) return;
    const payload = { criteria, recommendation, overallNotes, weightedScore: Math.round(weightedScore * 20), submittedAt: new Date().toISOString() };
    onSubmit?.(payload);
    setSubmitted(true);
  };

  const getScoreColor = (score) => {
    if (score == null) return 'text-gray-400';
    if (score >= 4) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 3) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon name="ClipboardList" size={16} className="text-purple-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
            Interview Scorecard{jobTitle ? ` – ${jobTitle}` : ''}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {scoredCount > 0 && (
            <span className={`text-sm font-bold ${getScoreColor(weightedScore)}`}>
              {Math.round(weightedScore * 20)}%
            </span>
          )}
          {!readOnly && (
            <Button
              size="sm"
              variant="ghost"
              iconName="Settings2"
              onClick={() => setEditing((v) => !v)}
              className="text-xs text-gray-500"
            >
              Customize
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Rubric Presets */}
        {!readOnly && editing && (
          <div className="rounded-xl border border-gray-100 dark:border-slate-700 p-3 space-y-3 bg-gray-50/50 dark:bg-slate-700/20">
            <p className="text-xs font-medium text-gray-700 dark:text-slate-300">Apply Preset Rubric</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PRESET_RUBRICS).map(([key, rubric]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyRubric(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedRubric === key
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-purple-400 dark:hover:border-purple-600'
                  }`}
                >
                  {rubric.name}
                </button>
              ))}
            </div>
            {/* Add criterion */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Add Criterion</label>
                <input
                  type="text"
                  value={newCriterion.label}
                  onChange={(e) => setNewCriterion((p) => ({ ...p, label: e.target.value }))}
                  placeholder="Criterion name"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="w-16">
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Weight %</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={newCriterion.weight}
                  onChange={(e) => setNewCriterion((p) => ({ ...p, weight: Number(e.target.value) }))}
                  className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <Button type="button" size="sm" variant="outline" onClick={addCriterion} className="shrink-0">Add</Button>
            </div>
            {totalWeight !== 100 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Total weight: {totalWeight}% (ideally 100%)
              </p>
            )}
          </div>
        )}

        {/* Criteria Scoring */}
        <div className="space-y-3">
          {criteria.map((crit) => (
            <div key={crit.id} className="rounded-xl border border-gray-100 dark:border-slate-700 p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{crit.label}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Weight: {crit.weight}%</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!readOnly && editing && (
                    <button
                      type="button"
                      onClick={() => removeCriterion(crit.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Icon name="Trash2" size={13} />
                    </button>
                  )}
                  <span className={`text-sm font-bold ${getScoreColor(crit.score)}`}>
                    {crit.score != null ? `${crit.score}/5` : '—'}
                  </span>
                </div>
              </div>

              {!readOnly && (
                <div className="flex gap-1 mb-2">
                  {SCORE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.label}
                      onClick={() => updateCriterion(crit.id, 'score', opt.value)}
                      className={`flex-1 h-7 rounded-md text-xs font-medium transition-colors ${
                        crit.score === opt.value
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-purple-100 dark:hover:bg-purple-900/20'
                      }`}
                    >
                      {opt.value}
                    </button>
                  ))}
                </div>
              )}

              {!readOnly && (
                <textarea
                  value={crit.notes}
                  onChange={(e) => updateCriterion(crit.id, 'notes', e.target.value)}
                  placeholder="Optional notes..."
                  rows={1}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 text-xs text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                />
              )}

              {readOnly && crit.notes && (
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 italic">{crit.notes}</p>
              )}
            </div>
          ))}
        </div>

        {/* Overall Notes & Recommendation */}
        {!readOnly && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Overall Notes</label>
              <textarea
                value={overallNotes}
                onChange={(e) => setOverallNotes(e.target.value)}
                placeholder="Overall impression, strengths, concerns..."
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-2">Recommendation</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'strong_hire', label: 'Strong Hire', color: 'emerald' },
                  { value: 'hire', label: 'Hire', color: 'green' },
                  { value: 'no_decision', label: 'No Decision Yet', color: 'gray' },
                  { value: 'no_hire', label: 'No Hire', color: 'red' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRecommendation(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      recommendation === opt.value
                        ? opt.value === 'strong_hire' ? 'bg-emerald-600 text-white border-emerald-600'
                          : opt.value === 'hire' ? 'bg-green-600 text-white border-green-600'
                          : opt.value === 'no_hire' ? 'bg-red-600 text-white border-red-600'
                          : 'bg-gray-500 text-white border-gray-500'
                        : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-purple-400 dark:hover:border-purple-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {readOnly && (
          <div className="rounded-xl bg-gray-50 dark:bg-slate-700/30 p-3">
            <p className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Recommendation</p>
            <p className="text-sm text-gray-900 dark:text-slate-100 capitalize">{(initialData?.recommendation || 'N/A').replace(/_/g, ' ')}</p>
            {initialData?.overallNotes && <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{initialData.overallNotes}</p>}
          </div>
        )}

        {/* Score Summary */}
        {scoredCount > 0 && (
          <div className="rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30 p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400">{scoredCount}/{criteria.length} criteria scored</p>
              <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                Weighted Score: {Math.round(weightedScore * 20)}%
              </p>
            </div>
            {!readOnly && !submitted && (
              <Button
                size="sm"
                variant="primary"
                onClick={handleSubmit}
                disabled={scoredCount === 0}
              >
                Submit Scorecard
              </Button>
            )}
            {submitted && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Icon name="CheckCircle" size={14} /> Submitted
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewScorecard;
