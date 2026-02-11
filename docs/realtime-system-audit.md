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

## Remaining requirement for final 100% confirmation

Code-level implementation is complete for the scoped domains, but production-grade confirmation still requires live multi-user verification with your Firebase project after deploying rules. Use `docs/realtime-test-checklist.md` to run that final pass.
