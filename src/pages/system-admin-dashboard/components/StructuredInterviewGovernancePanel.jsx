import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import LoadingState from '../../../components/ui/LoadingState';
import apiClient from '../../../services/apiClient.js';

const RANDOMIZATION_SCOPE_OPTIONS = ['INTERVIEW', 'CANDIDATE', 'TEMPLATE'];

const STRATEGY_FIELD_DEFS = [
  { key: 'enabled', label: 'Enabled', type: 'boolean' },
  { key: 'enforceCoreQuestions', label: 'Enforce Core Questions', type: 'boolean' },
  { key: 'allowLlmFill', label: 'Allow LLM Fill', type: 'boolean' },
  { key: 'coreQuestionRatio', label: 'Core Ratio', type: 'number', min: 0.2, max: 1, step: 0.05 },
  { key: 'minCoreQuestions', label: 'Min Core Questions', type: 'number', min: 1, max: 20, step: 1 },
  { key: 'randomizationScope', label: 'Randomization Scope', type: 'select', options: RANDOMIZATION_SCOPE_OPTIONS },
];

const defaultPreviewForm = {
  mode: 'HIRING',
  jobRole: 'Software Engineer',
  experienceLevel: 'mid',
  industry: 'technology',
  interviewTypes: 'behavioral,technical,system-design,coding',
  skillFocus: 'system-design,api-design',
  totalQuestions: 8,
};

const normalizeCsv = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const StrategyEditorCard = ({ mode, value, templateOptions = [], onChange }) => {
  const normalizedMode = mode.toUpperCase();
  const title = normalizedMode === 'HIRING' ? 'Hiring Defaults' : 'Practice Defaults';

  const handleFieldChange = (key, nextValue) => {
    onChange({
      ...value,
      [key]: nextValue,
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/35 p-4 space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{title}</h4>
        <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
          Global defaults applied when interviews are created in {normalizedMode.toLowerCase()} mode.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Template</label>
          <select
            value={value?.templateId || ''}
            onChange={(event) => handleFieldChange('templateId', event.target.value || null)}
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="">Auto-select best template</option>
            {templateOptions.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        {STRATEGY_FIELD_DEFS.map((field) => {
          if (field.type === 'boolean') {
            return (
              <label key={field.key} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2">
                <span className="text-xs font-medium text-gray-700 dark:text-slate-300">{field.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(value?.[field.key])}
                  onChange={(event) => handleFieldChange(field.key, event.target.checked)}
                  className="h-5 w-5 shrink-0 cursor-pointer text-blue-600 dark:text-blue-400 border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                />
              </label>
            );
          }

          if (field.type === 'select') {
            return (
              <div key={field.key}>
                <label className="text-xs font-medium text-gray-600 dark:text-slate-400">{field.label}</label>
                <select
                  value={value?.[field.key] || field.options[0]}
                  onChange={(event) => handleFieldChange(field.key, event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                >
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            );
          }

          return (
            <div key={field.key}>
              <label className="text-xs font-medium text-gray-600 dark:text-slate-400">{field.label}</label>
              <input
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={value?.[field.key] ?? ''}
                onChange={(event) => {
                  const parsed = field.step < 1
                    ? parseFloat(event.target.value)
                    : parseInt(event.target.value, 10);
                  handleFieldChange(field.key, Number.isFinite(parsed) ? parsed : value?.[field.key]);
                }}
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StructuredInterviewGovernancePanel = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [governance, setGovernance] = useState(null);
  const [editedDefaults, setEditedDefaults] = useState({ hiring: null, practice: null });
  const [previewForm, setPreviewForm] = useState(defaultPreviewForm);
  const [preview, setPreview] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await apiClient.admin.getStructuredInterviewGovernance(1000);
      if (!result.success) {
        setError(result.error || 'Failed to load structured interview governance data.');
        return;
      }

      setGovernance(result.governance || null);
      setEditedDefaults({
        hiring: result.governance?.defaults?.hiring || null,
        practice: result.governance?.defaults?.practice || null,
      });
    } catch (loadError) {
      setError(loadError.message || 'Failed to load structured interview governance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const templatesByMode = useMemo(() => {
    const templates = governance?.catalog?.templates || [];
    return {
      HIRING: templates.filter((template) => String(template.mode || '').toUpperCase() === 'HIRING'),
      PRACTICE: templates.filter((template) => String(template.mode || '').toUpperCase() === 'PRACTICE'),
    };
  }, [governance]);

  const handleSaveDefaults = async () => {
    if (!editedDefaults?.hiring || !editedDefaults?.practice) return;
    try {
      setSaving(true);
      setMessage('');
      setError('');
      const result = await apiClient.admin.updateSettings({
        structuredInterviewDefaults: {
          hiring: editedDefaults.hiring,
          practice: editedDefaults.practice,
        },
      });
      if (!result.success) {
        setError(result.error || 'Failed to save structured interview defaults.');
        return;
      }
      setMessage('Structured interview defaults saved.');
      await load();
    } catch (saveError) {
      setError(saveError.message || 'Failed to save structured interview defaults.');
    } finally {
      setSaving(false);
    }
  };

  const runPreview = async () => {
    try {
      setPreviewLoading(true);
      setError('');
      const payload = {
        mode: previewForm.mode,
        jobRole: previewForm.jobRole,
        experienceLevel: previewForm.experienceLevel,
        industry: previewForm.industry,
        interviewTypes: normalizeCsv(previewForm.interviewTypes),
        skillFocus: normalizeCsv(previewForm.skillFocus),
        totalQuestions: Number(previewForm.totalQuestions) || 8,
      };
      const result = await apiClient.admin.previewStructuredInterviewPlan(payload);
      if (!result.success) {
        setError(result.error || 'Failed to generate plan preview.');
        return;
      }
      setPreview(result.preview || null);
    } catch (previewError) {
      setError(previewError.message || 'Failed to generate plan preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading && !governance) {
    return (
      <LoadingState
        title="Loading structured interview governance"
        message="Fetching templates, defaults, and adoption metrics."
        variant="card"
        tone="secondary"
      />
    );
  }

  const usage = governance?.usage || {};
  const catalog = governance?.catalog || {};

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-300/70 dark:border-red-700/60 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-green-300/70 dark:border-green-700/60 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-700 dark:text-green-300">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-4">
          <p className="text-xs text-gray-500 dark:text-slate-400">Library version</p>
          <p className="text-base font-semibold text-gray-900 dark:text-slate-100 mt-1">{catalog?.library?.version || 'N/A'}</p>
        </div>
        <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-4">
          <p className="text-xs text-gray-500 dark:text-slate-400">Question count</p>
          <p className="text-base font-semibold text-gray-900 dark:text-slate-100 mt-1">{catalog?.library?.totalQuestions || 0}</p>
        </div>
        <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-4">
          <p className="text-xs text-gray-500 dark:text-slate-400">Template count</p>
          <p className="text-base font-semibold text-gray-900 dark:text-slate-100 mt-1">{(catalog?.templates || []).length}</p>
        </div>
        <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-4">
          <p className="text-xs text-gray-500 dark:text-slate-400">Structured adoption</p>
          <p className="text-base font-semibold text-purple-700 dark:text-purple-300 mt-1">{usage?.overallStructuredAdoptionRatePercent ?? 0}%</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <Icon name="Settings" className="w-4 h-4 text-purple-600" />
          Global Structured Interview Defaults
        </h3>
        <StrategyEditorCard
          mode="HIRING"
          value={editedDefaults.hiring || {}}
          templateOptions={templatesByMode.HIRING || []}
          onChange={(next) => setEditedDefaults((prev) => ({ ...prev, hiring: next }))}
        />
        <StrategyEditorCard
          mode="PRACTICE"
          value={editedDefaults.practice || {}}
          templateOptions={templatesByMode.PRACTICE || []}
          onChange={(next) => setEditedDefaults((prev) => ({ ...prev, practice: next }))}
        />

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleSaveDefaults} disabled={saving} loading={saving}>
            Save Defaults
          </Button>
          <Button size="sm" variant="ghost" onClick={load} disabled={saving}>
            Reload
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Template Usage (Recent Interviews)</h3>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-slate-400">
                <th className="py-2 pr-4">Template</th>
                <th className="py-2 pr-4">Interviews</th>
                <th className="py-2 pr-4">Completed</th>
                <th className="py-2 pr-4">Pending Eval</th>
                <th className="py-2 pr-4">Avg Score</th>
                <th className="py-2 pr-4">LLM Fill Qs</th>
              </tr>
            </thead>
            <tbody>
              {(usage?.templates || []).map((item) => (
                <tr key={item.templateId} className="border-t border-gray-200 dark:border-slate-700/60">
                  <td className="py-2 pr-4 text-gray-900 dark:text-slate-100">{item.templateName}</td>
                  <td className="py-2 pr-4">{item.interviews}</td>
                  <td className="py-2 pr-4">{item.completed}</td>
                  <td className="py-2 pr-4">{item.pendingEvaluation}</td>
                  <td className="py-2 pr-4">{item.averageOverallScore != null ? item.averageOverallScore.toFixed(1) : '—'}</td>
                  <td className="py-2 pr-4">{item.llmFillQuestions}</td>
                </tr>
              ))}
              {(usage?.templates || []).length === 0 && (
                <tr>
                  <td className="py-3 text-gray-500 dark:text-slate-400" colSpan={6}>No structured template usage recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Plan Preview</h3>
        <p className="text-xs text-gray-600 dark:text-slate-400">
          Simulate question selection before deploying strategy changes.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Mode</label>
            <select
              value={previewForm.mode}
              onChange={(event) => setPreviewForm((prev) => ({ ...prev, mode: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="HIRING">HIRING</option>
              <option value="PRACTICE">PRACTICE</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Job Role</label>
            <input
              value={previewForm.jobRole}
              onChange={(event) => setPreviewForm((prev) => ({ ...prev, jobRole: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Experience</label>
            <input
              value={previewForm.experienceLevel}
              onChange={(event) => setPreviewForm((prev) => ({ ...prev, experienceLevel: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Industry</label>
            <input
              value={previewForm.industry}
              onChange={(event) => setPreviewForm((prev) => ({ ...prev, industry: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Interview Types (comma separated)</label>
            <input
              value={previewForm.interviewTypes}
              onChange={(event) => setPreviewForm((prev) => ({ ...prev, interviewTypes: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Skill Focus (comma separated)</label>
            <input
              value={previewForm.skillFocus}
              onChange={(event) => setPreviewForm((prev) => ({ ...prev, skillFocus: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Total Questions</label>
            <input
              type="number"
              min="1"
              max="50"
              value={previewForm.totalQuestions}
              onChange={(event) => setPreviewForm((prev) => ({ ...prev, totalQuestions: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <Button size="sm" onClick={runPreview} loading={previewLoading} disabled={previewLoading}>
          Generate Preview
        </Button>

        {preview && (
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 p-3 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-gray-500 dark:text-slate-400">Template</p>
                <p className="font-semibold text-gray-900 dark:text-slate-100">{preview.plan?.template?.name || 'None'}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-slate-400">Core Qs</p>
                <p className="font-semibold text-gray-900 dark:text-slate-100">{preview.plan?.coreQuestionCount || 0}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-slate-400">Randomized Qs</p>
                <p className="font-semibold text-gray-900 dark:text-slate-100">{preview.plan?.randomizedQuestionCount || 0}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-slate-400">LLM Fill Qs</p>
                <p className="font-semibold text-gray-900 dark:text-slate-100">{preview.plan?.llmFillCount || 0}</p>
              </div>
            </div>

            <div className="space-y-2">
              {(preview.plan?.questions || []).map((question) => (
                <div key={question.id} className="rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2 text-xs">
                  <p className="text-gray-900 dark:text-slate-100 font-medium">Q{question.sequence}. {question.question}</p>
                  <p className="text-gray-600 dark:text-slate-400 mt-1">
                    {question.type} · {question.difficulty} · {question.isCoreQuestion ? 'Core' : 'Randomized'}
                  </p>
                </div>
              ))}
              {(preview.plan?.questions || []).length === 0 && (
                <p className="text-xs text-gray-500 dark:text-slate-400">No structured questions selected for this preview.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StructuredInterviewGovernancePanel;
