import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import InterviewCalendar from '../../components/ui/InterviewCalendar';
import ScheduleInterviewModal from '../../components/ui/ScheduleInterviewModal';
import UnifiedFilterPanel, {
  FILTER_DATE_GRID_CLASS,
  FILTER_GRID_CLASS,
  FILTER_SUBPANEL_CLASS,
  UnifiedFilterSelect,
  UnifiedFilterToggleButton,
  UnifiedSearchField,
  UnifiedTextInput,
} from '../../components/ui/UnifiedFilterPanel';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useInterviewRealtimeFeed } from '../../hooks/useInterviewRealtimeFeed';
import {
  INTERVIEW_FEED_EVENTS,
  combineRealtimeEventTypes,
} from '../../constants/realtimeFeedEvents.js';
import {
  getRecruiterMeetingLinkRescheduleDescription,
  getRecruiterMeetingLinkScheduledDescription,
  getRecruiterMeetingLinkUnscheduledDescription,
} from '../../constants/interviewMeetingLink.js';
import { hasPermission } from '../../utils/rolePermissions';
import {
  describeReviewReminderHistoryEntry,
  formatReviewRequestDateTime,
  getReviewRequestStateMeta,
  summarizeReviewWorkflow,
} from '../../utils/reviewRequests.js';
import {
  buildReviewerAssignmentOptions,
  summarizeReviewerAssignees,
} from '../../utils/reviewerAssignments.js';
import { toLocalDatetimeValue } from '../../utils/interviewSchedulingGuidance.js';
import { canMoveInterviewApplicationToOffer } from '../../utils/interviewRoundSummary.js';

const COMPANY_INTERVIEW_DATE_PRESET_OPTIONS = [
  { value: 'all', label: 'All Dates' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'last90', label: 'Last 90 Days' },
  { value: 'custom', label: 'Custom Range' },
];

const COMPANY_INTERVIEW_SCHEDULE_OPTIONS = [
  { value: 'all', label: 'All Schedule States' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'today', label: 'Today' },
  { value: 'past', label: 'Past' },
  { value: 'unscheduled', label: 'Unscheduled' },
];

const COMPANY_INTERVIEW_SCORE_OPTIONS = [
  { value: 'all', label: 'All Score Bands' },
  { value: 'scored', label: 'Scored Interviews' },
  { value: 'unscored', label: 'No Score Yet' },
  { value: '80+', label: '80 and Above' },
  { value: '60-79', label: '60 to 79' },
  { value: '<60', label: 'Below 60' },
];

const COMPANY_INTERVIEW_SORT_OPTIONS = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'scheduledSoon', label: 'Scheduled Soonest' },
  { value: 'candidateAsc', label: 'Candidate Name (A-Z)' },
  { value: 'scoreDesc', label: 'Highest Score' },
];

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const MANUAL_REVIEW_REMINDER_COOLDOWN_HOURS = 6;
const INTERVIEW_STAGE_OUTCOME_OPTIONS = [
  { value: 'PASS', label: 'Pass' },
  { value: 'HOLD', label: 'Hold' },
  { value: 'FAIL', label: 'Fail' },
];

const INTERVIEW_STAGE_ADVANCE_RULE_LABELS = {
  PASS_REQUIRED: 'Pass required to continue',
  COMPLETE_TO_CONTINUE: 'Completion is enough to continue',
};

const DEFAULT_COMPANY_INTERVIEW_FILTERS = {
  searchQuery: '',
  statusFilter: 'all',
  jobRoleFilter: 'all',
  scheduleFilter: 'all',
  scoreFilter: 'all',
  datePreset: 'all',
  from: '',
  to: '',
  sortBy: 'recent',
};

const normalizeFilterText = (value) => (value || '').toString().trim().toLowerCase();

const getCompanyInterviewDateWindow = (filters = {}) => {
  const preset = normalizeFilterText(filters.datePreset || 'all');
  if (preset === 'all') return { from: null, to: null };
  if (preset === 'custom') {
    const from = filters.from ? new Date(filters.from) : null;
    const to = filters.to ? new Date(filters.to) : null;
    if (from && !Number.isNaN(from.getTime())) from.setHours(0, 0, 0, 0);
    if (to && !Number.isNaN(to.getTime())) to.setHours(23, 59, 59, 999);
    return {
      from: from && !Number.isNaN(from.getTime()) ? from : null,
      to: to && !Number.isNaN(to.getTime()) ? to : null,
    };
  }
  const from = new Date();
  if (preset === 'last7') from.setDate(from.getDate() - 7);
  if (preset === 'last30') from.setDate(from.getDate() - 30);
  if (preset === 'last90') from.setDate(from.getDate() - 90);
  from.setHours(0, 0, 0, 0);
  return { from, to: null };
};

const countActiveCompanyInterviewFilters = (filters = {}) => {
  let count = 0;
  if (normalizeFilterText(filters.searchQuery)) count += 1;
  if ((filters.statusFilter || 'all') !== 'all') count += 1;
  if ((filters.jobRoleFilter || 'all') !== 'all') count += 1;
  if ((filters.scheduleFilter || 'all') !== 'all') count += 1;
  if ((filters.scoreFilter || 'all') !== 'all') count += 1;
  if ((filters.datePreset || 'all') !== 'all') count += 1;
  if ((filters.sortBy || 'recent') !== 'recent') count += 1;
  return count;
};

const getPendingRescheduleRequest = (interview) => {
  if (!interview) return null;
  if (interview.pendingRescheduleRequest) return interview.pendingRescheduleRequest;
  if (!Array.isArray(interview.rescheduleRequests)) return null;
  for (let index = interview.rescheduleRequests.length - 1; index >= 0; index -= 1) {
    const request = interview.rescheduleRequests[index];
    if ((request?.status || '').toUpperCase() === 'PENDING') {
      return request;
    }
  }
  return null;
};

const getAvailabilitySourceLabel = (interview) => {
  const source = String(interview?.availabilitySource || '').trim().toUpperCase();
  if (source === 'RECRUITER') return 'Recruiter availability';
  if (source === 'ORGANIZATION') return 'Organization availability';
  return null;
};

const getScheduleDecisionSummary = (interview) => {
  if (!interview?.scheduledFor) return null;

  const decision = interview?.scheduleDecision && typeof interview.scheduleDecision === 'object'
    ? interview.scheduleDecision
    : null;
  const source = String(decision?.source || '').trim().toUpperCase();
  const strategy = String(interview?.schedulingStrategy || decision?.strategy || '').trim().toUpperCase();
  const availabilitySource = getAvailabilitySourceLabel(interview);

  if (source === 'PREFERRED_SLOT') {
    return {
      label: 'Preferred slot accepted',
      detail: availabilitySource ? `Using ${availabilitySource.toLowerCase()}.` : null,
      tone: 'emerald',
    };
  }

  if (source === 'AUTO_EARLIEST') {
    return {
      label: strategy === 'PREFERRED_FIRST' ? 'Auto fallback slot assigned' : 'Auto earliest slot assigned',
      detail: strategy === 'PREFERRED_FIRST'
        ? 'Preferred slots were unavailable, so the next valid slot was selected.'
        : 'The earliest valid slot was selected automatically.',
      tone: 'blue',
    };
  }

  if (source === 'MANUAL' || strategy === 'MANUAL') {
    return {
      label: 'Manual slot selected',
      detail: availabilitySource ? `Validated against ${availabilitySource.toLowerCase()}.` : 'Chosen by the hiring team.',
      tone: 'slate',
    };
  }

  if (strategy === 'AUTO') {
    return {
      label: 'Auto slot assigned',
      detail: availabilitySource ? `Using ${availabilitySource.toLowerCase()}.` : null,
      tone: 'blue',
    };
  }

  if (strategy === 'PREFERRED_FIRST') {
    return {
      label: 'Preferred-first scheduling',
      detail: 'Candidate preference was evaluated before auto fallback.',
      tone: 'blue',
    };
  }

  return null;
};

const getMeetingLinkAutomationSummary = (interview) => {
  const mode = String(interview?.mode || 'HIRING').trim().toUpperCase();
  if (mode !== 'HIRING') return null;

  const status = String(interview?.status || '').trim().toUpperCase();
  if (status === 'COMPLETED' || status === 'CANCELLED') {
    return {
      label: 'Previous join link closed',
      detail: 'This interview is no longer joinable. Previous candidate join links are no longer active.',
      tone: 'slate',
    };
  }

  if (!interview?.scheduledFor) {
    return {
      label: 'Join link will be emailed automatically',
      detail: getRecruiterMeetingLinkUnscheduledDescription(),
      tone: 'blue',
    };
  }

  return {
    label: 'Candidate join link emails automatically',
    detail: `${getRecruiterMeetingLinkScheduledDescription()} ${getRecruiterMeetingLinkRescheduleDescription()}`,
    tone: 'blue',
  };
};

const getReviewerAssignmentSummary = (interview) => {
  if (!Array.isArray(interview?.reviewerAssignments)) return null;
  if (interview.reviewerAssignments.length === 0) {
    return {
      label: 'No reviewers assigned',
      detail: 'Assign reviewers so feedback lands in the reviewer queue after the interview completes.',
      tone: 'amber',
    };
  }

  return {
    label: 'Assigned reviewers',
    detail: summarizeReviewerAssignees(interview.reviewerAssignees || []),
    tone: 'emerald',
  };
};

const getReviewWorkflowSummaryCard = (interview) => {
  const summary = summarizeReviewWorkflow(interview);
  if (!summary) return null;
  return {
    ...summary,
    icon: summary.tone === 'emerald'
      ? 'ClipboardCheck'
      : summary.tone === 'rose'
        ? 'AlertTriangle'
        : summary.tone === 'amber'
          ? 'Clock3'
          : summary.tone === 'blue'
            ? 'ClipboardList'
            : 'Hourglass',
  };
};

const getLatestReviewReminderEntry = (interview) => {
  const detailedRequests = Array.isArray(interview?.reviewRequestsDetailed)
    ? interview.reviewRequestsDetailed
    : [];
  const latestEntries = detailedRequests
    .flatMap((request) => (
      Array.isArray(request?.reminderHistory) && request.reminderHistory.length > 0
        ? request.reminderHistory.map((entry) => ({
          ...entry,
          reviewerId: request.reviewerId,
        }))
        : (request?.lastReminderAt
          ? [{
            sentAt: request.lastReminderAt,
            workflowState: request.workflowState || null,
            channel: 'EMAIL',
            source: 'AUTOMATED',
            reviewerId: request.reviewerId,
          }]
          : [])
    ))
    .filter((entry) => entry?.sentAt)
    .sort((left, right) => Date.parse(right.sentAt) - Date.parse(left.sentAt));
  return latestEntries[0] || null;
};

const getReviewReminderSummary = (interview) => {
  const latestEntry = getLatestReviewReminderEntry(interview);
  if (!latestEntry) return null;
  return {
    label: `Last reminder ${formatReviewRequestDateTime(latestEntry.sentAt) || 'recently'}`,
    detail: describeReviewReminderHistoryEntry(latestEntry),
    tone: String(latestEntry?.source || '').toUpperCase() === 'MANUAL' ? 'amber' : 'blue',
  };
};

const getCurrentInterviewPlanStageDetail = (interview) => {
  const stages = Array.isArray(interview?.applicationInterviewPlan?.stages)
    ? interview.applicationInterviewPlan.stages
    : [];
  if (stages.length === 0) return null;
  return stages.find((stage) => stage?.id === interview?.planStageId)
    || stages.find((stage) => stage?.id === interview?.applicationInterviewPlan?.currentStageId)
    || null;
};

const getInterviewStageOutcomeSummary = (interview) => {
  const currentStage = getCurrentInterviewPlanStageDetail(interview);
  if (!currentStage) return null;

  const outcome = String(currentStage.outcome || 'PENDING').trim().toUpperCase();
  const advanceRule = String(currentStage.advanceRule || 'PASS_REQUIRED').trim().toUpperCase();
  const status = String(currentStage.status || '').trim().toUpperCase();

  if (status === 'SKIPPED') {
    return {
      label: 'Stage skipped',
      detail: currentStage.outcomeNote || 'This stage was skipped in the interview plan.',
      tone: 'slate',
      canAdvance: true,
      advanceRuleLabel: INTERVIEW_STAGE_ADVANCE_RULE_LABELS[advanceRule] || INTERVIEW_STAGE_ADVANCE_RULE_LABELS.PASS_REQUIRED,
    };
  }

  if (status !== 'COMPLETED') {
    return {
      label: 'Outcome pending until completion',
      detail: 'Complete this interview stage before recording an outcome.',
      tone: 'blue',
      canAdvance: false,
      advanceRuleLabel: INTERVIEW_STAGE_ADVANCE_RULE_LABELS[advanceRule] || INTERVIEW_STAGE_ADVANCE_RULE_LABELS.PASS_REQUIRED,
    };
  }

  if (advanceRule === 'COMPLETE_TO_CONTINUE') {
    const canAdvance = outcome !== 'FAIL' && outcome !== 'HOLD';
    return {
      label: outcome === 'PENDING' ? 'Ready to continue after completion' : `${outcome.charAt(0)}${outcome.slice(1).toLowerCase()} outcome recorded`,
      detail: currentStage.outcomeNote
        || (canAdvance
          ? 'This stage can continue after completion unless you place it on hold or fail it.'
          : outcome === 'FAIL'
            ? 'This stage is marked as failed. Update the outcome before continuing.'
            : 'This stage is on hold. Resolve the hold before continuing.'),
      tone: canAdvance ? (outcome === 'PASS' ? 'emerald' : 'blue') : (outcome === 'FAIL' ? 'rose' : 'amber'),
      canAdvance,
      advanceRuleLabel: INTERVIEW_STAGE_ADVANCE_RULE_LABELS.COMPLETE_TO_CONTINUE,
    };
  }

  const canAdvance = outcome === 'PASS';
  return {
    label: outcome === 'PASS'
      ? 'Pass outcome recorded'
      : outcome === 'FAIL'
        ? 'Fail outcome recorded'
        : outcome === 'HOLD'
          ? 'Stage on hold'
          : 'Pass outcome required',
    detail: currentStage.outcomeNote
      || (canAdvance
        ? 'This stage is cleared to create the next round.'
        : outcome === 'FAIL'
          ? 'This stage is blocked from progressing until the outcome changes.'
          : outcome === 'HOLD'
            ? 'This stage is blocked while the hold is unresolved.'
            : 'Record a Pass outcome before creating the next stage.'),
    tone: canAdvance ? 'emerald' : (outcome === 'FAIL' ? 'rose' : outcome === 'HOLD' ? 'amber' : 'blue'),
    canAdvance,
    advanceRuleLabel: INTERVIEW_STAGE_ADVANCE_RULE_LABELS.PASS_REQUIRED,
  };
};

const getInterviewPlanStageSummary = (interview) => {
  if (!interview) return null;
  const currentStage = getCurrentInterviewPlanStageDetail(interview);
  const outcome = String(currentStage?.outcome || 'PENDING').trim().toUpperCase();

  const sequence = Number(interview?.planStageSequence || interview?.nextPlanStage?.sequence || 0);
  const total = Number(
    interview?.planStageTotal
      || interview?.nextPlanStage?.total
      || interview?.applicationInterviewPlan?.stages?.length
      || 0,
  );
  const stageName = String(
    interview?.planStageName
      || interview?.nextPlanStage?.name
      || '',
  ).trim();
  const stageCategory = String(
    interview?.planStageCategory
      || interview?.nextPlanStage?.category
      || '',
  ).trim().toUpperCase();
  const status = String(interview?.status || '').trim().toUpperCase();
  if (!stageName && !total) return null;

  const roundLabel = total > 0 && sequence > 0
    ? `Round ${sequence} of ${total}`
    : 'Interview stage';
  const categoryLabel = stageCategory
    ? stageCategory.charAt(0) + stageCategory.slice(1).toLowerCase()
    : null;
  const nextStageCategoryLabel = String(interview?.nextPlanStage?.category || '').trim()
    ? String(interview.nextPlanStage.category).trim().charAt(0)
      + String(interview.nextPlanStage.category).trim().slice(1).toLowerCase()
    : null;

  if (status === 'COMPLETED' && interview?.hasNextPlanStage && interview?.nextPlanStage?.name) {
    return {
      label: outcome === 'PASS' ? `${roundLabel} passed` : `${roundLabel} completed`,
      detail: outcome === 'PASS'
        ? `Ready for next stage: ${interview.nextPlanStage.name}${nextStageCategoryLabel ? ` (${nextStageCategoryLabel})` : ''}.`
        : `Next stage: ${interview.nextPlanStage.name}${nextStageCategoryLabel ? ` (${nextStageCategoryLabel})` : ''}.`,
      badge: roundLabel,
      stageName,
      tone: outcome === 'PASS' ? 'emerald' : 'slate',
    };
  }

  if (status === 'COMPLETED') {
    return {
      label: outcome === 'PASS' ? `${roundLabel} passed` : `${roundLabel} completed`,
      detail: 'This was the final planned interview stage for the application.',
      badge: roundLabel,
      stageName,
      tone: 'slate',
    };
  }

  return {
    label: total > 0 && sequence > 0 ? `${roundLabel} active` : 'Interview stage active',
    detail: `${stageName}${categoryLabel ? ` - ${categoryLabel}` : ''}`,
    badge: roundLabel,
    stageName,
    tone: 'violet',
  };
};

const getInterviewPlanTimeline = (interview) => {
  const stages = Array.isArray(interview?.applicationInterviewPlan?.stages)
    ? interview.applicationInterviewPlan.stages
    : [];
  if (stages.length === 0) return [];

  return stages.map((stage, index) => {
    const sequence = Number(stage?.sequence || index + 1);
    const isCurrent = stage?.id && stage.id === interview?.planStageId;
    const isCompleted = Boolean(stage?.completedAt);
    const isUpcoming = !isCompleted && !isCurrent;
    return {
      id: stage?.id || `stage-${sequence}`,
      sequence,
      name: stage?.name || `Stage ${sequence}`,
      category: stage?.category || null,
      isCurrent,
      isCompleted,
      isUpcoming,
    };
  });
};

const canCreateNextInterviewStage = (interview, canManageInterviewScheduling, isReviewerOnly) => (
  Boolean(
    canManageInterviewScheduling
      && !isReviewerOnly
      && String(interview?.mode || '').trim().toUpperCase() === 'HIRING'
      && String(interview?.status || '').trim().toUpperCase() === 'COMPLETED'
      && interview?.hasNextPlanStage,
  )
);

const canAdvanceInterviewStageClient = (interview) => (
  Boolean(getInterviewStageOutcomeSummary(interview)?.canAdvance)
);

const getManualReviewReminderCooldownState = (reviewRequest) => {
  const lastReminderMs = reviewRequest?.lastReminderAt
    ? Date.parse(reviewRequest.lastReminderAt)
    : Number.NaN;
  if (!Number.isFinite(lastReminderMs)) {
    return { active: false, nextAvailableAt: null };
  }
  const cooldownMs = MANUAL_REVIEW_REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000;
  const nextAvailableMs = lastReminderMs + cooldownMs;
  if (Date.now() >= nextAvailableMs) {
    return { active: false, nextAvailableAt: null };
  }
  return {
    active: true,
    nextAvailableAt: new Date(nextAvailableMs).toISOString(),
  };
};

const decodeHtmlEntities = (value) => {
  if (typeof value !== 'string') return value || '';
  if (!value.includes('&')) return value;
  if (typeof document === 'undefined') return value;
  const decoder = document.createElement('textarea');
  decoder.innerHTML = value;
  return decoder.value;
};

const normalizeReviewerAssignmentIds = (values = []) => (
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean),
    ),
  ).sort()
);

const buildReviewRequestEditorState = (interview) => {
  const assignments = normalizeReviewerAssignmentIds(interview?.reviewerAssignments);
  const detailedRequests = Array.isArray(interview?.reviewRequestsDetailed)
    ? interview.reviewRequestsDetailed
    : [];
  const requestMap = new Map(
    detailedRequests
      .filter((request) => request?.reviewerId)
      .map((request) => [request.reviewerId, request]),
  );

  const config = assignments.reduce((accumulator, reviewerId) => {
    const request = requestMap.get(reviewerId);
    const dueSource = String(request?.dueSource || 'AUTO').trim().toUpperCase() === 'MANUAL'
      ? 'MANUAL'
      : 'AUTO';
    accumulator[reviewerId] = {
      dueSource,
      dueAt: dueSource === 'MANUAL' ? toLocalDatetimeValue(request?.dueAt) : '',
    };
    return accumulator;
  }, {});

  return { assignments, config };
};

const normalizeReviewRequestEditorState = (state = {}) => {
  const assignments = normalizeReviewerAssignmentIds(state?.assignments);
  const config = state?.config && typeof state.config === 'object' ? state.config : {};

  return {
    assignments,
    reviewRequests: assignments.map((reviewerId) => {
      const entry = config[reviewerId] || {};
      const dueSource = String(entry?.dueSource || 'AUTO').trim().toUpperCase() === 'MANUAL'
        ? 'MANUAL'
        : 'AUTO';
      return {
        reviewerId,
        dueSource,
        dueAt: dueSource === 'MANUAL' ? String(entry?.dueAt || '').trim() : '',
      };
    }),
  };
};

const areReviewRequestEditorStatesEqual = (left, right) => (
  JSON.stringify(normalizeReviewRequestEditorState(left))
  === JSON.stringify(normalizeReviewRequestEditorState(right))
);

const buildReviewRequestUpdatePayload = ({ initialState, currentState }) => {
  const normalizedInitial = normalizeReviewRequestEditorState(initialState);
  const normalizedCurrent = normalizeReviewRequestEditorState(currentState);
  const payload = {};

  if (JSON.stringify(normalizedInitial.assignments) !== JSON.stringify(normalizedCurrent.assignments)) {
    payload.reviewerAssignments = normalizedCurrent.assignments;
  }

  const initialRequestMap = new Map(
    normalizedInitial.reviewRequests.map((request) => [request.reviewerId, request]),
  );

  const reviewRequestUpdates = normalizedCurrent.reviewRequests
    .filter((request) => {
      const previous = initialRequestMap.get(request.reviewerId);
      if (!previous) {
        return request.dueSource === 'MANUAL';
      }
      return previous.dueSource !== request.dueSource
        || (request.dueSource === 'MANUAL' && previous.dueAt !== request.dueAt);
    })
    .map((request) => ({
      reviewerId: request.reviewerId,
      dueSource: request.dueSource,
      ...(request.dueSource === 'MANUAL'
        ? { dueAt: new Date(request.dueAt).toISOString() }
        : {}),
    }));

  if (reviewRequestUpdates.length > 0) {
    payload.reviewRequestUpdates = reviewRequestUpdates;
  }

  return payload;
};

const getReviewRequestToneClasses = (tone) => (
  tone === 'emerald'
    ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
    : tone === 'rose'
      ? 'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-200'
      : tone === 'amber'
        ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-200'
        : tone === 'blue'
          ? 'border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-200'
          : 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/40 text-gray-600 dark:text-slate-300'
);

const getCandidateProfileImage = (candidate) => {
  const possibleValues = [
    candidate?.profilePhotoUrl,
    candidate?.photoURL,
    candidate?.avatarUrl,
    candidate?.avatar,
    candidate?.imageUrl,
    candidate?.profileImage,
    candidate?.profile?.photoURL,
    candidate?.profile?.photoUrl,
    candidate?.profile?.imageUrl,
  ];
  const match = possibleValues.find((entry) => typeof entry === 'string' && entry.trim());
  return match ? match.trim() : null;
};

const normalizeUploadsPath = (value) => {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) return trimmed;
  if (trimmed.toLowerCase().startsWith('uploads/')) return `/${trimmed}`;
  return '';
};

const buildAssetSources = (value) => {
  if (!value || typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (
    trimmed.startsWith('http://')
    || trimmed.startsWith('https://')
    || trimmed.startsWith('data:')
    || trimmed.startsWith('blob:')
  ) {
    return [trimmed];
  }

  const uploadsPath = normalizeUploadsPath(trimmed);
  if (uploadsPath) {
    const base = API_BASE_URL.replace(/\/$/, '');
    const sources = [];
    if (base) sources.push(`${base}${uploadsPath}`);
    if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== base) {
      sources.push(`${window.location.origin}${uploadsPath}`);
    }
    return sources;
  }

  return [trimmed];
};

const CompanyInterviews = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, status } = useAuth();
  const organizationRole = user?.organizationContext?.membership?.role;
  const canManageInterviewScheduling = hasPermission(organizationRole, 'SEND_INVITATIONS');
  const isReviewerOnly = organizationRole === 'REVIEWER';
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // list | calendar
  const [scheduleModal, setScheduleModal] = useState(null); // { interview } | null
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(DEFAULT_COMPANY_INTERVIEW_FILTERS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(3);
  const [pendingRealtimeInterviewUpdates, setPendingRealtimeInterviewUpdates] = useState(0);
  const [rescheduleActionLoadingId, setRescheduleActionLoadingId] = useState(null);
  const [nextStageActionLoadingId, setNextStageActionLoadingId] = useState(null);
  const [offerActionLoadingId, setOfferActionLoadingId] = useState(null);
  const [reviewerOptions, setReviewerOptions] = useState([]);
  const [reviewerOptionsLoading, setReviewerOptionsLoading] = useState(false);
  const [reviewerOptionsError, setReviewerOptionsError] = useState('');
  const [reviewRequestEditorAssignments, setReviewRequestEditorAssignments] = useState([]);
  const [reviewRequestEditorConfig, setReviewRequestEditorConfig] = useState({});
  const [reviewRequestEditorInitialState, setReviewRequestEditorInitialState] = useState({
    assignments: [],
    config: {},
  });
  const [reviewRequestEditorSaving, setReviewRequestEditorSaving] = useState(false);
  const [reviewReminderSendingId, setReviewReminderSendingId] = useState('');
  const [reviewRequestEditorError, setReviewRequestEditorError] = useState('');
  const [reviewRequestEditorSuccess, setReviewRequestEditorSuccess] = useState('');
  const [nextStageActionMessage, setNextStageActionMessage] = useState('');
  const [stageOutcomeValue, setStageOutcomeValue] = useState('PASS');
  const [stageOutcomeNote, setStageOutcomeNote] = useState('');
  const [stageOutcomeInitialState, setStageOutcomeInitialState] = useState({
    outcome: 'PASS',
    note: '',
  });
  const [stageOutcomeSaving, setStageOutcomeSaving] = useState(false);
  const [stageOutcomeError, setStageOutcomeError] = useState('');
  const [stageOutcomeSuccess, setStageOutcomeSuccess] = useState('');

  useEffect(() => {
    document.title = 'Interviews - InterviewAI Pro';
  }, []);

  const openAssignedReviewsWorkspace = useCallback((interviewId, tab = 'review') => {
    if (!interviewId) return;
    const params = new URLSearchParams();
    params.set('interviewId', interviewId);
    if (tab) {
      params.set('tab', tab);
    }
    navigate(`/company-reviews?${params.toString()}`);
  }, [navigate]);

  const loadInterviews = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const result = await apiClient.interviews.getCompanyInterviews();
      if (result.success) {
        setInterviews(result.interviews || []);
        setPendingRealtimeInterviewUpdates(0);
      } else {
        setError(result.error || 'Failed to load interviews.');
      }
    } catch (err) {
      setError(err.message || 'Failed to load interviews.');
    } finally {
      setLoading(false);
    }
  }, []);

  useInterviewRealtimeFeed({
    userId: user?.id,
    enabled: Boolean(user?.id),
    eventTypes: combineRealtimeEventTypes(
      INTERVIEW_FEED_EVENTS.lifecycle,
      INTERVIEW_FEED_EVENTS.pipeline,
      INTERVIEW_FEED_EVENTS.reviews,
    ),
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      // Keep interview list stable while users are browsing/filtering.
      setPendingRealtimeInterviewUpdates((prev) => Math.min(prev + 1, 99));
    },
  });

  useEffect(() => {
    loadInterviews();
  }, [loadInterviews]);

  useEffect(() => {
    const interviewId = new URLSearchParams(location.search).get('interviewId');
    if (!interviewId || interviews.length === 0) return;
    const interview = interviews.find((item) => item.id === interviewId);
    if (interview) {
      setSelectedInterview(interview);
      setShowDetails(true);
      const params = new URLSearchParams(location.search);
      params.delete('interviewId');
      navigate(
        {
          pathname: location.pathname,
          search: params.toString() ? `?${params.toString()}` : '',
          hash: location.hash,
        },
        { replace: true },
      );
    }
  }, [interviews, location.hash, location.pathname, location.search, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      PENDING: { label: 'Pending Scheduling', color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700' },
      SCHEDULED: { label: 'Scheduled', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 border-blue-200 dark:border-blue-700' },
      IN_PROGRESS: { label: 'In Progress', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700' },
      COMPLETED: { label: 'Completed', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700' },
      CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700' },
    };
    const config = statusConfig[status?.toUpperCase()] || {
      label: String(status || 'Unknown')
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
      color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const updateFilter = (key, value) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters(DEFAULT_COMPANY_INTERVIEW_FILTERS);
    setShowAdvancedFilters(false);
  };

  const interviewFilterOptions = useMemo(
    () => ({
      jobRoleOptions: [
        { value: 'all', label: 'All Roles' },
        ...Array.from(
          new Set(
            interviews
              .map((interview) => interview?.jobRole)
              .map((value) => value?.toString?.().trim())
              .filter(Boolean),
          ),
        ).map((value) => ({ value, label: value })),
      ],
    }),
    [interviews],
  );

  const activeFilterCount = countActiveCompanyInterviewFilters(filters);

  const filteredInterviews = useMemo(
    () => {
      const interviewDateWindow = getCompanyInterviewDateWindow(filters);
      const searchTokens = normalizeFilterText(filters.searchQuery).split(' ').filter(Boolean);
      return interviews
        .filter((interview) => {
        const status = (interview?.status || '').toString().toUpperCase();
        const jobRole = (interview?.jobRole || '').toString();
        const scheduledDate = interview?.scheduledFor ? new Date(interview.scheduledFor) : null;
        const createdDate = interview?.createdAt ? new Date(interview.createdAt) : null;
        const primaryDate = scheduledDate && !Number.isNaN(scheduledDate.getTime())
          ? scheduledDate
          : (createdDate && !Number.isNaN(createdDate.getTime()) ? createdDate : null);
        const score = Number(interview?.overallScore);
        const hasScore = Number.isFinite(score);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        if (filters.statusFilter !== 'all' && status !== filters.statusFilter) return false;
        if (filters.jobRoleFilter !== 'all' && jobRole !== filters.jobRoleFilter) return false;

        if (filters.scheduleFilter !== 'all') {
          if (!scheduledDate || Number.isNaN(scheduledDate.getTime())) {
            if (filters.scheduleFilter !== 'unscheduled') return false;
          } else {
            if (filters.scheduleFilter === 'unscheduled') return false;
            if (filters.scheduleFilter === 'upcoming' && scheduledDate < now) return false;
            if (filters.scheduleFilter === 'past' && scheduledDate >= now) return false;
            if (filters.scheduleFilter === 'today' && (scheduledDate < startOfToday || scheduledDate > endOfToday)) return false;
          }
        }

        if (filters.scoreFilter === 'scored' && !hasScore) return false;
        if (filters.scoreFilter === 'unscored' && hasScore) return false;
        if (filters.scoreFilter === '80+' && !(hasScore && score >= 80)) return false;
        if (filters.scoreFilter === '60-79' && !(hasScore && score >= 60 && score < 80)) return false;
        if (filters.scoreFilter === '<60' && !(hasScore && score < 60)) return false;

        if (interviewDateWindow.from || interviewDateWindow.to) {
          if (!primaryDate) return false;
          if (interviewDateWindow.from && primaryDate < interviewDateWindow.from) return false;
          if (interviewDateWindow.to && primaryDate > interviewDateWindow.to) return false;
        }

        if (searchTokens.length) {
          const searchableText = [
            interview?.candidate?.fullName || '',
            interview?.candidate?.email || '',
            interview?.jobRole || '',
            interview?.status || '',
            interview?.pipelineStatus || '',
          ]
            .join(' ')
            .toLowerCase();
          if (!searchTokens.every((token) => searchableText.includes(token))) return false;
        }

        return true;
      })
      .sort((left, right) => {
        const leftScheduled = left?.scheduledFor ? new Date(left.scheduledFor).getTime() : 0;
        const rightScheduled = right?.scheduledFor ? new Date(right.scheduledFor).getTime() : 0;
        const leftCreated = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightCreated = right?.createdAt ? new Date(right.createdAt).getTime() : 0;

        if (filters.sortBy === 'oldest') return leftCreated - rightCreated;
        if (filters.sortBy === 'scheduledSoon') {
          if (!leftScheduled && !rightScheduled) return rightCreated - leftCreated;
          if (!leftScheduled) return 1;
          if (!rightScheduled) return -1;
          return leftScheduled - rightScheduled;
        }
        if (filters.sortBy === 'candidateAsc') {
          const leftName = left?.candidate?.fullName || left?.candidate?.email || '';
          const rightName = right?.candidate?.fullName || right?.candidate?.email || '';
          return leftName.localeCompare(rightName);
        }
        if (filters.sortBy === 'scoreDesc') return Number(right?.overallScore || 0) - Number(left?.overallScore || 0);
        return rightCreated - leftCreated;
      });
    },
    [filters, interviews],
  );

  // Pagination calculations
  const totalPages = Math.ceil(filteredInterviews.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedInterviews = filteredInterviews.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const handleViewDetails = (interview) => {
    setSelectedInterview(interview);
    setShowDetails(true);
  };

  const applyInterviewUpdate = useCallback((updatedInterview) => {
    if (!updatedInterview?.id) return;
    setInterviews((previous) => {
      const exists = previous.some((interview) => interview.id === updatedInterview.id);
      if (!exists) {
        return [updatedInterview, ...previous];
      }
      return previous.map((interview) => (
        interview.id === updatedInterview.id ? updatedInterview : interview
      ));
    });
    setSelectedInterview((previous) => (
      previous?.id === updatedInterview.id ? updatedInterview : previous
    ));
  }, []);

  const applyNextStageInterviewResult = useCallback(async (result, defaultMessage = '') => {
    const createdInterview = result?.nextInterview || result?.interview || null;
    if (!createdInterview) return;

    applyInterviewUpdate(createdInterview);
    await loadInterviews();
    setSelectedInterview(createdInterview);
    setShowDetails(true);
    if (!createdInterview.scheduledFor && canManageInterviewScheduling) {
      setShowDetails(false);
      setScheduleModal({
        interview: createdInterview,
      });
      setNextStageActionMessage(defaultMessage || `Created ${createdInterview.planStageName || 'the next interview stage'}. Schedule it to continue the hiring flow.`);
    } else {
      setNextStageActionMessage(
        defaultMessage
        || `Created ${createdInterview.planStageName || 'the next interview stage'}${createdInterview.scheduledFor ? ' and scheduled it successfully.' : '.'}`,
      );
    }
  }, [applyInterviewUpdate, canManageInterviewScheduling, loadInterviews]);

  const handleRejectRescheduleRequest = async (interview) => {
    if (!canManageInterviewScheduling) return;
    const pendingRequest = getPendingRescheduleRequest(interview);
    if (!interview?.id || !pendingRequest?.id) return;
    try {
      setRescheduleActionLoadingId(interview.id);
      setError('');
      await apiClient.interviews.rejectRescheduleRequest(interview.id, pendingRequest.id, {});
      await loadInterviews();
      if (selectedInterview?.id === interview.id) {
        setSelectedInterview((prev) => (prev ? { ...prev, pendingRescheduleRequest: null } : prev));
      }
    } catch (requestError) {
      setError(requestError?.message || 'Failed to reject reschedule request.');
    } finally {
      setRescheduleActionLoadingId(null);
    }
  };

  const toggleReviewRequestAssignment = (reviewerId) => {
    if (!reviewerId) return;
    setReviewRequestEditorSuccess('');
    setReviewRequestEditorError('');
    setReviewRequestEditorAssignments((previous) => (
      previous.includes(reviewerId)
        ? previous.filter((value) => value !== reviewerId)
        : [...previous, reviewerId].sort()
    ));
    setReviewRequestEditorConfig((previous) => (
      previous[reviewerId]
        ? previous
        : {
          ...previous,
          [reviewerId]: {
            dueSource: 'AUTO',
            dueAt: '',
          },
        }
    ));
  };

  const updateReviewRequestConfig = (reviewerId, nextValue) => {
    if (!reviewerId) return;
    setReviewRequestEditorSuccess('');
    setReviewRequestEditorError('');
    setReviewRequestEditorConfig((previous) => ({
      ...previous,
      [reviewerId]: {
        ...(previous[reviewerId] || { dueSource: 'AUTO', dueAt: '' }),
        ...nextValue,
      },
    }));
  };

  const handleSaveReviewRequests = async () => {
    if (!selectedInterview?.id || reviewRequestEditorSaving) return;

    const normalizedState = normalizeReviewRequestEditorState(reviewRequestEditorState);
    for (const request of normalizedState.reviewRequests) {
      if (request.dueSource !== 'MANUAL') continue;
      const parsedDueAt = new Date(request.dueAt);
      if (Number.isNaN(parsedDueAt.getTime())) {
        setReviewRequestEditorError('Each manual review due date must be a valid date and time.');
        return;
      }
      if (parsedDueAt.getTime() <= Date.now()) {
        setReviewRequestEditorError('Manual review due dates must be in the future.');
        return;
      }
    }

    const payload = buildReviewRequestUpdatePayload({
      initialState: reviewRequestEditorInitialState,
      currentState: reviewRequestEditorState,
    });
    if (!payload.reviewerAssignments && !payload.reviewRequestUpdates) {
      setReviewRequestEditorSuccess('No reviewer workflow changes to save.');
      return;
    }

    try {
      setReviewRequestEditorSaving(true);
      setReviewRequestEditorError('');
      setReviewRequestEditorSuccess('');
      const result = await apiClient.interviews.updateReviewRequests(selectedInterview.id, payload);
      const updatedInterview = result?.interview;
      if (updatedInterview) {
        const nextState = buildReviewRequestEditorState(updatedInterview);
        applyInterviewUpdate(updatedInterview);
        setReviewRequestEditorAssignments(nextState.assignments);
        setReviewRequestEditorConfig(nextState.config);
        setReviewRequestEditorInitialState(nextState);
      }
      setReviewRequestEditorSuccess('Reviewer assignments and due dates updated.');
    } catch (saveError) {
      setReviewRequestEditorError(saveError?.message || 'Unable to update reviewer workflow right now.');
    } finally {
      setReviewRequestEditorSaving(false);
    }
  };

  const handleSendManualReviewReminder = async (reviewerId, reviewerName) => {
    if (!selectedInterview?.id || !reviewerId || reviewReminderSendingId) return;

    try {
      setReviewReminderSendingId(reviewerId);
      setReviewRequestEditorError('');
      setReviewRequestEditorSuccess('');
      const result = await apiClient.interviews.sendReviewReminder(selectedInterview.id, reviewerId);
      if (result?.interview) {
        const nextState = buildReviewRequestEditorState(result.interview);
        applyInterviewUpdate(result.interview);
        setReviewRequestEditorAssignments(nextState.assignments);
        setReviewRequestEditorConfig(nextState.config);
        setReviewRequestEditorInitialState(nextState);
      }
      setReviewRequestEditorSuccess(`Reminder sent to ${reviewerName || 'the assigned reviewer'}.`);
    } catch (sendError) {
      setReviewRequestEditorError(sendError?.message || 'Unable to send the review reminder right now.');
    } finally {
      setReviewReminderSendingId('');
    }
  };

  const buildStageOutcomeEditorState = useCallback((interview) => {
    const currentStage = getCurrentInterviewPlanStageDetail(interview);
    const persistedOutcome = ['PASS', 'FAIL', 'HOLD'].includes(String(currentStage?.outcome || '').trim().toUpperCase())
      ? String(currentStage.outcome).trim().toUpperCase()
      : '';
    return {
      outcome: persistedOutcome || 'PASS',
      persistedOutcome,
      note: typeof currentStage?.outcomeNote === 'string' ? currentStage.outcomeNote : '',
    };
  }, []);

  const handleSaveStageOutcome = async (autoAdvance) => {
    if (!selectedInterview?.id || stageOutcomeSaving) return;

    try {
      setStageOutcomeSaving(true);
      setStageOutcomeError('');
      setStageOutcomeSuccess('');
      const payload = {
        outcome: stageOutcomeValue,
        note: stageOutcomeNote,
      };
      if (typeof autoAdvance === 'boolean') {
        payload.autoAdvance = autoAdvance;
      }
      const result = await apiClient.interviews.updateStageOutcome(selectedInterview.id, payload);
      const updatedInterview = result?.interview;
      if (updatedInterview) {
        applyInterviewUpdate(updatedInterview);
        setSelectedInterview(updatedInterview);
        const nextState = buildStageOutcomeEditorState(updatedInterview);
        setStageOutcomeValue(nextState.outcome);
        setStageOutcomeNote(nextState.note);
        setStageOutcomeInitialState({
          outcome: nextState.persistedOutcome,
          note: nextState.note,
        });
      }
      if (result?.nextInterview) {
        await applyNextStageInterviewResult(result, '');
        setStageOutcomeSuccess(
          result?.autoAdvance?.created === false
            ? 'Stage outcome saved. The next interview stage is already active.'
            : result?.autoAdvance?.scheduled
              ? 'Stage outcome saved. The next interview stage was created and scheduled.'
              : 'Stage outcome saved. The next interview stage was created.',
        );
      } else if (result?.applicationStatusChange?.status === 'REJECTED') {
        setStageOutcomeSuccess('Stage outcome saved. The application was closed based on this round result.');
      } else if (result?.autoAdvance?.warning) {
        setStageOutcomeSuccess(`Stage outcome saved. ${result.autoAdvance.warning}`);
      } else if (result?.autoAdvance?.done) {
        setStageOutcomeSuccess('Stage outcome saved. No further interview stages are planned.');
      } else {
        setStageOutcomeSuccess('Stage outcome saved.');
      }
    } catch (saveError) {
      setStageOutcomeError(saveError?.message || 'Unable to save the stage outcome right now.');
    } finally {
      setStageOutcomeSaving(false);
    }
  };

  const handleCreateNextStageInterview = async (interview) => {
    if (!interview?.id || nextStageActionLoadingId) return;

    try {
      setNextStageActionLoadingId(interview.id);
      setNextStageActionMessage('');
      setError('');
      const result = await apiClient.interviews.createNextStage(interview.id);
      await applyNextStageInterviewResult(result, '');
    } catch (stageError) {
      setError(stageError?.message || 'Unable to create the next interview stage right now.');
    } finally {
      setNextStageActionLoadingId(null);
    }
  };

  const handleMoveApplicationToOffer = async (interview) => {
    if (!interview?.applicationId || offerActionLoadingId) return;

    try {
      setOfferActionLoadingId(interview.id);
      setNextStageActionMessage('');
      setError('');
      await apiClient.applications.updateStatus(interview.applicationId, 'OFFER');
      await loadInterviews();
      setNextStageActionMessage('The candidate has been moved to the offer stage.');
    } catch (stageError) {
      setError(stageError?.message || 'Unable to move this application to the offer stage right now.');
    } finally {
      setOfferActionLoadingId(null);
    }
  };

  const selectedPendingRescheduleRequest = getPendingRescheduleRequest(selectedInterview);
  const selectedCurrentPlanStage = getCurrentInterviewPlanStageDetail(selectedInterview);
  const selectedStageSummary = getInterviewPlanStageSummary(selectedInterview);
  const selectedStageOutcomeSummary = getInterviewStageOutcomeSummary(selectedInterview);
  const selectedStageAutoAdvanceEnabled = Boolean(
    selectedCurrentPlanStage?.autoAdvanceOnPass
    && canCreateNextInterviewStage(selectedInterview, canManageInterviewScheduling, isReviewerOnly)
    && stageOutcomeValue === 'PASS',
  );
  const selectedCanCreateNextStageFromOutcome = Boolean(
    canCreateNextInterviewStage(selectedInterview, canManageInterviewScheduling, isReviewerOnly)
    && stageOutcomeValue === 'PASS',
  );
  const selectedCanMoveToOffer = Boolean(
    canManageInterviewScheduling
    && !isReviewerOnly
    && canMoveInterviewApplicationToOffer(selectedInterview),
  );
  const selectedStageTimeline = getInterviewPlanTimeline(selectedInterview);
  const selectedScheduleDecisionSummary = getScheduleDecisionSummary(selectedInterview);
  const selectedMeetingLinkAutomationSummary = getMeetingLinkAutomationSummary(selectedInterview);
  const selectedReviewerAssignmentSummary = getReviewerAssignmentSummary(selectedInterview);
  const selectedReviewWorkflowSummary = getReviewWorkflowSummaryCard(selectedInterview);
  const selectedReviewReminderSummary = getReviewReminderSummary(selectedInterview);
  const selectedCandidateImageSources = useMemo(
    () => buildAssetSources(getCandidateProfileImage(selectedInterview?.candidate)),
    [selectedInterview],
  );
  const selectedCandidateImageSrc = selectedCandidateImageSources[0] || null;
  const reviewRequestEditorState = useMemo(
    () => ({
      assignments: reviewRequestEditorAssignments,
      config: reviewRequestEditorConfig,
    }),
    [reviewRequestEditorAssignments, reviewRequestEditorConfig],
  );
  const reviewRequestEditorDirty = useMemo(
    () => !areReviewRequestEditorStatesEqual(reviewRequestEditorInitialState, reviewRequestEditorState),
    [reviewRequestEditorInitialState, reviewRequestEditorState],
  );
  const stageOutcomeDirty = useMemo(
    () => (
      stageOutcomeInitialState.outcome !== stageOutcomeValue
      || stageOutcomeInitialState.note !== stageOutcomeNote
    ),
    [stageOutcomeInitialState, stageOutcomeNote, stageOutcomeValue],
  );
  const reviewerOptionMap = useMemo(
    () => new Map(reviewerOptions.map((option) => [option.value, option])),
    [reviewerOptions],
  );
  const selectedReviewRequestRows = useMemo(() => {
    if (!selectedInterview) return [];
    const requestMap = new Map(
      (Array.isArray(selectedInterview?.reviewRequestsDetailed) ? selectedInterview.reviewRequestsDetailed : [])
        .filter((request) => request?.reviewerId)
        .map((request) => [request.reviewerId, request]),
    );
    const assigneeMap = new Map(
      (Array.isArray(selectedInterview?.reviewerAssignees) ? selectedInterview.reviewerAssignees : [])
        .filter((reviewer) => reviewer?.id)
        .map((reviewer) => [reviewer.id, reviewer]),
    );

    return reviewRequestEditorAssignments.map((reviewerId) => {
      const option = reviewerOptionMap.get(reviewerId);
      const assignee = assigneeMap.get(reviewerId);
      const request = requestMap.get(reviewerId) || null;
      const editorEntry = reviewRequestEditorConfig[reviewerId] || { dueSource: 'AUTO', dueAt: '' };
      const stateMeta = request?.workflowState
        ? getReviewRequestStateMeta(request.workflowState)
        : { label: 'New assignment', tone: 'blue' };
      const reminderCooldown = getManualReviewReminderCooldownState(request);

      return {
        reviewerId,
        name: assignee?.fullName || assignee?.email || option?.label || reviewerId,
        subtitle: option?.description || assignee?.email || reviewerId,
        request,
        stateMeta,
        dueSource: editorEntry.dueSource === 'MANUAL' ? 'MANUAL' : 'AUTO',
        dueAt: editorEntry.dueAt || '',
        isCompleted: Boolean(request?.completedAt || request?.completedReviewId),
        reminderCooldown,
      };
    });
  }, [reviewRequestEditorAssignments, reviewRequestEditorConfig, reviewerOptionMap, selectedInterview]);

  useEffect(() => {
    const nextState = buildReviewRequestEditorState(selectedInterview);
    setReviewRequestEditorAssignments(nextState.assignments);
    setReviewRequestEditorConfig(nextState.config);
    setReviewRequestEditorInitialState(nextState);
    setReviewRequestEditorError('');
    setReviewRequestEditorSuccess('');
  }, [selectedInterview?.id]);

  useEffect(() => {
    const nextState = buildStageOutcomeEditorState(selectedInterview);
    setStageOutcomeValue(nextState.outcome);
    setStageOutcomeNote(nextState.note);
    setStageOutcomeInitialState({
      outcome: nextState.persistedOutcome,
      note: nextState.note,
    });
    setStageOutcomeError('');
    setStageOutcomeSuccess('');
  }, [buildStageOutcomeEditorState, selectedInterview?.id]);

  useEffect(() => {
    setNextStageActionMessage('');
  }, [selectedInterview?.id]);

  useEffect(() => {
    if (!showDetails || !selectedInterview?.id || !canManageInterviewScheduling) {
      return undefined;
    }

    let cancelled = false;
    setReviewerOptionsLoading(true);
    setReviewerOptionsError('');

    const loadReviewerOptions = async () => {
      try {
        const result = await apiClient.organizations.listMembers();
        if (cancelled) return;
        setReviewerOptions(buildReviewerAssignmentOptions(result?.members || []));
      } catch (loadError) {
        if (cancelled) return;
        setReviewerOptions([]);
        setReviewerOptionsError(loadError?.message || 'Unable to load review-capable team members right now.');
      } finally {
        if (!cancelled) {
          setReviewerOptionsLoading(false);
        }
      }
    };

    loadReviewerOptions();
    return () => {
      cancelled = true;
    };
  }, [canManageInterviewScheduling, selectedInterview?.id, showDetails]);

  if (status === 'loading' || !user) {
    return (
      <LoadingState
        title="Loading interviews"
        message="Pulling the latest interview activity."
        variant="fullscreen"
        tone="primary"
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <Header 
        userType="company"
        isAuthenticated
        onLogout={handleLogout}
        organizationRole={user?.organizationContext?.membership?.role}
      />
      
      <div className="h-14 xs:h-16" />
      
      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType="company"
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
          
          <main className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${
            isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'
          }`}>
            <motion.section
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="container-responsive py-6 xs:py-8 sm:py-10 space-y-4 xs:space-y-5 sm:space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <Icon name="Calendar" size={22} color="white" />
                  </div>
                  <div>
                    <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
                      Interviews
                    </h1>
                      <p className="text-sm text-gray-600 dark:text-slate-400">
                        {isReviewerOnly
                          ? 'Review assigned interview schedules, recordings, and AI analysis without changing hiring logistics.'
                          : 'Manage and review all interview sessions'}
                      </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5">
                    <button
                      onClick={() => setViewMode('list')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        viewMode === 'list'
                          ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm'
                          : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                      }`}
                    >
                      <Icon name="List" size={13} /> List
                    </button>
                    <button
                      onClick={() => setViewMode('calendar')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        viewMode === 'calendar'
                          ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm'
                          : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                      }`}
                    >
                      <Icon name="CalendarDays" size={13} /> Calendar
                    </button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconName="RefreshCw"
                    onClick={loadInterviews}
                    disabled={loading}
                    className="rounded-full text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Calendar View */}
              {viewMode === 'calendar' && (
                <InterviewCalendar
                  interviews={interviews}
                  userType="company"
                  onViewInterview={(iv) => {
                    // Scroll to list and highlight, or navigate
                    setViewMode('list');
                  }}
                />
              )}

              {pendingRealtimeInterviewUpdates > 0 && (
                <div className="rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-4 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Icon name="Bell" className="w-4 h-4 mt-0.5 text-blue-600 dark:text-blue-300" />
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      {pendingRealtimeInterviewUpdates} new interview update{pendingRealtimeInterviewUpdates === 1 ? '' : 's'} available.
                      Refresh when you are ready.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadInterviews}
                    disabled={loading}
                    className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-500/40 dark:text-blue-200 dark:hover:bg-blue-500/20"
                  >
                    <Icon name="RefreshCw" size={14} className="mr-1.5" />
                    Refresh List
                  </Button>
                </div>
              )}

              {/* Filters */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <UnifiedFilterPanel
                  title="Interview Filters"
                  description="Refine interviews by candidate, role, status, scheduling state, score, and date range."
                  activeCount={activeFilterCount}
                  onClear={clearFilters}
                  headerActions={(
                    <UnifiedFilterToggleButton
                      active={showAdvancedFilters}
                      onClick={() => setShowAdvancedFilters((previous) => !previous)}
                      label="Advanced Filters"
                    />
                  )}
                >
                  <div className={FILTER_GRID_CLASS}>
                    <UnifiedSearchField
                      label="Search"
                      className="sm:col-span-2 xl:col-span-2"
                      type="text"
                      value={filters.searchQuery}
                      onChange={(event) => updateFilter('searchQuery', event.target.value)}
                      placeholder="Candidate name, email, role, status, or pipeline stage"
                    />
                    <UnifiedFilterSelect
                      label="Status"
                      value={filters.statusFilter}
                      onChange={(value) => updateFilter('statusFilter', value)}
                      options={[
                        { value: 'all', label: 'All Statuses' },
                        { value: 'PENDING', label: 'Pending Scheduling' },
                        { value: 'SCHEDULED', label: 'Scheduled' },
                        { value: 'IN_PROGRESS', label: 'In Progress' },
                        { value: 'COMPLETED', label: 'Completed' },
                        { value: 'CANCELLED', label: 'Cancelled' },
                      ]}
                    />
                    <UnifiedFilterSelect
                      label="Job Role"
                      value={filters.jobRoleFilter}
                      onChange={(value) => updateFilter('jobRoleFilter', value)}
                      options={interviewFilterOptions.jobRoleOptions}
                    />
                  </div>

                  {showAdvancedFilters && (
                    <div className={FILTER_SUBPANEL_CLASS}>
                      <div className={FILTER_GRID_CLASS}>
                        <UnifiedFilterSelect
                          label="Schedule State"
                          value={filters.scheduleFilter}
                          onChange={(value) => updateFilter('scheduleFilter', value)}
                          options={COMPANY_INTERVIEW_SCHEDULE_OPTIONS}
                        />
                        <UnifiedFilterSelect
                          label="Score Band"
                          value={filters.scoreFilter}
                          onChange={(value) => updateFilter('scoreFilter', value)}
                          options={COMPANY_INTERVIEW_SCORE_OPTIONS}
                        />
                        <UnifiedFilterSelect
                          label="Date Range"
                          value={filters.datePreset}
                          onChange={(value) => updateFilter('datePreset', value)}
                          options={COMPANY_INTERVIEW_DATE_PRESET_OPTIONS}
                        />
                        <UnifiedFilterSelect
                          label="Sort By"
                          value={filters.sortBy}
                          onChange={(value) => updateFilter('sortBy', value)}
                          options={COMPANY_INTERVIEW_SORT_OPTIONS}
                        />
                      </div>

                      {filters.datePreset === 'custom' && (
                        <div className={FILTER_DATE_GRID_CLASS}>
                          <label className="space-y-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">From</span>
                            <UnifiedTextInput
                              type="date"
                              value={filters.from}
                              onChange={(event) => updateFilter('from', event.target.value)}
                            />
                          </label>
                          <label className="space-y-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">To</span>
                            <UnifiedTextInput
                              type="date"
                              value={filters.to}
                              onChange={(event) => updateFilter('to', event.target.value)}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </UnifiedFilterPanel>
              </motion.div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs sm:text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
                >
                  {error}
                </motion.div>
              )}

              {/* Interviews List */}
              {viewMode === 'calendar' ? null : loading ? (
                <LoadingState
                  title="Loading interviews"
                  message="Updating interview schedules and status."
                  variant="card"
                  tone="primary"
                />
              ) : filteredInterviews.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-8 text-center"
                >
                  <Icon name="FileText" className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    {activeFilterCount > 0
                      ? 'No interviews match your filters.' 
                      : 'No interviews found yet. Move candidates to Interviewing to auto-schedule sessions.'}
                  </p>
                </motion.div>
              ) : (
                <>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-2 sm:space-y-3"
                >
                  {paginatedInterviews.map((interview) => {
                    const stageSummary = getInterviewPlanStageSummary(interview);
                    const pendingRescheduleRequest = getPendingRescheduleRequest(interview);
                    const scheduleDecisionSummary = getScheduleDecisionSummary(interview);
                    const meetingLinkAutomationSummary = getMeetingLinkAutomationSummary(interview);
                    const reviewerAssignmentSummary = getReviewerAssignmentSummary(interview);
                    const reviewWorkflowSummary = getReviewWorkflowSummaryCard(interview);
                    const reviewReminderSummary = getReviewReminderSummary(interview);
                    const hasInterviewSummaries = Boolean(
                      stageSummary
                      || scheduleDecisionSummary
                      || meetingLinkAutomationSummary
                      || reviewerAssignmentSummary
                      || reviewWorkflowSummary
                      || reviewReminderSummary
                      || (!pendingRescheduleRequest && interview.lastCandidateContact),
                    );
                    const candidateName = decodeHtmlEntities(
                      interview.candidate?.fullName || interview.candidate?.email || 'Unknown Candidate',
                    );
                    const candidateEmail = decodeHtmlEntities(interview.candidate?.email || '');
                    const roleLabel = decodeHtmlEntities(interview.jobRole || 'Position');
                    const candidateProfileImage = getCandidateProfileImage(interview.candidate);
                    const candidateProfileImageSources = buildAssetSources(candidateProfileImage);
                    const candidateProfileImageSrc = candidateProfileImageSources[0] || null;
                    return (
                      <div
                        key={interview.id}
                        data-testid={`interview-card-${interview.id}`}
                        className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.1)] dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all duration-200"
                      >
                        <div className="flex flex-col gap-3 sm:gap-4">
                          <div
                            data-testid={`interview-card-${interview.id}-content`}
                            className="flex flex-col gap-3"
                          >
                            <div
                              data-testid={`interview-card-${interview.id}-identity`}
                              className="flex items-start gap-3 sm:gap-4"
                            >
                              <div className="relative h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 self-start">
                                {candidateProfileImageSrc && (
                                  <img
                                    src={candidateProfileImageSrc}
                                    alt={candidateName}
                                    className="w-full h-full rounded-full object-cover border border-white/40 dark:border-slate-700/50"
                                    onError={(event) => {
                                      const nextIndex = Number.parseInt(
                                        event.currentTarget.dataset.fallbackIndex || '1',
                                        10,
                                      );
                                      if (
                                        Number.isInteger(nextIndex)
                                        && nextIndex >= 0
                                        && nextIndex < candidateProfileImageSources.length
                                      ) {
                                        event.currentTarget.dataset.fallbackIndex = String(nextIndex + 1);
                                        event.currentTarget.src = candidateProfileImageSources[nextIndex];
                                        return;
                                      }
                                      event.currentTarget.style.display = 'none';
                                      const fallback = event.currentTarget.nextElementSibling;
                                      if (fallback) fallback.style.display = 'flex';
                                    }}
                                    data-fallback-index="1"
                                  />
                                )}
                                <div className={`w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-500 items-center justify-center text-white font-semibold text-sm sm:text-base ${candidateProfileImageSrc ? 'hidden' : 'flex'}`}>
                                  {candidateName?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 dark:text-slate-100 text-sm sm:text-base truncate">
                                  {candidateName}
                                </h3>
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 truncate">
                                  {candidateEmail}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  <span className="text-xs text-gray-600 dark:text-slate-300">
                                    {roleLabel}
                                  </span>
                                  {stageSummary?.badge && (
                                    <>
                                      <span className="text-gray-400">&middot;</span>
                                      <span className="inline-flex items-center rounded-full border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-violet-700 dark:text-violet-200">
                                        {stageSummary.badge}
                                      </span>
                                    </>
                                  )}
                                  {interview.scheduledFor && (
                                    <>
                                      <span className="text-gray-400">&middot;</span>
                                      <span className="text-xs text-gray-600 dark:text-slate-300">
                                        {new Date(interview.scheduledFor).toLocaleDateString()}
                                      </span>
                                    </>
                                  )}
                                </div>
                                {pendingRescheduleRequest && (
                                  <p className="mt-2 inline-flex items-center rounded-full border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-200">
                                    Candidate requested reschedule
                                  </p>
                                )}
                              </div>
                            </div>
                            {hasInterviewSummaries && (
                              <div
                                data-testid={`interview-card-${interview.id}-summaries`}
                                className="space-y-2"
                              >
                                {stageSummary && (
                                  <div className={`rounded-lg border px-2.5 py-2 text-[11px] ${
                                    stageSummary.tone === 'emerald'
                                      ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                                      : stageSummary.tone === 'slate'
                                        ? 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/40 text-gray-600 dark:text-slate-300'
                                        : 'border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-200'
                                  }`}>
                                    <div className="flex items-start gap-1.5">
                                      <Icon name="Layers3" size={12} className="mt-0.5" />
                                      <div>
                                        <p className="font-semibold">{stageSummary.label}</p>
                                        <p className="mt-1 opacity-90">{stageSummary.stageName}</p>
                                        {stageSummary.detail && (
                                          <p className="mt-1 opacity-90">{stageSummary.detail}</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {scheduleDecisionSummary && (
                                  <div className={`rounded-lg border px-2.5 py-2 text-[11px] ${
                                    scheduleDecisionSummary.tone === 'emerald'
                                      ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                                      : scheduleDecisionSummary.tone === 'slate'
                                        ? 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/40 text-gray-600 dark:text-slate-300'
                                        : 'border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-200'
                                  }`}>
                                    <p className="font-semibold">{scheduleDecisionSummary.label}</p>
                                    {scheduleDecisionSummary.detail && (
                                      <p className="mt-1 opacity-90">{scheduleDecisionSummary.detail}</p>
                                    )}
                                  </div>
                                )}
                                {meetingLinkAutomationSummary && (
                                  <div className={`rounded-lg border px-2.5 py-2 text-[11px] ${
                                    meetingLinkAutomationSummary.tone === 'slate'
                                      ? 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/40 text-gray-600 dark:text-slate-300'
                                      : 'border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-200'
                                  }`}>
                                    <div className="flex items-start gap-1.5">
                                      <Icon name="Mail" size={12} className="mt-0.5" />
                                      <div>
                                        <p className="font-semibold">{meetingLinkAutomationSummary.label}</p>
                                        {meetingLinkAutomationSummary.detail && (
                                          <p className="mt-1 opacity-90">{meetingLinkAutomationSummary.detail}</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {reviewerAssignmentSummary && (
                                  <div className={`rounded-lg border px-2.5 py-2 text-[11px] ${
                                    reviewerAssignmentSummary.tone === 'amber'
                                      ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-200'
                                      : 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                                  }`}>
                                    <div className="flex items-start gap-1.5">
                                      <Icon name="Users" size={12} className="mt-0.5" />
                                      <div>
                                        <p className="font-semibold">{reviewerAssignmentSummary.label}</p>
                                        {reviewerAssignmentSummary.detail && (
                                          <p className="mt-1 opacity-90">{reviewerAssignmentSummary.detail}</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {reviewWorkflowSummary && (
                                  <div className={`rounded-lg border px-2.5 py-2 text-[11px] ${
                                    reviewWorkflowSummary.tone === 'emerald'
                                      ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                                      : reviewWorkflowSummary.tone === 'rose'
                                        ? 'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-200'
                                        : reviewWorkflowSummary.tone === 'amber'
                                          ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-200'
                                          : reviewWorkflowSummary.tone === 'blue'
                                            ? 'border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-200'
                                            : 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/40 text-gray-600 dark:text-slate-300'
                                  }`}>
                                    <div className="flex items-start gap-1.5">
                                      <Icon name={reviewWorkflowSummary.icon} size={12} className="mt-0.5" />
                                      <div>
                                        <p className="font-semibold">{reviewWorkflowSummary.label}</p>
                                        {reviewWorkflowSummary.detail && (
                                          <p className="mt-1 opacity-90">{reviewWorkflowSummary.detail}</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {reviewReminderSummary && (
                                  <div className={`rounded-lg border px-2.5 py-2 text-[11px] ${
                                    reviewReminderSummary.tone === 'amber'
                                      ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-200'
                                      : 'border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-200'
                                  }`}>
                                    <div className="flex items-start gap-1.5">
                                      <Icon name="BellRing" size={12} className="mt-0.5" />
                                      <div>
                                        <p className="font-semibold">{reviewReminderSummary.label}</p>
                                        {reviewReminderSummary.detail && (
                                          <p className="mt-1 opacity-90">{reviewReminderSummary.detail}</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {!pendingRescheduleRequest && interview.lastCandidateContact && (
                                  <p className="inline-flex items-center gap-1 rounded-full border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-700 dark:text-blue-200">
                                    <Icon name="MessageCircle" size={12} />
                                    Candidate message
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          <div
                            data-testid={`interview-card-${interview.id}-actions`}
                            className="flex flex-wrap items-center gap-2 sm:gap-3"
                          >
                            {getStatusBadge(interview.status)}
                            {canManageInterviewScheduling && (interview.status === 'SCHEDULED' || interview.status === 'PENDING' || !interview.scheduledFor) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                iconName={interview.scheduledFor ? 'CalendarClock' : 'CalendarPlus'}
                                onClick={() => setScheduleModal({
                                  interview: {
                                    ...interview,
                                    pendingRescheduleRequest,
                                  },
                                })}
                                className="rounded-full text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                title={interview.scheduledFor ? 'Reschedule' : 'Schedule'}
                              />
                            )}
                            {canManageInterviewScheduling && pendingRescheduleRequest && (
                              <Button
                                variant="ghost"
                                size="sm"
                                iconName="X"
                                onClick={() => handleRejectRescheduleRequest(interview)}
                                disabled={rescheduleActionLoadingId === interview.id}
                                className="rounded-full text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                title="Reject request"
                              />
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(interview)}
                              className="rounded-full"
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </motion.div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between gap-4 mt-6">
                    <div className="text-sm text-gray-600 dark:text-slate-400">
                      Showing {startIndex + 1} to {Math.min(endIndex, filteredInterviews.length)} of {filteredInterviews.length} interviews
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

              {/* Stats Summary */}
              {!loading && interviews.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
                    <div className="text-center">
                      <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-slate-100">
                        {interviews.length}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg sm:text-xl font-bold text-indigo-600 dark:text-indigo-400">
                        {interviews.filter(i => i.status === 'PENDING').length}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Pending</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400">
                        {interviews.filter(i => i.status === 'SCHEDULED').length}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Scheduled</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg sm:text-xl font-bold text-yellow-600 dark:text-yellow-400">
                        {interviews.filter(i => i.status === 'IN_PROGRESS').length}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">In Progress</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {interviews.filter(i => i.status === 'COMPLETED').length}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Completed</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.section>
          </main>
        </div>
      </div>

      {/* Interview Details Modal */}
      {showDetails && selectedInterview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowDetails(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                  Interview Details
                </h2>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <Icon name="X" className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Candidate</p>
                  <div className="flex items-center gap-3">
                    <div className="relative w-14 h-14 flex-shrink-0">
                      {selectedCandidateImageSrc && (
                        <img
                          src={selectedCandidateImageSrc}
                          alt={decodeHtmlEntities(
                            selectedInterview.candidate?.fullName
                            || selectedInterview.candidate?.email
                            || 'Candidate',
                          )}
                          className="w-full h-full rounded-full object-cover border border-white/40 dark:border-slate-700/50"
                          onError={(event) => {
                            const nextIndex = Number.parseInt(
                              event.currentTarget.dataset.fallbackIndex || '1',
                              10,
                            );
                            if (
                              Number.isInteger(nextIndex)
                              && nextIndex >= 0
                              && nextIndex < selectedCandidateImageSources.length
                            ) {
                              event.currentTarget.dataset.fallbackIndex = String(nextIndex + 1);
                              event.currentTarget.src = selectedCandidateImageSources[nextIndex];
                              return;
                            }
                            event.currentTarget.style.display = 'none';
                            const fallback = event.currentTarget.nextElementSibling;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                          data-fallback-index="1"
                        />
                      )}
                      <div className={`w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-500 items-center justify-center text-white text-sm font-semibold ${selectedCandidateImageSrc ? 'hidden' : 'flex'}`}>
                        {decodeHtmlEntities(
                          selectedInterview.candidate?.fullName
                          || selectedInterview.candidate?.email
                          || '?',
                        ).charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-slate-100 truncate">
                        {decodeHtmlEntities(
                          selectedInterview.candidate?.fullName
                          || selectedInterview.candidate?.email
                          || 'Unknown',
                        )}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-slate-400 truncate">
                        {decodeHtmlEntities(selectedInterview.candidate?.email || '')}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Job Role</p>
                  <p className="font-medium text-gray-900 dark:text-slate-100">
                    {decodeHtmlEntities(selectedInterview.jobRole || 'Not specified')}
                  </p>
                </div>

                {selectedStageSummary && (
                  <div className={`rounded-xl border p-3 space-y-2 ${
                    selectedStageSummary.tone === 'emerald'
                      ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10'
                      : selectedStageSummary.tone === 'slate'
                        ? 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/40'
                        : 'border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10'
                  }`}>
                    <div className="flex items-start gap-2">
                      <Icon
                        name="Layers3"
                        size={14}
                        className={
                          selectedStageSummary.tone === 'emerald'
                            ? 'text-emerald-600 dark:text-emerald-300 mt-0.5'
                            : selectedStageSummary.tone === 'slate'
                              ? 'text-gray-500 dark:text-slate-300 mt-0.5'
                              : 'text-violet-600 dark:text-violet-300 mt-0.5'
                        }
                      />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                          Interview stage
                        </p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">
                          {selectedStageSummary.label}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">
                          {selectedStageSummary.stageName}
                        </p>
                        {selectedStageSummary.detail && (
                          <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">
                            {selectedStageSummary.detail}
                          </p>
                        )}
                      </div>
                    </div>
                    {selectedStageTimeline.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedStageTimeline.map((stage) => (
                          <span
                            key={stage.id}
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                              stage.isCompleted
                                ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                                : stage.isCurrent
                                  ? 'border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-200'
                                  : 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/40 text-gray-600 dark:text-slate-300'
                            }`}
                          >
                            <span>{stage.sequence}</span>
                            <span>{stage.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedCurrentPlanStage && String(selectedInterview?.status || '').trim().toUpperCase() === 'COMPLETED' && !isReviewerOnly && (
                  <div className={`rounded-xl border p-4 space-y-3 ${
                    selectedStageOutcomeSummary?.tone === 'emerald'
                      ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10'
                      : selectedStageOutcomeSummary?.tone === 'rose'
                        ? 'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10'
                        : selectedStageOutcomeSummary?.tone === 'amber'
                          ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10'
                          : 'border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10'
                  }`}>
                    <div className="flex items-start gap-2">
                      <Icon
                        name="GitBranchPlus"
                        size={14}
                        className={
                          selectedStageOutcomeSummary?.tone === 'emerald'
                            ? 'text-emerald-600 dark:text-emerald-300 mt-0.5'
                            : selectedStageOutcomeSummary?.tone === 'rose'
                              ? 'text-rose-600 dark:text-rose-300 mt-0.5'
                              : selectedStageOutcomeSummary?.tone === 'amber'
                                ? 'text-amber-600 dark:text-amber-300 mt-0.5'
                                : 'text-blue-600 dark:text-blue-300 mt-0.5'
                        }
                      />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                          Stage outcome
                        </p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">
                          {selectedStageOutcomeSummary?.label || 'Record the decision for this completed stage'}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">
                          {selectedStageOutcomeSummary?.detail || 'Choose the decision that should govern progression for this interview round.'}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-2">
                          Advance rule: {selectedStageOutcomeSummary?.advanceRuleLabel || INTERVIEW_STAGE_ADVANCE_RULE_LABELS.PASS_REQUIRED}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {INTERVIEW_STAGE_OUTCOME_OPTIONS.map((option) => {
                        const selected = stageOutcomeValue === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setStageOutcomeValue(option.value);
                              setStageOutcomeError('');
                              setStageOutcomeSuccess('');
                            }}
                            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                              selected
                                ? option.value === 'PASS'
                                  ? 'border-emerald-500 bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                                  : option.value === 'FAIL'
                                    ? 'border-rose-500 bg-rose-600 text-white shadow-md shadow-rose-500/20'
                                    : 'border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/20'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500'
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
                        Outcome Note
                      </label>
                      <textarea
                        value={stageOutcomeNote}
                        onChange={(event) => {
                          setStageOutcomeNote(event.target.value);
                          setStageOutcomeError('');
                          setStageOutcomeSuccess('');
                        }}
                        rows={3}
                        maxLength={500}
                        placeholder="Explain why this round should pass, remain on hold, or fail."
                        className="w-full rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {(stageOutcomeError || stageOutcomeSuccess) && (
                      <p className={`text-xs ${stageOutcomeError ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
                        {stageOutcomeError || stageOutcomeSuccess}
                      </p>
                    )}

                    <div className="flex flex-wrap justify-end gap-2">
                      {selectedStageAutoAdvanceEnabled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSaveStageOutcome(false)}
                          disabled={!stageOutcomeDirty || stageOutcomeSaving}
                          className="rounded-full"
                        >
                          Save Outcome Only
                        </Button>
                      )}
                      {!selectedStageAutoAdvanceEnabled && selectedCanCreateNextStageFromOutcome && (
                        <Button
                          variant="outline"
                          size="sm"
                          iconName="BrandBrain"
                          onClick={() => handleSaveStageOutcome(true)}
                          disabled={!stageOutcomeDirty || stageOutcomeSaving}
                          className="rounded-full"
                        >
                          {stageOutcomeSaving ? 'Saving pass...' : 'Save Pass & Create Next Stage'}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        iconName="Save"
                        onClick={() => handleSaveStageOutcome()}
                        disabled={!stageOutcomeDirty || stageOutcomeSaving}
                        className="rounded-full"
                      >
                        {stageOutcomeSaving
                          ? (selectedStageAutoAdvanceEnabled ? 'Saving pass...' : 'Saving outcome...')
                          : (selectedStageAutoAdvanceEnabled ? 'Save Pass & Create Next Stage' : 'Save Stage Outcome')}
                      </Button>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Status</p>
                  {getStatusBadge(selectedInterview.status)}
                </div>

                {selectedInterview.scheduledFor && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Scheduled For</p>
                    <p className="font-medium text-gray-900 dark:text-slate-100">
                      {new Date(selectedInterview.scheduledFor).toLocaleString()}
                    </p>
                  </div>
                )}

                {selectedScheduleDecisionSummary && (
                  <div className={`rounded-xl border p-3 space-y-1.5 ${
                    selectedScheduleDecisionSummary.tone === 'emerald'
                      ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10'
                      : selectedScheduleDecisionSummary.tone === 'slate'
                        ? 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/40'
                        : 'border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10'
                  }`}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                      Slot decision
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                      {selectedScheduleDecisionSummary.label}
                    </p>
                    {selectedScheduleDecisionSummary.detail && (
                      <p className="text-xs text-gray-600 dark:text-slate-300">
                        {selectedScheduleDecisionSummary.detail}
                      </p>
                    )}
                  </div>
                )}

                {selectedMeetingLinkAutomationSummary && (
                  <div className={`rounded-xl border p-3 space-y-1.5 ${
                    selectedMeetingLinkAutomationSummary.tone === 'slate'
                      ? 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/40'
                      : 'border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10'
                  }`}>
                    <div className="flex items-start gap-2">
                      <Icon
                        name="Mail"
                        size={14}
                        className={
                          selectedMeetingLinkAutomationSummary.tone === 'slate'
                            ? 'text-gray-500 dark:text-slate-300 mt-0.5'
                            : 'text-blue-600 dark:text-blue-300 mt-0.5'
                        }
                      />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                          Meeting link delivery
                        </p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">
                          {selectedMeetingLinkAutomationSummary.label}
                        </p>
                        {selectedMeetingLinkAutomationSummary.detail && (
                          <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">
                            {selectedMeetingLinkAutomationSummary.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {selectedReviewerAssignmentSummary && (
                  <div className={`rounded-xl border p-3 space-y-1.5 ${
                    selectedReviewerAssignmentSummary.tone === 'amber'
                      ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10'
                      : 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10'
                  }`}>
                    <div className="flex items-start gap-2">
                      <Icon
                        name="Users"
                        size={14}
                        className={
                          selectedReviewerAssignmentSummary.tone === 'amber'
                            ? 'text-amber-600 dark:text-amber-300 mt-0.5'
                            : 'text-emerald-600 dark:text-emerald-300 mt-0.5'
                        }
                      />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                          Reviewer assignment
                        </p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">
                          {selectedReviewerAssignmentSummary.label}
                        </p>
                        {selectedReviewerAssignmentSummary.detail && (
                          <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">
                            {selectedReviewerAssignmentSummary.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {selectedReviewWorkflowSummary && (
                  <div className={`rounded-xl border p-3 space-y-1.5 ${
                    selectedReviewWorkflowSummary.tone === 'emerald'
                      ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10'
                      : selectedReviewWorkflowSummary.tone === 'rose'
                        ? 'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10'
                        : selectedReviewWorkflowSummary.tone === 'amber'
                          ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10'
                          : selectedReviewWorkflowSummary.tone === 'blue'
                            ? 'border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10'
                            : 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/40'
                  }`}>
                    <div className="flex items-start gap-2">
                      <Icon
                        name={selectedReviewWorkflowSummary.icon}
                        size={14}
                        className={
                          selectedReviewWorkflowSummary.tone === 'emerald'
                            ? 'text-emerald-600 dark:text-emerald-300 mt-0.5'
                            : selectedReviewWorkflowSummary.tone === 'rose'
                              ? 'text-rose-600 dark:text-rose-300 mt-0.5'
                              : selectedReviewWorkflowSummary.tone === 'amber'
                                ? 'text-amber-600 dark:text-amber-300 mt-0.5'
                                : selectedReviewWorkflowSummary.tone === 'blue'
                                  ? 'text-blue-600 dark:text-blue-300 mt-0.5'
                                  : 'text-gray-500 dark:text-slate-300 mt-0.5'
                        }
                      />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                          Review workflow
                        </p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">
                          {selectedReviewWorkflowSummary.label}
                        </p>
                        {selectedReviewWorkflowSummary.detail && (
                          <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">
                            {selectedReviewWorkflowSummary.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {selectedReviewReminderSummary && (
                  <div className={`rounded-xl border p-3 space-y-1.5 ${
                    selectedReviewReminderSummary.tone === 'amber'
                      ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10'
                      : 'border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10'
                  }`}>
                    <div className="flex items-start gap-2">
                      <Icon
                        name="BellRing"
                        size={14}
                        className={
                          selectedReviewReminderSummary.tone === 'amber'
                            ? 'text-amber-600 dark:text-amber-300 mt-0.5'
                            : 'text-blue-600 dark:text-blue-300 mt-0.5'
                        }
                      />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                          Reminder activity
                        </p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">
                          {selectedReviewReminderSummary.label}
                        </p>
                        {selectedReviewReminderSummary.detail && (
                          <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">
                            {selectedReviewReminderSummary.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {canManageInterviewScheduling && (
                  <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/40 p-3 sm:p-4 space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                          Review request admin
                        </p>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">
                          Manage reviewer coverage and due dates
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">
                          Assign review-capable team members, override due dates when needed, and track reminder timing from the interview record.
                        </p>
                      </div>
                      {reviewRequestEditorDirty && (
                        <span className="inline-flex min-w-max flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold leading-none text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                          <Icon name="CircleDashed" size={12} className="flex-shrink-0" />
                          Unsaved changes
                        </span>
                      )}
                    </div>

                    {reviewerOptionsError && (
                      <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
                        {reviewerOptionsError}
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                          Reviewer coverage
                        </p>
                        <span className="text-xs text-gray-500 dark:text-slate-400">
                          {reviewRequestEditorAssignments.length} assigned
                        </span>
                      </div>
                      {reviewerOptionsLoading ? (
                        <div className="rounded-xl border border-dashed border-gray-200 dark:border-slate-700 px-3 py-4 text-sm text-gray-500 dark:text-slate-400">
                          Loading review-capable team members...
                        </div>
                      ) : reviewerOptions.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 dark:border-slate-700 px-3 py-4 text-sm text-gray-500 dark:text-slate-400">
                          No active review-capable team members are available for assignment yet.
                        </div>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {reviewerOptions.map((option) => {
                            const checked = reviewRequestEditorAssignments.includes(option.value);
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => toggleReviewRequestAssignment(option.value)}
                                aria-pressed={checked}
                                className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                                  checked
                                    ? 'border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10'
                                    : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 hover:border-blue-200 dark:hover:border-blue-500/30'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <span className={`mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border ${
                                    checked
                                      ? 'border-blue-500 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-500'
                                      : 'border-gray-300 text-transparent dark:border-slate-500'
                                  }`}>
                                    <Icon name={checked ? 'Check' : 'Circle'} size={12} />
                                  </span>
                                  <div className="min-w-0 space-y-1">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                                      {option.label}
                                    </p>
                                    {option.roleLabel && (
                                      <p className="text-xs text-gray-500 dark:text-slate-400">
                                        {option.roleLabel}
                                      </p>
                                    )}
                                    {option.email && (
                                      <p className="break-all text-xs text-gray-500 dark:text-slate-400">
                                        {option.email}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                          Review due workflow
                        </p>
                        <span className="text-xs text-gray-500 dark:text-slate-400">
                          Automatic due dates follow the interview completion rules.
                        </span>
                      </div>

                      {selectedReviewRequestRows.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 dark:border-slate-700 px-3 py-4 text-sm text-gray-500 dark:text-slate-400">
                          Assign at least one reviewer to start the review workflow.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedReviewRequestRows.map((row) => (
                            <div
                              key={row.reviewerId}
                              className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 p-4 space-y-4"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                                    {row.name}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 break-all">
                                    {row.subtitle}
                                  </p>
                                </div>
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getReviewRequestToneClasses(row.stateMeta.tone)}`}>
                                  <Icon name={row.isCompleted ? 'ClipboardCheck' : 'Clock3'} size={12} />
                                  {row.stateMeta.label}
                                </span>
                              </div>

                              <div className="grid gap-3 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
                                <label className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/45 p-3 space-y-2">
                                  <span className="text-xs font-medium text-gray-600 dark:text-slate-300">
                                    Due mode
                                  </span>
                                  <div className="relative">
                                    <select
                                      value={row.dueSource}
                                      disabled={row.isCompleted || reviewRequestEditorSaving}
                                      onChange={(event) => updateReviewRequestConfig(row.reviewerId, {
                                        dueSource: event.target.value,
                                        ...(event.target.value === 'AUTO' ? { dueAt: '' } : {}),
                                      })}
                                      className="w-full appearance-none rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 px-3 py-2.5 pr-10 text-sm font-semibold text-gray-900 dark:text-slate-100"
                                      aria-label={`Due mode for ${row.name}`}
                                    >
                                      <option value="AUTO">Automatic</option>
                                      <option value="MANUAL">Manual due date</option>
                                    </select>
                                    <Icon
                                      name="ChevronDown"
                                      size={16}
                                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500"
                                    />
                                  </div>
                                </label>

                                {row.dueSource === 'MANUAL' ? (
                                  <label className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/45 p-3 space-y-2">
                                    <span className="text-xs font-medium text-gray-600 dark:text-slate-300">
                                      Manual due date
                                    </span>
                                    <input
                                      type="datetime-local"
                                      value={row.dueAt}
                                      disabled={row.isCompleted || reviewRequestEditorSaving}
                                      onChange={(event) => updateReviewRequestConfig(row.reviewerId, {
                                        dueAt: event.target.value,
                                      })}
                                      min={toLocalDatetimeValue(new Date(Date.now() + (5 * 60 * 1000)))}
                                      className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-slate-100"
                                      aria-label={`Manual due date for ${row.name}`}
                                    />
                                  </label>
                                ) : (
                                  <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/45 p-3">
                                    <div className="flex items-start gap-3">
                                      <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-200">
                                        <Icon name="CalendarClock" size={16} />
                                      </span>
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                                          Auto due date
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-slate-100">
                                          {row.request?.dueAt
                                            ? formatReviewRequestDateTime(row.request.dueAt)
                                            : 'Calculated after save'}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                                          Automatic due dates follow the interview completion rules.
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-xl border border-gray-100 dark:border-slate-700/70 bg-gray-50 dark:bg-slate-900/60 px-3 py-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                                    Reminder history
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-slate-100">
                                    {row.request?.lastReminderAt
                                      ? `Last reminder sent ${formatReviewRequestDateTime(row.request.lastReminderAt)}`
                                      : 'No reminder sent yet.'}
                                  </p>
                                  {Array.isArray(row.request?.reminderHistory) && row.request.reminderHistory.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {row.request.reminderHistory.slice(0, 3).map((entry, entryIndex) => (
                                        <p
                                          key={`${row.reviewerId}-reminder-${entry.sentAt || entryIndex}`}
                                          className="text-[11px] text-gray-500 dark:text-slate-400"
                                        >
                                          {describeReviewReminderHistoryEntry(entry)}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="rounded-xl border border-gray-100 dark:border-slate-700/70 bg-gray-50 dark:bg-slate-900/60 px-3 py-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                                    Current due date
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-slate-100">
                                    {row.request?.dueAt
                                      ? formatReviewRequestDateTime(row.request.dueAt)
                                      : row.dueSource === 'MANUAL' && row.dueAt
                                        ? new Date(row.dueAt).toLocaleString()
                                        : 'Will be assigned after save.'}
                                  </p>
                                </div>
                              </div>

                              <div className="rounded-xl border border-gray-100 dark:border-slate-700/70 bg-gray-50 dark:bg-slate-900/60 px-3 py-3">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="min-w-0 space-y-1">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                                      Manual reminder
                                    </p>
                                    {row.isCompleted && (
                                      <p className="text-xs text-emerald-700 dark:text-emerald-200">
                                        This reviewer has already submitted feedback. Completed review requests keep their recorded due date and reminder history.
                                      </p>
                                    )}
                                    {!row.isCompleted && reviewRequestEditorDirty && (
                                      <p className="text-xs text-amber-700 dark:text-amber-200">
                                        Save reviewer workflow changes before sending a manual reminder.
                                      </p>
                                    )}
                                    {!row.isCompleted && row.reminderCooldown.active && (
                                      <p className="text-xs text-gray-500 dark:text-slate-400">
                                        A reminder was sent recently. Manual reminders reopen after {MANUAL_REVIEW_REMINDER_COOLDOWN_HOURS} hours, at {formatReviewRequestDateTime(row.reminderCooldown.nextAvailableAt)}.
                                      </p>
                                    )}
                                    {!row.isCompleted && String(selectedInterview?.status || '').toUpperCase() !== 'COMPLETED' && (
                                      <p className="text-xs text-gray-500 dark:text-slate-400">
                                        Manual reminders become available after the interview is completed.
                                      </p>
                                    )}
                                    {!row.isCompleted
                                      && !reviewRequestEditorDirty
                                      && !row.reminderCooldown.active
                                      && String(selectedInterview?.status || '').toUpperCase() === 'COMPLETED' && (
                                      <p className="text-xs text-gray-500 dark:text-slate-400">
                                        Send a follow-up email when this reviewer needs a nudge.
                                      </p>
                                    )}
                                  </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSendManualReviewReminder(row.reviewerId, row.name)}
                                  disabled={
                                    row.isCompleted
                                    || String(selectedInterview?.status || '').toUpperCase() !== 'COMPLETED'
                                    || reviewRequestEditorSaving
                                    || Boolean(reviewReminderSendingId)
                                    || reviewRequestEditorDirty
                                    || row.reminderCooldown.active
                                  }
                                  className="shrink-0 rounded-full"
                                >
                                  {reviewReminderSendingId === row.reviewerId ? 'Sending...' : 'Send Reminder'}
                                </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {reviewRequestEditorError && (
                      <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-200">
                        {reviewRequestEditorError}
                      </div>
                    )}
                    {reviewRequestEditorSuccess && !reviewRequestEditorError && (
                      <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-200">
                        {reviewRequestEditorSuccess}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const nextState = buildReviewRequestEditorState(selectedInterview);
                          setReviewRequestEditorAssignments(nextState.assignments);
                          setReviewRequestEditorConfig(nextState.config);
                          setReviewRequestEditorInitialState(nextState);
                          setReviewRequestEditorError('');
                          setReviewRequestEditorSuccess('');
                        }}
                        disabled={reviewRequestEditorSaving || !reviewRequestEditorDirty}
                        className="rounded-full"
                      >
                        Reset
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleSaveReviewRequests}
                        disabled={reviewRequestEditorSaving || !reviewRequestEditorDirty}
                        className="rounded-full"
                      >
                        {reviewRequestEditorSaving ? 'Saving...' : 'Save reviewer workflow'}
                      </Button>
                    </div>
                  </div>
                )}

                {selectedPendingRescheduleRequest && (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-200">
                      Candidate reschedule request
                    </p>
                    <p className="text-sm text-amber-900 dark:text-amber-100">
                      {selectedPendingRescheduleRequest.reason}
                    </p>
                    {Array.isArray(selectedPendingRescheduleRequest.preferredSlots)
                      && selectedPendingRescheduleRequest.preferredSlots.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.08em] text-amber-700/80 dark:text-amber-200/80">
                          Preferred Slots
                        </p>
                        {selectedPendingRescheduleRequest.preferredSlots.map((slot) => (
                          <p
                            key={slot}
                            className="text-sm text-amber-900 dark:text-amber-100"
                          >
                            {new Date(slot).toLocaleString()}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!selectedPendingRescheduleRequest && selectedInterview.lastCandidateContact && (
                  <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-3 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Icon name="MessageCircle" size={14} className="text-blue-600 dark:text-blue-300" />
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700 dark:text-blue-200">
                        Message from {selectedInterview.lastCandidateContact.candidateName || 'candidate'}
                      </p>
                    </div>
                    <p className="text-sm text-blue-900 dark:text-blue-100 whitespace-pre-wrap">
                      {selectedInterview.lastCandidateContact.message}
                    </p>
                    <p className="text-[11px] text-blue-600/70 dark:text-blue-300/60">
                      {new Date(selectedInterview.lastCandidateContact.sentAt).toLocaleString()}
                    </p>
                    {canManageInterviewScheduling && (selectedInterview.status === 'SCHEDULED' || selectedInterview.status === 'PENDING' || !selectedInterview.scheduledFor) && (
                      <Button
                        variant="outline"
                        size="sm"
                        iconName="CalendarClock"
                        onClick={() => {
                          setShowDetails(false);
                          setScheduleModal({
                            interview: {
                              ...selectedInterview,
                              pendingRescheduleRequest: selectedPendingRescheduleRequest,
                            },
                          });
                        }}
                        className="mt-1 rounded-full border-blue-300 dark:border-blue-500/40 text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-500/20"
                      >
                        Reschedule Interview
                      </Button>
                    )}
                  </div>
                )}

                {selectedInterview.createdAt && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Created</p>
                    <p className="font-medium text-gray-900 dark:text-slate-100">
                      {new Date(selectedInterview.createdAt).toLocaleString()}
                    </p>
                  </div>
                )}

                {selectedInterview.endedAt && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Completed</p>
                    <p className="font-medium text-gray-900 dark:text-slate-100">
                      {new Date(selectedInterview.endedAt).toLocaleString()}
                    </p>
                  </div>
                )}

                {selectedInterview.overallScore && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Overall Score</p>
                    <p className="font-medium text-gray-900 dark:text-slate-100">
                      {selectedInterview.overallScore}%
                    </p>
                  </div>
                )}

                {selectedInterview.invitationId && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Linked to Invitation</p>
                    <p className="font-medium text-gray-900 dark:text-slate-100 text-sm">
                      {selectedInterview.invitationId}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6">
                {nextStageActionMessage && (
                  <div className="mb-4 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-4">
                    <p className="text-sm text-emerald-800 dark:text-emerald-100">
                      {nextStageActionMessage}
                    </p>
                  </div>
                )}
                {selectedInterview.status === 'COMPLETED' && !isReviewerOnly && (
                  <div className="mb-4 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <Icon
                        name="ClipboardList"
                        size={16}
                        className="text-amber-600 dark:text-amber-300 mt-0.5"
                      />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-200">
                          Structured scorecard
                        </p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">
                          Review evidence and submitted feedback in this workspace
                        </p>
                        <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">
                          Interactive scorecard submission is not enabled in this interview detail view yet. Use the AI evaluation, reviewer feedback, and interview evidence to complete your hiring decision.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {selectedInterview.status === 'COMPLETED' && !isReviewerOnly && selectedInterview.hasNextPlanStage && selectedStageOutcomeSummary && !selectedStageOutcomeSummary.canAdvance && (
                  <div className="mb-4 rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-4">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      Next stage creation is currently blocked
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-200 mt-1">
                      {selectedStageOutcomeSummary.detail}
                    </p>
                  </div>
                )}
                {selectedInterview.status === 'COMPLETED' && isReviewerOnly && (
                  <div className="mb-4 rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <Icon
                        name="ClipboardCheck"
                        size={16}
                        className="text-blue-600 dark:text-blue-300 mt-0.5"
                      />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-700 dark:text-blue-200">
                          Review workspace
                        </p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">
                          Submit reviewer feedback from Assigned Reviews
                        </p>
                        <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">
                          Interview details stay read-only here. Open the assigned reviews workspace to inspect evidence and submit or update your structured feedback.
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        iconName="ClipboardList"
                        onClick={() => openAssignedReviewsWorkspace(selectedInterview.id, 'review')}
                        className="rounded-full"
                      >
                        Open Assigned Reviews
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {canManageInterviewScheduling && (selectedInterview.status === 'SCHEDULED' || !selectedInterview.scheduledFor) && (
                    <Button
                      variant="outline"
                      size="sm"
                      iconName={selectedInterview.scheduledFor ? 'CalendarClock' : 'CalendarPlus'}
                      onClick={() => {
                        setShowDetails(false);
                        setScheduleModal({
                          interview: {
                            ...selectedInterview,
                            pendingRescheduleRequest: selectedPendingRescheduleRequest,
                          },
                        });
                      }}
                      className="flex-1"
                    >
                      {selectedPendingRescheduleRequest
                        ? 'Review & Reschedule'
                        : (selectedInterview.scheduledFor ? 'Reschedule' : 'Schedule')}
                    </Button>
                  )}
                  {canCreateNextInterviewStage(selectedInterview, canManageInterviewScheduling, isReviewerOnly) && (
                    <Button
                      variant="default"
                      size="sm"
                      iconName="ArrowRightCircle"
                      onClick={() => handleCreateNextStageInterview(selectedInterview)}
                      disabled={
                        nextStageActionLoadingId === selectedInterview.id
                        || stageOutcomeDirty
                        || !canAdvanceInterviewStageClient(selectedInterview)
                      }
                      className="flex-1"
                    >
                      {nextStageActionLoadingId === selectedInterview.id
                        ? 'Creating next round...'
                        : stageOutcomeDirty
                          ? 'Save Stage Outcome First'
                          : !canAdvanceInterviewStageClient(selectedInterview)
                            ? 'Stage Outcome Blocks Progression'
                            : 'Create Next Stage Interview'}
                    </Button>
                  )}
                  {selectedCanMoveToOffer && (
                    <Button
                      variant="default"
                      size="sm"
                      iconName="Briefcase"
                      onClick={() => handleMoveApplicationToOffer(selectedInterview)}
                      disabled={offerActionLoadingId === selectedInterview.id || stageOutcomeDirty}
                      className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {offerActionLoadingId === selectedInterview.id
                        ? 'Moving to Offer...'
                        : stageOutcomeDirty
                          ? 'Save Stage Outcome First'
                          : 'Move to Offer'}
                    </Button>
                  )}
                  {canManageInterviewScheduling && selectedPendingRescheduleRequest && (
                    <Button
                      variant="ghost"
                      size="sm"
                      iconName="X"
                      onClick={() => handleRejectRescheduleRequest(selectedInterview)}
                      disabled={rescheduleActionLoadingId === selectedInterview.id}
                      className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                    >
                      Reject Request
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      {/* Schedule / Reschedule Modal */}
      {canManageInterviewScheduling && scheduleModal && (
        <ScheduleInterviewModal
          interview={scheduleModal.interview}
          isOpen={true}
          onClose={() => setScheduleModal(null)}
          onScheduled={() => { loadInterviews(); }}
        />
      )}
    </div>
  );
};

export default CompanyInterviews;
