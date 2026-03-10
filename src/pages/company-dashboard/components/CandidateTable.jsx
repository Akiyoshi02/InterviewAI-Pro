import React, { useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import AppImage from '../../../components/AppImage';
import Button from '../../../components/ui/Button';
import UnifiedFilterPanel, {
  FILTER_GRID_CLASS,
  UnifiedFilterSelect,
  UnifiedSearchField,
} from '../../../components/ui/UnifiedFilterPanel';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const formatStatusLabel = (statusCode) => {
  const code = String(statusCode || 'UNKNOWN').toUpperCase();
  return code
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getStatusBadge = (statusCode) => {
  const code = String(statusCode || 'UNKNOWN').toUpperCase();
  const statusConfig = {
    COMPLETED: {
      color: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow shadow-blue-500/20',
      label: 'Completed',
    },
    IN_PROGRESS: {
      color: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow shadow-amber-500/20',
      label: 'In Progress',
    },
    SCHEDULED: {
      color: 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow shadow-indigo-500/20',
      label: 'Scheduled',
    },
    PENDING: {
      color: 'bg-gradient-to-r from-indigo-400 to-violet-500 text-white shadow shadow-indigo-500/20',
      label: 'Pending Scheduling',
    },
    CANCELLED: {
      color: 'bg-gradient-to-r from-slate-500 to-gray-500 text-white shadow shadow-slate-500/20',
      label: 'Cancelled',
    },
    NO_SHOW: {
      color: 'bg-gradient-to-r from-rose-500 to-red-500 text-white shadow shadow-rose-500/20',
      label: 'No Show',
    },
    UNKNOWN: {
      color: 'bg-gradient-to-r from-slate-500 to-gray-500 text-white shadow shadow-slate-500/20',
      label: 'Unknown',
    },
  };

  const config = statusConfig[code] || {
    color: 'bg-gradient-to-r from-slate-500 to-gray-500 text-white shadow shadow-slate-500/20',
    label: formatStatusLabel(code),
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

const getScoreColor = (score) => {
  if (score >= 90) return 'text-emerald-600';
  if (score >= 80) return 'text-amber-500';
  return 'text-rose-500';
};

const toMillis = (value) => {
  if (!value) return 0;
  const parsed = new Date(value);
  const millis = parsed.getTime();
  return Number.isFinite(millis) ? millis : 0;
};

const exportCandidatesCSV = (rows) => {
  const headers = ['Name', 'Email', 'Position', 'Experience', 'Interview Date', 'Duration', 'AI Score', 'Status'];
  const escape = (val) => {
    const str = val == null ? '' : String(val);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const csvContent = [
    headers.join(','),
    ...rows.map((c) =>
      [c.name, c.email, c.position, c.experience || '--', c.interviewDate, c.duration, c.aiScore != null ? `${c.aiScore}%` : '--', formatStatusLabel(c.statusCode)]
        .map(escape)
        .join(','),
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `candidates_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const CandidateTable = ({
  interviews = [],
  onViewRecording,
  onViewAnalysis,
  onUpdateStatus,
  canExport = true,
  canUpdateStatus = true,
  roleVariant = 'company',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('latest_date');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPosition, setFilterPosition] = useState('all');

  const candidates = useMemo(
    () => interviews.map((interview, idx) => {
      const statusCode = String(interview?.status || 'UNKNOWN').toUpperCase();
      const position = interview?.jobRole || interview?.job?.title || 'Position';
      const scheduledAtMillis = toMillis(interview?.scheduledFor);
      const updatedAtMillis = toMillis(interview?.updatedAt);
      const fallbackDateMillis = toMillis(interview?.createdAt);

      return {
        id: interview?.id || idx,
        candidateId: interview?.candidate?.id || interview?.candidateId || interview?.id || idx,
        name: interview?.candidate?.fullName || 'Candidate',
        email: interview?.candidate?.email || '',
        position,
        interviewDate: scheduledAtMillis
          ? new Date(scheduledAtMillis).toLocaleDateString()
          : 'TBD',
        aiScore: typeof interview?.overallScore === 'number' ? interview.overallScore : null,
        statusCode,
        avatar: (() => {
          const raw = interview?.candidate?.photoURL;
          if (!raw) return `https://ui-avatars.com/api/?name=${encodeURIComponent(interview?.candidate?.fullName || 'C')}&background=6366f1&color=fff`;
          if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
          const path = raw.startsWith('/') ? raw : `/${raw}`;
          return `${API_BASE}${path}`;
        })(),
        duration: interview?.duration ? `${Math.round(interview.duration / 60)} min` : '--',
        experience: interview?.experienceLevel
          ? String(interview.experienceLevel).charAt(0).toUpperCase() + String(interview.experienceLevel).slice(1).toLowerCase()
          : (interview?.candidate?.profile?.experienceLevel || null),
        sortDateMillis: Math.max(scheduledAtMillis, updatedAtMillis || 0, fallbackDateMillis || 0),
      };
    }),
    [interviews],
  );

  const statusOptions = useMemo(() => {
    const discoveredStatuses = Array.from(
      new Set(
        candidates
          .map((candidate) => candidate.statusCode)
          .filter(Boolean),
      ),
    ).sort((a, b) => formatStatusLabel(a).localeCompare(formatStatusLabel(b), undefined, { sensitivity: 'base' }));

    return [
      { value: 'all', label: 'All Statuses' },
      ...discoveredStatuses.map((statusCode) => ({
        value: statusCode,
        label: formatStatusLabel(statusCode),
      })),
    ];
  }, [candidates]);

  const positionOptions = useMemo(() => {
    const discoveredPositions = Array.from(
      new Set(
        candidates
          .map((candidate) => candidate.position)
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    return [
      { value: 'all', label: 'All Positions' },
      ...discoveredPositions.map((position) => ({
        value: position,
        label: position,
      })),
    ];
  }, [candidates]);

  const sortOptions = [
    { value: 'latest_date', label: 'Latest Interview' },
    { value: 'oldest_date', label: 'Oldest Interview' },
    { value: 'score_high', label: 'Highest Score' },
    { value: 'score_low', label: 'Lowest Score' },
    { value: 'candidate_az', label: 'Candidate A-Z' },
  ];

  const filteredCandidates = useMemo(() => {
    const normalizedQuery = normalizeText(searchQuery);
    const queryTokens = normalizedQuery.split(' ').filter(Boolean);
    const filtered = candidates.filter((candidate) => {
      if (filterStatus !== 'all' && candidate.statusCode !== filterStatus) return false;
      if (filterPosition !== 'all' && candidate.position !== filterPosition) return false;

      if (queryTokens.length > 0) {
        const haystack = normalizeText(
          `${candidate.name} ${candidate.email} ${candidate.position} ${candidate.statusCode} ${candidate.interviewDate}`,
        );
        if (!queryTokens.every((token) => haystack.includes(token))) return false;
      }

      return true;
    });

    filtered.sort((left, right) => {
      switch (sortBy) {
        case 'oldest_date':
          return left.sortDateMillis - right.sortDateMillis;
        case 'score_high':
          return (right.aiScore ?? -1) - (left.aiScore ?? -1);
        case 'score_low':
          return (left.aiScore ?? Number.MAX_SAFE_INTEGER) - (right.aiScore ?? Number.MAX_SAFE_INTEGER);
        case 'candidate_az':
          return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
        case 'latest_date':
        default:
          return right.sortDateMillis - left.sortDateMillis;
      }
    });

    return filtered;
  }, [candidates, filterPosition, filterStatus, searchQuery, sortBy]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (normalizeText(searchQuery).length > 0) count += 1;
    if (filterStatus !== 'all') count += 1;
    if (filterPosition !== 'all') count += 1;
    if (sortBy !== 'latest_date') count += 1;
    return count;
  }, [filterPosition, filterStatus, searchQuery, sortBy]);

  const clearFilters = () => {
    setSearchQuery('');
    setSortBy('latest_date');
    setFilterStatus('all');
    setFilterPosition('all');
  };

  const isReviewerVariant = roleVariant === 'reviewer';
  const tableTitle = isReviewerVariant ? 'Assigned Interview Activity' : 'Recent Interviews';
  const filterDescription = isReviewerVariant
    ? 'Search your assigned interview history by candidate, status, role, and outcome.'
    : 'Find interview sessions by candidate, status, role, and sorting preference.';
  const emptyStateTitle = isReviewerVariant ? 'No assigned interviews found' : 'No interviews found';
  const emptyStateDescription = isReviewerVariant
    ? 'You do not have any assigned interview activity matching the current filters.'
    : 'Adjust search or filters to find interviews.';

  return (
    <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
      <div className="space-y-3 sm:space-y-4 mb-3 sm:mb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">{tableTitle}</h2>
          {canExport && (
            <Button
              variant="outline"
              iconName="Download"
              iconPosition="left"
              onClick={() => exportCandidatesCSV(filteredCandidates)}
              className="w-full sm:w-auto rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
            >
              Export CSV
            </Button>
          )}
        </div>

        <UnifiedFilterPanel
          title="Interview Filters"
          description={filterDescription}
          activeCount={activeFilterCount}
          onClear={clearFilters}
        >
          <div className={FILTER_GRID_CLASS}>
            <UnifiedSearchField
              label="Search"
              className="sm:col-span-2 xl:col-span-2"
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Candidate, role, status, or date"
            />
            <UnifiedFilterSelect
              label="Status"
              placeholder="All statuses"
              options={statusOptions}
              value={filterStatus}
              onChange={setFilterStatus}
            />
            <UnifiedFilterSelect
              label="Position"
              placeholder="All positions"
              options={positionOptions}
              value={filterPosition}
              onChange={setFilterPosition}
            />
            <UnifiedFilterSelect
              label="Sort By"
              placeholder="Sort"
              options={sortOptions}
              value={sortBy}
              onChange={setSortBy}
            />
          </div>
        </UnifiedFilterPanel>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        {filteredCandidates.length === 0 ? (
          <div className="text-center py-12">
            <Icon name="Users" size={48} className="mx-auto text-gray-300 dark:text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">{emptyStateTitle}</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {emptyStateDescription}
            </p>
          </div>
        ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/30 dark:border-slate-700 text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
              <th className="text-left py-3 px-4 font-medium">Candidate</th>
              <th className="text-center py-3 px-4 font-medium">Position</th>
              <th className="text-left py-3 px-4 font-medium">Interview Date</th>
              <th className="text-center py-3 px-4 font-medium">AI Score</th>
              <th className="text-center py-3 px-4 font-medium">Status</th>
              <th className="text-center py-3 px-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCandidates.map((candidate) => (
              <tr key={candidate.id} className="border-b border-white/20 dark:border-slate-700/50 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors duration-200">
                <td className="py-4 px-4">
                  <div className="flex items-center space-x-3">
                    <AppImage
                      src={candidate.avatar}
                      alt={candidate.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />

                    <div>
                      <p className="font-medium text-gray-900 dark:text-slate-100">{candidate.name}</p>
                      <p className="text-sm text-gray-500 dark:text-slate-400">{candidate.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-slate-100">{candidate.position}</p>
                    <p className="text-sm text-gray-500 dark:text-slate-400">{candidate.experience ? `${candidate.experience} level` : 'Level N/A'}</p>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-slate-100">{candidate.interviewDate}</p>
                    <p className="text-sm text-gray-500 dark:text-slate-400">{candidate.duration}</p>
                  </div>
                </td>
                <td className="py-4 px-4 text-center">
                  {candidate.aiScore != null ? (
                    <span className={`text-lg font-bold ${getScoreColor(candidate.aiScore)}`}>
                      {candidate.aiScore}%
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400 dark:text-slate-500">--</span>
                  )}
                </td>
                <td className="py-4 px-4 text-center">
                  {getStatusBadge(candidate.statusCode)}
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center justify-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconName="Play"
                      onClick={() => onViewRecording?.(candidate.candidateId)}
                      title="View Recording"
                      className="rounded-full text-gray-500 hover:text-blue-600"
                    />

                    <Button
                      variant="ghost"
                      size="sm"
                      iconName="FileText"
                      onClick={() => onViewAnalysis?.(candidate.candidateId)}
                      title="View Analysis"
                      className="rounded-full text-gray-500 hover:text-blue-600"
                    />

                    {canUpdateStatus && (
                      <Button
                        variant="ghost"
                        size="sm"
                        iconName="Edit"
                        onClick={() => onUpdateStatus?.(candidate.candidateId)}
                        title="Update Status"
                        className="rounded-full text-gray-500 hover:text-blue-600"
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {filteredCandidates.length === 0 ? (
          <div className="text-center py-8">
            <Icon name="Users" size={40} className="mx-auto text-gray-300 dark:text-slate-600 mb-3" />
            <h3 className="text-base font-medium text-gray-900 dark:text-slate-100 mb-1">No interviews found</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Adjust search or filters to find interviews.
            </p>
          </div>
        ) : (
        filteredCandidates.map((candidate) => (
          <div key={candidate.id} className="bg-white/70 dark:bg-slate-900/60 border border-white/40 dark:border-slate-700/50 rounded-xl p-3 sm:p-4 space-y-3 backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <AppImage
                  src={candidate.avatar}
                  alt={candidate.name}
                  className="h-12 w-12 flex-shrink-0 rounded-full object-cover"
                />

                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 dark:text-slate-100 break-words">{candidate.name}</p>
                  <p className="text-sm text-gray-500 dark:text-slate-400 break-words leading-snug">{candidate.position}</p>
                </div>
              </div>
              <div className="sm:flex-shrink-0">
                {getStatusBadge(candidate.statusCode)}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 dark:text-slate-400">Interview Date</p>
                <p className="font-medium text-gray-900 dark:text-slate-100">{candidate.interviewDate}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-slate-400">AI Score</p>
                {candidate.aiScore != null ? (
                  <p className={`font-bold ${getScoreColor(candidate.aiScore)}`}>
                    {candidate.aiScore}%
                  </p>
                ) : (
                  <p className="text-gray-400 dark:text-slate-500">--</p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-2 pt-2 xs:grid-cols-2">
              <Button
                variant="outline"
                size="sm"
                iconName="Play"
                iconPosition="left"
                onClick={() => onViewRecording?.(candidate.candidateId)}
                className="w-full justify-center rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
              >
                Recording
              </Button>
              <Button
                variant="outline"
                size="sm"
                iconName="FileText"
                iconPosition="left"
                onClick={() => onViewAnalysis?.(candidate.candidateId)}
                className="w-full justify-center rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
              >
                Analysis
              </Button>
            </div>
          </div>
        ))
        )}
      </div>
    </div>
  );
};

export default CandidateTable;
