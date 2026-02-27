import React, { useRef, useState } from 'react';
import Icon from '../AppIcon';
import Button from './Button';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';

const EXTRACTABLE_FIELDS = [
  { key: 'fullName', label: 'Full Name', icon: 'User' },
  { key: 'email', label: 'Email', icon: 'Mail' },
  { key: 'phone', label: 'Phone', icon: 'Phone' },
  { key: 'targetRole', label: 'Target Role', icon: 'Briefcase' },
  { key: 'experienceLevel', label: 'Experience Level', icon: 'TrendingUp' },
  { key: 'yearsOfExperience', label: 'Years of Experience', icon: 'Clock' },
  { key: 'industry', label: 'Industry', icon: 'Building2' },
  { key: 'education', label: 'Education', icon: 'GraduationCap' },
  { key: 'location', label: 'Location', icon: 'MapPin' },
  { key: 'summary', label: 'Summary', icon: 'FileText' },
];

const READ_ONLY_FIELDS = new Set(['email']);

const normalizeText = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');

const parseYears = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const inferExperienceLevelFromYears = (years) => {
  if (typeof years !== 'number' || !Number.isFinite(years)) return '';
  if (years <= 2) return 'entry';
  if (years <= 5) return 'mid';
  if (years <= 10) return 'senior';
  if (years <= 15) return 'lead';
  return 'executive';
};

const normalizeExperienceLevel = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return '';
  if (['entry', 'junior', 'intern', 'graduate', 'fresher'].some((token) => normalized.includes(token))) return 'entry';
  if (normalized.includes('mid')) return 'mid';
  if (['senior', 'sr'].some((token) => normalized.includes(token))) return 'senior';
  if (['lead', 'principal', 'staff'].some((token) => normalized.includes(token))) return 'lead';
  if (['executive', 'director', 'head', 'c-level', 'vp'].some((token) => normalized.includes(token))) return 'executive';
  return normalized;
};

const normalizeTargetRole = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return '';

  const roleMap = [
    ['software engineer', 'software-engineer'],
    ['frontend engineer', 'frontend-developer'],
    ['frontend developer', 'frontend-developer'],
    ['backend engineer', 'backend-developer'],
    ['backend developer', 'backend-developer'],
    ['full stack engineer', 'fullstack-developer'],
    ['full-stack engineer', 'fullstack-developer'],
    ['full stack developer', 'fullstack-developer'],
    ['full-stack developer', 'fullstack-developer'],
    ['devops engineer', 'devops-engineer'],
    ['qa engineer', 'qa-engineer'],
    ['quality assurance engineer', 'qa-engineer'],
  ];

  const matchedRole = roleMap.find(([label]) => normalized.includes(label));
  return matchedRole ? matchedRole[1] : value;
};

const normalizeIndustry = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return '';
  if (
    normalized.includes('technology')
    || normalized.includes('software')
    || normalized.includes('information technology')
    || normalized === 'it'
  ) {
    return 'technology';
  }
  return value;
};

const normalizeQualification = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('phd') || normalized.includes('doctor')) return 'phd';
  if (normalized.includes('master')) return 'masters';
  if (normalized.includes('bachelor')) return 'bachelors';
  if (normalized.includes('hnd') || normalized.includes('higher national diploma')) return 'hnd';
  if (normalized.includes('diploma') || normalized.includes('certificate')) return 'diploma';
  if (normalized.includes('advanced level') || normalized.includes('a/l')) return 'al';
  if (normalized.includes('ordinary level') || normalized.includes('o/l')) return 'ol';
  return value;
};

const renderFieldValue = (key, value) => {
  if (value == null || value === '') return '';
  if (key === 'yearsOfExperience') {
    const years = parseYears(value);
    return years != null ? `${years} years` : String(value);
  }
  return String(value);
};

const buildProfileUpdates = (extracted, selected) => {
  const updates = {};
  if (!extracted || !selected) return updates;

  const years = parseYears(extracted.yearsOfExperience);

  if (selected.fullName && extracted.fullName) {
    updates.fullName = normalizeText(extracted.fullName);
  }
  if (selected.phone && extracted.phone) {
    updates.phoneNumber = normalizeText(extracted.phone);
  }
  if (selected.skills && Array.isArray(extracted.skills)) {
    updates.skills = extracted.skills.map((skill) => normalizeText(skill)).filter(Boolean);
  }
  if (selected.targetRole && extracted.targetRole) {
    updates.targetRole = normalizeTargetRole(extracted.targetRole);
  }

  if (selected.experienceLevel && extracted.experienceLevel) {
    updates.experienceLevel = normalizeExperienceLevel(extracted.experienceLevel);
  } else if (selected.yearsOfExperience && years != null) {
    updates.experienceLevel = inferExperienceLevelFromYears(years);
  }

  if (selected.industry && extracted.industry) {
    updates.industry = normalizeIndustry(extracted.industry);
  }
  if (selected.education && extracted.education) {
    updates.highestQualification = normalizeQualification(extracted.education);
  }
  if (selected.location && extracted.location) {
    updates.location = normalizeText(extracted.location);
  }
  if (selected.summary && extracted.summary) {
    updates.careerGoals = normalizeText(extracted.summary);
  }

  Object.keys(updates).forEach((key) => {
    const value = updates[key];
    if (value === '' || value == null || (Array.isArray(value) && value.length === 0)) {
      delete updates[key];
    }
  });

  return updates;
};

const ResumeParserWidget = ({ onProfileUpdate }) => {
  const { setAuthenticatedUser } = useAuth();
  const [step, setStep] = useState('idle'); // idle | parsing | review | done
  const [extracted, setExtracted] = useState(null);
  const [selected, setSelected] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState(null);
  const fileRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setStep('parsing');
    setError(null);
    try {
      const res = await apiClient.auth.parseResume(file);
      if (res?.success && res?.extracted) {
        setExtracted(res.extracted);
        // Pre-select editable extracted fields.
        const preSelected = {};
        Object.entries(res.extracted).forEach(([k, v]) => {
          if (
            !READ_ONLY_FIELDS.has(k)
            && v != null
            && v !== ''
            && !(Array.isArray(v) && v.length === 0)
          ) {
            preSelected[k] = true;
          }
        });
        setSelected(preSelected);
        setStep('review');
      } else {
        setError(res?.error || 'Failed to parse resume.');
        setStep('idle');
      }
    } catch (err) {
      setError(err?.message || 'Failed to parse resume.');
      setStep('idle');
    }
    e.target.value = '';
  };

  const handleApply = async () => {
    if (!extracted) return;
    setSaving(true);
    setError(null);
    try {
      const updates = buildProfileUpdates(extracted, selected);
      if (Object.keys(updates).length === 0) {
        setError('Select at least one editable field to apply.');
        return;
      }

      const response = await apiClient.auth.updateMe(updates);
      if (response?.success && response?.user && typeof setAuthenticatedUser === 'function') {
        setAuthenticatedUser(response.user);
      }
      if (onProfileUpdate) onProfileUpdate(updates, response?.user || null);
      setStep('done');
    } catch {
      setError('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep('idle');
    setExtracted(null);
    setSelected({});
    setError(null);
    setFileName(null);
  };

  if (step === 'done') {
    return (
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-700/50 bg-emerald-50 dark:bg-emerald-900/20 p-4 flex items-center gap-3">
        <Icon name="CheckCircle" size={20} className="text-emerald-600 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Profile updated from resume</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Selected fields have been applied to your profile.</p>
        </div>
        <button onClick={reset} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">Parse Another</button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-5 shadow-lg">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="FileSearch" size={16} className="text-blue-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Parse Resume</h3>
        {step !== 'idle' && step !== 'parsing' && (
          <button onClick={reset} className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
            <Icon name="X" size={14} />
          </button>
        )}
      </div>

      {step === 'idle' && (
        <div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
            Upload your resume (PDF, DOCX) and we&apos;ll extract your profile information automatically.
          </p>
          {error && <p className="text-xs text-red-600 dark:text-red-400 mb-2">{error}</p>}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            iconName="Upload"
            iconPosition="left"
          >
            Upload Resume
          </Button>
        </div>
      )}

      {step === 'parsing' && (
        <div className="flex items-center gap-3 py-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-600 dark:text-slate-400">Parsing {fileName}...</p>
        </div>
      )}

      {step === 'review' && extracted && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            We found the following information. Select what to apply to your profile:
          </p>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {/* Skills */}
            {Array.isArray(extracted.skills) && extracted.skills.length > 0 && (
              <label className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/40 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={!!selected.skills}
                  onChange={(e) => setSelected((p) => ({ ...p, skills: e.target.checked }))}
                  className="mt-0.5 rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 dark:text-slate-300">Skills</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {extracted.skills.slice(0, 10).map((s) => (
                      <span key={s} className="px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                        {s}
                      </span>
                    ))}
                    {extracted.skills.length > 10 && (
                      <span className="text-xs text-gray-400">+{extracted.skills.length - 10} more</span>
                    )}
                  </div>
                </div>
              </label>
            )}

            {EXTRACTABLE_FIELDS.map(({ key, label, icon }) => {
              const val = extracted[key];
              if (val == null || val === '') return null;

              const isReadOnly = READ_ONLY_FIELDS.has(key);
              if (isReadOnly) {
                return (
                  <div key={key} className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-50/70 dark:bg-slate-700/25">
                    <div className="mt-0.5 h-4 w-4 flex items-center justify-center text-gray-400 dark:text-slate-500">
                      <Icon name="Lock" size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Icon name={icon} size={11} />
                        {label}
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-gray-200 dark:border-slate-600 text-gray-400 dark:text-slate-500">
                          Read-only
                        </span>
                      </p>
                      <p className="text-sm text-gray-900 dark:text-slate-100 truncate mt-0.5">
                        {renderFieldValue(key, val)}
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <label key={key} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/40 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={!!selected[key]}
                    onChange={(e) => setSelected((p) => ({ ...p, [key]: e.target.checked }))}
                    className="mt-0.5 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Icon name={icon} size={11} />
                      {label}
                    </p>
                    <p className="text-sm text-gray-900 dark:text-slate-100 truncate mt-0.5">
                      {renderFieldValue(key, val)}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1 border-t border-gray-100 dark:border-slate-700">
            <Button variant="outline" size="sm" onClick={reset}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              onClick={handleApply}
              disabled={Object.values(selected).every((v) => !v)}
            >
              Apply to Profile
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumeParserWidget;
