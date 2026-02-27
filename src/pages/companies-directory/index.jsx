import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import MaintenanceBanner from '../../components/ui/MaintenanceBanner';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useMaintenanceMode } from '../../hooks/useMaintenanceMode';
import apiClient from '../../services/apiClient.js';
import CompanyDirectoryProfilePreview from '../../components/company/CompanyDirectoryProfilePreview';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_BASE_URL = API_URL.replace(/\/$/, '');

const INDUSTRIES = [
  { value: 'technology', label: 'Technology & Software' },
];

const INDUSTRY_FILTER_OPTIONS = [
  { value: '', label: 'Select industry' },
  ...INDUSTRIES,
];

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

const CompaniesDirectoryPage = () => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCompanySlug, setSelectedCompanySlug] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedCompanyLoading, setSelectedCompanyLoading] = useState(false);
  const [selectedCompanyError, setSelectedCompanyError] = useState('');

  const normalizedAccountType = (user?.accountType || '').toLowerCase();
  const userType = normalizedAccountType === 'company'
    ? 'company'
    : (normalizedAccountType === 'admin' || normalizedAccountType === 'system_admin')
      ? 'admin'
      : 'candidate';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeoutId);
  }, [search]);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await apiClient.companies.list({
        search: debouncedSearch,
        industry,
      });

      setCompanies(Array.isArray(data.companies) ? data.companies : []);
    } catch (err) {
      setCompanies([]);
      setError(err?.message || 'Failed to load companies.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, industry]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    if (companies.length === 0) {
      setSelectedCompanySlug('');
      setSelectedCompany(null);
      setSelectedCompanyError('');
      return;
    }

    if (!selectedCompanySlug) return;

    const selectedStillVisible = companies.some((company) => company.slug === selectedCompanySlug);
    if (!selectedStillVisible) {
      setSelectedCompanySlug('');
      setSelectedCompany(null);
      setSelectedCompanyError('');
    }
  }, [companies, selectedCompanySlug]);

  const loadSelectedCompany = useCallback(async (slug) => {
    if (!slug) {
      setSelectedCompany(null);
      setSelectedCompanyError('');
      return;
    }

    setSelectedCompanyLoading(true);
    setSelectedCompanyError('');

    try {
      const data = await apiClient.companies.getBySlug(slug);
      if (!data?.company) throw new Error('Failed to load company details.');

      setSelectedCompany(data.company);
    } catch (err) {
      setSelectedCompany(null);
      setSelectedCompanyError(err?.message || 'Failed to load company details.');
    } finally {
      setSelectedCompanyLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSelectedCompany(selectedCompanySlug);
  }, [selectedCompanySlug, loadSelectedCompany]);

  const handleBackToCompanies = () => {
    setSelectedCompanySlug('');
    setSelectedCompany(null);
    setSelectedCompanyError('');
  };

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
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-1"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-500/30">
                    <Icon name="Building2" size={24} color="white" />
                  </div>
                  <div>
                    <h1 className="text-2xl xs:text-3xl sm:text-4xl font-bold text-gray-900 dark:text-slate-100">
                      Companies Directory
                    </h1>
                    <p className="text-sm xs:text-base text-gray-600 dark:text-slate-400 mt-1">
                      Explore public company profiles and discover open opportunities.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-3">
                  <div className="relative">
                    <Icon
                      name="Search"
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="text"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search companies..."
                      className="w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 pl-10 pr-3 py-2.5 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="relative">
                    <select
                      value={industry}
                      onChange={(event) => setIndustry(event.target.value)}
                      className="w-full appearance-none rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 pr-10 py-2.5 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {INDUSTRY_FILTER_OPTIONS.map((value) => (
                        <option key={value.value} value={value.value}>{value.label}</option>
                      ))}
                    </select>
                    <Icon
                      name="ChevronDown"
                      size={16}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                  </div>
                </div>

                {!loading && !error && companies.length > 0 && selectedCompanySlug && (
                  <div className="mt-5">
                    <div className="mb-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        iconName="ArrowLeft"
                        iconPosition="left"
                        onClick={handleBackToCompanies}
                        className="rounded-full"
                      >
                        Back to companies
                      </Button>
                    </div>
                    {selectedCompanyLoading ? (
                      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 text-center shadow-lg">
                        <Icon name="Loader2" size={22} className="animate-spin text-blue-500 mx-auto" />
                        <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">Loading company details...</p>
                      </div>
                    ) : selectedCompanyError ? (
                      <div className="rounded-2xl border border-red-200/70 dark:border-red-800/40 bg-red-50/80 dark:bg-red-900/10 p-5 shadow-lg">
                        <p className="text-sm text-red-600 dark:text-red-300/90">{selectedCompanyError}</p>
                      </div>
                    ) : selectedCompany ? (
                      <CompanyDirectoryProfilePreview
                        company={selectedCompany}
                        onJobSelect={(job) => navigate(`/jobs/${job.id}`)}
                      />
                    ) : null}
                  </div>
                )}
              </motion.div>

              {loading ? (
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-8 text-center shadow-lg">
                  <Icon name="Loader2" size={26} className="animate-spin text-blue-500 mx-auto" />
                  <p className="mt-3 text-sm text-gray-500 dark:text-slate-400">Loading companies...</p>
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-red-200/70 dark:border-red-800/40 bg-red-50/80 dark:bg-red-900/10 p-6 shadow-lg">
                  <div className="flex items-start gap-3">
                    <Icon name="AlertTriangle" size={20} className="text-red-500 mt-0.5" />
                    <div className="flex-1">
                      <h2 className="text-base font-semibold text-red-700 dark:text-red-300">Could not load companies</h2>
                      <p className="text-sm text-red-600 dark:text-red-300/90 mt-1">{error}</p>
                      <Button onClick={loadCompanies} variant="outline" size="sm" className="mt-4">
                        Try again
                      </Button>
                    </div>
                  </div>
                </div>
              ) : companies.length === 0 ? (
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-10 text-center shadow-lg">
                  <Icon name="Building2" size={48} className="text-gray-300 dark:text-slate-600 mx-auto" />
                  <p className="mt-3 text-sm text-gray-500 dark:text-slate-400">
                    No companies found. Try a different search.
                  </p>
                </div>
              ) : selectedCompanySlug ? null : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {companies.map((company) => {
                    const logoImageUrl = getAssetUrl(company.logoUrl || '');
                    const coverImageUrl = getAssetUrl(company.coverUrl || '');
                    const coverColor = isHexColor(company.coverColor) ? company.coverColor : '#3b82f6';
                    const companyOpenJobsCount = Number.isFinite(Number(company.openJobsCount))
                      ? Number(company.openJobsCount)
                      : 0;
                    const workModelLabel = formatWorkModelLabel(company.workModel);
                    const companyWebsiteHost = getHostname(company.website || '');

                    return (
                      <motion.div
                        key={company.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="h-full"
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedCompanySlug(company.slug)}
                          className="group relative h-full w-full overflow-hidden rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 text-left shadow-[0_14px_40px_-24px_rgba(59,130,246,0.65)] transition-all hover:-translate-y-1 hover:border-blue-200/70 dark:hover:border-blue-600/50 hover:shadow-[0_20px_48px_-20px_rgba(59,130,246,0.55)]"
                        >
                          <div
                            className={`relative h-20 overflow-hidden ${
                              coverImageUrl ? 'bg-slate-900' : ''
                            }`}
                            style={
                              coverImageUrl
                                ? undefined
                                : { background: coverColor }
                            }
                          >
                            {coverImageUrl && (
                              <img src={coverImageUrl} alt="" className="h-full w-full object-cover" />
                            )}
                            <div
                              className={`absolute inset-0 ${
                                coverImageUrl ? 'bg-gradient-to-r from-black/20 via-transparent to-black/10' : 'bg-transparent'
                              }`}
                            />
                          </div>

                          <div className="relative p-4">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="-mt-9 h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-white dark:border-slate-800 bg-white dark:bg-slate-700 shadow-lg flex items-center justify-center">
                                  {logoImageUrl ? (
                                    <img src={logoImageUrl} alt={company.displayName || company.name} className="h-full w-full object-contain p-1.5" />
                                  ) : (
                                    <Icon name="Building2" size={22} className="text-gray-400" />
                                  )}
                                </div>

                                <div className="min-w-0 pt-1">
                                  <p className="truncate text-base font-semibold text-gray-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {company.displayName || company.name || 'Unnamed company'}
                                  </p>
                                  <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-slate-400">
                                    {formatIndustryLabel(company.industry)}
                                  </p>
                                </div>
                              </div>

                              <span className="inline-flex items-center rounded-full border border-blue-200/70 bg-blue-50/80 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:border-blue-700/40 dark:bg-blue-900/20 dark:text-blue-300 whitespace-nowrap">
                                {companyOpenJobsCount} open
                              </span>
                            </div>

                            <p className="text-sm text-gray-600 dark:text-slate-400 line-clamp-2">
                              {company.tagline || 'No public tagline added yet.'}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {workModelLabel && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-white/50 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/60 px-2 py-1 text-[11px] text-gray-600 dark:text-slate-300">
                                  <Icon name="Building" size={11} />
                                  {workModelLabel}
                                </span>
                              )}
                              {company.companySize && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-white/50 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/60 px-2 py-1 text-[11px] text-gray-600 dark:text-slate-300">
                                  <Icon name="Users" size={11} />
                                  {company.companySize} employees
                                </span>
                              )}
                            </div>

                            <div className="mt-3 space-y-1.5 text-xs text-gray-500 dark:text-slate-400">
                              <div className="flex items-center gap-1.5 truncate">
                                <Icon name="MapPin" size={12} className="shrink-0" />
                                <span className="truncate">{company.location || 'Location not set'}</span>
                              </div>
                              {companyWebsiteHost && (
                                <div className="flex items-center gap-1.5 truncate">
                                  <Icon name="Globe" size={12} className="shrink-0" />
                                  <span className="truncate">{companyWebsiteHost}</span>
                                </div>
                              )}
                            </div>

                            <div className="mt-4 flex items-center justify-between">
                              <span className="text-xs text-gray-500 dark:text-slate-400">View company profile</span>
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/60 dark:border-slate-700/70 bg-white/85 dark:bg-slate-900/60 text-blue-600 dark:text-blue-400 transition-transform group-hover:translate-x-0.5">
                                <Icon name="ArrowRight" size={14} />
                              </span>
                            </div>
                          </div>
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default CompaniesDirectoryPage;
