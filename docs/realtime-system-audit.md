# Realtime System Audit (Implemented)

## Scope

This audit covers realtime behavior for:

- Interview lifecycle
- Jobs (company + public)
- Applications (company + candidate)
- Invitations and team invitations
- Interview reviews (reviewer + score override flows)
- Organization member and organization profile changes
- Pipeline movement
- System admin queues/panels (approvals, org list, audit, settings, fairness, datasets)

Date: 2026-02-11

## Large-scale reference baseline

This implementation follows Firebase’s documented scale guidance:

- Listener efficiency and low-path subscriptions (`onValue` at the narrowest possible path):  
  https://firebase.google.com/docs/database/web/read-and-write  
  https://firebase.google.com/docs/database/usage/optimize
- Query/index/download efficiency and operational profiling:  
  https://firebase.google.com/docs/database/usage/optimize  
  https://firebase.google.com/docs/database/usage/profile
- Capacity boundaries and sharding thresholds for sustained growth:  
  https://firebase.google.com/docs/database/usage/limits  
  https://firebase.google.com/docs/database/usage/sharding

## Realtime architecture now in place

### Realtime Database feed paths

- `organizationFeeds/{organizationId}`
- `candidateFeeds/{userId}`
- `publicFeeds/{channel}`
- `adminFeeds/global`
- `userOrganizationMap/{userId}/{organizationId}` (membership map for secure org-feed reads)

Existing interview-specific feeds remain active:

- `sessions/{interviewId}`
- `userInterviewFeeds/{userId}`
- `liveChats/*`
- `public/systemSettings`
- `organizationApprovalStatus/{organizationId}`

### Backend realtime publishers

Added shared realtime publishers in:

- `server/src/services/firebaseData.service.js`

Functions:

- `publishOrganizationRealtimeUpdate`
- `publishCandidateRealtimeUpdate`
- `publishPublicRealtimeUpdate`
- `publishAdminRealtimeUpdate`
- `syncUserOrganizationRealtimeMembership`

### Backend emit coverage added

Realtime emit hooks were added to these mutation paths:

- `server/src/controllers/job.controller.js`
- `server/src/controllers/application.controller.js`
- `server/src/controllers/invitation.controller.js`
- `server/src/controllers/teamInvitation.controller.js`
- `server/src/controllers/review.controller.js`
- `server/src/controllers/organization.controller.js`
- `server/src/controllers/pipeline.controller.js`
- `server/src/controllers/admin.controller.js`
- `server/src/controllers/dataset.controller.js`
- `server/src/controllers/auth.controller.js` (team invitation acceptance + org registration/re-review admin feed updates)
- `server/src/services/firebaseData.service.js` (scheduled auto-publish jobs + membership sync)

Second-pass deep sweep additions:

- `server/src/controllers/interview.controller.js` now emits organization feed events for interview lifecycle (`interview-created`, `interview-started`, `interview-ended`) and admin feed event `interview-completed`.
- `server/src/controllers/review.controller.js` now emits admin feed event `review-submitted` in addition to organization/session realtime updates.
- `server/src/controllers/auth.controller.js` now emits organization feed update when company logo updates the organization record.

### Frontend realtime subscriptions added

Generic hook:

- `src/hooks/useRealtimePathFeed.js`
- `src/hooks/useInterviewRealtimeFeed.js` (event-scoped interview feed filtering)

Subscriptions wired into:

- `src/pages/company-jobs/index.jsx`
- `src/pages/company-team-members/index.jsx`
- `src/pages/company-dashboard/components/InvitationManager.jsx`
- `src/pages/company-dashboard/components/ApplicationsManager.jsx`
- `src/pages/company-dashboard/components/CandidateManager.jsx`
- `src/pages/company-dashboard/components/CandidateProgressDashboard.jsx`
- `src/pages/company-dashboard/components/CandidatePipeline.jsx`
- `src/pages/company-dashboard/components/ReviewerPanel.jsx`
- `src/pages/company-dashboard/index.jsx`
- `src/pages/jobs/index.jsx`
- `src/pages/job-detail/index.jsx`
- `src/pages/candidate-dashboard/components/MyApplicationsList.jsx`
- `src/pages/system-admin-dashboard/index.jsx`
- `src/pages/system-admin-dashboard/components/OrganizationApprovalQueue.jsx`
- `src/pages/system-admin-dashboard/components/AllOrganizationsList.jsx`
- `src/pages/system-admin-dashboard/components/PlatformAuditLogs.jsx`
- `src/pages/system-admin-dashboard/components/SystemSettings.jsx`
- `src/pages/system-admin-dashboard/components/FairnessCalibrationPanel.jsx`
- `src/pages/system-admin-dashboard/components/TrainingDataManager.jsx`

### Feed event scoping (performance/stability hardening)

Realtime listeners now subscribe with explicit `eventTypes` filters so unrelated feed writes do not trigger HTTP refetches.

Examples:

- Job surfaces only react to job feed events.
- Application surfaces only react to application/pipeline feed events.
- Team/invitation surfaces only react to team/invitation events.
- Admin panels react only to relevant admin event categories (organizations/settings/datasets/calibration).
- Interview feed consumers (dashboards/lists/review/lobby) ignore live-session noise unless relevant to their UI.

This filtering is implemented through:

- `src/constants/realtimeFeedEvents.js`
- `src/hooks/useRealtimePathFeed.js`
- `src/hooks/useInterviewRealtimeFeed.js`

### Non-disruptive large-scale list behavior

To align with large-scale UX patterns, high-churn browse lists use "updates available" signaling instead of forced live list replacement:

- `src/pages/jobs/index.jsx` (public jobs list)
- `src/pages/company-jobs/index.jsx` (company jobs list)
- `src/pages/company-interviews/index.jsx` (company interviews list)

Detail-focused screens remain realtime (e.g., job detail, interview review/lobby/live session).

## Realtime security coverage

Rules expanded in:

- `firebase.database.rules.json`

Added secure access rules for:

- `userOrganizationMap`
- `organizationFeeds`
- `candidateFeeds`
- `publicFeeds`
- `adminFeeds`

## Validation completed (local)

- `node --check` passed for all edited backend files
- `npm test -- --run` passed
- `npm run build` passed

## Deep pass (2026-02-12)

This pass re-scanned the full repo for:

- backend write paths vs realtime publish paths
- frontend API-backed views vs realtime subscriptions
- Firestore/RTDB storage boundaries
- high-scale behavior risks (unnecessary refetch storms)

### Additional hardening completed in this pass

1. Interview feed dedup hardening:
- Backend now writes `lastEventId` for interview feed snapshots (`session-synced` and recorded events).
- Frontend interview feed hook now keys change detection on `lastEventId` as well.
- This prevents rare event-collapse cases for same-type/same-timestamp updates.

2. Job detail scoped realtime refresh:
- `src/pages/job-detail/index.jsx` now ignores public/candidate feed events for other jobs by checking `feed.payload.jobId`.
- Prevents unnecessary refetches on high-volume unrelated job updates.

3. Public jobs list large-scale behavior:
- `src/pages/jobs/index.jsx` now listens to `publicFeeds/jobs` without forcing list rerenders.
- It shows a non-disruptive "new updates available" banner and refreshes only when the user clicks refresh.
- This keeps list browsing stable while still surfacing realtime changes.

### Complete Firestore inventory (from code)

- `users`
- `interviews`
- `interviews/{interviewId}/questions`
- `interviews/{interviewId}/poseData`
- `webrtcSessions`
- `organizations`
- `organizationMembers`
- `teamInvitations`
- `jobs`
- `invitations`
- `interviewReviews`
- `activityLogs`
- `jobApplications`
- `platformAuditLogs`
- `systemSettings`
- `analyticsSnapshots`
- `emailVerifications`
- `trainingDatasets_interviews`
- `trainingDatasets_analytics`
- `trainingDatasets_metadata`
- `newsletterSubscriptions`
- `interviewTemplates`
- `subscriptions`
- `billingEvents`

### Complete Realtime Database inventory (from code)

- `public/systemSettings`
- `organizationApprovalStatus/{organizationId}`
- `admins/{uid}`
- `sessions/{interviewId}/participants`
- `sessions/{interviewId}/meta`
- `sessions/{interviewId}/events/{eventId}`
- `sessions/{interviewId}/lastEvent`
- `sessions/{interviewId}/presence/{participantId}`
- `userInterviewFeeds/{uid}/{interviewId}`
- `organizationFeeds/{organizationId}`
- `candidateFeeds/{uid}`
- `publicFeeds/{channel}`
- `adminFeeds/global`
- `userOrganizationMap/{uid}/{organizationId}`
- `liveChats/{chatId}`
- `liveChats/{chatId}/user`
- `liveChats/{chatId}/messages/{messageId}`

### Coverage result (API-backed UI surfaces)

Realtime-covered domains:

- Jobs (public detail realtime + list non-disruptive)
- Applications (candidate/company)
- Invitations (candidate/company)
- Team members + team invitations
- Pipeline board
- Interview lifecycle and review flows
- Company and candidate dashboards
- Admin approvals/org list/audit/settings/fairness/training datasets
- Live chat, maintenance mode, organization approval status

Intentionally not force-realtime:

- High-churn browse lists use manual refresh cues instead of forced rerenders:
  - public jobs list
  - company jobs list
  - company interviews list
- one-off forms/auth pages (login/register/verify/contact/onboarding) remain request-response driven
- billing/newsletter/template CRUD remain non-realtime (no current collaborative UI dependency)

### Open design assumption to confirm

- `GET /api/interviews/company/all` currently returns interviews where `companyId === currentUserId` (user-scoped), not all interviews in the organization.
- This is consistent with current feed/listener wiring, but if your product requirement is organization-wide interview visibility for all company members, that endpoint and access model should be expanded in a separate change.

## Remaining requirement for final 100% confirmation

Code-level implementation is complete for the scoped domains, but production-grade confirmation still requires live multi-user verification with your Firebase project after deploying rules. Use `docs/realtime-test-checklist.md` to run that final pass.

## ATS hardening note (2026-02-12)

Beyond realtime behavior, the ATS core lifecycle now includes:

- Soft-delete job lifecycle behavior (non-destructive by default in `jobStore.delete`).
- Structured application disposition metadata (`dispositionCode`, `dispositionCategory`, reason/notes/tags, source, status history).
- Candidate/company visibility for closed-position outcomes (no blank/unknown status context when role is removed after application).

See `docs/ats-scale-hardening.md` for implementation details and scope.
See `docs/ats-core-completion-report.md` for full ATS core coverage status and remaining enterprise-next items.
