# ATS Scale Hardening (2026-02-12)

## Objective

Upgrade the core ATS behavior to align with large-scale ATS patterns:

- No unsafe destructive job deletion.
- Structured and auditable application dispositions.
- Candidate transparency when a role is closed after applications exist.
- Consistent lifecycle metadata for reporting and compliance.

## External ATS reference baseline

The lifecycle model in this implementation is aligned with enterprise ATS guidance and behavior:

- Greenhouse: rejection reasons are typically required and treated as structured analytics data.
  - https://support.greenhouse.io/hc/en-us/articles/360038321491-Rejection-reason-requirement
  - https://support.greenhouse.io/hc/en-us/articles/207305363-Rejection-reasons-overview
- Workable: disqualification reasons are configurable/optionally mandatory and support reporting and automation.
  - https://help.workable.com/hc/en-us/articles/7263547772055-Disqualification-reasons-overview
  - https://help.workable.com/hc/en-us/articles/115004710893-Disqualifying-rejecting-candidates
- SmartRecruiters: candidate-facing status model includes archived substatuses such as `WITHDRAWN_BY_APPLICANT` and `DELETED_BY_COMPANY`.
  - https://developers.smartrecruiters.com/changelog/candidate-status-api
  - https://developers.smartrecruiters.com/reference/publicgetstatus
- Lever: archive/close workflow and archive reasons are first-class lifecycle operations, including bulk handling and optional candidate communication.
  - https://lever-old.zendesk.com/hc/en-us/articles/204502125-Archiving-opportunities
  - https://lever-old.zendesk.com/hc/en-us/articles/360030950011-Bulk-archiving-opportunities
  - https://lever-old.zendesk.com/hc/en-us/articles/360042220512-Creating-and-managing-job-postings

## Implemented Architecture Changes

### 1) Job deletion moved to ATS soft-delete semantics

Files:

- `server/src/services/firebaseData.service.js`
- `server/src/controllers/job.controller.js`

Changes:

- `jobStore.delete()` now performs **soft delete** by default (keeps record, marks deletion metadata).
- New job metadata:
  - `deletedAt`
  - `deletedBy`
  - `deleteReason`
  - `deletionMode` (`SOFT`)
- `jobStore.getById()` excludes soft-deleted jobs unless explicitly requested via options.
- Organization job lists also exclude soft-deleted jobs by default.
- Public job visibility now rejects soft-deleted jobs.

Result:

- Historical integrity is preserved.
- Existing job-delete flow still enforces:
  - archive-before-delete
  - resolve active applications before delete

### 2) Structured application disposition model

Files:

- `server/src/utils/applicationLifecycle.util.js` (new)
- `server/src/controllers/application.controller.js`
- `server/src/routes/application.routes.js`
- `server/src/services/firebaseData.service.js`

Changes:

- Added canonical disposition codes and categories:
  - `NOT_SELECTED`
  - `SKILL_MISMATCH`
  - `EXPERIENCE_MISMATCH`
  - `SALARY_MISMATCH`
  - `POSITION_FILLED`
  - `JOB_CLOSED`
  - `CANDIDATE_WITHDREW`
  - `HIRED`
  - `OTHER`
- New per-application fields:
  - `statusSource`
  - `statusChangedAt`
  - `dispositionCode`
  - `dispositionCategory`
  - `dispositionReason`
  - `dispositionNotes`
  - `dispositionTags`
  - `dispositionAt`
  - `dispositionBy`
  - `statusHistory` (append-only bounded trail)
- Recruiter status updates now persist lifecycle metadata.
- Candidate withdrawals now persist explicit disposition metadata.
- Job closure auto-resolution now writes `JOB_CLOSED` disposition metadata.

Result:

- Rejections and closures are now reportable and auditable.
- System behavior is closer to enterprise ATS disposition workflows.

### 3) Candidate/company UX transparency improvements

Files:

- `src/constants/applicationDisposition.js` (new)
- `src/pages/company-dashboard/components/ApplicationsManager.jsx`
- `src/pages/candidate-dashboard/components/MyApplicationsList.jsx`
- `src/services/apiClient.js`
- `src/pages/company-jobs/index.jsx`

Changes:

- Added disposition-aware status labels (including **Position Closed**).
- Recruiter rejection action now captures a structured reason before submission.
- Candidate and company application details display disposition reason/note.
- Grouping fallback no longer collapses missing-job records into one generic bucket.
- Job delete flow allows optional candidate closure message before auto-resolution.
- API client status update accepts structured payloads (not only plain status string).

Result:

- Candidate gets clearer context.
- Recruiters produce cleaner rejection data.
- ATS behavior is more transparent and less ambiguous.

### 4) Application status governance and bulk operations

Files:

- `server/src/utils/applicationLifecycle.util.js`
- `server/src/controllers/application.controller.js`
- `server/src/routes/application.routes.js`
- `src/services/apiClient.js`

Changes:

- Added explicit application status transition rules (including terminal-state guards).
- Recruiter status updates now enforce legal transitions and return structured conflict details for invalid transitions.
- Added bulk status update endpoint for recruiter/admin operations:
  - `PATCH /api/applications/bulk/status`
- Added optional cursor pagination support for:
  - candidate applications
  - job applications
  - organization applications

Result:

- Core ATS status flow is now controlled and auditable at scale.
- Recruiter teams can process large batches consistently without one-by-one API calls.

### 5) Invitation flow integrated into ATS application lifecycle

Files:

- `server/src/controllers/invitation.controller.js`
- `server/src/services/firebaseData.service.js`

Changes:

- Prevent duplicate active invitations for same job+email.
- Invitation acceptance now ensures a corresponding ATS application exists:
  - creates a lifecycle-tracked application when needed
  - or moves existing non-terminal application to interviewing state
- Application realtime updates are published during invitation acceptance flow.

Result:

- ATS no longer has invitation/interview records disconnected from application lifecycle.
- Candidate pipeline continuity is preserved.

### 6) Company interview visibility aligned to organization scope

Files:

- `server/src/controllers/interview.controller.js`

Changes:

- Company interview listing now resolves by organization scope (not only interviewer creator user).
- Interview access checks now allow approved company organization members to access interviews in their own organization.

Result:

- Team-based ATS operations (recruiter, reviewer, hiring manager) behave correctly in multi-user organizations.

### 7) Scale hardening pass for query efficiency, idempotency, and CI

Files:

- `server/src/services/firebaseData.service.js`
- `server/src/controllers/invitation.controller.js`
- `server/src/controllers/job.controller.js`
- `server/src/controllers/admin.controller.js`
- `server/src/routes/admin.routes.js`
- `server/src/routes/interview.routes.js`
- `server/src/controllers/interview.controller.js`
- `src/services/apiClient.js`
- `src/pages/system-admin-dashboard/components/PlatformAuditLogs.jsx`
- `.github/workflows/ci.yml` (new)
- `.github/workflows/deploy.yml` (new)

Changes:

- Replaced admin audit logs `offset` pagination path with cursor pagination:
  - backend store supports `listPage({ limit, cursor })`
  - admin API returns `hasMore` + `nextCursor`
  - UI now paginates using cursor history instead of numeric offsets.
- Added compatibility bridge for legacy offset callers with `listPageFromOffset`.
- Removed N+1 per-job application count queries on company jobs list:
  - added `jobApplicationStore.countByJobIds(jobIds)` batch aggregation.
- Added transaction-safe invitation acceptance claim/finalize flow:
  - atomic acceptance lock (`claimForAcceptance`)
  - stale lock recovery support
  - explicit finalize (`finalizeAcceptance`) and lock release on failure
  - invitation now stores `acceptedInterviewId` / `acceptedApplicationId`.
- Added query caps for interview list endpoints (`limit` validated to max 200) and store-level limit support with index fallback sorting.
- Added backend unit tests for new pagination/idempotency utilities.
- Added CI workflows so every PR/push executes automated tests/build checks.

Result:

- Lower query fan-out on hot ATS paths.
- Better correctness under concurrent invitation acceptance.
- Better admin list scalability at high audit-log volume.
- Stronger engineering governance with enforced automated checks.

### 8) Research-phase object storage + async jobs + lifecycle integration tests

Files:

- `server/src/services/localObjectStorage.service.js` (new)
- `server/src/controllers/objectStorage.controller.js` (new)
- `server/src/routes/objectStorage.routes.js` (new)
- `server/src/routes/index.js`
- `src/services/apiClient.js`
- `src/pages/company-dashboard/components/ApplicationsManager.jsx`
- `src/pages/company-dashboard/components/CandidateManager.jsx`
- `src/pages/jobs/components/JobApplicationForm.jsx`
- `server/src/services/backgroundJobQueue.service.js` (new)
- `server/src/controllers/application.controller.js`
- `server/src/controllers/invitation.controller.js`
- `server/src/controllers/job.controller.js`
- `server/src/controllers/admin.controller.js`
- `server/src/controllers/newsletter.controller.js`
- `server/src/controllers/analytics.controller.js`
- `server/src/__tests__/atsLifecycle.integration.test.js` (new)

Changes:

- Added local object-storage signed download URLs for `uploads/*` assets:
  - `GET /api/object-storage/signed-url?path=...`
  - `GET /api/object-storage/download?...` (signed token verification + expiry)
- Added optional runtime switch for upload exposure:
  - `UPLOADS_ACCESS_MODE=PUBLIC` (default during testing)
  - `UPLOADS_ACCESS_MODE=SIGNED` (disable public `/uploads` static serving)
- Kept storage backend local-on-disk for testing/research constraints, while aligning access pattern with enterprise signed-URL behavior.
- Added in-memory async background queues for:
  - outbound email jobs
  - heavy analytics snapshot jobs
- Added retries and bounded backoff in queue processing.
- Moved email-heavy controller paths and analytics snapshot writes to queued execution.
- Added backend ATS lifecycle integration tests covering:
  - application submit -> recruiter transition -> job closure auto-resolution
  - invitation acceptance idempotency (no duplicate interview/application)
  - analytics endpoint behavior with queued snapshot scheduling

Result:

- Storage access pattern now supports signed URL controls without paid cloud storage during research/testing.
- Request latency on ATS endpoints is reduced by offloading non-critical work.
- Core lifecycle behavior has executable regression coverage across critical ATS paths.

### 9) Interview creation integrity hardening

Files:

- `server/src/middleware/inputValidation.middleware.js`
- `server/src/controllers/interview.controller.js`
- `server/src/routes/pipeline.routes.js`
- `server/src/controllers/pipeline.controller.js`
- `server/src/controllers/review.controller.js`
- `server/src/middleware/__tests__/inputValidation.interviewCreateSchema.test.js` (new)
- `server/src/__tests__/atsLifecycle.integration.test.js`

Changes:

- Expanded interview-create request whitelist to preserve ATS linkage fields:
  - `candidateId`, `jobId`, `jobStage`, `invitationId`, `config`, `pipelineStatus`, `reviewerAssignments`, `status`.
- Added hiring interview guardrails:
  - require `candidateId` for hiring mode
  - validate candidate account type
  - validate job ownership for organization
  - require existing application/invitation linkage when creating hiring interview against a job
  - reuse existing active interview for same candidate+job to avoid duplicates.
- Tightened pipeline mutation validation with enumerated status values and explicit organization context requirement.
- Normalized review response shape (`interviewId` field added; `interviewerId` kept as compatibility alias).

Result:

- Hiring interviews now remain strongly linked to ATS entities (candidate/application/job).
- Interview setup data for AI interview configuration is preserved instead of being dropped by request sanitization.
- Duplicate active hiring interviews are prevented on repeated recruiter actions.

## Data/Reporting Impact

New lifecycle fields create a stronger foundation for:

- disposition trend analytics,
- stage-to-outcome analysis,
- recruiter consistency audits,
- compliance evidence trails.

## Remaining Enterprise-ATS Enhancements (Future Iteration)

- Requisition and approval workflow objects.
- Configurable per-job pipeline templates and stage SLA tracking.
- Webhook/API key ecosystem for external ATS integrations.
- Retention automation/anonymization jobs from configured policy values.
- Cloud object storage migration from local disk to managed blob service for production durability.
- Distributed queue/worker infrastructure (e.g., Redis/SQS + worker autoscaling) for true horizontal scale.
- Full HTTP-level integration tests against ephemeral test datastore and production-like auth boundary.
