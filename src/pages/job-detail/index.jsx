import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import LoadingState from '../../components/ui/LoadingState';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import JobApplicationForm from '../jobs/components/JobApplicationForm';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Helper function to convert relative upload paths to absolute URLs
const getLogoUrl = (logoPath) => {
  if (!logoPath) return null;
  if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
    return logoPath;
  }
  const base = API_URL.replace(/\/$/, '');
  return `${base}${logoPath.startsWith('/') ? logoPath : `/${logoPath}`}`;
};

const JobDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, status } = useAuth();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [applicationSuccess, setApplicationSuccess] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState(null);

  // Check localStorage for cached auth state
  const cachedIsAuthenticated = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('isAuthenticated') === 'true';
  }, []);

  const showSidebar = isAuthenticated || (status === 'loading' && cachedIsAuthenticated);
  const userType = user?.accountType?.toLowerCase() === 'company' ? 'company' : 'candidate';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Load job details
  useEffect(() => {
    const loadJob = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await apiClient.jobs.getPublic(id);
        if (result.success) {
          setJob(result.job);
        } else {
          setError('Job not found');
        }
      } catch (err) {
        setError(err.message || 'Failed to load job details');
      } finally {
        setLoading(false);
      }
    };
    if (id) {
      loadJob();
    }
  }, [id]);

  // Check if user has applied
  useEffect(() => {
    const checkApplication = async () => {
      if (!isAuthenticated || user?.accountType?.toUpperCase() !== 'CANDIDATE') return;
      try {
        const result = await apiClient.applications.getMyApplications();
        if (result.success && result.applications) {
          const application = result.applications.find(app => app.jobId === id);
          if (application) {
            setHasApplied(true);
            setApplicationStatus(application.status);
          }
        }
      } catch (err) {
        console.error('Failed to check application status:', err);
      }
    };
    checkApplication();
  }, [isAuthenticated, user, id]);

  // Format helpers
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

  const formatEmploymentType = (type) => {
    if (!type) return null;
    const mapping = {
      'FULL_TIME': 'Full-time',
      'PART_TIME': 'Part-time',
      'CONTRACT': 'Contract',
      'INTERNSHIP': 'Internship',
    };
    return mapping[type] || type.replace('_', '-').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getDaysLeft = (job) => {
    if (!job) return null;
    
    // If expiresAt is available, use it directly
    if (job.expiresAt) {
      const expires = new Date(job.expiresAt);
      const now = new Date();
      const daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 0) return null;
      return daysLeft;
    }
    
    // Fallback: calculate from publishedAt + postingDuration
    if (job.publishedAt) {
      const published = new Date(job.publishedAt);
      const now = new Date();
      const postingDuration = job.postingDuration || 30;
      const daysSincePublished = Math.floor((now - published) / (1000 * 60 * 60 * 24));
      const daysLeft = postingDuration - daysSincePublished;
      if (daysLeft <= 0) return null;
      return daysLeft;
    }
    
    return null;
  };

  const formatCompanySize = (size) => {
    if (!size) return null;
    const mapping = {
      '1-10': '1-10 employees',
      '11-50': '11-50 employees',
      '51-200': '51-200 employees',
      '201-1000': '201-1K employees',
      '1000+': '1K+ employees',
    };
    return mapping[size] || size;
  };

  const extractCityFromLocation = (location) => {
    if (!location) return null;
    // Extract city from "City, Region" or just "City" format
    const parts = location.split(',');
    return parts[0]?.trim() || location.trim();
  };

  const handleApply = () => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=/jobs/${id}`);
      return;
    }
    if (user?.accountType?.toUpperCase() !== 'CANDIDATE') {
      alert('Only candidates can apply to jobs.');
      return;
    }
    setShowApplicationForm(true);
  };

  const handleApplicationSuccess = () => {
    setShowApplicationForm(false);
    setApplicationSuccess(true);
    setHasApplied(true);
    setApplicationStatus('SUBMITTED');
    setTimeout(() => setApplicationSuccess(false), 5000);
  };

  const handlePractice = () => {
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

  const handleShare = (platform) => {
    const jobUrl = window.location.href;
    const shareText = `Check out this job: ${job?.title} at ${job?.organization?.name || 'Company'}`;
    
    let shareUrl = '';
    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + jobUrl)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(jobUrl)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(jobUrl)}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(jobUrl)}`;
        break;
      default:
        if (navigator.share) {
          navigator.share({ title: job?.title, text: shareText, url: jobUrl });
          return;
        } else {
          navigator.clipboard.writeText(jobUrl);
          alert('Job URL copied to clipboard!');
          return;
        }
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  };

  const daysLeft = job ? getDaysLeft(job) : null;

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      {/* Background decorations */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-24 right-0 h-60 w-60 sm:h-80 sm:w-80 bg-gradient-to-br from-blue-400/30 to-purple-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-[-10%] h-[300px] w-[300px] sm:h-[420px] sm:w-[420px] bg-gradient-to-tr from-indigo-300/25 via-blue-200/20 to-transparent blur-[120px]" />
      </div>

      <Header userType={userType} isAuthenticated={showSidebar} onLogout={handleLogout} />
      
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
          
          <main className={`flex-1 transition-all duration-300 ${
            showSidebar
              ? `pb-20 lg:pb-0 ${isNavCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'}`
              : ''
          }`}>
            <div className="container-responsive py-6 xs:py-8 sm:py-10">
              {/* Back Button */}
              <button
                onClick={() => navigate('/jobs')}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 mb-6 transition-colors"
              >
                <Icon name="ArrowLeft" size={18} />
                Back to Jobs
              </button>

              {loading && (
                <LoadingState
                  title="Loading job details"
                  message="Fetching role information and application steps."
                  variant="card"
                  tone="primary"
                />
              )}

              {error && (
                <div className="card-base p-8 text-center">
                  <Icon name="AlertCircle" size={48} className="text-red-500 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">Job Not Found</h2>
                  <p className="text-gray-600 dark:text-slate-400 mb-4">{error}</p>
                  <Button onClick={() => navigate('/jobs')}>
                    Browse All Jobs
                  </Button>
                </div>
              )}

              {!loading && !error && job && (
                <div className="space-y-6">
                  {/* Main Job Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card-base overflow-hidden"
                  >
                    {/* Header Section */}
                    <div className="p-6 sm:p-8 border-b border-gray-200 dark:border-slate-700">
                      <div className="flex flex-col sm:flex-row gap-6">
                        {/* Company Logo */}
                        <div className="flex-shrink-0">
                          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-center p-3 shadow-sm">
                            {job.organization?.logo && getLogoUrl(job.organization.logo) ? (
                              <img
                                src={getLogoUrl(job.organization.logo)}
                                alt={job.organization.name || 'Company logo'}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <Icon name="Building2" size={48} className="text-gray-400 dark:text-slate-500" />
                            )}
                          </div>
                        </div>

                        {/* Job Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                                {job.title}
                              </h1>
                              {job.organization?.name && (
                                <p className="text-lg text-gray-700 dark:text-slate-300">
                                  {job.organization.name}
                                </p>
                              )}
                            </div>
                            
                            {/* Status Badges - Applied and Days Left */}
                            <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
                              {/* Applied Badge */}
                              {hasApplied && (
                                <div className="px-4 py-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800">
                                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                                    <Icon name="Check" size={16} />
                                    <span className="text-sm font-medium">Applied</span>
                                  </div>
                                </div>
                              )}
                              
                              {/* Days Left Badge */}
                              {daysLeft && (
                                <div className="px-4 py-2 rounded-full bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800">
                                  <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                                    <Icon name="Clock" size={16} />
                                    <span className="text-sm font-medium">{daysLeft} days left</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Meta Info */}
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-slate-400">
                            {job.location && (
                              <div className="flex items-center gap-1.5">
                                <Icon name="MapPin" size={16} className="text-gray-500 dark:text-slate-500" />
                                <span>{job.location}</span>
                              </div>
                            )}
                            {!job.location && (
                              <div className="flex items-center gap-1.5">
                                <Icon name="MapPin" size={16} className="text-gray-500 dark:text-slate-500" />
                                <span>Remote</span>
                              </div>
                            )}
                            {job.employmentType && (
                              <div className="flex items-center gap-1.5">
                                <Icon name="Briefcase" size={16} className="text-gray-500 dark:text-slate-500" />
                                <span>{formatEmploymentType(job.employmentType)}</span>
                              </div>
                            )}
                            {job.experienceLevel && (
                              <div className="flex items-center gap-1.5">
                                <Icon name="TrendingUp" size={16} className="text-gray-500 dark:text-slate-500" />
                                <span>{formatExperienceLevel(job.experienceLevel)}</span>
                              </div>
                            )}
                            {job.department && (
                              <div className="flex items-center gap-1.5">
                                <Icon name="Building" size={16} className="text-gray-500 dark:text-slate-500" />
                                <span>{job.department}</span>
                              </div>
                            )}
                          </div>

                          {/* Share Icons */}
                          <div className="flex items-center gap-3 mt-4">
                            <span className="text-sm text-gray-500 dark:text-slate-400">Share:</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleShare('share')}
                                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                                aria-label="Copy link"
                              >
                                <Icon name="Link" size={16} className="text-gray-600 dark:text-slate-400" />
                              </button>
                              <button
                                onClick={() => handleShare('whatsapp')}
                                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                                aria-label="Share on WhatsApp"
                              >
                                <Icon name="MessageCircle" size={16} className="text-gray-600 dark:text-slate-400" />
                              </button>
                              <button
                                onClick={() => handleShare('facebook')}
                                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                aria-label="Share on Facebook"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gray-600 dark:text-slate-400">
                                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                </svg>
                              </button>
                              <button
                                onClick={() => handleShare('twitter')}
                                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-colors"
                                aria-label="Share on Twitter"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gray-600 dark:text-slate-400">
                                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                                </svg>
                              </button>
                              <button
                                onClick={() => handleShare('linkedin')}
                                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                aria-label="Share on LinkedIn"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gray-600 dark:text-slate-400">
                                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-6 sm:p-8 space-y-8">
                      {/* Compensation */}
                      {job.compensationRange && (
                        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon name="DollarSign" size={20} className="text-emerald-600 dark:text-emerald-400" />
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Salary / Compensation</h3>
                          </div>
                          <p className="text-emerald-700 dark:text-emerald-300 font-medium text-lg">
                            {job.compensationRange}
                            {job.salaryCurrency && (
                              <span className="text-sm ml-2">({job.salaryCurrency})</span>
                            )}
                          </p>
                        </div>
                      )}

                      {/* Description */}
                      {job.description && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                            <Icon name="FileText" size={20} className="text-blue-600 dark:text-blue-400" />
                            Job Description
                          </h3>
                          <div className="prose prose-gray dark:prose-invert max-w-none">
                            <p className="text-gray-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                              {job.description}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Requirements */}
                      {job.requirements?.length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                            <Icon name="CheckCircle" size={20} className="text-blue-600 dark:text-blue-400" />
                            Requirements
                          </h3>
                          <ul className="space-y-2.5">
                            {job.requirements.map((req, idx) => (
                              <li key={idx} className="flex items-start gap-3 text-gray-700 dark:text-slate-300">
                                <Icon name="Check" size={18} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                <span>{req}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Responsibilities */}
                      {job.responsibilities?.length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                            <Icon name="ClipboardList" size={20} className="text-blue-600 dark:text-blue-400" />
                            What You'll Do
                          </h3>
                          <ul className="space-y-2.5">
                            {job.responsibilities.map((resp, idx) => (
                              <li key={idx} className="flex items-start gap-3 text-gray-700 dark:text-slate-300">
                                <Icon name="ArrowRight" size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
                                <span>{resp}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Skills */}
                      {job.skills?.length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                            <Icon name="Tag" size={20} className="text-blue-600 dark:text-blue-400" />
                            Required Skills
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {job.skills.map((skill, idx) => (
                              <span
                                key={idx}
                                className="px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium border border-blue-200 dark:border-blue-800"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Benefits */}
                      {job.benefits && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                            <Icon name="Gift" size={20} className="text-blue-600 dark:text-blue-400" />
                            Benefits
                          </h3>
                          <p className="text-gray-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                            {job.benefits}
                          </p>
                        </div>
                      )}

                      {/* Company Info */}
                      {job.organization && (
                        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 p-6">
                          <div className="flex flex-col sm:flex-row gap-6 mb-6">
                            {/* Company Logo */}
                            <div className="flex-shrink-0">
                              <div className="w-24 h-24 rounded-xl bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 flex items-center justify-center p-3 shadow-sm">
                                {job.organization.logo && getLogoUrl(job.organization.logo) ? (
                                  <img
                                    src={getLogoUrl(job.organization.logo)}
                                    alt={job.organization.name}
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <Icon name="Building2" size={40} className="text-gray-400 dark:text-slate-500" />
                                )}
                              </div>
                            </div>

                            {/* Company Header Info */}
                            <div className="flex-1 min-w-0">
                              <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                                {job.organization.name}
                              </h3>
                              
                              {/* Job Post Count - Dynamic */}
                              <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                                {/* Note: Job count would be calculated from active jobs */}
                              </p>

                              {/* Badges */}
                              <div className="flex flex-wrap items-center gap-2 mb-4">
                                {job.location && (
                                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
                                    <Icon name="Send" size={14} className="text-blue-600 dark:text-blue-400" />
                                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                      {extractCityFromLocation(job.location)}
                                    </span>
                                  </div>
                                )}
                                {job.organization.companySize && (
                                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800">
                                    <Icon name="Users" size={14} className="text-purple-600 dark:text-purple-400" />
                                    <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                                      {formatCompanySize(job.organization.companySize)}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Social Media Links */}
                              {(job.organization.website || job.organization.facebookUrl || job.organization.linkedinUrl || job.organization.youtubeUrl) && (
                                <div className="flex items-center gap-3">
                                  {job.organization.website && (
                                    <a
                                      href={job.organization.website}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                                      aria-label="Visit website"
                                    >
                                      <Icon name="Globe" size={18} className="text-gray-600 dark:text-slate-400" />
                                    </a>
                                  )}
                                  {job.organization.facebookUrl && (
                                    <a
                                      href={job.organization.facebookUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                      aria-label="Facebook"
                                    >
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-gray-600 dark:text-slate-400">
                                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                      </svg>
                                    </a>
                                  )}
                                  {job.organization.linkedinUrl && (
                                    <a
                                      href={job.organization.linkedinUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                      aria-label="LinkedIn"
                                    >
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-gray-600 dark:text-slate-400">
                                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                      </svg>
                                    </a>
                                  )}
                                  {job.organization.youtubeUrl && (
                                    <a
                                      href={job.organization.youtubeUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                      aria-label="YouTube"
                                    >
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-gray-600 dark:text-slate-400">
                                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                      </svg>
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Physical Address */}
                          {job.organization.address && (
                            <div className="mb-4 pb-4 border-b border-gray-200 dark:border-slate-700">
                              <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-300">
                                <Icon name="Home" size={18} className="text-gray-500 dark:text-slate-500 mt-0.5 flex-shrink-0" />
                                <span className="whitespace-pre-line">{job.organization.address}</span>
                              </div>
                            </div>
                          )}

                          {/* Company Description */}
                          {job.organization.description && (
                            <div>
                              <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-2">About {job.organization.name}</h4>
                              <div className="prose prose-sm prose-gray dark:prose-invert max-w-none">
                                <p className="text-gray-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                                  {job.organization.description}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Section */}
                    <div className="p-6 sm:p-8 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <Button
                          onClick={handleApply}
                          disabled={hasApplied || userType === 'company'}
                          className={`flex-1 py-3 text-base ${
                            hasApplied
                              ? 'bg-emerald-500 hover:bg-emerald-600'
                              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                          }`}
                        >
                          {hasApplied ? (
                            <>
                              <Icon name="Check" size={20} className="mr-2" />
                              Applied
                            </>
                          ) : !isAuthenticated ? (
                            <>
                              <Icon name="LogIn" size={20} className="mr-2" />
                              Sign in to Apply
                            </>
                          ) : (
                            <>
                              <Icon name="Send" size={20} className="mr-2" />
                              Apply Now
                            </>
                          )}
                        </Button>
                        
                        <Button
                          variant="outline"
                          onClick={handlePractice}
                          className="flex-1 py-3 text-base"
                        >
                          <Icon name="Play" size={20} className="mr-2" />
                          Practice Interview
                        </Button>
                      </div>

                      {/* AI Practice CTA */}
                      <div className="mt-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                            <Icon name="Sparkles" size={20} className="text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-slate-100">Prepare with AI</p>
                            <p className="text-sm text-gray-600 dark:text-slate-400">
                              Get tailored interview questions based on this role's requirements. Practice with our AI interviewer before the real thing.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Application Form Modal */}
      {showApplicationForm && job && (
        <JobApplicationForm
          job={job}
          onClose={() => setShowApplicationForm(false)}
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
                  Your application has been sent to the employer. You can track its status in your dashboard.
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

export default JobDetailPage;
