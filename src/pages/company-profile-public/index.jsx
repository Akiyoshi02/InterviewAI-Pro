import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import MaintenanceBanner from '../../components/ui/MaintenanceBanner';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useMaintenanceMode } from '../../hooks/useMaintenanceMode';
import apiClient from '../../services/apiClient.js';

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

  // Single-industry project scope.
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

const getHostname = (value) => {
  if (!value) return '';
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
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

const CompanyProfilePublicPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAuthenticated } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const normalizedAccountType = (user?.accountType || '').toLowerCase();
  const userType = normalizedAccountType === 'company'
    ? 'company'
    : (normalizedAccountType === 'admin' || normalizedAccountType === 'system_admin')
      ? 'admin'
      : 'candidate';
  const isCompanyPreviewRoute = location.pathname.startsWith('/company-preview/');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setNotFound(false);

      try {
        const data = isCompanyPreviewRoute && normalizedAccountType === 'company'
          ? await apiClient.companies.getMyProfile()
          : await apiClient.companies.getBySlug(slug);

        if (data?.company) {
          setCompany(data.company);
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isCompanyPreviewRoute, normalizedAccountType, slug]);

  if (loading) {
    return <LoadingState title="Loading company profile" variant="fullscreen" tone="primary" />;
  }

  const hasDetails = Boolean(
    company?.about
    || company?.mission
    || company?.culture
    || company?.workModel
    || company?.hiringProcess
    || company?.hiringTimeline
    || company?.responseTime
    || (company?.benefits && company.benefits.length > 0)
    || (company?.techStack && company.techStack.length > 0)
    || (company?.openJobs && company.openJobs.length > 0)
  );
  const coverImageUrl = getAssetUrl(company?.coverUrl || '');
  const logoImageUrl = getAssetUrl(company?.logoUrl || '');
  const coverColor = isHexColor(company?.coverColor) ? company.coverColor : '#3b82f6';
  const workModelLabel = formatWorkModelLabel(company?.workModel);
  const memberSinceLabel = formatMemberSince(company?.memberSince);

  return (
    <div className="dashboard-shell">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-24 right-0 h-60 w-60 sm:h-80 sm:w-80 bg-gradient-to-br from-blue-400/30 to-purple-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-[-10%] h-[300px] w-[300px] sm:h-[420px] sm:w-[420px] bg-gradient-to-tr from-indigo-300/25 via-blue-200/20 to-transparent blur-[120px]" />
        <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
      </div>

      <Header userType={userType} isAuthenticated={isAuthenticated} onLogout={handleLogout} />

      {isAuthenticated && maintenanceMode && <MaintenanceBanner />}

      <div className="h-14 xs:h-16" />

      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          {isAuthenticated && (
            <UserContextNavigation
              userType={userType}
              isCollapsed={isNavCollapsed}
              onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)}
            />
          )}

          <main
            className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${
              isAuthenticated
                ? (isNavCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80')
                : ''
            }`}
          >
            <section className="container-responsive py-6 xs:py-8 sm:py-10 space-y-4 xs:space-y-5 sm:space-y-6">
              {notFound ? (
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-8 text-center shadow-lg">
                  <Icon name="Building2" size={48} className="text-gray-300 dark:text-slate-600 mx-auto" />
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 mt-4">Company Not Found</h1>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
                    This company profile doesn't exist or is not public.
                  </p>
                  <Button
                    onClick={() => navigate(isCompanyPreviewRoute ? '/company-profile-editor' : '/companies')}
                    variant="outline"
                    className="mt-4"
                  >
                    {isCompanyPreviewRoute ? 'Back to editor' : 'Browse all companies'}
                  </Button>
                </div>
              ) : (
                <>
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-3xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 shadow-xl"
                  >
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
                            ? 'bg-gradient-to-b from-black/10 via-black/15 to-black/55'
                            : 'bg-transparent'
                        }`}
                      />
                    </div>

                    <div className="relative px-4 sm:px-6 pb-6 -mt-14 sm:-mt-16">
                      <div className="flex items-end gap-4">
                        <div className="w-24 h-24 rounded-2xl border-4 border-white dark:border-slate-800 bg-white dark:bg-slate-700 shadow-lg overflow-hidden shrink-0 flex items-center justify-center">
                          {logoImageUrl ? (
                            <img src={logoImageUrl} alt={company.name} className="w-full h-full object-contain p-1" />
                          ) : (
                            <Icon name="Building2" size={32} className="text-gray-400" />
                          )}
                        </div>

                        <div className="pb-1 min-w-0">
                          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 truncate">
                            {company.displayName}
                          </h1>
                          {company.tagline && (
                            <p className="text-sm text-gray-600 dark:text-slate-400 truncate">{company.tagline}</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Icon name="Briefcase" size={14} />
                          {formatIndustryLabel(company.industry)}
                        </span>

                        {company.companySize && (
                          <span className="flex items-center gap-1.5">
                            <Icon name="Users" size={14} />
                            {company.companySize} employees
                          </span>
                        )}

                        {company.location && (
                          <span className="flex items-center gap-1.5">
                            <Icon name="MapPin" size={14} />
                            {company.location}
                          </span>
                        )}

                        {company.website && (
                          <a
                            href={company.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <Icon name="Globe" size={14} />
                            {getHostname(company.website)}
                          </a>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                          <Icon name="BadgeCheck" size={12} />
                          Verified company
                        </span>
                        {memberSinceLabel && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/80 px-2.5 py-1 text-xs text-gray-600 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-300">
                            <Icon name="CalendarDays" size={12} />
                            Member since {memberSinceLabel}
                          </span>
                        )}
                        {workModelLabel && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/80 px-2.5 py-1 text-xs text-gray-600 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-300">
                            <Icon name="Building" size={12} />
                            {workModelLabel}
                          </span>
                        )}
                        {company?.responseTime && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/80 px-2.5 py-1 text-xs text-gray-600 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-300">
                            <Icon name="Clock3" size={12} />
                            {company.responseTime}
                          </span>
                        )}
                        {company?.hiringTimeline && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/80 px-2.5 py-1 text-xs text-gray-600 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-300">
                            <Icon name="Route" size={12} />
                            {company.hiringTimeline}
                          </span>
                        )}
                      </div>

                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-white/40 dark:border-slate-700/50 shadow p-4 text-center">
                          <p className="text-2xl font-bold text-blue-600">{company.openJobsCount}</p>
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Open Positions</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {!hasDetails && (
                    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
                      <p className="text-sm text-gray-500 dark:text-slate-400">
                        This company has not published more profile details yet.
                      </p>
                    </div>
                  )}

                  {company.about && (
                    <section className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-5 shadow-lg">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">About</h2>
                      <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">{company.about}</p>
                    </section>
                  )}

                  {company.hiringProcess && (
                    <section className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-5 shadow-lg">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">Hiring Process</h2>
                      <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">{company.hiringProcess}</p>
                    </section>
                  )}

                  {company.mission && (
                    <section className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-5 shadow-lg">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">Mission</h2>
                      <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">{company.mission}</p>
                    </section>
                  )}

                  {company.culture && (
                    <section className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-5 shadow-lg">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">Culture</h2>
                      <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">{company.culture}</p>
                    </section>
                  )}

                  {company.benefits?.length > 0 && (
                    <section className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-5 shadow-lg">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">Benefits & Perks</h2>
                      <div className="flex flex-wrap gap-2">
                        {company.benefits.map((benefit) => <Tag key={benefit} label={benefit} />)}
                      </div>
                    </section>
                  )}

                  {company.techStack?.length > 0 && (
                    <section className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-5 shadow-lg">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">Tech Stack</h2>
                      <div className="flex flex-wrap gap-2">
                        {company.techStack.map((stack) => <Tag key={stack} label={stack} />)}
                      </div>
                    </section>
                  )}

                  {company.openJobs?.length > 0 && (
                    <section className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-5 shadow-lg">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">Open Positions</h2>
                      <div className="space-y-3">
                        {company.openJobs.map((job) => (
                          <Link
                            key={job.id}
                            to={`/jobs/${job.id}`}
                            className="block rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-white/40 dark:border-slate-700/50 shadow hover:shadow-md transition-shadow p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{job.title}</p>
                                <div className="flex gap-3 mt-1 text-xs text-gray-500 dark:text-slate-400">
                                  {job.location && <span className="flex items-center gap-1"><Icon name="MapPin" size={11} />{job.location}</span>}
                                  {job.type && <span>{job.type}</span>}
                                  {job.salary && <span className="text-green-600 dark:text-green-400">{job.salary}</span>}
                                </div>
                              </div>
                              <Icon name="ChevronRight" size={16} className="text-gray-400 shrink-0" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    </section>
                  )}

                  {company.socialLinks && Object.keys(company.socialLinks).length > 0 && (
                    <section className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-5 shadow-lg">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">Connect</h2>
                      <div className="flex flex-wrap gap-3">
                        {Object.entries(company.socialLinks).map(([platform, url]) => (
                          url && (
                            <a
                              key={platform}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              <Icon name={platform === 'linkedin' ? 'Linkedin' : platform === 'twitter' ? 'Twitter' : 'Globe'} size={16} />
                              {platform.charAt(0).toUpperCase() + platform.slice(1)}
                            </a>
                          )
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default CompanyProfilePublicPage;
