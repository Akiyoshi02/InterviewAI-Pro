import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Button from '../../components/ui/Button';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';

const JobsPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    const loadJobs = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await apiClient.jobs.listPublic(50);
        if (result.success) {
          setJobs(result.jobs || []);
          if (!selectedJob && result.jobs?.length) {
            setSelectedJob(result.jobs[0]);
          }
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

  const handlePractice = (job) => {
    if (!job) return;
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
    navigate('/practice-interview-setup');
  };

  const handleApply = (job) => {
    if (!job) return;
    if (!isAuthenticated) {
      navigate(`/login?redirect=/jobs`);
      return;
    }
    navigate(`/candidate-dashboard?jobId=${job.id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
      <Header userType="candidate" />
      {/* Spacer for fixed header */}
      <div className="h-14 xs:h-16" />
      <main className="container-responsive py-6 xs:py-8 sm:py-10 space-y-4 xs:space-y-5 sm:space-y-6">
        <div className="text-center space-y-2 xs:space-y-3">
          <p className="text-[10px] xs:text-xs uppercase tracking-[0.4em] xs:tracking-[0.5em] text-blue-600 dark:text-blue-300">Opportunities</p>
          <h1 className="text-2xl xs:text-3xl sm:text-4xl font-bold text-gray-900 dark:text-slate-100">Interview-ready roles</h1>
          <p className="text-sm xs:text-base text-gray-600 dark:text-slate-400 max-w-2xl mx-auto">
            Browse openings from teams already using InterviewAI to streamline their hiring process.
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-8 xs:py-12">
            <div className="animate-spin rounded-full h-10 w-10 xs:h-12 xs:w-12 border-b-2 border-primary" />
          </div>
        )}

        {error && (
          <div className="text-center text-sm xs:text-base text-red-600 dark:text-red-400">{error}</div>
        )}

        {!loading && !error && (
          <motion.div
            className="grid gap-4 xs:gap-5 sm:gap-6 lg:grid-cols-[1.5fr_1fr]"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          >
            <div className="grid gap-3 xs:gap-4">
              {jobs.map((job) => (
                <motion.div
                  key={job.id}
                  variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                  className={`card-base p-4 xs:p-5 space-y-2 xs:space-y-3 cursor-pointer touch-manipulation active:scale-[0.99] transition-all ${
                    selectedJob?.id === job.id
                      ? 'border-blue-400 shadow-lg shadow-blue-500/20 ring-1 ring-blue-400/50'
                      : ''
                  }`}
                  onClick={() => setSelectedJob(job)}
                >
                  <div className="flex items-start xs:items-center justify-between gap-2 xs:gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base xs:text-lg sm:text-xl font-semibold text-gray-900 dark:text-slate-100 truncate">{job.title}</h2>
                      <p className="text-xs xs:text-sm text-gray-500 dark:text-slate-400">{job.department || 'General'}</p>
                    </div>
                    <span className="text-[10px] xs:text-xs font-semibold text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 px-2 xs:px-3 py-1 rounded-full flex-shrink-0">
                      {job.employmentType?.replace('_', ' ') || 'FULL TIME'}
                    </span>
                  </div>
                  <p className="text-xs xs:text-sm text-gray-600 dark:text-slate-300 line-clamp-2">{job.description}</p>
                  <div className="flex flex-wrap gap-1.5 xs:gap-2">
                    {(job.skills || []).slice(0, 4).map((skill) => (
                      <span
                        key={skill}
                        className="px-2 xs:px-3 py-0.5 xs:py-1 rounded-full border border-blue-100 text-[10px] xs:text-xs text-blue-600 dark:border-blue-500/30 dark:text-blue-300"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[10px] xs:text-xs text-gray-500 dark:text-slate-400">
                    {job.location || 'Remote'} • Updated{' '}
                    {job.publishedAt ? new Date(job.publishedAt).toLocaleDateString() : 'recently'}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Job details - Hidden on mobile until a job is selected, or always shown on desktop */}
            <div className={`card-base p-4 xs:p-5 sm:p-6 space-y-3 xs:space-y-4 lg:sticky lg:top-24 h-fit ${!selectedJob ? 'hidden lg:block' : ''}`}>
              {selectedJob ? (
                <>
                  <div>
                    <p className="text-[10px] xs:text-xs uppercase tracking-[0.3em] xs:tracking-[0.4em] text-blue-600 dark:text-blue-400">Role Spotlight</p>
                    <h2 className="text-xl xs:text-2xl font-bold text-gray-900 dark:text-slate-100">{selectedJob.title}</h2>
                    <p className="text-xs xs:text-sm text-gray-500 dark:text-slate-400">{selectedJob.department || 'General team'}</p>
                  </div>
                  <p className="text-xs xs:text-sm text-gray-600 dark:text-slate-300 whitespace-pre-line">{selectedJob.description}</p>
                  <div>
                    <h3 className="text-xs xs:text-sm font-semibold text-gray-900 dark:text-slate-100">Key skills</h3>
                    <div className="mt-1.5 xs:mt-2 flex flex-wrap gap-1.5 xs:gap-2">
                      {(selectedJob.skills || ['Communication']).map((skill) => (
                        <span key={skill} className="px-2 xs:px-3 py-0.5 xs:py-1 text-[10px] xs:text-xs rounded-full border border-slate-200 dark:border-slate-700 text-gray-700 dark:text-slate-200">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl xs:rounded-2xl border border-blue-100 dark:border-blue-500/30 bg-blue-50/70 dark:bg-blue-500/10 p-3 xs:p-4 text-xs xs:text-sm text-blue-900 dark:text-blue-100">
                    These roles use InterviewAI for their pre-screen. Accept the recruiter invite to launch a guided session, or prep with a customized practice run first.
                  </div>
                  <div className="flex flex-col xs:flex-row gap-2 xs:gap-3">
                    <Button className="flex-1 rounded-full text-sm" onClick={() => handlePractice(selectedJob)}>
                      Practice for this role
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 rounded-full text-sm"
                      onClick={() => handleApply(selectedJob)}
                    >
                      {isAuthenticated ? 'Request Invite' : 'Sign in to apply'}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-xs xs:text-sm text-gray-500 dark:text-slate-400">Select an opening to see full details.</p>
              )}
            </div>
          </motion.div>
        )}

        {!loading && !error && jobs.length === 0 && (
          <div className="text-center text-sm xs:text-base text-gray-500 dark:text-slate-400">No public roles are available yet.</div>
        )}
      </main>
    </div>
  );
};

export default JobsPage;

