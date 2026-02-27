/**
 * AI Model A/B Testing Framework
 *
 * Allows administrators and researchers to:
 * 1. Define experiments (e.g. compare two LLM prompts or model variants).
 * 2. Assign interview sessions to variants automatically.
 * 3. View comparative metrics (score distributions, user satisfaction, completions).
 * 4. Export experiment data for statistical analysis.
 *
 * Storage: localStorage for prototype; designed for Firestore migration.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const LS_KEY = 'ab_experiments';

const STATUS_COLORS = { RUNNING: 'emerald', PAUSED: 'yellow', COMPLETED: 'blue', DRAFT: 'gray' };
const STATUS_CLASS = {
  RUNNING: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  PAUSED: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  COMPLETED: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  DRAFT: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
};

const SAMPLE_EXPERIMENTS = [
  {
    id: 'exp_001',
    name: 'Prompt Style: Formal vs Conversational',
    hypothesis: 'Conversational prompts lead to higher engagement and better candidate experience.',
    status: 'RUNNING',
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    variants: [
      { id: 'A', name: 'Formal (Control)', description: 'Standard formal interview prompts', sessions: 48, avgScore: 72, completion: 89, satisfaction: 78 },
      { id: 'B', name: 'Conversational', description: 'Friendly, conversational interview style', sessions: 46, avgScore: 74, completion: 92, satisfaction: 84 },
    ],
    primaryMetric: 'satisfaction',
    trafficSplit: 50,
    tags: ['prompt-engineering', 'ux'],
  },
  {
    id: 'exp_002',
    name: 'Question Depth: Surface vs In-depth Follow-ups',
    hypothesis: 'Deep follow-up questions better assess candidate competency.',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    variants: [
      { id: 'A', name: 'Surface (2 follow-ups)', description: '2 follow-up questions max', sessions: 120, avgScore: 69, completion: 94, satisfaction: 76 },
      { id: 'B', name: 'In-depth (4 follow-ups)', description: '4 follow-up questions max', sessions: 118, avgScore: 73, completion: 88, satisfaction: 79 },
    ],
    primaryMetric: 'avgScore',
    trafficSplit: 50,
    tags: ['question-strategy'],
  },
];

const computeMean = (arr) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

const ABTestingPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [experiments, setExperiments] = useState([]);
  const [selectedExperiment, setSelectedExperiment] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newExp, setNewExp] = useState({
    name: '', hypothesis: '', primaryMetric: 'avgScore', trafficSplit: 50, tags: '',
    variantAName: 'Control (A)', variantADesc: '',
    variantBName: 'Variant (B)', variantBDesc: '',
  });

  const userType = user?.accountType === 'ADMIN' || user?.accountType === 'SYSTEM_ADMIN' ? 'admin' : 'company';

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) setExperiments(JSON.parse(stored));
      else setExperiments(SAMPLE_EXPERIMENTS);
    } catch {
      setExperiments(SAMPLE_EXPERIMENTS);
    }
  }, []);

  const persist = (updated) => {
    setExperiments(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  };

  const handleCreateExperiment = () => {
    if (!newExp.name.trim()) return;
    const exp = {
      id: `exp_${Date.now()}`,
      name: newExp.name,
      hypothesis: newExp.hypothesis,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      primaryMetric: newExp.primaryMetric,
      trafficSplit: Number(newExp.trafficSplit),
      tags: newExp.tags.split(',').map((t) => t.trim()).filter(Boolean),
      variants: [
        { id: 'A', name: newExp.variantAName, description: newExp.variantADesc, sessions: 0, avgScore: 0, completion: 0, satisfaction: 0 },
        { id: 'B', name: newExp.variantBName, description: newExp.variantBDesc, sessions: 0, avgScore: 0, completion: 0, satisfaction: 0 },
      ],
    };
    persist([exp, ...experiments]);
    setShowCreateModal(false);
    setNewExp({ name: '', hypothesis: '', primaryMetric: 'avgScore', trafficSplit: 50, tags: '', variantAName: 'Control (A)', variantADesc: '', variantBName: 'Variant (B)', variantBDesc: '' });
  };

  const updateStatus = (id, status) => {
    persist(experiments.map((e) => (e.id === id ? { ...e, status } : e)));
    if (selectedExperiment?.id === id) setSelectedExperiment((p) => ({ ...p, status }));
  };

  const deleteExperiment = (id) => {
    persist(experiments.filter((e) => e.id !== id));
    if (selectedExperiment?.id === id) setSelectedExperiment(null);
  };

  const exportExperiment = (exp) => {
    const data = JSON.stringify(exp, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `experiment_${exp.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedExp = selectedExperiment || experiments[0] || null;

  const chartData = selectedExp
    ? [
        {
          metric: 'Avg Score',
          [selectedExp.variants[0]?.name || 'A']: selectedExp.variants[0]?.avgScore,
          [selectedExp.variants[1]?.name || 'B']: selectedExp.variants[1]?.avgScore,
        },
        {
          metric: 'Completion %',
          [selectedExp.variants[0]?.name || 'A']: selectedExp.variants[0]?.completion,
          [selectedExp.variants[1]?.name || 'B']: selectedExp.variants[1]?.completion,
        },
        {
          metric: 'Satisfaction',
          [selectedExp.variants[0]?.name || 'A']: selectedExp.variants[0]?.satisfaction,
          [selectedExp.variants[1]?.name || 'B']: selectedExp.variants[1]?.satisfaction,
        },
      ]
    : [];

  const winner = selectedExp
    ? selectedExp.variants.reduce((best, v) => (v[selectedExp.primaryMetric] > best[selectedExp.primaryMetric] ? v : best), selectedExp.variants[0])
    : null;

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-24 right-0 h-80 w-80 bg-gradient-to-br from-blue-400/30 to-purple-500/20 blur-3xl" />
      </div>

      <Header userType={userType} isAuthenticated onLogout={async () => { await logout(); navigate('/login'); }} />
      <div className="h-14 xs:h-16" />

      <div className="relative z-10 flex flex-col lg:flex-row">
        <UserContextNavigation
          userType={userType}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        <main className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'}`}>
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="container-responsive py-6 xs:py-8 sm:py-10 space-y-6"
          >
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
                  <Icon name="Split" size={22} color="white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">A/B Testing Framework</h1>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Compare AI model variants and prompt strategies</p>
                </div>
              </div>
              <Button variant="primary" iconName="Plus" onClick={() => setShowCreateModal(true)}>
                New Experiment
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Experiment List */}
              <div className="lg:col-span-1 space-y-3">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Experiments ({experiments.length})</h2>
                {experiments.map((exp) => (
                  <button
                    key={exp.id}
                    onClick={() => setSelectedExperiment(exp)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
                      selectedExp?.id === exp.id
                        ? 'border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
                        : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 leading-snug">{exp.name}</p>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[exp.status] || STATUS_CLASS.DRAFT}`}>
                        {exp.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {exp.variants.reduce((s, v) => s + v.sessions, 0)} sessions · {new Date(exp.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>

              {/* Experiment Detail */}
              <div className="lg:col-span-2">
                {selectedExp ? (
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-5 shadow-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{selectedExp.name}</h2>
                          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{selectedExp.hypothesis}</p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {(selectedExp.tags || []).map((t) => (
                              <span key={t} className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-xs text-gray-600 dark:text-slate-300">{t}</span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" variant="ghost" iconName="Download" onClick={() => exportExperiment(selectedExp)} />
                          {selectedExp.status === 'DRAFT' && (
                            <Button size="sm" variant="outline" iconName="Play" onClick={() => updateStatus(selectedExp.id, 'RUNNING')}>Start</Button>
                          )}
                          {selectedExp.status === 'RUNNING' && (
                            <Button size="sm" variant="outline" iconName="Pause" onClick={() => updateStatus(selectedExp.id, 'PAUSED')}>Pause</Button>
                          )}
                          {selectedExp.status === 'PAUSED' && (
                            <Button size="sm" variant="outline" iconName="CheckCircle" onClick={() => updateStatus(selectedExp.id, 'COMPLETED')}>Complete</Button>
                          )}
                          <Button size="sm" variant="ghost" iconName="Trash2" onClick={() => deleteExperiment(selectedExp.id)} className="text-red-500" />
                        </div>
                      </div>
                    </div>

                    {/* Winner Banner */}
                    {winner && selectedExp.status === 'COMPLETED' && (
                      <div className="rounded-2xl bg-gradient-to-r from-yellow-50 to-emerald-50 dark:from-yellow-900/10 dark:to-emerald-900/10 border border-yellow-200 dark:border-yellow-700/40 p-4 flex items-center gap-3">
                        <Icon name="Trophy" size={20} className="text-yellow-500" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                            Winner: <span className="text-emerald-700 dark:text-emerald-300">{winner.name}</span>
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            Best {selectedExp.primaryMetric.replace(/([A-Z])/g, ' $1').toLowerCase()} ({winner[selectedExp.primaryMetric]})
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Variant Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedExp.variants.map((v, i) => (
                        <div key={v.id} className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${i === 0 ? 'bg-blue-500' : 'bg-purple-500'}`}>
                              {v.id}
                            </span>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{v.name}</h3>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">{v.description || 'No description'}</p>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { label: 'Sessions', value: v.sessions },
                              { label: 'Avg Score', value: `${v.avgScore}%` },
                              { label: 'Completion', value: `${v.completion}%` },
                              { label: 'Satisfaction', value: `${v.satisfaction}%` },
                            ].map((m) => (
                              <div key={m.label} className="text-center rounded-lg bg-gray-50 dark:bg-slate-700/30 p-2">
                                <p className="text-base font-bold text-gray-900 dark:text-slate-100">{m.value}</p>
                                <p className="text-xs text-gray-500 dark:text-slate-400">{m.label}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Comparison Chart */}
                    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-5 shadow-lg">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <Icon name="BarChart2" size={15} className="text-blue-500" />
                        Variant Comparison
                      </h3>
                      <div style={{ height: 200 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-slate-700" />
                            <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                            <Legend />
                            <Bar dataKey={selectedExp.variants[0]?.name} fill="#3b82f6" radius={[3, 3, 0, 0]} />
                            <Bar dataKey={selectedExp.variants[1]?.name} fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Traffic Split Info */}
                    <div className="rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 flex items-center gap-3">
                      <Icon name="Split" size={14} className="text-gray-400" />
                      <p className="text-xs text-gray-600 dark:text-slate-400">
                        Traffic split: <strong>{selectedExp.trafficSplit}% A</strong> / <strong>{100 - selectedExp.trafficSplit}% B</strong>
                        &nbsp;·&nbsp; Primary metric: <strong>{selectedExp.primaryMetric}</strong>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 dark:border-slate-700 p-12 text-center">
                    <Icon name="Split" size={36} className="mx-auto mb-3 text-gray-300 dark:text-slate-600" />
                    <p className="text-sm text-gray-500 dark:text-slate-400">Select an experiment to view details</p>
                  </div>
                )}
              </div>
            </div>
          </motion.section>
        </main>
      </div>

      {/* Create Experiment Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">New Experiment</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><Icon name="X" size={18} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Experiment Name *</label>
                  <input type="text" value={newExp.name} onChange={(e) => setNewExp((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Prompt Style A vs B" className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Hypothesis</label>
                  <textarea value={newExp.hypothesis} onChange={(e) => setNewExp((p) => ({ ...p, hypothesis: e.target.value }))} rows={2} placeholder="What do you expect the variant to improve?" className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Primary Metric</label>
                    <select value={newExp.primaryMetric} onChange={(e) => setNewExp((p) => ({ ...p, primaryMetric: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500">
                      <option value="avgScore">Average Score</option>
                      <option value="completion">Completion Rate</option>
                      <option value="satisfaction">Satisfaction</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Traffic Split A%</label>
                    <input type="number" min="10" max="90" value={newExp.trafficSplit} onChange={(e) => setNewExp((p) => ({ ...p, trafficSplit: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Variant A Name</label>
                    <input type="text" value={newExp.variantAName} onChange={(e) => setNewExp((p) => ({ ...p, variantAName: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    <textarea placeholder="Description" value={newExp.variantADesc} onChange={(e) => setNewExp((p) => ({ ...p, variantADesc: e.target.value }))} rows={2} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-xs text-gray-900 dark:text-slate-100 focus:outline-none resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Variant B Name</label>
                    <input type="text" value={newExp.variantBName} onChange={(e) => setNewExp((p) => ({ ...p, variantBName: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    <textarea placeholder="Description" value={newExp.variantBDesc} onChange={(e) => setNewExp((p) => ({ ...p, variantBDesc: e.target.value }))} rows={2} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-xs text-gray-900 dark:text-slate-100 focus:outline-none resize-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Tags (comma-separated)</label>
                  <input type="text" value={newExp.tags} onChange={(e) => setNewExp((p) => ({ ...p, tags: e.target.value }))} placeholder="prompt, llm, evaluation" className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button variant="primary" className="flex-1" onClick={handleCreateExperiment} disabled={!newExp.name.trim()}>Create Experiment</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ABTestingPage;
