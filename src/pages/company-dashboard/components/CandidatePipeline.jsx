import React, { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import Icon from '../../../components/AppIcon';
import apiClient from '../../../services/apiClient.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useRealtimePathFeed } from '../../../hooks/useRealtimePathFeed';
import {
  ORGANIZATION_FEED_EVENTS,
  combineRealtimeEventTypes,
} from '../../../constants/realtimeFeedEvents.js';

const PIPELINE_COLUMNS = [
  { id: 'SCREENING', title: 'AI Screening', color: 'bg-blue-400' },
  { id: 'INTERVIEW', title: 'Live Interview', color: 'bg-purple-400' },
  { id: 'FINAL', title: 'Final Review', color: 'bg-amber-400' },
  { id: 'HIRED', title: 'Hired', color: 'bg-emerald-400' },
  { id: 'REJECTED', title: 'Archived', color: 'bg-rose-400' },
];

const CandidatePipeline = () => {
  const { organization } = useAuth();
  const [pipeline, setPipeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [moving, setMoving] = useState({});
  const realtimeRefreshTimeoutRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const loadPipelineRef = useRef(null);

  const loadPipeline = async () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    setLoading(true);
    setError('');
    try {
      const result = await apiClient.pipeline.list();
      if (result.success) {
        setPipeline(result.pipeline || []);
      } else {
        setPipeline([]);
        setError(result.error || 'Failed to load pipeline.');
      }
    } catch (err) {
      const errorMessage = err?.message || 'Failed to load pipeline.';
      const statusCode = err?.status || err?.response?.status;
      const isRateLimited = statusCode === 429 || /too many requests/i.test(errorMessage);

      if (isRateLimited) {
        setError('Syncing pipeline updates. Retrying shortly...');
        retryTimeoutRef.current = setTimeout(() => {
          loadPipelineRef.current?.();
        }, 4000);
      } else {
        setError(errorMessage);
      }
      setPipeline([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPipelineRef.current = loadPipeline;
  }, [loadPipeline]);

  useRealtimePathFeed({
    path: organization?.id ? `organizationFeeds/${organization.id}` : null,
    enabled: Boolean(organization?.id),
    eventTypes: combineRealtimeEventTypes(
      ORGANIZATION_FEED_EVENTS.pipeline,
      ORGANIZATION_FEED_EVENTS.interviews,
      ORGANIZATION_FEED_EVENTS.applications,
    ),
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        loadPipelineRef.current?.();
      }, 300);
    },
  });

  useEffect(
    () => () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    loadPipeline();
  }, []);

  const groupedPipeline = useMemo(() => {
    const groups = PIPELINE_COLUMNS.reduce((acc, column) => {
      acc[column.id] = [];
      return acc;
    }, {});

    pipeline.forEach((item) => {
      const status = item.pipelineStatus || 'SCREENING';
      if (!groups[status]) {
        groups[status] = [];
      }
      groups[status].push(item);
    });

    return groups;
  }, [pipeline]);

  const totalCandidates = pipeline.length;

  const handleMoveCandidate = async (interviewId, nextStatus) => {
    if (!nextStatus) return;

    setMoving((prev) => ({ ...prev, [interviewId]: true }));
    try {
      const result = await apiClient.pipeline.move(interviewId, { pipelineStatus: nextStatus });
      if (result.success) {
        setPipeline((prev) =>
          prev.map((entry) =>
            entry.interviewId === interviewId
              ? { ...entry, pipelineStatus: nextStatus }
              : entry,
          ),
        );
      }
    } catch (err) {
      setError(err?.message || 'Failed to move candidate. Please try again.');
    } finally {
      setMoving((prev) => ({ ...prev, [interviewId]: false }));
    }
  };

  return (
    <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 mb-3 sm:mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Recruiter Pipeline</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Real-time status of every candidate interview
          </p>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          iconName="RefreshCw"
          onClick={loadPipeline} 
          disabled={loading}
          className="rounded-full text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
        >
          Refresh
        </Button>
      </div>

      {error && (
        <div
          className={`mb-3 rounded-xl px-3 py-2 text-xs sm:text-sm ${
            /syncing pipeline updates/i.test(error)
              ? 'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100'
              : 'border border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100'
          }`}
        >
          {error}
        </div>
      )}

      {totalCandidates === 0 && !loading ? (
        <div className="rounded-xl border border-dashed border-blue-200/70 dark:border-blue-700/40 bg-blue-50/60 dark:bg-blue-900/15 p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600/15 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 flex items-center justify-center flex-shrink-0">
              <Icon name="Users" size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Pipeline is empty</h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-300">
                As soon as candidates apply or interviews are invited, they appear in these stages.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {PIPELINE_COLUMNS.map((column) => (
              <div
                key={column.id}
                className="rounded-lg border border-white/40 dark:border-slate-700/60 bg-white/75 dark:bg-slate-900/40 px-2 py-2"
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${column.color}`} />
                  <span className="text-xs font-medium text-gray-700 dark:text-slate-300 truncate">{column.title}</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">0</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-5 gap-2 sm:gap-3">
          {PIPELINE_COLUMNS.map((column) => {
            const candidates = groupedPipeline[column.id] || [];
            return (
              <div key={column.id} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 ${column.color} rounded-full`} />
                    <h3 className="font-medium text-gray-900 dark:text-slate-100 text-sm">{column.title}</h3>
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-slate-400 bg-white/70 dark:bg-slate-800/70 border border-white/40 dark:border-slate-700/50 px-2 py-0.5 rounded-full">
                    {candidates.length}
                  </span>
                </div>

                <div className="space-y-2.5 rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/60 p-2.5 min-h-[136px]">
                  {candidates.map((candidate) => (
                    <div
                      key={candidate.interviewId}
                      className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-2.5 sm:p-3 space-y-2 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.1)] dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all duration-200"
                    >
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-slate-100">
                          {candidate.candidate?.fullName || 'Candidate'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {candidate.job?.title || candidate.jobStage || 'Role TBD'}
                        </p>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">
                        Updated {candidate.updatedAt ? new Date(candidate.updatedAt).toLocaleString() : 'recently'}
                      </div>
                      <Select
                        options={PIPELINE_COLUMNS.map((stage) => ({ value: stage.id, label: stage.title }))}
                        value={candidate.pipelineStatus || 'SCREENING'}
                        onChange={(value) => handleMoveCandidate(candidate.interviewId, value)}
                        loading={moving[candidate.interviewId]}
                      />
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>Status: {candidate.status}</span>
                        {candidate.overallScore && <span>AI score: {candidate.overallScore}</span>}
                      </div>
                    </div>
                  ))}
                  {!candidates.length && (
                    <div className="text-center py-3">
                      <p className="text-xs text-gray-400 dark:text-slate-500">No candidates in this stage</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CandidatePipeline;

