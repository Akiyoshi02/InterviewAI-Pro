import React from 'react';
import Icon from '../AppIcon';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_BASE_URL = API_URL.replace(/\/$/, '');

const formatIndustryLabel = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (
    !normalized ||
    normalized === 'technology' ||
    normalized === 'technology & software' ||
    normalized === 'tech' ||
    normalized === 'it' ||
    normalized === 'information technology' ||
    normalized.includes('software')
  ) {
    return 'Technology & Software';
  }

  return 'Technology & Software';
};

const formatWorkModelLabel = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'REMOTE') return 'Remote';
  if (normalized === 'HYBRID') return 'Hybrid';
  if (normalized === 'ONSITE') return 'Onsite';
  if (normalized === 'FLEXIBLE') return 'Flexible';
  return '';
};

const formatMemberSince = (value) => {
  if (!value) return '';

  let parsedDate;
  if (value?.toDate?.() instanceof Date) {
    parsedDate = value.toDate();
  } else if (typeof value?._seconds === 'number') {
    parsedDate = new Date(value._seconds * 1000);
  } else {
    parsedDate = new Date(value);
  }

  if (!(parsedDate instanceof Date) || Number.isNaN(parsedDate.getTime())) return '';

  return parsedDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

const getAssetUrl = (assetPath) => {
  if (!assetPath) return '';
  if (
    assetPath.startsWith('http://') ||
    assetPath.startsWith('https://') ||
    assetPath.startsWith('blob:') ||
    assetPath.startsWith('data:')
  ) {
    return assetPath;
  }

  return `${API_BASE_URL}${assetPath.startsWith('/') ? assetPath : `/${assetPath}`}`;
};

const getHostname = (value) => {
  if (!value) return '';
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
};

const isHexColor = (value) => /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(String(value || '').trim());

const FACEBOOK_COVER = {
  width: 820,
  height: 312,
};

const Tag = ({ label }) => (
  <span className="inline-flex px-2.5 py-1 rounded-full text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
    {label}
  </span>
);

const CompanyDirectoryProfilePreview = ({ company, onJobSelect, appliedJobIds = [] }) => {
  if (!company) return null;
  const canOpenJobs = typeof onJobSelect === 'function';
  const appliedJobIdLookup = new Set(
    (Array.isArray(appliedJobIds) ? appliedJobIds : [])
      .map((jobId) => String(jobId || '').trim())
      .filter(Boolean),
  );

  const coverImageUrl = getAssetUrl(company.coverUrl || '');
  const logoImageUrl = getAssetUrl(company.logoUrl || '');
  const coverColor = isHexColor(company.coverColor) ? company.coverColor : '#3b82f6';
  const workModelLabel = formatWorkModelLabel(company.workModel);
  const memberSince = formatMemberSince(company.memberSince);
  const websiteHost = getHostname(company.website || '');
  const openJobsCount = Number.isFinite(Number(company.openJobsCount))
    ? Number(company.openJobsCount)
    : (Array.isArray(company.openJobs) ? company.openJobs.length : 0);
  const hasProfileDetails = Boolean(
    company.about
    || company.mission
    || company.culture
    || company.hiringProcess
    || (company.benefits && company.benefits.length > 0)
    || (company.techStack && company.techStack.length > 0)
  );

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 shadow-[0_24px_65px_-24px_rgba(59,130,246,0.55)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(59,130,246,0.16),transparent_48%),radial-gradient(circle_at_20%_100%,rgba(99,102,241,0.14),transparent_52%)]" />

      <div
        className={`relative overflow-hidden ${
          coverImageUrl ? 'bg-slate-900' : ''
        }`}
        style={
          coverImageUrl
            ? { height: `clamp(180px, 34vw, ${FACEBOOK_COVER.height}px)` }
            : {
              background: coverColor,
              height: `clamp(180px, 34vw, ${FACEBOOK_COVER.height}px)`,
            }
        }
      >
        {coverImageUrl && (
          <img src={coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
        )}
        <div
          className={`absolute inset-0 ${
            coverImageUrl
              ? 'bg-gradient-to-b from-black/15 via-black/20 to-slate-950/80'
              : 'bg-transparent'
          }`}
        />
      </div>

      <div className="relative px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8 -mt-14 sm:-mt-16">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-end gap-4 min-w-0">
            <div className="w-24 h-24 rounded-2xl border-4 border-white dark:border-slate-800 bg-white dark:bg-slate-700 shadow-xl overflow-hidden shrink-0 flex items-center justify-center">
              {logoImageUrl ? (
                <img src={logoImageUrl} alt={company.displayName || company.name} className="w-full h-full object-contain p-1.5" />
              ) : (
                <Icon name="Building2" size={32} className="text-gray-400" />
              )}
            </div>

            <div className="pb-1 min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold text-white dark:text-slate-100 truncate drop-shadow-sm">
                {company.displayName || company.name}
              </h2>
              <p className="mt-1 text-sm sm:text-base text-slate-100/90 dark:text-slate-300 truncate">
                {company.tagline || 'Company profile'}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto sm:min-w-[180px] lg:min-w-[200px]">
            <div className="rounded-2xl border border-white/20 bg-white/12 px-3 py-3 backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-wide text-slate-200/90">Open roles</p>
              <p className="mt-1 text-xl font-semibold text-white">{openJobsCount}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white/15 px-3 py-1.5 text-slate-100 backdrop-blur-sm">
            <Icon name="Briefcase" size={13} />
            {formatIndustryLabel(company.industry)}
          </span>

          {company.companySize && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white/15 px-3 py-1.5 text-slate-100 backdrop-blur-sm">
              <Icon name="Users" size={13} />
              {company.companySize} employees
            </span>
          )}

          {company.location && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white/15 px-3 py-1.5 text-slate-100 backdrop-blur-sm">
              <Icon name="MapPin" size={13} />
              {company.location}
            </span>
          )}

          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white/15 px-3 py-1.5 text-blue-100 hover:text-white hover:border-white/60 transition-colors backdrop-blur-sm"
            >
              <Icon name="Globe" size={13} />
              {websiteHost}
            </a>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/25 dark:text-emerald-300">
            <Icon name="BadgeCheck" size={12} />
            Verified company
          </span>
          {memberSince && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/90 px-3 py-1.5 text-xs text-gray-700 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300">
              <Icon name="CalendarDays" size={12} />
              Member since {memberSince}
            </span>
          )}
          {workModelLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/90 px-3 py-1.5 text-xs text-gray-700 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300">
              <Icon name="Building" size={12} />
              {workModelLabel}
            </span>
          )}
          {company.hiringTimeline && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/90 px-3 py-1.5 text-xs text-gray-700 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300">
              <Icon name="Route" size={12} />
              {company.hiringTimeline}
            </span>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            {(company.about || company.mission || company.culture) ? (
              <section className="rounded-2xl border border-white/50 dark:border-slate-700/50 bg-white/85 dark:bg-slate-900/60 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                  About company
                </h3>

                {company.about && (
                  <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-slate-300 whitespace-pre-line">
                    {company.about}
                  </p>
                )}

                {company.mission && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Mission</p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-700 dark:text-slate-300 whitespace-pre-line">{company.mission}</p>
                  </div>
                )}

                {company.culture && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Culture</p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-700 dark:text-slate-300 whitespace-pre-line">{company.culture}</p>
                  </div>
                )}
              </section>
            ) : null}

            {company.hiringProcess && (
              <section className="rounded-2xl border border-white/50 dark:border-slate-700/50 bg-white/85 dark:bg-slate-900/60 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                  Hiring process
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-slate-300 whitespace-pre-line">
                  {company.hiringProcess}
                </p>
              </section>
            )}

            {!hasProfileDetails && (
              <section className="rounded-2xl border border-white/50 dark:border-slate-700/50 bg-white/85 dark:bg-slate-900/60 p-5">
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  This company has not published extra profile details yet.
                </p>
              </section>
            )}
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl border border-white/50 dark:border-slate-700/50 bg-white/85 dark:bg-slate-900/60 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Company snapshot
              </h3>
              <div className="mt-3 space-y-2.5 text-sm">
                <div className="flex items-start gap-2 text-gray-700 dark:text-slate-300">
                  <Icon name="MapPin" size={14} className="mt-0.5 text-blue-500" />
                  <span>{company.location || 'Location not set'}</span>
                </div>
                <div className="flex items-start gap-2 text-gray-700 dark:text-slate-300">
                  <Icon name="Globe" size={14} className="mt-0.5 text-blue-500" />
                  {company.website ? (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {websiteHost}
                    </a>
                  ) : (
                    <span>Website not set</span>
                  )}
                </div>
                <div className="flex items-start gap-2 text-gray-700 dark:text-slate-300">
                  <Icon name="Users" size={14} className="mt-0.5 text-blue-500" />
                  <span>{company.companySize ? `${company.companySize} employees` : 'Team size not set'}</span>
                </div>
                <div className="flex items-start gap-2 text-gray-700 dark:text-slate-300">
                  <Icon name="Clock3" size={14} className="mt-0.5 text-blue-500" />
                  <span>{company.responseTime || 'Response time not set'}</span>
                </div>
                {company.hiringTimeline && (
                  <div className="flex items-start gap-2 text-gray-700 dark:text-slate-300">
                    <Icon name="Route" size={14} className="mt-0.5 text-blue-500" />
                    <span>{company.hiringTimeline}</span>
                  </div>
                )}
              </div>
            </section>

            {company.benefits?.length > 0 && (
              <section className="rounded-2xl border border-white/50 dark:border-slate-700/50 bg-white/85 dark:bg-slate-900/60 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-3">
                  Benefits & perks
                </h3>
                <div className="flex flex-wrap gap-2">
                  {company.benefits.map((benefit) => (
                    <Tag key={`benefit-${benefit}`} label={benefit} />
                  ))}
                </div>
              </section>
            )}

            {company.techStack?.length > 0 && (
              <section className="rounded-2xl border border-white/50 dark:border-slate-700/50 bg-white/85 dark:bg-slate-900/60 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-3">
                  Tech stack
                </h3>
                <div className="flex flex-wrap gap-2">
                  {company.techStack.map((stack) => (
                    <Tag key={`stack-${stack}`} label={stack} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/50 dark:border-slate-700/50 bg-white/85 dark:bg-slate-900/65 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">Open positions</h3>
            <span className="inline-flex items-center rounded-full border border-blue-200/70 bg-blue-50/80 px-2.5 py-1 text-xs font-medium text-blue-700 dark:border-blue-700/40 dark:bg-blue-900/20 dark:text-blue-300">
              {openJobsCount} open
            </span>
          </div>

          {company.openJobs?.length > 0 ? (
            <div className="space-y-2.5">
              {company.openJobs.slice(0, 5).map((job, index) => {
                const jobId = String(job?.id || job?.jobId || '').trim();
                const hasApplied = Boolean(jobId) && appliedJobIdLookup.has(jobId);

                return (
                  <button
                    key={job?.id || job?.jobId || `${job?.title || 'job'}-${index}`}
                    type="button"
                    onClick={() => onJobSelect?.(job)}
                    disabled={!canOpenJobs}
                    className={`w-full rounded-xl border border-white/60 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/60 px-4 py-3 text-left ${
                      canOpenJobs
                        ? 'transition-all hover:-translate-y-0.5 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm'
                        : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{job.title}</p>
                      {hasApplied && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/25 dark:text-emerald-300">
                          <Icon name="BadgeCheck" size={11} />
                          Applied
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      {job.location || 'Location not specified'}
                      {job.type ? ` - ${job.type}` : ''}
                      {job.salary ? ` - ${job.salary}` : ''}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-slate-400">
              No open positions published right now.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanyDirectoryProfilePreview;
