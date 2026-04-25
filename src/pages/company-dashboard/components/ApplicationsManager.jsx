import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import LoadingState from '../../../components/ui/LoadingState';
import UnifiedFilterPanel, {
  FILTER_DATE_GRID_CLASS,
  FILTER_GRID_CLASS,
  FILTER_SUBPANEL_CLASS,
  UnifiedFilterField,
  UnifiedFilterSelect,
  UnifiedFilterToggleButton,
  UnifiedSearchField,
  UnifiedTextInput,
} from '../../../components/ui/UnifiedFilterPanel';
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
import { hasPermission } from '../../../utils/rolePermissions';
import {
  COMPANY_APPLICATION_DATE_PRESET_FILTER_OPTIONS,
  COMPANY_APPLICATION_JOB_STATE_FILTER_OPTIONS,
  COMPANY_APPLICATION_REVIEW_STATE_FILTER_OPTIONS,
  COMPANY_APPLICATION_SORT_FILTER_OPTIONS,
  COMPANY_APPLICATION_STATUS_FILTER_OPTIONS,
  DEFAULT_COMPANY_APPLICATION_FILTERS,
  buildCompanyApplicationFilterOptions,
  countActiveCompanyFilters,
  filterCompanyApplications,
  getDerivedApplicationStatus,
  groupCompanyApplicationsByJob,
} from '../utils/companyApplicationFilters.js';
import {
  buildManualWindowBounds,
  buildSuggestedManualSlots,
  formatMinutesOfDay,
  formatWorkingDays,
  getAvailabilitySourceLabel,
  toLocalDatetimeValue,
  validateManualInterviewSelection,
} from '../../../utils/interviewSchedulingGuidance.js';
import { buildReviewerAssignmentOptions } from '../../../utils/reviewerAssignments.js';
import {
  formatOfferCompensation,
  formatOfferHistoryEventLabel,
} from '../../../utils/applicationOfferPresentation.js';
import {
  buildInitialOfferDraft,
  buildOfferPayloadFromDraft,
  OFFER_COMPENSATION_PERIOD_OPTIONS,
  validateOfferDraft,
} from '../../../utils/applicationOfferForm.js';
import { getApplicationOfferStageEligibility } from '../../../utils/interviewRoundSummary.js';

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

const getStatusConfig = (applicationOrStatus, withdrawnBy = null, dispositionCode = null) => {
  const application = typeof applicationOrStatus === 'object' && applicationOrStatus !== null
    ? applicationOrStatus
    : {
      status: applicationOrStatus,
      withdrawnBy,
      dispositionCode,
    };
  const derivedStatus = getDerivedApplicationStatus(application);

  if (derivedStatus === 'WITHDRAWN') {
    return {
      label: 'Withdrew',
      color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      icon: 'XCircle',
    };
  }

  if (derivedStatus === 'POSITION_CLOSED') {
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
      icon: 'BrandBrain',
    },
    OFFER: {
      label: 'Offer',
      color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
      icon: 'Briefcase',
    },
    REJECTED: {
      label: 'Not Selected',
      color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200',
      icon: 'XCircle',
    },
    HIRED: {
      label: 'Hired',
      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      icon: 'CheckCircle',
    },
    UNKNOWN: {
      label: 'Unknown',
      color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
      icon: 'HelpCircle',
    },
  };
  return configs[derivedStatus] || configs.UNKNOWN;
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

const INTERVIEW_SCHEDULING_DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
  { value: 90, label: '90 min' },
];

const resolveLocalTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const getDefaultInterviewingDatetime = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 60 - (date.getMinutes() % 30));
  date.setSeconds(0, 0);
  return toLocalDatetimeValue(date);
};

const getDemoInterviewingDatetime = () => {
  const date = new Date(Date.now() + (2 * 60 * 1000));
  date.setSeconds(0, 0);
  return toLocalDatetimeValue(date);
};

const getMinimumInterviewingDatetime = () => {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(date.getMinutes() + 1);
  return toLocalDatetimeValue(date);
};

const buildInitialInterviewingScheduleState = (applicationId = null) => ({
  open: false,
  applicationId,
  mode: 'AUTO',
  scheduledFor: getDefaultInterviewingDatetime(),
  timezone: resolveLocalTimezone(),
  duration: 30,
  notes: '',
  error: '',
  schedulingConstraints: null,
  constraintsLoading: false,
  constraintsError: '',
  reviewerAssignments: [],
  reviewerOptions: [],
  reviewerOptionsLoading: false,
  reviewerOptionsError: '',
  demoBypassAvailability: false,
});

const OFFER_STATUS_LABELS = {
  PENDING: 'Pending Candidate Response',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
};

const decodeHtmlEntities = (value) => {
  if (typeof value !== 'string') return value || '';
  if (!value.includes('&')) return value;
  if (typeof document === 'undefined') return value;
  const decoder = document.createElement('textarea');
  decoder.innerHTML = value;
  return decoder.value;
};

const normalizeQuestionDefs = (job) => {
  const rawQuestions = Array.isArray(job?.applicationQuestions) && job.applicationQuestions.length > 0
    ? job.applicationQuestions
    : (Array.isArray(job?.customFormFields) ? job.customFormFields : []);

  return rawQuestions
    .map((rawQuestion, index) => {
      const question = rawQuestion && typeof rawQuestion === 'object'
        ? rawQuestion
        : { question: rawQuestion };
      const id = String(question.id || `question_${index + 1}`).trim() || `question_${index + 1}`;
      const prompt = decodeHtmlEntities(String(question.question || question.label || '').trim());
      if (!prompt) return null;
      return {
        id,
        prompt,
      };
    })
    .filter(Boolean);
};

const buildApplicationResponses = (application) => {
  const answers = Array.isArray(application?.answers) ? application.answers : [];
  const questionDefs = normalizeQuestionDefs(application?.job || {});
  const questionsById = new Map(questionDefs.map((question) => [question.id, question]));
  const usedQuestionIds = new Set();

  const rows = answers.map((rawAnswer, index) => {
    const answer = rawAnswer && typeof rawAnswer === 'object'
      ? rawAnswer
      : { answer: String(rawAnswer ?? '') };
    const questionId = String(answer.questionId || answer.id || '').trim();
    const mappedQuestion = questionId ? questionsById.get(questionId) : null;
    if (mappedQuestion?.id) usedQuestionIds.add(mappedQuestion.id);
    const prompt = decodeHtmlEntities(
      String(answer.question || answer.label || mappedQuestion?.prompt || `Question ${index + 1}`).trim(),
    );
    const responseValue = answer.answer ?? answer.value ?? '';
    const response = decodeHtmlEntities(String(responseValue || '').trim());
    return {
      id: questionId || `answer_${index + 1}`,
      prompt,
      response: response || 'No response provided',
      isMissing: !response,
    };
  });

  questionDefs.forEach((question) => {
    if (usedQuestionIds.has(question.id)) return;
    rows.push({
      id: `missing_${question.id}`,
      prompt: question.prompt,
      response: 'No response provided',
      isMissing: true,
    });
  });

  return rows;
};

const STATUS_SELECTION_OPTIONS = ['SCREENING', 'INTERVIEWING', 'SHORTLISTED', 'OFFER', 'REJECTED', 'HIRED'];

const getPrimaryActionConfig = ({
  application,
  pendingStatus,
  canUpdateStatus,
  canOpenInterviewWorkspace,
}) => {
  if (!application) {
    return {
      label: 'Confirm Status',
      icon: 'CheckCircle',
      disabled: true,
      action: 'none',
      helperText: 'Select an application to continue.',
    };
  }

  const derivedStatus = getDerivedApplicationStatus(application);
  const hasInterview = Boolean(application.interviewId);
  const selectedStatus = pendingStatus || (STATUS_SELECTION_OPTIONS.includes(derivedStatus) ? derivedStatus : null);
  const hasPendingStatusChange = Boolean(
    canUpdateStatus
    && selectedStatus
    && selectedStatus !== derivedStatus,
  );

  if (hasPendingStatusChange) {
    const selectedConfig = getStatusConfig(
      selectedStatus,
      null,
      selectedStatus === 'REJECTED' ? 'NOT_SELECTED' : null,
    );
    const offerEligibility = selectedStatus === 'OFFER'
      ? getApplicationOfferStageEligibility(application)
      : { allowed: true, reason: null };
    if (selectedStatus === 'OFFER' && !offerEligibility.allowed) {
      return {
        label: `Confirm: ${selectedConfig.label}`,
        icon: 'CheckCircle',
        disabled: true,
        action: 'confirm_status',
        helperText: offerEligibility.reason || 'This application is not ready for the offer stage yet.',
      };
    }
    const helperText = selectedStatus === 'INTERVIEWING'
      ? 'This moves the candidate to Interviewing. You can auto-schedule or pick the interview date now.'
      : selectedStatus === 'OFFER'
        ? 'This confirms the interviews are complete and moves the candidate into the offer stage.'
      : `This will update the application status to ${selectedConfig.label}.`;
    return {
      label: `Confirm: ${selectedConfig.label}`,
      icon: 'CheckCircle',
      disabled: false,
      action: 'confirm_status',
      helperText,
    };
  }

  if (derivedStatus === 'WITHDRAWN') {
    return {
      label: 'Application Withdrawn',
      icon: 'XCircle',
      disabled: true,
      action: 'none',
      helperText: 'Candidate withdrew this application.',
    };
  }

  if (derivedStatus === 'POSITION_CLOSED') {
    return {
      label: 'Position Closed',
      icon: 'Archive',
      disabled: true,
      action: 'none',
      helperText: 'This job is closed.',
    };
  }

  if (derivedStatus === 'INTERVIEWING') {
    if (hasInterview && canOpenInterviewWorkspace) {
      return {
        label: 'Open Interview',
        icon: 'Calendar',
        disabled: false,
        action: 'open_interview',
        helperText: 'Interview record is ready. Open the interview workspace to inspect reviews and scheduling details.',
      };
    }
    return {
      label: 'Preparing Interview',
      icon: 'Clock',
      disabled: true,
      action: 'none',
      helperText: 'Interview record is being prepared. Refresh in a moment.',
    };
  }

  if (hasInterview && canOpenInterviewWorkspace) {
    return {
      label: 'Open Interview',
      icon: 'Calendar',
      disabled: false,
      action: 'open_interview',
      helperText: 'Open the linked interview workspace to inspect recordings, scorecards, and reviewer feedback.',
    };
  }

  if (derivedStatus === 'SCREENING') {
    return {
      label: 'Screening In Progress',
      icon: 'Eye',
      disabled: true,
      action: 'none',
      helperText: 'Screening means CV/profile review only. Select Interviewing above, then confirm.',
    };
  }

  if (derivedStatus === 'SUBMITTED') {
    return {
      label: 'Select Status To Confirm',
      icon: 'ArrowRight',
      disabled: true,
      action: 'none',
      helperText: 'Choose a status above and confirm.',
    };
  }

  return {
    label: 'Select Status To Confirm',
    icon: 'CheckCircle',
    disabled: true,
    action: 'none',
    helperText: 'Choose a status above and confirm.',
  };
};

const ApplicationsManager = ({ jobId = null, canUpdateStatus = true }) => {
  const navigate = useNavigate();
  const { organization, user } = useAuth();
  const organizationRole = user?.organizationContext?.membership?.role;
  const canStartReview = hasPermission(organizationRole, 'START_CANDIDATE_REVIEW');
  const canOpenInterviewWorkspace = hasPermission(organizationRole, 'VIEW_INTERVIEWS')
    && hasPermission(organizationRole, 'SUBMIT_REVIEWS');
  const isReviewerOnly = organizationRole === 'REVIEWER';
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [modalError, setModalError] = useState('');
  const [filters, setFilters] = useState(DEFAULT_COMPANY_APPLICATION_FILTERS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [updating, setUpdating] = useState(null);
  const [expandedJobs, setExpandedJobs] = useState(new Set());
  const [startingReview, setStartingReview] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [offerDraft, setOfferDraft] = useState(() => buildInitialOfferDraft(null));
  const [savingOffer, setSavingOffer] = useState(false);
  const [resendingOffer, setResendingOffer] = useState(false);
  const [offerSuccess, setOfferSuccess] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(3);
  const [rejectionModal, setRejectionModal] = useState({ open: false, applicationId: null, dispositionCode: 'PASSED_ON', notes: '' });
  const [interviewingScheduleModal, setInterviewingScheduleModal] = useState(() => buildInitialInterviewingScheduleState());
  const realtimeRefreshTimeoutRef = useRef(null);
  const loadApplicationsRef = useRef(null);

  const manualInterviewingWindowBounds = useMemo(
    () => buildManualWindowBounds(interviewingScheduleModal.schedulingConstraints),
    [interviewingScheduleModal.schedulingConstraints],
  );
  const manualInterviewingValidationMessage = interviewingScheduleModal.mode === 'MANUAL'
      && !interviewingScheduleModal.demoBypassAvailability
    ? validateManualInterviewSelection({
      scheduledFor: interviewingScheduleModal.scheduledFor,
      duration: interviewingScheduleModal.duration,
      constraints: interviewingScheduleModal.schedulingConstraints,
      requiresAvailabilityChecks: true,
    })
    : null;
  const manualInterviewingSlots = useMemo(
    () => (
      interviewingScheduleModal.mode === 'MANUAL'
        ? buildSuggestedManualSlots({
          constraints: interviewingScheduleModal.schedulingConstraints,
          duration: interviewingScheduleModal.duration,
          requiresAvailabilityChecks: true,
        })
        : []
    ),
    [
      interviewingScheduleModal.duration,
      interviewingScheduleModal.mode,
      interviewingScheduleModal.schedulingConstraints,
    ],
  );
  const showInterviewingTimezoneTranslation = Boolean(
    interviewingScheduleModal.schedulingConstraints?.timezone
    && interviewingScheduleModal.schedulingConstraints.timezone !== resolveLocalTimezone(),
  );

  useEffect(() => {
    loadApplications();
  }, [jobId]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, jobId]);

  const updateFilter = (key, value) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters(DEFAULT_COMPANY_APPLICATION_FILTERS);
  };

  const loadApplications = async () => {
    try {
      setLoading(true);
      setPageError('');
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
        setPageError('Failed to load applications');
      }
    } catch (err) {
      setPageError(err.message || 'Failed to load applications');
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

  const REJECTION_DISPOSITION_OPTIONS = APPLICATION_DISPOSITION_OPTIONS.filter(
    (item) => item.value !== 'CANDIDATE_WITHDREW' && item.value !== 'JOB_CLOSED' && item.value !== 'HIRED',
  );

  const closeInterviewingScheduleModal = () => {
    setInterviewingScheduleModal(buildInitialInterviewingScheduleState());
  };

  const openInterviewingScheduleModal = (applicationId) => {
    setInterviewingScheduleModal({
      ...buildInitialInterviewingScheduleState(applicationId),
      open: true,
    });
  };

  const toggleInterviewingReviewerAssignment = (reviewerId) => {
    setInterviewingScheduleModal((previous) => ({
      ...previous,
      reviewerAssignments: previous.reviewerAssignments.includes(reviewerId)
        ? previous.reviewerAssignments.filter((value) => value !== reviewerId)
        : [...previous.reviewerAssignments, reviewerId],
    }));
  };

  const applyInterviewingDemoBypass = () => {
    setInterviewingScheduleModal((previous) => {
      const currentNotes = previous.notes || '';
      const marker = 'Temporary demo scheduling bypass used.';
      return {
        ...previous,
        mode: 'MANUAL',
        scheduledFor: getDemoInterviewingDatetime(),
        demoBypassAvailability: true,
        error: '',
        notes: currentNotes.includes(marker)
          ? currentNotes
          : `${currentNotes}${currentNotes ? '\n' : ''}${marker}`,
      };
    });
  };

  useEffect(() => {
    if (!interviewingScheduleModal.open || !interviewingScheduleModal.applicationId) {
      return undefined;
    }

    let cancelled = false;
    setInterviewingScheduleModal((previous) => ({
      ...previous,
      constraintsLoading: true,
      constraintsError: '',
      schedulingConstraints: null,
      reviewerOptionsLoading: true,
      reviewerOptionsError: '',
      reviewerOptions: [],
    }));

    const loadSchedulingPreview = async () => {
      try {
        const [applicationResult, memberResult] = await Promise.allSettled([
          apiClient.applications.getApplication(interviewingScheduleModal.applicationId),
          apiClient.organizations.listMembers(),
        ]);
        if (cancelled) return;

        if (applicationResult.status !== 'fulfilled') {
          throw applicationResult.reason;
        }

        const preview = applicationResult.value?.application?.interviewSchedulingPreview || null;
        const previewError = applicationResult.value?.application?.interviewSchedulingPreviewError?.message || '';
        const reviewerOptions = memberResult.status === 'fulfilled'
          ? buildReviewerAssignmentOptions(memberResult.value?.members || [])
          : [];
        const reviewerOptionsError = memberResult.status === 'rejected'
          ? (memberResult.reason?.message || 'Unable to load reviewer options right now.')
          : '';
        setInterviewingScheduleModal((previous) => ({
          ...previous,
          schedulingConstraints: preview,
          constraintsError: previewError,
          constraintsLoading: false,
          reviewerOptions,
          reviewerOptionsError,
          reviewerOptionsLoading: false,
          timezone: (
            !previous.timezone
            || previous.timezone === resolveLocalTimezone()
          )
            ? (preview?.timezone || previous.timezone || resolveLocalTimezone())
            : previous.timezone,
        }));
      } catch (loadError) {
        if (cancelled) return;
        setInterviewingScheduleModal((previous) => ({
          ...previous,
          schedulingConstraints: null,
          constraintsError: loadError?.message || 'Unable to load scheduling rules right now.',
          constraintsLoading: false,
          reviewerOptions: [],
          reviewerOptionsError: loadError?.message || 'Unable to load reviewer options right now.',
          reviewerOptionsLoading: false,
        }));
      }
    };

    loadSchedulingPreview();
    return () => {
      cancelled = true;
    };
  }, [interviewingScheduleModal.applicationId, interviewingScheduleModal.open]);

  const handleStatusChange = async (applicationId, newStatus, options = {}) => {
    const {
      interviewSchedulingMode = null,
      manualSchedule = null,
      reviewerAssignments = undefined,
    } = options;

    if (newStatus === 'REJECTED') {
      setRejectionModal({ open: true, applicationId, dispositionCode: REJECTION_DISPOSITION_OPTIONS[0]?.value || 'PASSED_ON', notes: '' });
      return false;
    }

    let statusUpdated = false;
    let statusResult = null;
    let finalInterview = null;

    try {
      setUpdating(applicationId);
      const payload = { status: newStatus };
      if (newStatus === 'INTERVIEWING' && interviewSchedulingMode) {
        payload.interviewSchedulingMode = interviewSchedulingMode;
      }
      if (Array.isArray(reviewerAssignments)) {
        payload.reviewerAssignments = reviewerAssignments;
      }

      statusResult = await apiClient.applications.updateStatus(applicationId, payload);
      if (statusResult.success) {
        statusUpdated = true;
        finalInterview = statusResult?.interview || null;

        const shouldManualSchedule = newStatus === 'INTERVIEWING'
          && interviewSchedulingMode === 'MANUAL'
          && manualSchedule;

        if (shouldManualSchedule) {
          let interviewId = finalInterview?.id || statusResult?.application?.interviewId || null;
          if (!interviewId) {
            const refreshedApplication = await apiClient.applications.getApplication(applicationId);
            interviewId = refreshedApplication?.application?.interviewId || null;
          }

          if (!interviewId) {
            throw new Error('Status was updated, but interview record is not ready yet. Refresh and schedule from Interviews.');
          }

          const scheduledDate = manualSchedule?.scheduledFor ? new Date(manualSchedule.scheduledFor) : null;
          if (!scheduledDate || Number.isNaN(scheduledDate.getTime())) {
            throw new Error('Please select a valid interview date and time.');
          }
          if (scheduledDate.getTime() <= Date.now()) {
            throw new Error('Please select a future interview date and time.');
          }

          const schedulePayload = {
            scheduledFor: scheduledDate.toISOString(),
            strategy: 'MANUAL',
            timezone: manualSchedule?.timezone?.trim() || resolveLocalTimezone(),
            duration: Number.isFinite(Number(manualSchedule?.duration)) ? Number(manualSchedule.duration) : 30,
            notes: manualSchedule?.notes?.trim() || '',
            reviewerAssignments: Array.isArray(manualSchedule?.reviewerAssignments)
              ? manualSchedule.reviewerAssignments
              : [],
            ...(manualSchedule?.demoBypassAvailability ? { demoBypassAvailability: true } : {}),
          };

          const scheduleResult = await apiClient.interviews.schedule(interviewId, schedulePayload);
          finalInterview = scheduleResult?.interview || finalInterview;
        }

        await loadApplications();
        if (selectedApplication?.id === applicationId) {
          setSelectedApplication((previous) => ({
            ...(previous || {}),
            ...(statusResult.application || {}),
            interviewId: finalInterview?.id || statusResult?.interview?.id || statusResult?.application?.interviewId || previous?.interviewId || null,
          }));
          setPendingStatus(newStatus);
        }
      }
      return Boolean(statusResult?.success);
    } catch (err) {
      const actionMessage = statusUpdated && newStatus === 'INTERVIEWING' && interviewSchedulingMode === 'MANUAL'
        ? 'Status updated to Interviewing, but scheduling failed: '
        : 'Failed to update status: ';
      setModalError(actionMessage + (err.message || 'Please try again.'));
      setTimeout(() => setModalError(''), 5000);
      return false;
    } finally {
      setUpdating(null);
    }
  };

  const handleConfirmInterviewingTransition = async () => {
    const modal = interviewingScheduleModal;
    if (!modal?.applicationId) return;

    if (modal.mode === 'MANUAL') {
      const blockingMessage = modal.constraintsLoading
        ? 'Loading assigned scheduling availability...'
        : ((modal.demoBypassAvailability ? null : modal.constraintsError) || manualInterviewingValidationMessage);
      if (blockingMessage) {
        setInterviewingScheduleModal((previous) => ({
          ...previous,
          error: blockingMessage,
        }));
        return;
      }

      const scheduledDate = modal.scheduledFor ? new Date(modal.scheduledFor) : null;
      if (scheduledDate.getTime() <= Date.now()) {
        setInterviewingScheduleModal((previous) => ({
          ...previous,
          error: 'Interview date and time must be in the future.',
        }));
        return;
      }
    }

    setInterviewingScheduleModal((previous) => ({ ...previous, error: '' }));
    const wasUpdated = await handleStatusChange(modal.applicationId, 'INTERVIEWING', {
      interviewSchedulingMode: modal.mode,
      reviewerAssignments: modal.reviewerAssignments,
      manualSchedule: modal.mode === 'MANUAL'
        ? {
          scheduledFor: modal.scheduledFor,
          timezone: modal.timezone,
          duration: modal.duration,
          notes: modal.notes,
          reviewerAssignments: modal.reviewerAssignments,
          demoBypassAvailability: modal.demoBypassAvailability,
        }
        : null,
    });
    if (wasUpdated) {
      closeInterviewingScheduleModal();
    }
  };

  const confirmRejection = async () => {
    const { applicationId, dispositionCode, notes } = rejectionModal;
    setRejectionModal({ open: false, applicationId: null, dispositionCode: 'PASSED_ON', notes: '' });
    const selectedOption = REJECTION_DISPOSITION_OPTIONS.find((o) => o.value === dispositionCode) || REJECTION_DISPOSITION_OPTIONS[0];
    const payload = {
      status: 'REJECTED',
      dispositionCode: selectedOption?.value,
      dispositionCategory: selectedOption?.category,
      dispositionReason: selectedOption?.reason || selectedOption?.label,
      dispositionNotes: notes?.trim() || null,
    };
    try {
      setUpdating(applicationId);
      const result = await apiClient.applications.updateStatus(applicationId, payload);
      if (result.success) {
        await loadApplications();
        if (selectedApplication?.id === applicationId) {
          setSelectedApplication((previous) => ({
            ...(previous || {}),
            ...(result.application || {}),
            interviewId: result?.interview?.id || result?.application?.interviewId || previous?.interviewId || null,
          }));
          setPendingStatus('REJECTED');
        }
      }
    } catch (err) {
      setModalError('Failed to reject application: ' + (err.message || 'Please try again.'));
      setTimeout(() => setModalError(''), 5000);
    } finally {
      setUpdating(null);
    }
  };

  const isWithdrawn = (application) => {
    return application.status === 'REJECTED' && application.withdrawnBy;
  };

  const handleViewDetails = (application) => {
    setSelectedApplication(application);
    setModalError('');
    setOfferSuccess('');
    setOfferDraft(buildInitialOfferDraft(application));
    const derivedStatus = getDerivedApplicationStatus(application);
    setPendingStatus(STATUS_SELECTION_OPTIONS.includes(derivedStatus) ? derivedStatus : null);
    setShowDetails(true);
  };

  const handleOfferDraftFieldChange = (field, value) => {
    setOfferDraft((previous) => ({
      ...previous,
      [field]: value,
    }));
    setOfferSuccess('');
  };

  const handleSaveOffer = async () => {
    if (!selectedApplication) return;
    const validationMessage = validateOfferDraft(offerDraft);
    if (validationMessage) {
      setModalError(validationMessage);
      setTimeout(() => setModalError(''), 5000);
      return;
    }

    try {
      setSavingOffer(true);
      setModalError('');
      setOfferSuccess('');
      const payload = buildOfferPayloadFromDraft(offerDraft);
      const result = await apiClient.applications.upsertOffer(selectedApplication.id, payload);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to save offer details.');
      }

      await loadApplications();
      setSelectedApplication((previous) => ({
        ...(previous || {}),
        ...(result.application || {}),
      }));
      setOfferDraft(buildInitialOfferDraft(result.application || selectedApplication));
      setOfferSuccess(result.message || 'Offer details saved.');
    } catch (error) {
      setModalError(error.message || 'Failed to save offer details.');
      setTimeout(() => setModalError(''), 5000);
    } finally {
      setSavingOffer(false);
    }
  };

  const handleResendOffer = async () => {
    if (!selectedApplication?.id || !canEditOffer) return;

    setResendingOffer(true);
    setOfferSuccess('');
    setModalError('');
    try {
      const result = await apiClient.applications.resendOffer(selectedApplication.id);
      if (!result?.success || !result?.application) {
        throw new Error(result?.error || 'Failed to resend offer.');
      }

      setSelectedApplication((previous) => (
        previous?.id === result.application.id
          ? { ...previous, ...result.application }
          : previous
      ));
      setOfferSuccess(result.message || 'Offer email resent successfully.');
      await loadApplications();
    } catch (error) {
      setModalError(error.message || 'Failed to resend offer.');
    } finally {
      setResendingOffer(false);
    }
  };

  const handleStartReview = async () => {
    if (!canOpenInterviewWorkspace) {
      setModalError('You do not have permission to access interview reviews.');
      setTimeout(() => setModalError(''), 5000);
      return;
    }

    if (!selectedApplication || !selectedApplication.candidateId) return;
    const derivedStatus = getDerivedApplicationStatus(selectedApplication);

    if (derivedStatus !== 'INTERVIEWING') {
      setModalError('Set status to Interviewing before starting interview review.');
      setTimeout(() => setModalError(''), 5000);
      return;
    }

    try {
      setStartingReview(true);
      setModalError('');

      let interviewId = selectedApplication.interviewId;

      if (!interviewId && derivedStatus === 'INTERVIEWING') {
        const refreshed = await apiClient.applications.getApplication(selectedApplication.id);
        interviewId = refreshed?.application?.interviewId || null;
      }

      if (interviewId) {
        navigate(`/company-interviews?interviewId=${encodeURIComponent(interviewId)}`);
        setShowDetails(false);
      } else {
        throw new Error('Interview is still being auto-scheduled. Please refresh and try again.');
      }
    } catch (err) {
      setModalError(err.message || 'Failed to start review. Please try again.');
      setTimeout(() => setModalError(''), 5000);
    } finally {
      setStartingReview(false);
    }
  };

  const handlePrimaryAction = async () => {
    if (!selectedApplication) return;
    const actionConfig = getPrimaryActionConfig({
      application: selectedApplication,
      pendingStatus,
      canUpdateStatus,
      canOpenInterviewWorkspace,
    });

    if (actionConfig.disabled) {
      if (actionConfig.helperText) {
        setModalError(actionConfig.helperText);
        setTimeout(() => setModalError(''), 5000);
      }
      return;
    }

    if (actionConfig.action === 'confirm_status') {
      if (!pendingStatus) return;
      if (
        pendingStatus === 'INTERVIEWING'
        && getDerivedApplicationStatus(selectedApplication) !== 'INTERVIEWING'
      ) {
        openInterviewingScheduleModal(selectedApplication.id);
        return;
      }
      await handleStatusChange(selectedApplication.id, pendingStatus);
      return;
    }

    if (actionConfig.action === 'open_interview') {
      await handleStartReview();
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

  const effectiveFilters = useMemo(
    () => (jobId ? { ...filters, jobFilter: String(jobId) } : filters),
    [filters, jobId],
  );

  const filteredApplications = useMemo(
    () => filterCompanyApplications(applications, effectiveFilters),
    [applications, effectiveFilters],
  );

  const groupedApplications = useMemo(
    () => groupCompanyApplicationsByJob(filteredApplications, { sortBy: effectiveFilters.sortBy }),
    [filteredApplications, effectiveFilters.sortBy],
  );

  const {
    jobOptions,
    companyOptions,
    employmentTypeOptions,
    dispositionOptions,
  } = useMemo(
    () => buildCompanyApplicationFilterOptions(applications),
    [applications],
  );

  const activeFilterCount = useMemo(() => {
    const filterStateForCount = jobId
      ? { ...effectiveFilters, jobFilter: 'all' }
      : effectiveFilters;
    return countActiveCompanyFilters(filterStateForCount);
  }, [effectiveFilters, jobId]);

  useEffect(() => {
    setExpandedJobs((previous) => {
      const visibleJobIds = groupedApplications.map((group) => group.jobId);
      const visibleLookup = new Set(visibleJobIds);
      const next = new Set([...previous].filter((groupJobId) => visibleLookup.has(groupJobId)));

      if (next.size === 0 && visibleJobIds.length > 0) {
        next.add(visibleJobIds[0]);
      }

      const previousIds = [...previous];
      const nextIds = [...next];
      const unchanged = previousIds.length === nextIds.length
        && previousIds.every((groupJobId, index) => groupJobId === nextIds[index]);

      return unchanged ? previous : next;
    });
  }, [groupedApplications]);

  useEffect(() => {
    if (!selectedApplication) return;
    setOfferDraft(buildInitialOfferDraft(selectedApplication));
  }, [selectedApplication?.id, selectedApplication?.offer, selectedApplication?.status]);

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

  if (pageError) {
    return (
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <div className="text-center py-12">
          <Icon name="AlertCircle" className="w-12 h-12 text-red-600 mx-auto mb-3" />
          <p className="text-gray-900 dark:text-slate-100 mb-4">{pageError}</p>
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

  const totalApplicationsCount = groupedApplications.reduce((sum, jobData) => sum + jobData.filteredCount, 0);
  const totalJobsCount = groupedApplications.length;

  // Pagination calculations
  const jobsArray = groupedApplications;
  const totalPages = Math.ceil(jobsArray.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedJobs = jobsArray.slice(startIndex, endIndex);
  const selectedPrimaryAction = selectedApplication ? getPrimaryActionConfig({
      application: selectedApplication,
      pendingStatus,
      canUpdateStatus,
      canOpenInterviewWorkspace,
    }) : null;
  const selectedApplicationResponses = buildApplicationResponses(selectedApplication);
  const selectedApplicationStatus = selectedApplication ? getDerivedApplicationStatus(selectedApplication) : null;
  const canEditOffer = canUpdateStatus && selectedApplicationStatus === 'OFFER';
  const currentOfferStatus = selectedApplication?.offer?.status || null;
  const selectedOfferHistory = Array.isArray(selectedApplication?.offerHistory) ? selectedApplication.offerHistory : [];

  return (
    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-4 sm:p-6 shadow-lg">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              {isReviewerOnly ? 'Application Reviews' : 'Job Applications'}
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
        <UnifiedFilterPanel
          title="Application Filters"
          description={isReviewerOnly
            ? 'Search candidate submissions and refine them by role, status, disposition, and interview context.'
            : 'Search candidates and refine applications by role, status, disposition, and hiring timeline.'}
          activeCount={activeFilterCount}
          onClear={clearFilters}
          headerActions={(
            <UnifiedFilterToggleButton
              active={showAdvancedFilters}
              onClick={() => setShowAdvancedFilters((previous) => !previous)}
              label={showAdvancedFilters ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
            />
          )}
        >
          <div className={FILTER_GRID_CLASS}>
            <UnifiedSearchField
              label="Search"
              className="sm:col-span-2 xl:col-span-3"
              type="text"
              placeholder="Candidate, role, outcome, notes, or location"
              value={filters.searchQuery}
              onChange={(event) => updateFilter('searchQuery', event.target.value)}
            />
            <UnifiedFilterSelect
              label="Status"
              value={filters.statusFilter}
              onChange={(value) => updateFilter('statusFilter', value)}
              options={COMPANY_APPLICATION_STATUS_FILTER_OPTIONS}
              placeholder="All statuses"
            />
          </div>

          {showAdvancedFilters && (
            <div className={FILTER_SUBPANEL_CLASS}>
              <div className={FILTER_GRID_CLASS}>
                {!jobId && (
                  <UnifiedFilterSelect
                    label="Job Role"
                    value={filters.jobFilter}
                    onChange={(value) => updateFilter('jobFilter', value)}
                    options={jobOptions}
                    placeholder="All roles"
                  />
                )}
                <UnifiedFilterSelect
                  label="Company"
                  value={filters.companyFilter}
                  onChange={(value) => updateFilter('companyFilter', value)}
                  options={companyOptions}
                  placeholder="All companies"
                />
                <UnifiedFilterSelect
                  label="Employment Type"
                  value={filters.employmentTypeFilter}
                  onChange={(value) => updateFilter('employmentTypeFilter', value)}
                  options={employmentTypeOptions}
                  placeholder="All employment types"
                />
                <UnifiedFilterSelect
                  label="Outcome"
                  value={filters.dispositionFilter}
                  onChange={(value) => updateFilter('dispositionFilter', value)}
                  options={dispositionOptions}
                  placeholder="All outcomes"
                />
                <UnifiedFilterSelect
                  label="Review State"
                  value={filters.reviewStateFilter}
                  onChange={(value) => updateFilter('reviewStateFilter', value)}
                  options={COMPANY_APPLICATION_REVIEW_STATE_FILTER_OPTIONS}
                  placeholder="All review states"
                />
                <UnifiedFilterSelect
                  label="Job State"
                  value={filters.jobStateFilter}
                  onChange={(value) => updateFilter('jobStateFilter', value)}
                  options={COMPANY_APPLICATION_JOB_STATE_FILTER_OPTIONS}
                  placeholder="All job states"
                />
                <UnifiedFilterSelect
                  label="Date Range"
                  value={filters.datePreset}
                  onChange={(value) => {
                    setFilters((previous) => ({
                      ...previous,
                      datePreset: value,
                      ...(value === 'custom' ? {} : { appliedFrom: '', appliedTo: '' }),
                    }));
                  }}
                  options={COMPANY_APPLICATION_DATE_PRESET_FILTER_OPTIONS}
                  placeholder="All dates"
                />
                <UnifiedFilterSelect
                  label="Sort By"
                  value={filters.sortBy}
                  onChange={(value) => updateFilter('sortBy', value)}
                  options={COMPANY_APPLICATION_SORT_FILTER_OPTIONS}
                  placeholder="Latest activity"
                />
              </div>

              {filters.datePreset === 'custom' && (
                <div className={FILTER_DATE_GRID_CLASS}>
                  <UnifiedFilterField label="Applied From">
                    <UnifiedTextInput
                      type="date"
                      value={filters.appliedFrom}
                      onChange={(event) => updateFilter('appliedFrom', event.target.value)}
                    />
                  </UnifiedFilterField>
                  <UnifiedFilterField label="Applied To">
                    <UnifiedTextInput
                      type="date"
                      value={filters.appliedTo}
                      onChange={(event) => updateFilter('appliedTo', event.target.value)}
                    />
                  </UnifiedFilterField>
                </div>
              )}
            </div>
          )}
        </UnifiedFilterPanel>

        {/* Job Groups */}
        <div className="space-y-4">
          {groupedApplications.length === 0 ? (
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
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <>
            {paginatedJobs.map((jobData, index) => {
              const groupJobId = jobData.jobId;
              const isExpanded = expandedJobs.has(groupJobId);
              
              return (
                <motion.div
                  key={groupJobId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-hidden"
                >
                  {/* Job Header */}
                  <button
                    onClick={() => toggleJob(groupJobId)}
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
                            <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-200 text-xs font-medium shrink-0">
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
                        {jobData.stats.submitted > 0 && (
                          <span className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-medium text-blue-700 dark:text-blue-300">
                            {jobData.stats.submitted} New
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
                            const statusConfig = getStatusConfig(application);
                            
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
                onClick={() => {
                  setShowDetails(false);
                  setModalError('');
                }}
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
                      onClick={() => {
                        setShowDetails(false);
                        setModalError('');
                      }}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                    >
                      <Icon name="X" className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 space-y-6">
                    {/* Error Message */}
                    {modalError && (
                      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <p className="text-sm text-red-700 dark:text-red-300">{modalError}</p>
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
                          <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-200 text-xs font-medium">
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
                            {STATUS_SELECTION_OPTIONS.map((status) => {
                              const config = getStatusConfig(status, null, status === 'REJECTED' ? 'NOT_SELECTED' : null);
                              const currentStatus = getDerivedApplicationStatus(selectedApplication);
                              const isCurrent = currentStatus === status;
                              const isSelected = pendingStatus === status;
                              const isWithdrawnApp = isWithdrawn(selectedApplication);
                              const offerEligibility = status === 'OFFER'
                                ? getApplicationOfferStageEligibility(selectedApplication)
                                : { allowed: true, reason: null };
                              const isStatusDisabled = updating === selectedApplication.id
                                || isWithdrawnApp
                                || (status === 'OFFER' && !offerEligibility.allowed);
                              
                              return (
                                <button
                                  key={status}
                                  onClick={() => !isStatusDisabled && setPendingStatus(status)}
                                  disabled={isStatusDisabled}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                    isSelected
                                      ? `${config.color} border-white/80 dark:border-slate-100/70 shadow-sm ring-1 ring-black/5 dark:ring-white/10`
                                      : isStatusDisabled
                                      ? 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500 border-gray-300 dark:border-slate-700 cursor-not-allowed'
                                      : 'bg-white dark:bg-slate-800/80 text-gray-700 dark:text-slate-200 border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700'
                                  }`}
                                  title={
                                    isWithdrawnApp
                                      ? 'Cannot change status of withdrawn applications'
                                      : status === 'OFFER' && !offerEligibility.allowed
                                        ? offerEligibility.reason
                                        : ''
                                  }
                                >
                                  <span className="inline-flex items-center gap-1.5">
                                    {config.label}
                                    {isCurrent && (
                                      <span className="text-[10px] uppercase tracking-wide opacity-75">Current</span>
                                    )}
                                  </span>
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
                      {selectedPrimaryAction?.helperText && (
                        <p className={`text-xs mt-2 ${
                          selectedPrimaryAction.disabled
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-gray-500 dark:text-slate-400'
                        }`}>
                          {selectedPrimaryAction.helperText}
                        </p>
                      )}
                    </div>

                    {((selectedApplicationStatus === 'OFFER' && (canEditOffer || selectedApplication.offer !== undefined))
                      || (selectedApplicationStatus === 'HIRED' && selectedApplication.offer)) && (
                      <div className="space-y-4 rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/45 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                              Offer Details
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
                              This is the structured offer the candidate can review and respond to in their dashboard.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {currentOfferStatus && (
                              <span className="inline-flex items-center rounded-full bg-white/90 dark:bg-slate-900/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-200">
                                {OFFER_STATUS_LABELS[currentOfferStatus] || currentOfferStatus}
                              </span>
                            )}
                            {selectedApplication.offer?.respondedAt && (
                              <span className="text-xs text-gray-500 dark:text-slate-400">
                                Responded {formatDate(selectedApplication.offer.respondedAt)}
                              </span>
                            )}
                          </div>
                        </div>

                        {offerSuccess && (
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                            {offerSuccess}
                          </div>
                        )}

                        {selectedApplication.offer?.declineReason && (
                          <div className="rounded-xl border border-rose-200/70 dark:border-rose-500/25 bg-white dark:bg-slate-950/60 px-3 py-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-rose-700 dark:text-rose-300">
                              Candidate decline note
                            </p>
                            <p className="mt-1 text-sm text-gray-700 dark:text-slate-300">
                              {selectedApplication.offer.declineReason}
                            </p>
                          </div>
                        )}

                        {selectedApplication.offer && (
                          <div className="rounded-xl border border-gray-200/80 dark:border-slate-700/70 bg-white dark:bg-slate-950/60 px-3 py-3">
                            <div className="grid gap-2 text-xs text-gray-600 dark:text-slate-400 sm:grid-cols-3">
                              <div>
                                <p className="font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Compensation</p>
                                <p className="mt-1 text-sm text-gray-900 dark:text-slate-100">
                                  {formatOfferCompensation(selectedApplication.offer) || 'Not set'}
                                </p>
                              </div>
                              <div>
                                <p className="font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Last Sent</p>
                                <p className="mt-1 text-sm text-gray-900 dark:text-slate-100">
                                  {selectedApplication.offer.sentAt ? formatDate(selectedApplication.offer.sentAt) : 'Not sent'}
                                </p>
                              </div>
                              <div>
                                <p className="font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Response</p>
                                <p className="mt-1 text-sm text-gray-900 dark:text-slate-100">
                                  {selectedApplication.offer.respondedAt ? formatDate(selectedApplication.offer.respondedAt) : 'Awaiting candidate response'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <UnifiedFilterField label="Offer Title">
                            <UnifiedTextInput
                              value={offerDraft.title}
                              onChange={(event) => handleOfferDraftFieldChange('title', event.target.value)}
                              disabled={!canEditOffer || savingOffer}
                              placeholder="Senior Data Analyst Offer"
                            />
                          </UnifiedFilterField>
                          <UnifiedFilterField label="Compensation Amount">
                            <UnifiedTextInput
                              type="number"
                              value={offerDraft.compensationAmount}
                              onChange={(event) => handleOfferDraftFieldChange('compensationAmount', event.target.value)}
                              disabled={!canEditOffer || savingOffer}
                            />
                          </UnifiedFilterField>
                          <UnifiedFilterField label="Currency">
                            <UnifiedTextInput
                              value={offerDraft.compensationCurrency}
                              onChange={(event) => handleOfferDraftFieldChange('compensationCurrency', event.target.value.toUpperCase())}
                              disabled={!canEditOffer || savingOffer}
                              placeholder="LKR"
                            />
                          </UnifiedFilterField>
                          <UnifiedFilterSelect
                            label="Compensation Period"
                            value={offerDraft.compensationPeriod}
                            onChange={(value) => handleOfferDraftFieldChange('compensationPeriod', value)}
                            options={OFFER_COMPENSATION_PERIOD_OPTIONS}
                            disabled={!canEditOffer || savingOffer}
                            placeholder="Select period"
                          />
                          <UnifiedFilterField label="Start Date">
                            <UnifiedTextInput
                              type="date"
                              value={offerDraft.startDate}
                              onChange={(event) => handleOfferDraftFieldChange('startDate', event.target.value)}
                              disabled={!canEditOffer || savingOffer}
                            />
                          </UnifiedFilterField>
                          <UnifiedFilterField label="Offer Expiry">
                            <UnifiedTextInput
                              type="datetime-local"
                              value={offerDraft.expiresAt}
                              onChange={(event) => handleOfferDraftFieldChange('expiresAt', event.target.value)}
                              disabled={!canEditOffer || savingOffer}
                            />
                          </UnifiedFilterField>
                        </div>

                        <UnifiedFilterField label="Offer Note">
                          <textarea
                            value={offerDraft.note}
                            onChange={(event) => handleOfferDraftFieldChange('note', event.target.value)}
                            disabled={!canEditOffer || savingOffer}
                            placeholder="Summarize compensation context, joining expectations, or next steps."
                            className="min-h-[110px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </UnifiedFilterField>

                        <div className="flex flex-wrap justify-end gap-3">
                          {selectedApplication.status === 'HIRED' && selectedApplication.onboarding && (
                            <Button
                              variant="outline"
                              onClick={() => navigate(`/company-applications/${selectedApplication.id}/onboarding`)}
                              disabled={resendingOffer || savingOffer}
                            >
                              <Icon name="ClipboardCheck" className="w-4 h-4 mr-2" />
                              Open Onboarding Workspace
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            onClick={() => navigate(`/company-applications/${selectedApplication.id}/offer`)}
                            disabled={resendingOffer || savingOffer}
                          >
                            <Icon name="ExternalLink" className="w-4 h-4 mr-2" />
                            Open Offer Workspace
                          </Button>
                          {canEditOffer && selectedApplication.offer?.status === 'PENDING' && (
                            <Button
                              variant="outline"
                              onClick={handleResendOffer}
                              loading={resendingOffer}
                              disabled={resendingOffer || savingOffer}
                            >
                              {!resendingOffer && (
                                <Icon name="Send" className="w-4 h-4 mr-2" />
                              )}
                              Resend Offer Email
                            </Button>
                          )}
                          {canEditOffer && (
                            <Button
                              variant="default"
                              onClick={handleSaveOffer}
                              loading={savingOffer}
                              disabled={savingOffer || resendingOffer}
                              className="bg-amber-600 hover:bg-amber-700 text-white"
                            >
                              {!savingOffer && (
                                <Icon name="Briefcase" className="w-4 h-4 mr-2" />
                              )}
                              Save Offer Details
                            </Button>
                          )}
                        </div>

                        {selectedOfferHistory.length > 0 && (
                          <div className="space-y-3 rounded-xl border border-gray-200/80 dark:border-slate-700/70 bg-white dark:bg-slate-950/60 p-4">
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Offer History</h4>
                              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                                Track every offer update, resend, and candidate response.
                              </p>
                            </div>
                            <div className="space-y-2">
                              {selectedOfferHistory.map((entry) => (
                                <div key={entry.id} className="rounded-lg border border-gray-200/80 dark:border-slate-700/70 bg-slate-50/90 dark:bg-slate-900/70 px-3 py-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                                      {formatOfferHistoryEventLabel(entry.eventType)}
                                    </p>
                                    <span className="text-xs text-gray-500 dark:text-slate-500">
                                      {formatDate(entry.createdAt)}
                                    </span>
                                  </div>
                                  {entry.offer && (
                                    <p className="mt-1 text-xs text-gray-600 dark:text-slate-400">
                                      {formatOfferCompensation(entry.offer) || 'Compensation unavailable'}
                                    </p>
                                  )}
                                  {entry.note && (
                                    <p className="mt-1 text-sm text-gray-700 dark:text-slate-300">
                                      {entry.note}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

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
                    {selectedApplicationResponses.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                          Application Questions
                        </h3>
                        <div className="space-y-3">
                          {selectedApplicationResponses.map((response, idx) => (
                            <div key={response.id || idx} className="p-3 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                              <p className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                                {response.prompt || `Question ${idx + 1}`}
                              </p>
                              <p className={`text-sm ${response.isMissing ? 'text-gray-500 dark:text-slate-400 italic' : 'text-gray-900 dark:text-slate-100'}`}>
                                {response.response}
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
                      onClick={() => {
                        setShowDetails(false);
                        setModalError('');
                      }}
                      className="flex-1 border-gray-300 dark:border-slate-500 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                      Close
                    </Button>
                    {(canOpenInterviewWorkspace || canUpdateStatus) && (
                      <Button
                        variant="default"
                        onClick={handlePrimaryAction}
                        loading={startingReview || updating === selectedApplication?.id}
                        disabled={startingReview || updating === selectedApplication?.id || !selectedPrimaryAction || selectedPrimaryAction.disabled}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 text-white font-semibold shadow-md"
                      >
                        {!startingReview && updating !== selectedApplication?.id && (
                          <Icon name={selectedPrimaryAction?.icon || 'CheckCircle'} className="w-4 h-4 mr-2" />
                        )}
                        {startingReview
                          ? 'Opening...'
                          : updating === selectedApplication?.id
                          ? 'Saving...'
                          : (selectedPrimaryAction?.label || 'Confirm Status')}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {rejectionModal.open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white dark:bg-slate-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">Reject Application</h3>
              <button
                type="button"
                onClick={() => setRejectionModal({ open: false, applicationId: null, dispositionCode: 'PASSED_ON', notes: '' })}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-full p-1"
              >
                <Icon name="X" size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Rejection reason</label>
              <select
                value={rejectionModal.dispositionCode}
                onChange={(e) => setRejectionModal((prev) => ({ ...prev, dispositionCode: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              >
                {REJECTION_DISPOSITION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                Recruiter note <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={rejectionModal.notes}
                onChange={(e) => setRejectionModal((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Internal audit note..."
                rows={3}
                className="w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-500 dark:placeholder:text-slate-400 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setRejectionModal({ open: false, applicationId: null, dispositionCode: 'PASSED_ON', notes: '' })}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white border-none"
                onClick={confirmRejection}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {interviewingScheduleModal.open && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {interviewingScheduleModal.open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto px-3 py-4 sm:px-4 sm:py-6"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
                onClick={closeInterviewingScheduleModal}
                aria-hidden="true"
              />
              <motion.div
                initial={{ y: 16, opacity: 0, scale: 0.97 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 16, opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                role="dialog"
                aria-modal="true"
                onClick={(event) => event.stopPropagation()}
                className="relative w-full max-w-2xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-white/20 dark:border-slate-700/50 bg-white dark:bg-slate-800 shadow-2xl p-5 sm:p-6 space-y-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                      Move To Interviewing
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                      Choose how this interview should be scheduled.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeInterviewingScheduleModal}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                  >
                    <Icon name="X" className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      value: 'AUTO',
                      title: 'Auto schedule',
                      description: 'Use organization rules (working hours, buffers, and conflict checks) to assign the best slot.',
                    },
                    {
                      value: 'MANUAL',
                      title: 'Pick date & time now',
                      description: 'Set an exact interview slot immediately.',
                    },
                  ].map((option) => {
                    const isActive = interviewingScheduleModal.mode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setInterviewingScheduleModal((previous) => ({
                          ...previous,
                          mode: option.value,
                          demoBypassAvailability: false,
                          error: '',
                        }))}
                        className={`text-left rounded-xl border p-3 transition-colors ${
                          isActive
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-200'
                            : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-500/60'
                        }`}
                      >
                        <p className="text-sm font-semibold">{option.title}</p>
                        <p className="text-xs mt-1 opacity-85">{option.description}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Icon name="FastForward" className="mt-0.5 h-4 w-4 text-amber-700 dark:text-amber-200" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-200">
                        Temporary demo bypass
                      </p>
                      <p className="text-sm text-amber-800 dark:text-amber-100">
                        Use this only for the demo. It switches to manual scheduling, sets the interview about two minutes from now,
                        and skips lead time, working-day, business-hour, and conflict checks for this save only.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    iconName="FastForward"
                    onClick={applyInterviewingDemoBypass}
                    className="w-full border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:text-amber-100 dark:hover:bg-amber-500/20"
                  >
                    Use Demo Time Now
                  </Button>
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/40 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                        Reviewer coverage
                      </p>
                      <p className="text-sm text-gray-700 dark:text-slate-200 mt-1">
                        Assign the reviewers who should evaluate this interview after it completes.
                      </p>
                    </div>
                    <span className="inline-flex flex-shrink-0 items-center whitespace-nowrap rounded-full border border-gray-200 dark:border-slate-600 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:text-slate-300">
                      {interviewingScheduleModal.reviewerAssignments.length} assigned
                    </span>
                  </div>

                  {interviewingScheduleModal.reviewerOptionsLoading ? (
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Loading review-capable team members...
                    </p>
                  ) : interviewingScheduleModal.reviewerOptionsError ? (
                    <p className="text-xs text-rose-600 dark:text-rose-300">
                      {interviewingScheduleModal.reviewerOptionsError}
                    </p>
                  ) : interviewingScheduleModal.reviewerOptions.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      No active review-capable team members are available to assign yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {interviewingScheduleModal.reviewerOptions.map((option) => {
                        const isSelected = interviewingScheduleModal.reviewerAssignments.includes(option.value);
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => toggleInterviewingReviewerAssignment(option.value)}
                            className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                              isSelected
                                ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                                : 'border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:border-emerald-300 dark:hover:border-emerald-500/60'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span className={`mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border ${
                                isSelected
                                  ? 'border-emerald-500 bg-emerald-500 text-white dark:border-emerald-400 dark:bg-emerald-500'
                                  : 'border-gray-300 text-transparent dark:border-slate-500'
                              }`}>
                                <Icon
                                  name={isSelected ? 'Check' : 'Circle'}
                                  className="w-3 h-3"
                                />
                              </span>
                              <div className="min-w-0 space-y-1">
                                <p className="text-sm font-semibold break-words">{option.label}</p>
                                {option.roleLabel && (
                                  <p className="text-[11px] opacity-80">{option.roleLabel}</p>
                                )}
                                {option.email && (
                                  <p className="break-all text-[11px] opacity-80">{option.email}</p>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {interviewingScheduleModal.mode === 'MANUAL' && (
                  <div className="space-y-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/40 p-4">
                    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 p-3 space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                        Manual scheduling checks
                      </p>
                      {interviewingScheduleModal.schedulingConstraints ? (
                        <>
                          <p className="text-sm font-medium text-gray-800 dark:text-slate-100">
                            {getAvailabilitySourceLabel(interviewingScheduleModal.schedulingConstraints)}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-slate-400">
                            {formatWorkingDays(interviewingScheduleModal.schedulingConstraints.workingDays)} | {' '}
                            {formatMinutesOfDay(interviewingScheduleModal.schedulingConstraints.businessHoursStartMinutes)}-
                            {formatMinutesOfDay(interviewingScheduleModal.schedulingConstraints.businessHoursEndMinutes)} {' '}
                            {interviewingScheduleModal.schedulingConstraints.timezone || 'UTC'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-500">
                            Lead time: {interviewingScheduleModal.schedulingConstraints.leadHours}h | Window: {interviewingScheduleModal.schedulingConstraints.scheduleWindowDays} days
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-gray-600 dark:text-slate-400">
                          {interviewingScheduleModal.constraintsLoading
                            ? 'Loading assigned scheduling availability...'
                            : (interviewingScheduleModal.constraintsError || 'Scheduling rules are unavailable right now.')}
                        </p>
                      )}
                      {interviewingScheduleModal.demoBypassAvailability && (
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-200">
                          Demo bypass is active. This save will skip availability checks while still requiring a future time.
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="interviewing-schedule-datetime"
                        className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5"
                      >
                        Date & Time
                      </label>
                      <input
                        id="interviewing-schedule-datetime"
                        type="datetime-local"
                        value={interviewingScheduleModal.scheduledFor}
                        onChange={(event) => setInterviewingScheduleModal((previous) => ({
                          ...previous,
                          scheduledFor: event.target.value,
                          error: '',
                        }))}
                        min={
                          interviewingScheduleModal.demoBypassAvailability
                            ? getMinimumInterviewingDatetime()
                            : manualInterviewingWindowBounds?.minimumDate
                            ? toLocalDatetimeValue(manualInterviewingWindowBounds.minimumDate)
                            : getMinimumInterviewingDatetime()
                        }
                        max={
                          interviewingScheduleModal.demoBypassAvailability
                            ? undefined
                            : manualInterviewingWindowBounds?.maximumDate
                            ? toLocalDatetimeValue(manualInterviewingWindowBounds.maximumDate)
                            : undefined
                        }
                        step={
                          interviewingScheduleModal.demoBypassAvailability
                            ? 60
                            : Math.max(1, Number(manualInterviewingWindowBounds?.slotMinutes) || 30) * 60
                        }
                        className="w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-gray-900 dark:text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      {interviewingScheduleModal.schedulingConstraints && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                          Lead time, scheduling window, working days, and business hours are applied here.
                          Final conflict checks still run when you save.
                        </p>
                      )}
                      {interviewingScheduleModal.schedulingConstraints && !interviewingScheduleModal.constraintsLoading && (
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                              Next valid slots
                            </p>
                            <p className="text-[11px] text-gray-400 dark:text-slate-500">
                              Based on {getAvailabilitySourceLabel(interviewingScheduleModal.schedulingConstraints).toLowerCase()}
                            </p>
                          </div>
                          {manualInterviewingSlots.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {manualInterviewingSlots.map((slot) => {
                                const isSelected = slot.value === interviewingScheduleModal.scheduledFor;
                                return (
                                  <button
                                    key={slot.value}
                                    type="button"
                                    onClick={() => setInterviewingScheduleModal((previous) => ({
                                      ...previous,
                                      scheduledFor: slot.value,
                                      error: '',
                                    }))}
                                    aria-label={`Use suggested slot ${slot.localLabel}`}
                                    className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                                      isSelected
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-200'
                                        : 'border-gray-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-600 text-gray-700 dark:text-slate-200'
                                    }`}
                                  >
                                    <p className="text-sm font-medium">{slot.localLabel}</p>
                                    {showInterviewingTimezoneTranslation && (
                                      <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                                        {slot.availabilityLabel} {interviewingScheduleModal.schedulingConstraints.timezone}
                                      </p>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500 dark:text-slate-400">
                              No guided slots are available inside the current availability window.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                          Timezone
                        </label>
                        <input
                          type="text"
                          value={interviewingScheduleModal.timezone}
                          onChange={(event) => setInterviewingScheduleModal((previous) => ({
                            ...previous,
                            timezone: event.target.value,
                            error: '',
                          }))}
                          className="w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-gray-900 dark:text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                          Duration
                        </label>
                        <select
                          value={interviewingScheduleModal.duration}
                          onChange={(event) => setInterviewingScheduleModal((previous) => ({
                            ...previous,
                            duration: Number(event.target.value),
                            error: '',
                          }))}
                          className="w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-gray-900 dark:text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {INTERVIEW_SCHEDULING_DURATION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                        Notes <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <textarea
                        value={interviewingScheduleModal.notes}
                        onChange={(event) => setInterviewingScheduleModal((previous) => ({
                          ...previous,
                          notes: event.target.value,
                          error: '',
                        }))}
                        rows={2}
                        placeholder="Optional scheduling note for the candidate."
                        className="w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-gray-900 dark:text-slate-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                  </div>
                )}

                {interviewingScheduleModal.error && (
                  <div className="rounded-lg border border-rose-200 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 px-3 py-2">
                    <p className="text-sm text-rose-700 dark:text-rose-200">
                      {interviewingScheduleModal.error}
                    </p>
                  </div>
                )}
                {!interviewingScheduleModal.error && interviewingScheduleModal.mode === 'MANUAL' && (
                  (interviewingScheduleModal.constraintsLoading && !interviewingScheduleModal.demoBypassAvailability)
                  || (!interviewingScheduleModal.demoBypassAvailability && interviewingScheduleModal.constraintsError)
                  || manualInterviewingValidationMessage
                ) && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-3 py-2">
                    <p className="text-sm text-amber-700 dark:text-amber-200">
                      {interviewingScheduleModal.constraintsLoading
                        ? 'Loading assigned scheduling availability...'
                        : (interviewingScheduleModal.constraintsError || manualInterviewingValidationMessage)}
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={closeInterviewingScheduleModal}
                    disabled={updating === interviewingScheduleModal.applicationId}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 text-white"
                    onClick={handleConfirmInterviewingTransition}
                    loading={updating === interviewingScheduleModal.applicationId}
                    disabled={
                      updating === interviewingScheduleModal.applicationId
                      || (
                        interviewingScheduleModal.mode === 'MANUAL'
                        && (
                          (interviewingScheduleModal.constraintsLoading && !interviewingScheduleModal.demoBypassAvailability)
                          || (!interviewingScheduleModal.demoBypassAvailability && Boolean(interviewingScheduleModal.constraintsError))
                          || Boolean(manualInterviewingValidationMessage)
                        )
                      )
                    }
                  >
                    {interviewingScheduleModal.mode === 'MANUAL'
                      ? 'Set Status & Schedule'
                      : 'Set Status'}
                  </Button>
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

