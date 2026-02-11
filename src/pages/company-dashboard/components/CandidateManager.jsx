import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import LoadingState from '../../../components/ui/LoadingState';
import apiClient from '../../../services/apiClient.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useRealtimePathFeed } from '../../../hooks/useRealtimePathFeed';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const CandidateManager = ({ canStartReview = true }) => {
  const { organization } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterJob, setFilterJob] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [jobs, setJobs] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(3);
  const realtimeRefreshTimeoutRef = useRef(null);
  const loadDataRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load applications (which include candidate info)
      const [applicationsResult, jobsResult] = await Promise.all([
        apiClient.applications.getOrganizationApplications(),
        apiClient.jobs.getOrganizationJobs(),
      ]);

      if (applicationsResult.success) {
        setCandidates(applicationsResult.applications || []);
      }

      if (jobsResult.success) {
        setJobs(jobsResult.jobs || []);
      }
    } catch (err) {
      console.error('Failed to load candidate data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  useRealtimePathFeed({
    path: organization?.id ? `organizationFeeds/${organization.id}` : null,
    enabled: Boolean(organization?.id),
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        loadDataRef.current?.();
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

  const handleViewDetails = async (application) => {
    setSelectedCandidate(application);
    setShowDetails(true);
  };

  const filteredCandidates = candidates.filter((candidate) => {
    if (filterJob !== 'all' && candidate.jobId !== filterJob) return false;
    if (filterStatus !== 'all' && candidate.status !== filterStatus) return false;
    return true;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredCandidates.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCandidates = filteredCandidates.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterJob, filterStatus]);

  const statusOptions = ['SUBMITTED', 'SCREENING', 'INTERVIEWING', 'SHORTLISTED', 'REJECTED', 'HIRED'];
  
  const getStatusBadge = (status) => {
    const badges = {
      SUBMITTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      SCREENING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      INTERVIEWING: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      SHORTLISTED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      REJECTED: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
      HIRED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    };
    return badges[status] || badges.SUBMITTED;
  };

  if (loading) {
    return (
      <LoadingState
        title="Loading candidates"
        message="Gathering pipeline and candidate details."
        variant="card"
        tone="secondary"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header & Filters */}
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-4 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            Candidate Pipeline ({filteredCandidates.length})
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            className="flex items-center gap-2"
          >
            <Icon name="RefreshCw" className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              Filter by Job
            </label>
            <div className="relative group">
              <select
                value={filterJob}
                onChange={(e) => setFilterJob(e.target.value)}
                className="w-full appearance-none px-3 pr-10 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
              >
                <option value="all">All Jobs</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
              <Icon
                name="ChevronDown"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-slate-400 pointer-events-none transition-transform duration-200 group-focus-within:rotate-180"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              Filter by Status
            </label>
            <div className="relative group">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full appearance-none px-3 pr-10 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
              >
                <option value="all">All Statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0) + status.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
              <Icon
                name="ChevronDown"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-slate-400 pointer-events-none transition-transform duration-200 group-focus-within:rotate-180"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Candidates List */}
      {filteredCandidates.length === 0 ? (
        <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
          <div className="text-center py-12">
            <Icon name="Users" className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-slate-400">
              No candidates match the selected filters
            </p>
          </div>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 gap-3">
          {paginatedCandidates.map((candidate, index) => (
            <motion.div
              key={candidate.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 shrink-0">
                      <Icon name="User" className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-slate-100 truncate">
                        {candidate.candidate?.fullName || candidate.candidate?.email || 'Unknown Candidate'}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-slate-400 truncate">
                        {candidate.job?.title || 'Position'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(candidate.status)}`}>
                      {candidate.status}
                    </div>
                    
                    {candidate.candidate?.experienceLevel && (
                      <div className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300">
                        {candidate.candidate.experienceLevel}
                      </div>
                    )}

                    {candidate.candidate?.skills && candidate.candidate.skills.length > 0 && (
                      <div className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs text-blue-700 dark:text-blue-300">
                        {candidate.candidate.skills.length} skills
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-gray-500 dark:text-slate-500 flex flex-wrap gap-3">
                    <span>Applied {new Date(candidate.submittedAt).toLocaleDateString()}</span>
                    {candidate.reviewedAt && (
                      <span>• Reviewed {new Date(candidate.reviewedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetails(candidate)}
                    className="min-w-[100px]"
                  >
                    <Icon name="Eye" className="w-4 h-4 mr-1" />
                    View
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-4 mt-6">
            <div className="text-sm text-gray-600 dark:text-slate-400">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredCandidates.length)} of {filteredCandidates.length} candidates
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

      {/* Details Modal - Rendered outside section using Portal */}
      {showDetails && selectedCandidate && typeof document !== 'undefined' ? createPortal(
        <AnimatePresence>
          {showDetails && selectedCandidate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setShowDetails(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full my-8"
              >
              {/* Modal Header */}
              <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <Icon name="User" className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                      {selectedCandidate.candidate?.fullName || 'Candidate Profile'}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      {selectedCandidate.candidate?.email}
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
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      Position Applied For
                    </h3>
                    <p className="text-base text-gray-900 dark:text-slate-100">
                      {selectedCandidate.job?.title}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      Status
                    </h3>
                    <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(selectedCandidate.status)}`}>
                      {selectedCandidate.status}
                    </div>
                  </div>

                  {selectedCandidate.candidate?.experienceLevel && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                        Experience Level
                      </h3>
                      <p className="text-base text-gray-900 dark:text-slate-100">
                        {selectedCandidate.candidate.experienceLevel}
                      </p>
                    </div>
                  )}

                  {selectedCandidate.candidate?.location && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                        Location
                      </h3>
                      <p className="text-base text-gray-900 dark:text-slate-100">
                        {selectedCandidate.candidate.location}
                      </p>
                    </div>
                  )}

                  {selectedCandidate.submittedAt && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                        Application Date
                      </h3>
                      <p className="text-base text-gray-900 dark:text-slate-100">
                        {new Date(selectedCandidate.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Educational Background */}
                {(selectedCandidate.candidate?.highestQualification || selectedCandidate.candidate?.fieldOfStudy || selectedCandidate.candidate?.institutionName) && (
                  <div className="rounded-lg border border-purple-100 dark:border-purple-900/30 bg-purple-50/50 dark:bg-purple-900/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="GraduationCap" className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                        Educational Background
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {selectedCandidate.candidate?.highestQualification && (
                        <div>
                          <span className="text-gray-500 dark:text-slate-400">Qualification: </span>
                          <span className="text-gray-900 dark:text-slate-100">{selectedCandidate.candidate.highestQualification}</span>
                        </div>
                      )}
                      {selectedCandidate.candidate?.fieldOfStudy && (
                        <div>
                          <span className="text-gray-500 dark:text-slate-400">Field: </span>
                          <span className="text-gray-900 dark:text-slate-100">{selectedCandidate.candidate.fieldOfStudy}</span>
                        </div>
                      )}
                      {selectedCandidate.candidate?.institutionName && (
                        <div>
                          <span className="text-gray-500 dark:text-slate-400">Institution: </span>
                          <span className="text-gray-900 dark:text-slate-100">{selectedCandidate.candidate.institutionName}</span>
                        </div>
                      )}
                      {selectedCandidate.candidate?.graduationYear && (
                        <div>
                          <span className="text-gray-500 dark:text-slate-400">Graduation: </span>
                          <span className="text-gray-900 dark:text-slate-100">{selectedCandidate.candidate.graduationYear}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Job Preferences */}
                {(selectedCandidate.candidate?.availability || selectedCandidate.candidate?.preferredWorkType || selectedCandidate.candidate?.expectedSalary) && (
                  <div className="rounded-lg border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="Briefcase" className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                        Job Preferences
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {selectedCandidate.candidate?.availability && (
                        <div>
                          <span className="text-gray-500 dark:text-slate-400">Availability: </span>
                          <span className="text-gray-900 dark:text-slate-100">{selectedCandidate.candidate.availability}</span>
                        </div>
                      )}
                      {selectedCandidate.candidate?.preferredWorkType && (
                        <div>
                          <span className="text-gray-500 dark:text-slate-400">Work Type: </span>
                          <span className="text-gray-900 dark:text-slate-100">{selectedCandidate.candidate.preferredWorkType}</span>
                        </div>
                      )}
                      {selectedCandidate.candidate?.preferredEmploymentType && (
                        <div>
                          <span className="text-gray-500 dark:text-slate-400">Employment: </span>
                          <span className="text-gray-900 dark:text-slate-100">{selectedCandidate.candidate.preferredEmploymentType}</span>
                        </div>
                      )}
                      {selectedCandidate.candidate?.expectedSalary && (
                        <div>
                          <span className="text-gray-500 dark:text-slate-400">Expected Salary: </span>
                          <span className="text-gray-900 dark:text-slate-100">{selectedCandidate.candidate.expectedSalary}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Professional Links */}
                {(selectedCandidate.candidate?.linkedinUrl || selectedCandidate.candidate?.githubUrl || selectedCandidate.candidate?.portfolioUrl) && (
                  <div className="rounded-lg border border-sky-100 dark:border-sky-900/30 bg-sky-50/50 dark:bg-sky-900/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="Link" className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                        Professional Links
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedCandidate.candidate?.linkedinUrl && (
                        <a
                          href={selectedCandidate.candidate.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                        >
                          <Icon name="Linkedin" className="w-3.5 h-3.5" />
                          LinkedIn
                        </a>
                      )}
                      {selectedCandidate.candidate?.githubUrl && (
                        <a
                          href={selectedCandidate.candidate.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Icon name="Github" className="w-3.5 h-3.5" />
                          GitHub
                        </a>
                      )}
                      {selectedCandidate.candidate?.portfolioUrl && (
                        <a
                          href={selectedCandidate.candidate.portfolioUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                        >
                          <Icon name="Globe" className="w-3.5 h-3.5" />
                          Portfolio
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Certifications */}
                {selectedCandidate.candidate?.certifications && selectedCandidate.candidate.certifications.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      Certifications
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedCandidate.candidate.certifications.map((cert, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-sm text-amber-700 dark:text-amber-300"
                        >
                          {cert}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Skills */}
                {selectedCandidate.job?.skills && selectedCandidate.job.skills.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      Key Skills
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedCandidate.job.skills.map((skill) => (
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

                {/* Candidate Skills */}
                {selectedCandidate.candidate?.skills && selectedCandidate.candidate.skills.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      Candidate Skills
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedCandidate.candidate.skills.map((skill, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-sm text-blue-700 dark:text-blue-300"
                        >
                          {skill}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resume */}
                {selectedCandidate.resumeUrl && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      Resume
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const resumeUrl = selectedCandidate.resumeUrl.startsWith('http') 
                          ? selectedCandidate.resumeUrl 
                          : `${API_URL}${selectedCandidate.resumeUrl.startsWith('/') ? selectedCandidate.resumeUrl : `/${selectedCandidate.resumeUrl}`}`;
                        window.open(resumeUrl, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      <Icon name="FileText" className="w-4 h-4 mr-2" />
                      View Resume
                    </Button>
                  </div>
                )}

                {/* Cover Letter */}
                {selectedCandidate.coverLetter && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      Cover Letter
                    </h3>
                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                      <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">
                        {selectedCandidate.coverLetter}
                      </p>
                    </div>
                  </div>
                )}

                {/* Application Questions */}
                {selectedCandidate.answers && selectedCandidate.answers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      Application Responses
                    </h3>
                    <div className="space-y-3">
                      {selectedCandidate.answers.map((answer, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700"
                        >
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
                  onClick={() => {
                    window.open(`mailto:${selectedCandidate.candidate?.email}`, '_blank');
                  }}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Icon name="Mail" className="w-4 h-4 mr-2" />
                  Contact Candidate
                </Button>
              </div>
            </motion.div>
          </motion.div>
          )}
        </AnimatePresence>,
        document.body
      ) : null}
    </div>
  );
};

export default CandidateManager;

