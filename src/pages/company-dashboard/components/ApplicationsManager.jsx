import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import LoadingState from '../../../components/ui/LoadingState';
import apiClient from '../../../services/apiClient.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useRealtimePathFeed } from '../../../hooks/useRealtimePathFeed';
import {
  ORGANIZATION_FEED_EVENTS,
  combineRealtimeEventTypes,
} from '../../../constants/realtimeFeedEvents.js';
import {
  APPLICATION_DISPOSITION_OPTIONS,
  getDispositionLabel,
} from '../../../constants/applicationDisposition.js';

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

// Helper function to get candidate profile image URL
const getCandidateImageUrl = (candidate) => {
  if (!candidate) return null;
  const photoUrl = candidate.profilePhotoUrl || candidate.photoURL || candidate.user_metadata?.photoURL;
  if (!photoUrl) return null;
  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
    return photoUrl;
  }
  // Convert relative path to absolute URL
  const base = API_URL.replace(/\/$/, '');
  return `${base}${photoUrl.startsWith('/') ? photoUrl : `/${photoUrl}`}`;
};

const getStatusConfig = (status, withdrawnBy = null, dispositionCode = null) => {
  const normalizedDispositionCode = String(dispositionCode || '').toUpperCase();

  // If status is REJECTED and withdrawnBy exists, it means the candidate withdrew
  if (status === 'REJECTED' && withdrawnBy) {
    return {
      label: 'Withdrew',
      color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      icon: 'XCircle',
    };
  }

  if (status === 'REJECTED' && normalizedDispositionCode === 'JOB_CLOSED') {
    return {
      label: 'Position Closed',
      color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
      icon: 'Archive',
    };
  }
  
  const configs = {
    SUBMITTED: {
      label: 'New',
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      icon: 'Send',
    },
    SCREENING: {
      label: 'Screening',
      color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      icon: 'Eye',
    },
    INTERVIEWING: {
      label: 'Interviewing',
      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      icon: 'Video',
    },
    SHORTLISTED: {
      label: 'Shortlisted',
      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      icon: 'Star',
    },
    REJECTED: {
      label: 'Rejected',
      color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
      icon: 'XCircle',
    },
    HIRED: {
      label: 'Hired',
      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      icon: 'CheckCircle',
    },
  };
  return configs[status] || configs.SUBMITTED;
};

// Helper to format dates
const formatDate = (dateInput) => {
  if (!dateInput) return 'N/A';
  let date;
  if (dateInput.toDate) { // Firestore Timestamp
    date = dateInput.toDate();
  } else if (typeof dateInput === 'string' || typeof dateInput === 'number') {
    date = new Date(dateInput);
  } else {
    return 'N/A';
  }

  if (isNaN(date.getTime())) {
    return 'N/A';
  }
  return date.toLocaleDateString();
};

const ApplicationsManager = ({ jobId = null, canUpdateStatus = true }) => {
  const navigate = useNavigate();
  const { organization } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [updating, setUpdating] = useState(null);
  const [expandedJobs, setExpandedJobs] = useState(new Set());
  const [startingReview, setStartingReview] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(3);
  const realtimeRefreshTimeoutRef = useRef(null);
  const loadApplicationsRef = useRef(null);

  useEffect(() => {
    loadApplications();
  }, [jobId]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  const loadApplications = async () => {
    try {
      setLoading(true);
      setError('');
      const result = jobId
        ? await apiClient.applications.getJobApplications(jobId)
        : await apiClient.applications.getOrganizationApplications();
      
      if (result.success) {
        setApplications(result.applications || []);
        // Auto-expand first job by default
        if (!jobId && result.applications?.length > 0) {
          const firstJobId = result.applications[0]?.job?.id;
          if (firstJobId) {
            setExpandedJobs(new Set([firstJobId]));
          }
        }
      } else {
        setError('Failed to load applications');
      }
    } catch (err) {
      console.error('Failed to load applications:', err);
      setError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplicationsRef.current = loadApplications;
  }, [loadApplications]);

  useRealtimePathFeed({
    path: organization?.id ? `organizationFeeds/${organization.id}` : null,
    enabled: Boolean(organization?.id),
    eventTypes: combineRealtimeEventTypes(
      ORGANIZATION_FEED_EVENTS.applications,
      ORGANIZATION_FEED_EVENTS.pipeline,
    ),
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        loadApplicationsRef.current?.();
      }, 300);
    },
  });

  useEffect(
    () => () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
    },
    [],
  );

  const promptRejectionDisposition = () => {
    const selectableOptions = APPLICATION_DISPOSITION_OPTIONS.filter(
      (item) => item.value !== 'CANDIDATE_WITHDREW' && item.value !== 'JOB_CLOSED' && item.value !== 'HIRED',
    );
    const choiceText = selectableOptions
      .map((option, index) => `${index + 1}. ${option.label}`)
      .join('\n');
    const selection = window.prompt(
      `Select a rejection reason:\n${choiceText}\n\nEnter number (default: 1).`,
      '1',
    );
    if (selection === null) return null;

    const parsedIndex = Number.parseInt(String(selection).trim(), 10);
    const selectedOption = Number.isInteger(parsedIndex) && parsedIndex >= 1 && parsedIndex <= selectableOptions.length
      ? selectableOptions[parsedIndex - 1]
      : selectableOptions[0];
    const notes = window.prompt(
      'Optional recruiter note for audit trail (leave blank to skip):',
      '',
    );
    if (notes === null) return null;

    return {
      dispositionCode: selectedOption.value,
      dispositionCategory: selectedOption.category,
      dispositionReason: selectedOption.reason || selectedOption.label,
      dispositionNotes: notes.trim() || null,
    };
  };

  const handleStatusChange = async (applicationId, newStatus) => {
    try {
      setUpdating(applicationId);
      const payload = { status: newStatus };
      if (newStatus === 'REJECTED') {
        const rejectionDisposition = promptRejectionDisposition();
        if (!rejectionDisposition) {
          setUpdating(null);
          return;
        }
        Object.assign(payload, rejectionDisposition);
      }

      const result = await apiClient.applications.updateStatus(applicationId, payload);
      if (result.success) {
        await loadApplications();
        if (selectedApplication?.id === applicationId) {
          setSelectedApplication(result.application);
        }
      }
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    } finally {
      setUpdating(null);
    }
  };

  const isWithdrawn = (application) => {
    return application.status === 'REJECTED' && application.withdrawnBy;
  };

  const handleViewDetails = (application) => {
    setSelectedApplication(application);
    setShowDetails(true);
  };

  const handleStartReview = async () => {
    if (!selectedApplication || !selectedApplication.candidateId) return;

    try {
      setStartingReview(true);
      setError('');

      // Check if interview already exists for this application
      let interviewId = selectedApplication.interviewId;
      
      if (!interviewId) {
        // Create a HIRING interview for this candidate and job
        const interviewData = {
          mode: 'HIRING',
          jobId: selectedApplication.jobId,
          candidateId: selectedApplication.candidateId,
          jobRole: selectedApplication.job?.title || 'Position',
          experienceLevel: selectedApplication.job?.experienceLevel || 'MID',
          industry: selectedApplication.job?.department || 'Technology',
          interviewTypes: ['BEHAVIORAL', 'TECHNICAL'],
          skillFocus: selectedApplication.job?.skills || [],
          duration: 30,
          jobStage: 'INITIAL_SCREENING',
        };

        const result = await apiClient.interviews.create(interviewData);
        
        if (result.success && result.interview) {
          interviewId = result.interview.id;
          
          // Update the application to link it to the interview and set status to INTERVIEWING
          try {
            await apiClient.applications.updateStatus(selectedApplication.id, 'INTERVIEWING');
            // Reload applications to get updated data
            await loadApplications();
          } catch (updateErr) {
            console.warn('Failed to update application status:', updateErr);
          }
        } else {
          throw new Error(result.error || 'Failed to create interview');
        }
      }

      // Navigate to the interview review page
      if (interviewId) {
        navigate(`/company-dashboard?interviewId=${interviewId}&tab=reviews`);
        setShowDetails(false);
      }
    } catch (err) {
      console.error('Failed to start review:', err);
      setError(err.message || 'Failed to start review. Please try again.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setStartingReview(false);
    }
  };

  const toggleJob = (jobId) => {
    setExpandedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  // Group applications by job
  const groupedApplications = applications.reduce((acc, application) => {
    const jobId = application.job?.id || application.jobId || `unknown-${application.id}`;
    if (!acc[jobId]) {
      acc[jobId] = {
        job: application.job,
        organization: application.organization, // Store organization data for logo
        applications: [],
        stats: {
          total: 0,
          new: 0,
          screening: 0,
          interviewing: 0,
          shortlisted: 0,
          rejected: 0,
          withdrew: 0,
          hired: 0,
        }
      };
    }
    
    acc[jobId].applications.push(application);
    acc[jobId].stats.total++;
    
    // Count by status
    if (application.status === 'SUBMITTED') acc[jobId].stats.new++;
    else if (application.status === 'SCREENING') acc[jobId].stats.screening++;
    else if (application.status === 'INTERVIEWING') acc[jobId].stats.interviewing++;
    else if (application.status === 'SHORTLISTED') acc[jobId].stats.shortlisted++;
    else if (application.status === 'HIRED') acc[jobId].stats.hired++;
    else if (application.status === 'REJECTED') {
      if (application.withdrawnBy) acc[jobId].stats.withdrew++;
      else acc[jobId].stats.rejected++;
    }
    
    return acc;
  }, {});

  // Filter applications
  const filteredGroupedApplications = Object.entries(groupedApplications).reduce((acc, [jobId, jobData]) => {
    const filteredApps = jobData.applications.filter((application) => {
      // Search filter
      const matchesSearch = searchQuery
        ? (application.candidate?.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (application.candidate?.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (application.job?.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (application.job?.department || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (application.job?.location || '').toLowerCase().includes(searchQuery.toLowerCase())
        : true;

      // Status filter
      let matchesStatus = true;
      if (statusFilter !== 'all') {
        if (statusFilter === 'WITHDRAWN') {
          matchesStatus = application.status === 'REJECTED' && application.withdrawnBy;
        } else if (statusFilter === 'REJECTED') {
          matchesStatus = application.status === 'REJECTED' && !application.withdrawnBy;
        } else {
          matchesStatus = application.status === statusFilter;
        }
      }

      return matchesSearch && matchesStatus;
    });

    if (filteredApps.length > 0) {
      acc[jobId] = {
        ...jobData,
        applications: filteredApps,
        filteredCount: filteredApps.length,
      };
    }

    return acc;
  }, {});

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'SUBMITTED', label: 'New' },
    { value: 'SCREENING', label: 'Screening' },
    { value: 'INTERVIEWING', label: 'Interviewing' },
    { value: 'SHORTLISTED', label: 'Shortlisted' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'WITHDRAWN', label: 'Withdrew' },
    { value: 'HIRED', label: 'Hired' },
  ];

  if (loading) {
    return (
      <LoadingState
        title="Loading applications"
        message="Syncing candidate submissions and review queues."
        variant="card"
        tone="primary"
      />
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <div className="text-center py-12">
          <Icon name="AlertCircle" className="w-12 h-12 text-red-600 mx-auto mb-3" />
          <p className="text-gray-900 dark:text-slate-100 mb-4">{error}</p>
          <Button onClick={loadApplications}>Retry</Button>
        </div>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <div className="text-center py-12">
          <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 inline-flex mb-4">
            <Icon name="FileText" className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
            No Applications Yet
          </h3>
          <p className="text-gray-600 dark:text-slate-400 mb-4">
            {jobId ? 'No applications have been submitted for this job yet.' : 'No applications have been submitted yet.'}
          </p>
        </div>
      </div>
    );
  }

  const totalApplicationsCount = Object.values(filteredGroupedApplications).reduce((sum, jobData) => sum + jobData.filteredCount, 0);
  const totalJobsCount = Object.keys(filteredGroupedApplications).length;

  // Pagination calculations
  const jobsArray = Object.entries(filteredGroupedApplications);
  const totalPages = Math.ceil(jobsArray.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedJobs = jobsArray.slice(startIndex, endIndex);

  return (
    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-4 sm:p-6 shadow-lg">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Job Applications
            </h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              {totalApplicationsCount} {totalApplicationsCount === 1 ? 'application' : 'applications'} across {totalJobsCount} {totalJobsCount === 1 ? 'job' : 'jobs'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadApplications}
            className="flex items-center gap-2"
          >
            <Icon name="RefreshCw" className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500 z-20 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by candidate name, email, job title, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-11 sm:h-12 w-full rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 pr-3 sm:pr-4 py-2.5 pl-10 text-base sm:text-sm text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
            />
          </div>
          <div className="relative z-30 sm:w-[200px]">
            <Select
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              options={statusOptions}
              placeholder="All Status"
              className="w-full"
            />
          </div>
        </div>

        {/* Job Groups */}
        <div className="space-y-4">
          {Object.keys(filteredGroupedApplications).length === 0 ? (
            <div className="text-center py-12">
              <div className="p-3 rounded-full bg-gray-100 dark:bg-slate-800 inline-flex mb-4">
                <Icon name="Search" className="w-8 h-8 text-gray-400 dark:text-slate-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
                No applications found
              </h3>
              <p className="text-gray-600 dark:text-slate-400 mb-4">
                Try adjusting your search or filter criteria.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <>
            {paginatedJobs.map(([jobId, jobData], index) => {
              const isExpanded = expandedJobs.has(jobId);
              
              return (
                <motion.div
                  key={jobId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-hidden"
                >
                  {/* Job Header */}
                  <button
                    onClick={() => toggleJob(jobId)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Company Logo or Briefcase Icon */}
                      {jobData.organization?.logo && getLogoUrl(jobData.organization.logo) ? (
                        <img
                          src={getLogoUrl(jobData.organization.logo)}
                          alt={jobData.organization.name || 'Company logo'}
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-contain p-1 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const fallback = e.target.nextElementSibling;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className={`p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 shrink-0 ${jobData.organization?.logo && getLogoUrl(jobData.organization.logo) ? 'hidden' : 'flex'}`}
                      >
                        <Icon name="Briefcase" className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-slate-100 truncate">
                            {jobData.job?.title || 'Deleted Position'}
                          </h3>
                          {jobData.job?.isDeleted && (
                            <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-200 text-[11px] font-medium shrink-0">
                              Deleted
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-slate-400">
                          {jobData.job?.department && `${jobData.job.department} - `}
                          {jobData.filteredCount} {jobData.filteredCount === 1 ? 'application' : 'applications'}
                        </p>
                      </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="flex items-center gap-3 ml-4">
                      <div className="hidden sm:flex items-center gap-2">
                        {jobData.stats.new > 0 && (
                          <span className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-medium text-blue-700 dark:text-blue-300">
                            {jobData.stats.new} New
                          </span>
                        )}
                        {jobData.stats.screening > 0 && (
                          <span className="px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-xs font-medium text-yellow-700 dark:text-yellow-300">
                            {jobData.stats.screening} Screening
                          </span>
                        )}
                        {jobData.stats.shortlisted > 0 && (
                          <span className="px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-xs font-medium text-green-700 dark:text-green-300">
                            {jobData.stats.shortlisted} Shortlisted
                          </span>
                        )}
                      </div>
                      <Icon 
                        name={isExpanded ? "ChevronUp" : "ChevronDown"} 
                        className="w-5 h-5 text-gray-400 dark:text-slate-500 transition-transform" 
                      />
                    </div>
                  </button>

                  {/* Expanded Applications List */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-gray-200 dark:border-slate-700"
                      >
                        <div className="p-4 space-y-3 bg-gray-50/50 dark:bg-slate-800/30">
                          {jobData.applications.map((application, appIndex) => {
                            const statusConfig = getStatusConfig(
                              application.status,
                              application.withdrawnBy,
                              application.dispositionCode,
                            );
                            
                            return (
                              <motion.div
                                key={application.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: appIndex * 0.03 }}
                                className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 hover:shadow-md transition-shadow"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start gap-3 mb-2">
                                      {/* Candidate Profile Image or User Icon */}
                                      {getCandidateImageUrl(application.candidate) ? (
                                        <img
                                          src={getCandidateImageUrl(application.candidate)}
                                          alt={application.candidate?.fullName || 'Candidate'}
                                          className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-slate-700 flex-shrink-0"
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            const fallback = e.target.nextElementSibling;
                                            if (fallback) fallback.style.display = 'flex';
                                          }}
                                        />
                                      ) : null}
                                      <div 
                                        className={`p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0 ${getCandidateImageUrl(application.candidate) ? 'hidden' : 'flex'}`}
                                      >
                                        <Icon name="User" className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-gray-900 dark:text-slate-100 truncate text-sm">
                                          {application.candidate?.fullName || application.candidate?.email || 'Unknown Candidate'}
                                        </h4>
                                        {application.candidate?.email && application.candidate?.fullName && (
                                          <p className="text-xs text-gray-500 dark:text-slate-500 truncate">
                                            {application.candidate.email}
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                      <div className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${statusConfig.color}`}>
                                        <Icon name={statusConfig.icon} className="w-3 h-3" />
                                        {statusConfig.label}
                                      </div>

                                      <span className="text-xs text-gray-500 dark:text-slate-500">
                                        {formatDate(application.submittedAt || application.createdAt)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex flex-col gap-2 shrink-0">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleViewDetails(application)}
                                      className="text-xs"
                                    >
                                      <Icon name="Eye" className="w-3 h-3 mr-1" />
                                      View
                                    </Button>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-4 mt-6">
                <div className="text-sm text-gray-600 dark:text-slate-400">
                  Showing {startIndex + 1} to {Math.min(endIndex, jobsArray.length)} of {jobsArray.length} jobs
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="rounded-full"
                  >
                    <Icon name="ChevronLeft" size={16} />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`min-w-[40px] h-10 px-3 rounded-full text-sm font-medium transition-colors ${
                              currentPage === page
                                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                                : 'bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      } else if (
                        page === currentPage - 2 ||
                        page === currentPage + 2
                      ) {
                        return (
                          <span key={page} className="text-gray-500 dark:text-slate-500 px-1">
                            ...
                          </span>
                        );
                      }
                      return null;
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-full"
                  >
                    Next
                    <Icon name="ChevronRight" size={16} />
                  </Button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showDetails && selectedApplication && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showDetails && selectedApplication && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4"
              style={{ overflow: 'auto' }}
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
                onClick={() => setShowDetails(false)}
                aria-hidden="true"
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-3xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-white/40 dark:border-slate-700/60 my-auto"
                style={{ maxHeight: 'calc(100vh - 2rem)' }}
              >
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
                  {/* Modal Header */}
                  <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                        <Icon name="User" className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                          {selectedApplication.candidate?.fullName || 'Candidate'}
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-slate-400">
                          {selectedApplication.candidate?.email}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowDetails(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                    >
                      <Icon name="X" className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 space-y-6">
                    {/* Error Message */}
                    {error && (
                      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                      </div>
                    )}

                    {/* Job Info */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                        Position
                      </h3>
                      <div className="flex items-center gap-2">
                        <p className="text-base text-gray-900 dark:text-slate-100">
                          {selectedApplication.job?.title || 'Deleted Position'}
                        </p>
                        {selectedApplication.job?.isDeleted && (
                          <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-200 text-[11px] font-medium">
                            Deleted
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-slate-400">
                        {selectedApplication.job?.department || 'No department'}
                      </p>
                    </div>

                    {/* Key Skills */}
                    {selectedApplication.job?.skills && selectedApplication.job.skills.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                          Key Skills
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedApplication.job.skills.map((skill) => (
                            <span
                              key={skill}
                              className="px-3 py-1 rounded-full border border-blue-100 text-xs text-blue-600 dark:border-blue-500/30 dark:text-blue-300"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Status */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                        Current Status
                      </h3>
                      {canUpdateStatus ? (
                        <>
                          <div className="flex gap-2 flex-wrap">
                            {['SCREENING', 'INTERVIEWING', 'SHORTLISTED', 'REJECTED', 'HIRED'].map((status) => {
                              const config = getStatusConfig(status, null, status === 'REJECTED' ? 'NOT_SELECTED' : null);
                              const isCurrent = selectedApplication.status === status;
                              const isWithdrawnApp = isWithdrawn(selectedApplication);
                              
                              return (
                                <button
                                  key={status}
                                  onClick={() => !isCurrent && !isWithdrawnApp && handleStatusChange(selectedApplication.id, status)}
                                  disabled={updating === selectedApplication.id || isCurrent || isWithdrawnApp}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                    isCurrent
                                      ? config.color
                                      : isWithdrawnApp
                                      ? 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500 cursor-not-allowed'
                                      : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                                  }`}
                                  title={isWithdrawnApp ? 'Cannot change status of withdrawn applications' : ''}
                                >
                                  {config.label}
                                </button>
                              );
                            })}
                          </div>
                          {isWithdrawn(selectedApplication) && (
                            <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                              This application was withdrawn by the candidate.
                            </p>
                          )}
                        </>
                      ) : (
                        <div className={`inline-flex px-3 py-1.5 rounded-lg text-sm font-medium ${
                          getStatusConfig(
                            selectedApplication.status,
                            selectedApplication.withdrawnBy,
                            selectedApplication.dispositionCode,
                          )?.color || 'bg-gray-100 text-gray-700'
                        }`}>
                          {getStatusConfig(
                            selectedApplication.status,
                            selectedApplication.withdrawnBy,
                            selectedApplication.dispositionCode,
                          )?.label || selectedApplication.status}
                        </div>
                      )}
                      {selectedApplication.dispositionCode && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                          Reason: {getDispositionLabel(selectedApplication.dispositionCode)}
                        </p>
                      )}
                      {selectedApplication.dispositionNotes && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                          Note: {selectedApplication.dispositionNotes}
                        </p>
                      )}
                    </div>

                    {/* Resume */}
                    {selectedApplication.resumeUrl && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                          Resume
                        </h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const resumeUrl = await apiClient.uploads.getDownloadUrl(selectedApplication.resumeUrl);
                            if (!resumeUrl) return;
                            window.open(resumeUrl, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          <Icon name="FileText" className="w-4 h-4 mr-2" />
                          View Resume
                        </Button>
                      </div>
                    )}

                    {/* Cover Letter */}
                    {selectedApplication.coverLetter && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                          Cover Letter
                        </h3>
                        <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                          <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">
                            {selectedApplication.coverLetter}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Custom Answers */}
                    {selectedApplication.answers && selectedApplication.answers.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                          Application Questions
                        </h3>
                        <div className="space-y-3">
                          {selectedApplication.answers.map((answer, idx) => (
                            <div key={idx} className="p-3 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                              <p className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                                Question {idx + 1}
                              </p>
                              <p className="text-sm text-gray-900 dark:text-slate-100">
                                {answer.answer}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-slate-700">
                    <Button
                      variant="outline"
                      onClick={() => setShowDetails(false)}
                      className="flex-1"
                    >
                      Close
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleStartReview}
                      loading={startingReview}
                      disabled={startingReview || isWithdrawn(selectedApplication)}
                      className="flex-1"
                    >
                      {!startingReview && <Icon name="Play" className="w-4 h-4 mr-2" />}
                      {startingReview ? 'Starting...' : 'Start Review'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default ApplicationsManager;

