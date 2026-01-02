import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import apiClient from '../../../services/apiClient.js';

const CandidateManager = () => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterJob, setFilterJob] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [jobs, setJobs] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

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

  const handleViewDetails = async (application) => {
    setSelectedCandidate(application);
    setShowDetails(true);
  };

  const filteredCandidates = candidates.filter((candidate) => {
    if (filterJob !== 'all' && candidate.jobId !== filterJob) return false;
    if (filterStatus !== 'all' && candidate.status !== filterStatus) return false;
    return true;
  });

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
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      </div>
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
            <select
              value={filterJob}
              onChange={(e) => setFilterJob(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
            >
              <option value="all">All Jobs</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              Filter by Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
            >
              <option value="all">All Statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0) + status.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
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
        <div className="grid grid-cols-1 gap-3">
          {filteredCandidates.map((candidate, index) => (
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
      )}

      {/* Details Modal */}
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

                {/* Skills */}
                {selectedCandidate.candidate?.skills && selectedCandidate.candidate.skills.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      Skills
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
                      onClick={() => window.open(selectedCandidate.resumeUrl, '_blank')}
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
      </AnimatePresence>
    </div>
  );
};

export default CandidateManager;

