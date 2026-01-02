import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import JobApplicationForm from './components/JobApplicationForm';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Helper function to convert relative upload paths to absolute URLs
const getLogoUrl = (logoPath) => {
  if (!logoPath) return null;
  if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
    return logoPath;
  }
  // Convert relative path to absolute URL
  const base = API_URL.replace(/\/$/, '');
  return `${base}${logoPath.startsWith('/') ? logoPath : `/${logoPath}`}`;
};

const JobsPage = () => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, status } = useAuth();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [applicationJob, setApplicationJob] = useState(null);
  const [applicationSuccess, setApplicationSuccess] = useState(false);
  const [applicationsByJobId, setApplicationsByJobId] = useState(new Map()); // Map<jobId, {status, withdrawnBy}>
  
  // Check localStorage for cached auth state to prevent flash during initial load
  const cachedIsAuthenticated = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('isAuthenticated') === 'true';
  }, []);
  
  // Show sidebar if authenticated OR if auth is loading but user was previously authenticated
  const showSidebar = isAuthenticated || (status === 'loading' && cachedIsAuthenticated);
  
  const userType = user?.accountType?.toLowerCase() === 'company' ? 'company' : 'candidate';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    const loadJobs = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await apiClient.jobs.listPublic(50);
        if (result.success) {
          setJobs(result.jobs || []);
        } else {
          setError('Failed to load jobs.');
        }
      } catch (err) {
        setError(err.message || 'Failed to load jobs.');
      } finally {
        setLoading(false);
      }
    };
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load user's applications to check which jobs have been applied to and their status
  useEffect(() => {
    const loadApplications = async () => {
      if (!isAuthenticated || user?.accountType?.toUpperCase() !== 'CANDIDATE') {
        setApplicationsByJobId(new Map());
        return;
      }
      try {
        const result = await apiClient.applications.getMyApplications();
        if (result.success && result.applications) {
          // Create a map of jobId -> application status info
          // If multiple applications exist for the same job, prioritize the most recent non-withdrawn one
          const applicationsMap = new Map();
          result.applications.forEach((app) => {
            if (app.jobId) {
              const existing = applicationsMap.get(app.jobId);
              const isWithdrawn = app.status === 'REJECTED' && app.withdrawnBy;
              const existingIsWithdrawn = existing?.status === 'REJECTED' && existing?.withdrawnBy;
              
              // Always prefer non-withdrawn applications over withdrawn ones
              // If both are withdrawn or both are not withdrawn, prefer the most recent (later in array)
              if (!existing || (!isWithdrawn && existingIsWithdrawn) || (isWithdrawn === existingIsWithdrawn)) {
                applicationsMap.set(app.jobId, {
                  status: app.status,
                  withdrawnBy: app.withdrawnBy || null,
                });
              }
            }
          });
          setApplicationsByJobId(applicationsMap);
        }
      } catch (err) {
        console.error('Failed to load applications:', err);
      }
    };
    loadApplications();
  }, [isAuthenticated, user]);

  const handlePractice = (job) => {
    if (job) {
      try {
        const draft = JSON.parse(localStorage.getItem('interviewSetupDraft') || '{}');
        localStorage.setItem(
          'interviewSetupDraft',
          JSON.stringify({
            ...draft,
            jobRole: job.title,
            industry: job.department || draft.industry,
          }),
        );
      } catch {
        // ignore
      }
    }
    navigate('/practice-interview-setup');
  };

  const handleApply = (job) => {
    if (!job) return;
    if (!isAuthenticated) {
      navigate(`/login?redirect=/jobs`);
      return;
    }
    
    // Only candidates can apply
    if (user?.accountType?.toUpperCase() !== 'CANDIDATE') {
      alert('Only candidates can apply to jobs.');
      return;
    }
    
    setApplicationJob(job);
    setShowApplicationForm(true);
  };

  const handleApplicationSuccess = async (application) => {
    setShowApplicationForm(false);
    setApplicationSuccess(true);
    // Update the application status for this job
    if (application?.jobId) {
      setApplicationsByJobId((prev) => {
        const newMap = new Map(prev);
        newMap.set(application.jobId, {
          status: application.status || 'SUBMITTED',
          withdrawnBy: application.withdrawnBy || null,
        });
        return newMap;
      });
    }
    
    // Reload applications to ensure we have the latest status
    if (isAuthenticated && user?.accountType?.toUpperCase() === 'CANDIDATE') {
      try {
        const result = await apiClient.applications.getMyApplications();
        if (result.success && result.applications) {
          // Create a map of jobId -> application status info
          // If multiple applications exist for the same job, prioritize the most recent non-withdrawn one
          const applicationsMap = new Map();
          result.applications.forEach((app) => {
            if (app.jobId) {
              const existing = applicationsMap.get(app.jobId);
              const isWithdrawn = app.status === 'REJECTED' && app.withdrawnBy;
              const existingIsWithdrawn = existing?.status === 'REJECTED' && existing?.withdrawnBy;
              
              // Always prefer non-withdrawn applications over withdrawn ones
              // If both are withdrawn or both are not withdrawn, prefer the most recent (later in array)
              if (!existing || (!isWithdrawn && existingIsWithdrawn) || (isWithdrawn === existingIsWithdrawn)) {
                applicationsMap.set(app.jobId, {
                  status: app.status,
                  withdrawnBy: app.withdrawnBy || null,
                });
              }
            }
          });
          setApplicationsByJobId(applicationsMap);
        }
      } catch (err) {
        console.error('Failed to reload applications:', err);
      }
    }
    
    setTimeout(() => setApplicationSuccess(false), 5000);
  };

  // Format experience level for display
  const formatExperienceLevel = (level) => {
    if (!level) return null;
    const mapping = {
      'ENTRY': 'Entry Level',
      'JUNIOR': 'Junior',
      'MID': 'Mid-Level',
      'SENIOR': 'Senior',
      'LEAD': 'Lead',
      'PRINCIPAL': 'Principal',
      'EXECUTIVE': 'Executive'
    };
    return mapping[level] || level.charAt(0) + level.slice(1).toLowerCase();
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-24 right-0 h-60 w-60 sm:h-80 sm:w-80 bg-gradient-to-br from-blue-400/30 to-purple-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-[-10%] h-[300px] w-[300px] sm:h-[420px] sm:w-[420px] bg-gradient-to-tr from-indigo-300/25 via-blue-200/20 to-transparent blur-[120px]" />
        <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
      </div>

      <Header userType={userType} isAuthenticated={showSidebar} onLogout={handleLogout} />
      
      {/* Spacer for fixed header */}
      <div className="h-14 xs:h-16" />
      
      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          {showSidebar && (
            <UserContextNavigation
              userType={userType}
              isCollapsed={isNavCollapsed}
              onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)}
            />
          )}
          <main
            className={`flex-1 transition-all duration-300 ${
              showSidebar
                ? `pb-20 lg:pb-0 ${isNavCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'}`
                : ''
            }`}
          >
          <section className="container-responsive py-6 xs:py-8 sm:py-10 space-y-4 xs:space-y-5 sm:space-y-6">
            <div className="relative overflow-hidden card-base p-4 xs:p-5 sm:p-6 shadow-glass dark:shadow-glass-dark">
              <div className="absolute inset-0 opacity-80 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.15),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.15),transparent_40%)]" />
              <div className="relative z-10 flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 text-center sm:text-left">
                  <div className="mx-auto sm:mx-0 w-11 h-11 xs:w-12 xs:h-12 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
                    <Icon name="Briefcase" size={18} className="xs:w-5 xs:h-5" color="white" />
                  </div>
                  <div className="space-y-1 xs:space-y-1.5">
                    <p className="text-[10px] xs:text-xs uppercase tracking-[0.4em] xs:tracking-[0.5em] text-blue-600 dark:text-blue-300">Opportunities</p>
                    <h1 className="text-2xl xs:text-3xl sm:text-4xl font-bold text-gray-900 dark:text-slate-100">Interview-ready roles</h1>
                    <p className="text-sm xs:text-base text-gray-600 dark:text-slate-300 max-w-2xl">
                      Browse openings from teams already using InterviewAI to streamline their hiring process.
                    </p>
                  </div>
                </div>
                <div className="rounded-xl xs:rounded-2xl border border-blue-100 dark:border-blue-500/30 bg-blue-50/70 dark:bg-blue-500/10 p-3 xs:p-4 text-xs xs:text-sm text-blue-900 dark:text-blue-100">
                  Select a role, review key skills, and launch a practice interview in minutes.
                </div>
              </div>
            </div>
    
            {loading && (
              <div className="grid gap-4 xs:gap-5 sm:gap-6 max-w-4xl mx-auto" aria-busy="true">
                <div className="grid gap-3 xs:gap-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={`job-skeleton-${index}`}
                      className="card-base p-4 xs:p-5 space-y-3 xs:space-y-4 animate-pulse"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-2/3 rounded-full bg-slate-200/80 dark:bg-slate-700/60" />
                          <div className="h-3 w-1/3 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                        </div>
                        <div className="h-5 w-16 rounded-full bg-slate-200/80 dark:bg-slate-700/60" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 w-full rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                        <div className="h-3 w-5/6 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="h-5 w-14 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                        <span className="h-5 w-12 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                        <span className="h-5 w-16 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                      </div>
                      <div className="h-3 w-1/2 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                    </div>
                  ))}
                </div>
                <div className="card-base p-4 xs:p-5 sm:p-6 space-y-4 animate-pulse">
                  <div className="space-y-2">
                    <div className="h-3 w-24 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                    <div className="h-5 w-2/3 rounded-full bg-slate-200/80 dark:bg-slate-700/60" />
                    <div className="h-3 w-1/3 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-full rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                    <div className="h-3 w-11/12 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                    <div className="h-3 w-5/6 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                  </div>
                  <div className="h-20 rounded-xl bg-slate-200/60 dark:bg-slate-700/40" />
                  <div className="flex flex-wrap gap-2">
                    <span className="h-5 w-14 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                    <span className="h-5 w-16 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                    <span className="h-5 w-12 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                  </div>
                  <div className="flex flex-col xs:flex-row gap-2 xs:gap-3">
                    <div className="h-9 flex-1 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                    <div className="h-9 flex-1 rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
                  </div>
                </div>
              </div>
            )}
    
            {error && (
              <div className="text-center text-sm xs:text-base text-red-600 dark:text-red-400">{error}</div>
            )}
    
            {!loading && !error && (
              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 xs:gap-5 sm:gap-6"
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
              >
                {jobs.length === 0 ? (
                  <div className="card-base p-6 xs:p-8 text-center max-w-lg mx-auto">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center mx-auto mb-4">
                      <Icon name="Briefcase" size={28} className="text-gray-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">No openings available</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                      There are no public job listings at the moment. You can still practice interviews for any role.
                    </p>
                    <Button className="rounded-full" onClick={() => handlePractice(null)}>
                      <Icon name="Play" size={16} className="mr-1.5" />
                      Start a practice interview
                    </Button>
                  </div>
                ) : (
                  jobs.map((job) => {
                    const applicationInfo = isAuthenticated && user?.accountType?.toUpperCase() === 'CANDIDATE' 
                      ? applicationsByJobId.get(job.id) 
                      : null;
                    const hasApplied = !!applicationInfo;
                    const isWithdrawn = applicationInfo?.status === 'REJECTED' && applicationInfo?.withdrawnBy;
                    const isRejected = applicationInfo?.status === 'REJECTED' && !applicationInfo?.withdrawnBy;
                    const canReapply = isWithdrawn; // Can reapply if withdrawn
                    const showAppliedBadge = hasApplied && !isWithdrawn && !isRejected;
                    const showWithdrawnBadge = isWithdrawn;
                    const showRejectedBadge = isRejected;
                    
                    return (
                    <motion.div
                      key={job.id}
                      variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                      className="card-base p-4 xs:p-5 sm:p-6 space-y-3 xs:space-y-4 h-full flex flex-col relative"
                    >
                      {/* Status Badge */}
                      {showAppliedBadge && (
                        <div className="absolute top-3 right-3 z-10">
                          <div className="px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 flex items-center gap-1.5 shadow-sm">
                            <Icon name="CheckCircle" size={14} className="text-green-600 dark:text-green-400" />
                            <span className="text-xs font-medium text-green-700 dark:text-green-300">Applied</span>
                          </div>
                        </div>
                      )}
                      {showWithdrawnBadge && (
                        <div className="absolute top-3 right-3 z-10">
                          <div className="px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 flex items-center gap-1.5 shadow-sm">
                            <Icon name="XCircle" size={14} className="text-orange-600 dark:text-orange-400" />
                            <span className="text-xs font-medium text-orange-700 dark:text-orange-300">Withdrew</span>
                          </div>
                        </div>
                      )}
                      {showRejectedBadge && (
                        <div className="absolute top-3 right-3 z-10">
                          <div className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-800 flex items-center gap-1.5 shadow-sm">
                            <Icon name="XCircle" size={14} className="text-gray-600 dark:text-gray-400" />
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Not Selected</span>
                          </div>
                        </div>
                      )}
                      
                      <div>
                        {/* Company Branding */}
                        {job.organization && (
                          <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-200 dark:border-slate-700">
                            {job.organization.logo && getLogoUrl(job.organization.logo) && (
                              <img
                                src={getLogoUrl(job.organization.logo)}
                                alt={job.organization.name || 'Company logo'}
                                className="w-14 h-14 xs:w-16 xs:h-16 sm:w-20 sm:h-20 rounded-full object-contain p-1 border border-gray-200 dark:border-slate-700 flex-shrink-0 bg-white dark:bg-slate-800"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] xs:text-xs uppercase tracking-[0.3em] xs:tracking-[0.4em] text-blue-600 dark:text-blue-400">Company</p>
                              <h3 className="text-sm xs:text-base font-semibold text-gray-900 dark:text-slate-100 truncate">
                                {job.organization.name || 'Company'}
                              </h3>
                              {job.organization.website && (
                                <a
                                  href={job.organization.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] xs:text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-0.5"
                                >
                                  <Icon name="ExternalLink" size={10} />
                                  Visit website
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                        <p className="text-[10px] xs:text-xs uppercase tracking-[0.3em] xs:tracking-[0.4em] text-blue-600 dark:text-blue-400">Role Spotlight</p>
                        <h2 className="text-xl xs:text-2xl font-bold text-gray-900 dark:text-slate-100">{job.title}</h2>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <p className="text-xs xs:text-sm text-gray-500 dark:text-slate-400">{job.department || 'General team'}</p>
                          {job.experienceLevel && (
                            <>
                              <span className="text-gray-300 dark:text-slate-600">•</span>
                              <span className="text-xs xs:text-sm text-gray-500 dark:text-slate-400">{formatExperienceLevel(job.experienceLevel)}</span>
                            </>
                          )}
                          {job.location && (
                            <>
                              <span className="text-gray-300 dark:text-slate-600">•</span>
                              <span className="text-xs xs:text-sm text-gray-500 dark:text-slate-400 flex items-center gap-1">
                                <Icon name="MapPin" size={12} />
                                {job.location}
                              </span>
                            </>
                          )}
                        </div>
                        
                        {/* Updated time */}
                        <div className="flex items-center text-[10px] xs:text-xs text-gray-500 dark:text-slate-400 mt-2">
                          <Icon name="Clock" size={12} className="mr-1" />
                          Updated {job.publishedAt ? new Date(job.publishedAt).toLocaleDateString() : 'recently'}
                        </div>
                      </div>
                      
                      <p className="text-xs xs:text-sm text-gray-600 dark:text-slate-300 whitespace-pre-line">{job.description}</p>
                      
                      {/* Requirements */}
                      {job.requirements?.length > 0 && (
                        <div>
                          <h3 className="text-xs xs:text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">Requirements</h3>
                          <ul className="space-y-1.5">
                            {job.requirements.slice(0, 5).map((req, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-xs xs:text-sm text-gray-600 dark:text-slate-300">
                                <Icon name="Check" size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                <span>{req}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Responsibilities */}
                      {job.responsibilities?.length > 0 && (
                        <div>
                          <h3 className="text-xs xs:text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">What you'll do</h3>
                          <ul className="space-y-1.5">
                            {job.responsibilities.slice(0, 4).map((resp, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-xs xs:text-sm text-gray-600 dark:text-slate-300">
                                <Icon name="ArrowRight" size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                                <span>{resp}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Key Skills - Highlighted like in left section */}
                      {job.skills && job.skills.length > 0 && (
                        <div>
                          <h3 className="text-xs xs:text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">Key skills</h3>
                          <div className="flex flex-wrap gap-1.5 xs:gap-2">
                            {job.skills.map((skill) => (
                              <span
                                key={skill}
                                className="px-2 xs:px-3 py-0.5 xs:py-1 rounded-full border border-blue-100 text-[10px] xs:text-xs text-blue-600 dark:border-blue-500/30 dark:text-blue-300"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Practice CTA */}
                      <div className="rounded-xl border border-blue-100 dark:border-blue-500/30 bg-blue-50/70 dark:bg-blue-500/10 p-3 xs:p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                            <Icon name="Sparkles" size={14} className="text-white" />
                          </div>
                          <p className="text-xs xs:text-sm font-semibold text-gray-900 dark:text-slate-100">AI-Powered Practice</p>
                        </div>
                        <p className="text-xs text-blue-900 dark:text-blue-100">
                          Get tailored interview questions based on this role's requirements and skills. Practice with our AI interviewer before the real thing.
                        </p>
                      </div>
                      
                      <div className="flex flex-col xs:flex-row gap-2 xs:gap-3 mt-auto">
                        <Button className="flex-1 rounded-full text-sm" onClick={() => handlePractice(job)}>
                          <Icon name="Play" size={16} className="mr-1.5" />
                          Practice for this role
                        </Button>
                        <Button
                          variant={hasApplied && !canReapply ? 'success' : 'outline'}
                          className={`flex-1 rounded-full text-sm ${
                            hasApplied && !canReapply 
                              ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                              : canReapply
                              ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/30'
                              : ''
                          }`}
                          onClick={() => handleApply(job)}
                          disabled={(hasApplied && !canReapply) || !isAuthenticated || userType !== 'candidate'}
                        >
                          {hasApplied && !canReapply ? (
                            <div className="flex items-center gap-2">
                              <Icon name="Check" size={16} className="mr-1.5" />
                              Applied
                            </div>
                          ) : canReapply ? (
                            <div className="flex items-center gap-2">
                              <Icon name="RefreshCw" size={16} className="mr-1.5" />
                              Apply Again
                            </div>
                          ) : isRejected ? (
                            <div className="flex items-center gap-2">
                              <Icon name="XCircle" size={16} className="mr-1.5" />
                              Not Selected
                            </div>
                          ) : isAuthenticated ? (
                            'Apply'
                          ) : (
                            'Sign in to apply'
                          )}
                        </Button>
                      </div>
                    </motion.div>
                    );
                  })
                )}
              </motion.div>
            )}
    
          </section>
        </main>
        </div>
      </div>

      {/* Application Form Modal */}
      {showApplicationForm && applicationJob && (
        <JobApplicationForm
          job={applicationJob}
          onClose={() => {
            setShowApplicationForm(false);
            setApplicationJob(null);
          }}
          onSuccess={handleApplicationSuccess}
        />
      )}

      {/* Success Message */}
      {applicationSuccess && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-4 right-4 z-50 max-w-md"
        >
          <div className="rounded-2xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                <Icon name="CheckCircle" className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-1">
                  Application Submitted!
                </h4>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Your application has been sent to the employer. You can track its status in your candidate dashboard.
                </p>
              </div>
              <button
                onClick={() => setApplicationSuccess(false)}
                className="p-1 hover:bg-green-200 dark:hover:bg-green-800 rounded"
              >
                <Icon name="X" className="w-4 h-4 text-green-600 dark:text-green-400" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default JobsPage;
