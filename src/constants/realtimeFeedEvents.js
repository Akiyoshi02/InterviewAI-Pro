export const ORGANIZATION_FEED_EVENTS = Object.freeze({
  jobs: Object.freeze([
    'job-created',
    'job-updated',
    'job-deleted',
    'job-published',
  ]),
  applications: Object.freeze([
    'application-submitted',
    'application-status-updated',
    'application-withdrawn',
  ]),
  team: Object.freeze([
    'team-invitation-created',
    'team-invitation-revoked',
    'team-invitation-resent',
    'team-invitation-accepted',
    'member-updated',
    'member-synced',
  ]),
  pipeline: Object.freeze([
    'pipeline-updated',
  ]),
  reviews: Object.freeze([
    'review-submitted',
  ]),
  interviews: Object.freeze([
    'interview-created',
    'interview-scheduled',
    'interview-rescheduled',
    'interview-reschedule-requested',
    'interview-reschedule-request-rejected',
    'interview-started',
    'interview-ended',
    'interview-candidate-message',
  ]),
  profile: Object.freeze([
    'organization-updated',
  ]),
});

export const CANDIDATE_FEED_EVENTS = Object.freeze({
  applications: Object.freeze([
    'application-submitted',
    'application-status-updated',
    'application-withdrawn',
  ]),
  pipeline: Object.freeze([
    'pipeline-updated',
  ]),
  membership: Object.freeze([
    'organization-membership-updated',
  ]),
});

export const PUBLIC_FEED_EVENTS = Object.freeze({
  jobs: Object.freeze([
    'job-published',
    'job-updated',
    'job-deleted',
  ]),
});

export const ADMIN_FEED_EVENTS = Object.freeze({
  organizations: Object.freeze([
    'organization-status-updated',
  ]),
  settings: Object.freeze([
    'system-settings-updated',
  ]),
  users: Object.freeze([
    'user-status-updated',
  ]),
  operations: Object.freeze([
    'data-retention-cleanup-run',
  ]),
  datasets: Object.freeze([
    'dataset-updated',
  ]),
  interviews: Object.freeze([
    'interview-completed',
  ]),
  reviews: Object.freeze([
    'review-submitted',
  ]),
});

export const INTERVIEW_FEED_EVENTS = Object.freeze({
  lifecycle: Object.freeze([
    'interview-created',
    'interview-scheduled',
    'interview-rescheduled',
    'interview-reschedule-requested',
    'interview-reschedule-request-rejected',
    'interview-started',
    'interview-ended',
  ]),
  pipeline: Object.freeze([
    'pipeline-updated',
  ]),
  reviews: Object.freeze([
    'review-submitted',
  ]),
  liveSession: Object.freeze([
    'session-synced',
    'question-asked',
    'answer-submitted',
    'participant-connected',
    'participant-disconnected',
  ]),
});

export const combineRealtimeEventTypes = (...eventGroups) => (
  Array.from(
    new Set(
      eventGroups
        .flat()
        .filter((eventType) => typeof eventType === 'string' && eventType.trim()),
    ),
  )
);
