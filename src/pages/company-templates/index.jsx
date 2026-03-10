
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import MaintenanceBanner from '../../components/ui/MaintenanceBanner';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import LoadingState from '../../components/ui/LoadingState';
import Icon from '../../components/AppIcon';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useMaintenanceMode } from '../../hooks/useMaintenanceMode';
import { hasPermission } from '../../utils/rolePermissions';

const INTERVIEW_TYPE_OPTIONS = [
  { label: 'Behavioral', value: 'BEHAVIORAL' },
  { label: 'Technical', value: 'TECHNICAL' },
  { label: 'Coding', value: 'CODING' },
  { label: 'System Design', value: 'SYSTEM_DESIGN' },
  { label: 'Case Study', value: 'CASE_STUDY' },
];

const EXPERIENCE_OPTIONS = [
  { label: 'Junior', value: 'JUNIOR' },
  { label: 'Mid', value: 'MID' },
  { label: 'Senior', value: 'SENIOR' },
];

const difficultyRank = {
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
};

const normalizeType = (value) => (value || '').toString().trim().toUpperCase();

const buildDefaultFormState = () => ({
  id: null,
  name: '',
  description: '',
  jobRole: '',
  experienceLevel: 'MID',
  industry: '',
  duration: 30,
  interviewTypes: ['BEHAVIORAL', 'TECHNICAL'],
  skillFocusText: '',
  coreQuestionIds: [],
  randomPoolIds: [],
});

const toUniqueIds = (values = []) => [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];

const toTemplateForm = (template = {}) => {
  const structured = template?.structuredQuestionSet
    || template?.config?.structuredQuestionSet
    || {};
  const interviewTypes = toUniqueIds(
    (structured.interviewTypes || template.interviewTypes || [])
      .map((item) => normalizeType(item))
      .filter(Boolean),
  );

  return {
    id: template.id || null,
    name: template.name || '',
    description: template.description || '',
    jobRole: template.jobRole || '',
    experienceLevel: normalizeType(template.experienceLevel || 'MID') || 'MID',
    industry: template.industry || '',
    duration: Number.isFinite(Number(template.duration)) ? Number(template.duration) : 30,
    interviewTypes: interviewTypes.length ? interviewTypes : ['BEHAVIORAL'],
    skillFocusText: Array.isArray(template.skillFocus) ? template.skillFocus.join(', ') : '',
    coreQuestionIds: toUniqueIds(structured.coreQuestionIds || []),
    randomPoolIds: toUniqueIds(structured.randomPoolIds || []),
  };
};

const CompanyTemplatesPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();

  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [templates, setTemplates] = useState([]);
  const [libraryQuestions, setLibraryQuestions] = useState([]);
  const [form, setForm] = useState(buildDefaultFormState());
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionTypeFilter, setQuestionTypeFilter] = useState('ALL');

  const organizationRole = user?.organizationContext?.membership?.role || null;
  const canManageTemplates = hasPermission(organizationRole, 'CREATE_TEMPLATES')
    || hasPermission(organizationRole, 'EDIT_TEMPLATES');

  const questionMap = useMemo(() => {
    const map = new Map();
    libraryQuestions.forEach((question) => {
      if (question?.id) {
        map.set(question.id, question);
      }
    });
    return map;
  }, [libraryQuestions]);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedTemplateId) || null,
    [templates, selectedTemplateId],
  );

  const loadData = useCallback(async ({ keepSelection = true } = {}) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const [templateResponse, catalogResponse] = await Promise.all([
        apiClient.templates.list(),
        apiClient.templates.getStructuredCatalog(),
      ]);

      const nextTemplates = Array.isArray(templateResponse?.templates)
        ? templateResponse.templates
        : [];
      const nextLibraryQuestions = Array.isArray(catalogResponse?.catalog?.library?.questions)
        ? catalogResponse.catalog.library.questions
        : [];

      setTemplates(nextTemplates);
      setLibraryQuestions(nextLibraryQuestions);

      const nextSelectedId = keepSelection && selectedTemplateId
        ? (nextTemplates.some((template) => template.id === selectedTemplateId) ? selectedTemplateId : null)
        : null;
      const fallbackSelected = nextSelectedId || nextTemplates[0]?.id || null;
      setSelectedTemplateId(fallbackSelected);
      setForm(fallbackSelected
        ? toTemplateForm(nextTemplates.find((template) => template.id === fallbackSelected))
        : buildDefaultFormState());
    } catch (loadError) {
      setError(loadError?.message || 'Failed to load template editor data.');
    } finally {
      setLoading(false);
    }
  }, [selectedTemplateId]);

  useEffect(() => {
    loadData({ keepSelection: false });
  }, [loadData]);

  const filteredQuestions = useMemo(() => {
    const normalizedQuery = questionSearch.trim().toLowerCase();

    return [...libraryQuestions]
      .filter((question) => {
        if (!question?.id) return false;
        if (questionTypeFilter !== 'ALL' && normalizeType(question.type) !== questionTypeFilter) {
          return false;
        }
        if (!normalizedQuery) return true;
        const haystack = [
          question.prompt,
          question.id,
          question.type,
          ...(Array.isArray(question.competencies) ? question.competencies : []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .sort((left, right) => {
        const typeDelta = normalizeType(left.type).localeCompare(normalizeType(right.type));
        if (typeDelta !== 0) return typeDelta;
        const difficultyDelta = (difficultyRank[normalizeType(left.difficulty)] || 0)
          - (difficultyRank[normalizeType(right.difficulty)] || 0);
        if (difficultyDelta !== 0) return difficultyDelta;
        return String(left.id).localeCompare(String(right.id));
      });
  }, [libraryQuestions, questionSearch, questionTypeFilter]);

  const coreQuestionCount = form.coreQuestionIds.length;
  const randomQuestionCount = form.randomPoolIds.length;
  const selectedQuestionCount = coreQuestionCount + randomQuestionCount;

  const selectTemplate = (templateId) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setSelectedTemplateId(templateId);
    setForm(toTemplateForm(template));
    setNotice(null);
    setError(null);
  };

  const resetForNewTemplate = () => {
    setSelectedTemplateId(null);
    setForm(buildDefaultFormState());
    setNotice(null);
    setError(null);
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleInterviewType = (typeValue) => {
    const canonical = normalizeType(typeValue);
    if (!canonical) return;
    setForm((current) => {
      const exists = current.interviewTypes.includes(canonical);
      const next = exists
        ? current.interviewTypes.filter((item) => item !== canonical)
        : [...current.interviewTypes, canonical];
      return {
        ...current,
        interviewTypes: next.length ? next : ['BEHAVIORAL'],
      };
    });
  };

  const toggleCoreQuestion = (questionId) => {
    setForm((current) => {
      const isCore = current.coreQuestionIds.includes(questionId);
      return {
        ...current,
        coreQuestionIds: isCore
          ? current.coreQuestionIds.filter((item) => item !== questionId)
          : [...current.coreQuestionIds, questionId],
        randomPoolIds: current.randomPoolIds.filter((item) => item !== questionId),
      };
    });
  };

  const toggleRandomQuestion = (questionId) => {
    setForm((current) => {
      const isRandom = current.randomPoolIds.includes(questionId);
      return {
        ...current,
        randomPoolIds: isRandom
          ? current.randomPoolIds.filter((item) => item !== questionId)
          : [...current.randomPoolIds, questionId],
        coreQuestionIds: current.coreQuestionIds.filter((item) => item !== questionId),
      };
    });
  };

  const buildStructuredPayload = () => {
    const interviewTypes = toUniqueIds(form.interviewTypes.map((item) => normalizeType(item)));
    return {
      enabled: true,
      mode: 'HIRING',
      interviewTypes: interviewTypes.length ? interviewTypes : ['BEHAVIORAL'],
      coreQuestionIds: toUniqueIds(form.coreQuestionIds),
      randomPoolIds: toUniqueIds(form.randomPoolIds).filter((id) => !form.coreQuestionIds.includes(id)),
    };
  };

  const handleSave = async () => {
    if (!canManageTemplates) {
      setError('You do not have permission to manage structured templates.');
      return;
    }
    const name = form.name.trim();
    const jobRole = form.jobRole.trim();

    if (!name) {
      setError('Template name is required.');
      return;
    }
    if (!jobRole) {
      setError('Job role is required.');
      return;
    }

    const structuredQuestionSet = buildStructuredPayload();
    if (structuredQuestionSet.coreQuestionIds.length === 0) {
      setError('Add at least one core question.');
      return;
    }

    const skillFocus = form.skillFocusText
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const payload = {
      name,
      description: form.description.trim(),
      jobRole,
      experienceLevel: form.experienceLevel || 'MID',
      industry: form.industry.trim() || null,
      interviewTypes: structuredQuestionSet.interviewTypes,
      duration: Number.isFinite(Number(form.duration)) ? Number(form.duration) : 30,
      skillFocus,
      structuredQuestionSet,
    };

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = selectedTemplateId
        ? await apiClient.templates.update(selectedTemplateId, payload)
        : await apiClient.templates.create(payload);
      const savedTemplate = response?.template;
      if (!savedTemplate?.id) {
        throw new Error('Template was saved but no template id was returned.');
      }

      setTemplates((current) => {
        const exists = current.some((item) => item.id === savedTemplate.id);
        if (exists) {
          return current.map((item) => (item.id === savedTemplate.id ? savedTemplate : item));
        }
        return [savedTemplate, ...current];
      });
      setSelectedTemplateId(savedTemplate.id);
      setForm(toTemplateForm(savedTemplate));
      setNotice(selectedTemplateId ? 'Template updated.' : 'Template created.');

      const catalogResponse = await apiClient.templates.getStructuredCatalog();
      setLibraryQuestions(Array.isArray(catalogResponse?.catalog?.library?.questions) ? catalogResponse.catalog.library.questions : []);
    } catch (saveError) {
      setError(saveError?.message || 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplateId) return;
    if (!window.confirm('Delete this template? This cannot be undone.')) return;
    setDeleting(true);
    setError(null);
    setNotice(null);
    try {
      await apiClient.templates.delete(selectedTemplateId);
      const remaining = templates.filter((item) => item.id !== selectedTemplateId);
      setTemplates(remaining);
      setNotice('Template deleted.');
      const nextId = remaining[0]?.id || null;
      setSelectedTemplateId(nextId);
      setForm(nextId
        ? toTemplateForm(remaining.find((item) => item.id === nextId))
        : buildDefaultFormState());
    } catch (deleteError) {
      setError(deleteError?.message || 'Failed to delete template.');
    } finally {
      setDeleting(false);
    }
  };

  const selectedCoreQuestions = form.coreQuestionIds
    .map((id) => questionMap.get(id))
    .filter(Boolean);
  const selectedRandomQuestions = form.randomPoolIds
    .map((id) => questionMap.get(id))
    .filter(Boolean);

  if (loading) {
    return <LoadingState title="Loading structured templates" message="Fetching approved question library and templates." variant="fullscreen" tone="primary" />;
  }

  if (!canManageTemplates) {
    return (
      <div className="dashboard-shell">
        <Header userType="company" isAuthenticated onLogout={async () => { await logout(); navigate('/login'); }} organizationRole={organizationRole} />
        {maintenanceMode && <MaintenanceBanner />}
        <div className="h-14 xs:h-16" />
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
            You need hiring permissions to manage structured templates.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <Header
        userType="company"
        isAuthenticated
        onLogout={async () => { await logout(); navigate('/login'); }}
        organizationRole={organizationRole}
      />
      {maintenanceMode && <MaintenanceBanner />}
      <div className="h-14 xs:h-16" />

      <div className="relative z-10 flex flex-col lg:flex-row">
        <UserContextNavigation
          userType="company"
          isCollapsed={isNavCollapsed}
          onToggleCollapse={() => setIsNavCollapsed((prev) => !prev)}
        />

        <main className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${isNavCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'}`}>
          <div className="container-responsive py-6 xs:py-8 sm:py-10 space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div
                data-testid="structured-templates-header"
                className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <Icon name="ClipboardList" size={22} color="white" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
                      Structured Templates
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      Build consistent interview flows with core fairness questions and controlled random pools.
                    </p>
                  </div>
                </div>
              </div>
              <div
                data-testid="structured-templates-actions"
                className="grid grid-cols-1 gap-3 sm:grid-cols-3"
              >
                <Button variant="outline" iconName="Plus" onClick={resetForNewTemplate} fullWidth>New Template</Button>
                <Button iconName="Save" loading={saving} onClick={handleSave} fullWidth>Save Template</Button>
                <Button
                  variant="destructive"
                  iconName="Trash2"
                  loading={deleting}
                  disabled={!selectedTemplateId}
                  onClick={handleDelete}
                  fullWidth
                >
                  Delete
                </Button>
              </div>
            </motion.div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-700/50 dark:bg-green-900/20 dark:text-green-300">
                {notice}
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <section className="xl:col-span-3 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Organization Templates</h2>
                  <span className="text-xs text-gray-500 dark:text-slate-400">{templates.length}</span>
                </div>
                <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                  {templates.map((template) => {
                    const isActive = template.id === selectedTemplateId;
                    const structured = template.structuredQuestionSet || template?.config?.structuredQuestionSet || {};
                    const coreCount = Array.isArray(structured.coreQuestionIds) ? structured.coreQuestionIds.length : 0;
                    const randomCount = Array.isArray(structured.randomPoolIds) ? structured.randomPoolIds.length : 0;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => selectTemplate(template.id)}
                        className={`w-full text-left rounded-xl border px-3 py-2 transition ${
                          isActive
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 dark:border-slate-700 dark:hover:border-blue-500/60 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{template.name || 'Untitled template'}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{template.jobRole || 'No role set'}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Core {coreCount} | Random {randomCount}</p>
                      </button>
                    );
                  })}
                  {templates.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      No templates yet. Create your first structured template.
                    </p>
                  )}
                </div>
              </section>

              <section className="xl:col-span-9 space-y-6">
                <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 p-4 sm:p-5 space-y-4">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                    {selectedTemplate ? 'Edit Template' : 'Create Template'}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input label="Template Name" value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Backend Engineer Structured Interview" />
                    <Input label="Job Role" value={form.jobRole} onChange={(event) => updateField('jobRole', event.target.value)} placeholder="Backend Engineer" />
                    <Select
                      label="Experience Level"
                      options={EXPERIENCE_OPTIONS}
                      value={form.experienceLevel}
                      onChange={(value) => updateField('experienceLevel', value)}
                    />
                    <Input
                      type="number"
                      label="Duration (minutes)"
                      value={String(form.duration)}
                      min="10"
                      max="180"
                      onChange={(event) => updateField('duration', Number(event.target.value))}
                    />
                    <Input label="Industry" value={form.industry} onChange={(event) => updateField('industry', event.target.value)} placeholder="Technology" />
                    <Input
                      label="Skill Focus (comma-separated)"
                      value={form.skillFocusText}
                      onChange={(event) => updateField('skillFocusText', event.target.value)}
                      placeholder="distributed-systems, api-design, testing"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-slate-100">Description</label>
                    <textarea
                      value={form.description}
                      onChange={(event) => updateField('description', event.target.value)}
                      rows={3}
                      placeholder="Internal structured template for fair and repeatable interviews."
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-gray-900 dark:text-slate-100 dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-slate-100">Interview Types</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {INTERVIEW_TYPE_OPTIONS.map((option) => {
                        const checked = form.interviewTypes.includes(option.value);
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => toggleInterviewType(option.value)}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                              checked
                                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'border-gray-300 text-gray-600 hover:border-blue-400 dark:border-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Approved Question Library</h2>
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <Input
                        className="sm:w-72"
                        placeholder="Search question, competency, id..."
                        value={questionSearch}
                        onChange={(event) => setQuestionSearch(event.target.value)}
                      />
                      <Select
                        className="sm:w-48"
                        options={[
                          { label: 'All Types', value: 'ALL' },
                          ...INTERVIEW_TYPE_OPTIONS,
                        ]}
                        value={questionTypeFilter}
                        onChange={(value) => setQuestionTypeFilter(value || 'ALL')}
                      />
                    </div>
                  </div>

                  <div className="overflow-auto max-h-[420px] rounded-xl border border-gray-200 dark:border-slate-700">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50 dark:bg-slate-900/90">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-slate-300">Question</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-slate-300">Type</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-slate-300">Difficulty</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-600 dark:text-slate-300">Core</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-600 dark:text-slate-300">Random</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredQuestions.map((question) => {
                          const isCore = form.coreQuestionIds.includes(question.id);
                          const isRandom = form.randomPoolIds.includes(question.id);
                          return (
                            <tr key={question.id} className="border-t border-gray-200 dark:border-slate-700/60">
                              <td className="px-3 py-2 align-top">
                                <p className="text-gray-900 dark:text-slate-100">{question.prompt}</p>
                                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{question.id}</p>
                              </td>
                              <td className="px-3 py-2 align-top text-gray-700 dark:text-slate-300">{normalizeType(question.type)}</td>
                              <td className="px-3 py-2 align-top text-gray-700 dark:text-slate-300">{normalizeType(question.difficulty)}</td>
                              <td className="px-3 py-2 align-top text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleCoreQuestion(question.id)}
                                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                                    isCore
                                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300'
                                      : 'border-gray-300 text-gray-500 dark:border-slate-600 dark:text-slate-300'
                                  }`}
                                  aria-label={`Toggle ${question.id} as core`}
                                >
                                  {isCore ? <Icon name="Check" size={14} /> : <span className="text-xs">-</span>}
                                </button>
                              </td>
                              <td className="px-3 py-2 align-top text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleRandomQuestion(question.id)}
                                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                                    isRandom
                                      ? 'border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-400 dark:bg-amber-900/30 dark:text-amber-300'
                                      : 'border-gray-300 text-gray-500 dark:border-slate-600 dark:text-slate-300'
                                  }`}
                                  aria-label={`Toggle ${question.id} as random`}
                                >
                                  {isRandom ? <Icon name="Check" size={14} /> : <span className="text-xs">-</span>}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredQuestions.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-3 py-8 text-center text-gray-500 dark:text-slate-400">
                              No questions match your filter.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Core Questions ({selectedCoreQuestions.length})</h3>
                    <div className="space-y-2 max-h-56 overflow-auto pr-1">
                      {selectedCoreQuestions.map((question) => (
                        <div key={question.id} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-700/60 dark:bg-blue-900/20">
                          <p className="font-medium text-gray-900 dark:text-slate-100">{question.prompt}</p>
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{question.id}</p>
                        </div>
                      ))}
                      {selectedCoreQuestions.length === 0 && (
                        <p className="text-sm text-gray-500 dark:text-slate-400">No core questions selected yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Random Pool ({selectedRandomQuestions.length})</h3>
                    <div className="space-y-2 max-h-56 overflow-auto pr-1">
                      {selectedRandomQuestions.map((question) => (
                        <div key={question.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-700/60 dark:bg-amber-900/20">
                          <p className="font-medium text-gray-900 dark:text-slate-100">{question.prompt}</p>
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{question.id}</p>
                        </div>
                      ))}
                      {selectedRandomQuestions.length === 0 && (
                        <p className="text-sm text-gray-500 dark:text-slate-400">No random questions selected yet.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <Button iconName="Save" loading={saving} onClick={handleSave}>
                    Save Template ({selectedQuestionCount} selected)
                  </Button>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CompanyTemplatesPage;
