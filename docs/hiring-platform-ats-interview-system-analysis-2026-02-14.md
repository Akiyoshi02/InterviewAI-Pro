# Hiring Platform ATS + Interview System Analysis
Generated: 2026-02-14

This document captures:
1. OUR SYSTEM dashboard audit (candidate + company)
2. Industry-standard hiring/interview process research
3. Proposed end-to-end flow for this system
4. Practical implementation notes (MUST/SHOULD/NICE-TO-HAVE)

---

## 1) OUR SYSTEM - Dashboard Audit (Candidate + Company)

### Candidate dashboard and related candidate flow

| Feature | Inputs | Outputs / State Change | Actor | Evidence |
|---|---|---|---|---|
| Candidate navigation | Click nav items | Route change to Dashboard, Jobs, My Applications, Practice Interview | Candidate | `src/components/ui/UserContextNavigation.jsx:168`, `src/components/ui/UserContextNavigation.jsx:170`, `src/components/ui/UserContextNavigation.jsx:176`, `src/components/ui/UserContextNavigation.jsx:182`, `src/components/ui/UserContextNavigation.jsx:188` |
| Candidate core routes | URL paths | Candidate-access pages | Candidate | `src/Routes.jsx:157`, `src/Routes.jsx:165`, `src/Routes.jsx:195`, `src/Routes.jsx:203`, `src/Routes.jsx:211`, `src/Routes.jsx:72` |
| Candidate dashboard load | No form input; page load | Fetches interviews + dashboard analytics + candidate dashboard metrics | Candidate | `src/pages/candidate-dashboard/index.jsx:107`, `src/pages/candidate-dashboard/index.jsx:108`, `src/pages/candidate-dashboard/index.jsx:109` |
| Dashboard activity/scheduling widgets | Interview feed data | Shows recent activity and upcoming interviews | Candidate | `src/pages/candidate-dashboard/index.jsx:390`, `src/pages/candidate-dashboard/index.jsx:391` |
| Public jobs browse/filter | Search + multi-filter form | Filtered and sorted public jobs list | Candidate | `src/pages/jobs/index.jsx:72`, `src/pages/jobs/index.jsx:83`, `src/pages/jobs/index.jsx:522` |
| Application submission | Job + apply form | Creates application via API | Candidate | `src/pages/jobs/components/JobApplicationForm.jsx:154`, `src/services/apiClient.js:1227` |
| Apply form required fields | Resume URL, required question answers | Blocks submit when missing required answers or resume | Candidate | `src/pages/jobs/components/JobApplicationForm.jsx:43`, `src/pages/jobs/components/JobApplicationForm.jsx:451`, `src/pages/jobs/components/JobApplicationForm.jsx:462` |
| Resume update from apply modal | Resume file upload | Updates profile resume | Candidate | `src/pages/jobs/components/JobApplicationForm.jsx:98`, `src/services/apiClient.js:384` |
| My Applications management | Filters/sort + withdraw action | Loads, groups, filters applications; withdraw where allowed | Candidate | `src/pages/candidate-dashboard/components/MyApplicationsList.jsx:174`, `src/pages/candidate-dashboard/components/MyApplicationsList.jsx:271`, `src/pages/candidate-dashboard/components/MyApplicationsList.jsx:233`, `src/pages/candidate-dashboard/utils/candidateApplicationFilters.js:30` |
| Invite acceptance | `token` query param, Accept click | Invitation preview and acceptance; lobby redirect on linked interview | Candidate | `src/pages/invite/index.jsx:44`, `src/pages/invite/index.jsx:69`, `src/pages/invite/index.jsx:73` |
| Lobby to live session | Interview ID | Navigates to live interview session | Candidate | `src/pages/interview-lobby/index.jsx:37`, `src/pages/interview-lobby/index.jsx:88` |

### Company dashboard and related company flow

| Feature | Inputs | Outputs / State Change | Actor | Evidence |
|---|---|---|---|---|
| Company navigation | Click nav items | Route change to Dashboard, Hiring, Interviews, Analytics, Team Members | Company user | `src/components/ui/UserContextNavigation.jsx:195`, `src/components/ui/UserContextNavigation.jsx:205`, `src/components/ui/UserContextNavigation.jsx:216`, `src/components/ui/UserContextNavigation.jsx:226`, `src/components/ui/UserContextNavigation.jsx:234` |
| Company core routes | URL paths | Company pages | Company user | `src/Routes.jsx:80`, `src/Routes.jsx:88`, `src/Routes.jsx:96`, `src/Routes.jsx:104`, `src/Routes.jsx:112`, `src/Routes.jsx:120`, `src/Routes.jsx:128`, `src/Routes.jsx:136` |
| Role permissions | Org role membership | Enables/disables pages/actions by role | Admin/Recruiter/Reviewer | `src/utils/rolePermissions.js:9`, `src/utils/rolePermissions.js:10`, `src/utils/rolePermissions.js:11`, `src/utils/rolePermissions.js:57`, `src/utils/rolePermissions.js:58`, `src/utils/rolePermissions.js:59`, `src/utils/rolePermissions.js:60`, `src/utils/rolePermissions.js:61`, `src/utils/rolePermissions.js:62` |
| Pending approval gating | Organization status | Restricts create-job / invitation operations | Company user | `src/pages/company-dashboard/components/PendingApprovalBanner.jsx:6`, `src/pages/company-dashboard/components/PendingApprovalBanner.jsx:29` |
| Dashboard modules | Loaded interview/metric data | Shows pipeline, hiring metrics, quick actions, reviewer panel, candidate table | Company user | `src/pages/company-dashboard/index.jsx:109`, `src/pages/company-dashboard/index.jsx:512`, `src/pages/company-dashboard/index.jsx:513`, `src/pages/company-dashboard/index.jsx:522`, `src/pages/company-dashboard/index.jsx:528`, `src/pages/company-dashboard/index.jsx:534` |
| Quick actions behavior | Click quick action | Redirects schedule/template to practice setup; report currently logs | Company user | `src/pages/company-dashboard/index.jsx:349`, `src/pages/company-dashboard/index.jsx:350`, `src/pages/company-dashboard/index.jsx:353`, `src/pages/company-dashboard/index.jsx:354`, `src/pages/company-dashboard/index.jsx:357`, `src/pages/company-dashboard/index.jsx:358` |
| Job create/edit | Job form fields | Create/update job and lifecycle state | Admin/Recruiter | `src/pages/company-jobs/index.jsx:762`, `src/pages/company-jobs/index.jsx:774`, `src/pages/company-jobs/index.jsx:775`, `src/pages/company-jobs/index.jsx:776`, `src/pages/company-jobs/index.jsx:781`, `server/src/routes/job.routes.js:17`, `server/src/routes/job.routes.js:36`, `server/src/routes/job.routes.js:39`, `server/src/routes/job.routes.js:40` |
| Job lifecycle ops | Publish/archive/delete | Status transitions; delete can require archive and active-app resolution | Admin/Recruiter | `src/pages/company-jobs/index.jsx:1297`, `src/pages/company-jobs/index.jsx:1309`, `src/pages/company-jobs/index.jsx:1213`, `src/pages/company-jobs/index.jsx:1248`, `src/pages/company-jobs/index.jsx:1273`, `src/pages/company-jobs/index.jsx:1274`, `server/src/controllers/job.controller.js:607`, `server/src/controllers/job.controller.js:627` |
| Applications manager | Load + update status/disposition + start review | Changes application status/disposition; can start review path | Admin/Recruiter | `src/pages/company-dashboard/components/ApplicationsManager.jsx:205`, `src/pages/company-dashboard/components/ApplicationsManager.jsx:206`, `src/pages/company-dashboard/components/ApplicationsManager.jsx:303`, `src/pages/company-dashboard/components/ApplicationsManager.jsx:283`, `src/pages/company-dashboard/components/ApplicationsManager.jsx:355`, `src/pages/company-dashboard/components/ApplicationsManager.jsx:1152` |
| Candidate manager | Filters/detail/contact | Candidate read/detail panel and contact action | Admin/Recruiter/Reviewer | `src/pages/company-dashboard/components/CandidateManager.jsx:122`, `src/pages/company-dashboard/components/CandidateManager.jsx:296`, `src/pages/company-dashboard/components/CandidateManager.jsx:868` |
| Invitation manager | jobId, email, stage | Creates invitations and tracks lifecycle/status | Admin/Recruiter | `src/pages/company-dashboard/components/InvitationManager.jsx:92`, `src/pages/company-dashboard/components/InvitationManager.jsx:95`, `src/pages/company-dashboard/components/InvitationManager.jsx:238`, `src/pages/company-dashboard/components/InvitationManager.jsx:241` |
| Interviews page | Status/schedule/score/date filters | Lists and details interviews | Admin/Recruiter/Reviewer | `src/pages/company-interviews/index.jsx:34`, `src/pages/company-interviews/index.jsx:35`, `src/pages/company-interviews/index.jsx:39`, `src/pages/company-interviews/index.jsx:409`, `src/pages/company-interviews/index.jsx:435` |
| Pipeline board | Move pipelineStatus | Updates interview pipeline status | Admin/Recruiter | `src/pages/company-dashboard/components/CandidatePipeline.jsx:14`, `src/pages/company-dashboard/components/CandidatePipeline.jsx:15`, `src/pages/company-dashboard/components/CandidatePipeline.jsx:16`, `src/pages/company-dashboard/components/CandidatePipeline.jsx:17`, `src/pages/company-dashboard/components/CandidatePipeline.jsx:18`, `src/pages/company-dashboard/components/CandidatePipeline.jsx:107` |
| Review and calibration | Review inputs + recommendation + override | Stores review and optional SME final score override | Admin/Recruiter/Reviewer | `src/pages/company-dashboard/components/ReviewerPanel.jsx:12`, `src/pages/company-dashboard/components/ReviewerPanel.jsx:14`, `src/pages/company-dashboard/components/InterviewReviewEnhanced.jsx:955`, `src/pages/company-dashboard/components/InterviewReviewEnhanced.jsx:960`, `server/src/controllers/review.controller.js:141`, `server/src/controllers/review.controller.js:143`, `server/src/controllers/review.controller.js:144` |
| Analytics page | Time range, export actions | Candidate progress dashboard + PDF/CSV export | Admin/Recruiter | `src/pages/company-analytics/index.jsx:82`, `src/pages/company-dashboard/components/CandidateProgressDashboard.jsx:37`, `src/pages/company-dashboard/components/CandidateProgressDashboard.jsx:845`, `src/pages/company-dashboard/components/CandidateProgressDashboard.jsx:1035` |
| Team members page | Invite email/role, role update, remove, revoke/resend invite | Team membership and invitation lifecycle changes | Admin | `src/pages/company-team-members/index.jsx:27`, `src/pages/company-team-members/index.jsx:28`, `src/pages/company-team-members/index.jsx:29`, `src/pages/company-team-members/index.jsx:30`, `src/pages/company-team-members/index.jsx:97`, `src/pages/company-team-members/index.jsx:98`, `src/pages/company-team-members/index.jsx:193`, `src/pages/company-team-members/index.jsx:342`, `src/pages/company-team-members/index.jsx:355` |

### Statuses/stages extracted from system

| Domain | Statuses / Stages | Evidence |
|---|---|---|
| Organization | `PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED` | `server/src/middleware/inputValidation.middleware.js:113` |
| Job | `DRAFT`, `PUBLISHED`, `ARCHIVED`; derived publish-state (`scheduled`, `live`) | `server/src/middleware/inputValidation.middleware.js:126`, `src/pages/company-jobs/index.jsx:136`, `src/pages/company-jobs/index.jsx:138`, `src/pages/company-jobs/index.jsx:139` |
| Application canonical | `SUBMITTED`, `SCREENING`, `INTERVIEWING`, `SHORTLISTED`, `REJECTED`, `HIRED` | `server/src/middleware/inputValidation.middleware.js:125`, `server/src/utils/applicationLifecycle.util.js:57` |
| Application derived UI | `WITHDRAWN`, `POSITION_CLOSED` | `src/pages/candidate-dashboard/utils/candidateApplicationFilters.js:187`, `src/pages/candidate-dashboard/utils/candidateApplicationFilters.js:190` |
| Application disposition | `NOT_SELECTED`, `SKILL_MISMATCH`, `EXPERIENCE_MISMATCH`, `SALARY_MISMATCH`, `POSITION_FILLED`, `JOB_CLOSED`, `CANDIDATE_WITHDREW`, `HIRED`, `OTHER` | `src/constants/applicationDisposition.js:2` |
| Invitation status | `PENDING`, `ACCEPTED`, `EXPIRED`, `REVOKED` | `src/pages/company-dashboard/utils/invitationFilters.js:10` |
| Invitation stage | `SCREENING`, `INTERVIEW`, `FINAL` | `src/pages/company-dashboard/utils/invitationFilters.js:11`, `src/pages/company-dashboard/components/InvitationManager.jsx:34` |
| Invitation lifecycle | `AWAITING_CANDIDATE`, `IN_PROGRESS`, `ACCEPTED_WITHOUT_INTERVIEW`, `ACCEPTED_WITH_INTERVIEW`, `EXPIRED`, `REVOKED` | `src/pages/company-dashboard/utils/invitationFilters.js:21` |
| Interview | `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `PAUSED`, `CANCELLED` | `server/src/middleware/inputValidation.middleware.js:128` |
| Pipeline | `SCREENING`, `INTERVIEW`, `FINAL`, `HIRED`, `REJECTED` | `server/src/middleware/inputValidation.middleware.js:129`, `src/pages/company-dashboard/components/CandidatePipeline.jsx:14` |
| Review decision | `ADVANCE`, `HOLD`, `REJECT` | `src/pages/company-dashboard/components/ReviewerPanel.jsx:12` |
| Recommendation scale | `STRONG_YES`, `YES`, `MAYBE`, `NO`, `STRONG_NO`, `UNDECIDED` | `src/pages/company-dashboard/components/InterviewReviewEnhanced.jsx:955` |
| Team invitation | `PENDING`, `ACCEPTED`, `REVOKED` | `server/src/services/firebaseData.service.js:3338`, `server/src/services/firebaseData.service.js:3415`, `server/src/services/firebaseData.service.js:3433` |

### Integrations/dependencies observed

1. Email notifications: invitation/application/status updates via queued email jobs.  
Evidence: `server/src/controllers/invitation.controller.js:93`, `server/src/controllers/application.controller.js:258`, `server/src/controllers/application.controller.js:579`, `server/src/services/email.service.js:1129`, `server/src/services/email.service.js:1141`, `server/src/services/email.service.js:1152`.

2. Realtime updates: org/candidate/public/admin feed updates.  
Evidence: `server/src/services/firebaseData.service.js:920`, `server/src/services/firebaseData.service.js:925`, `src/constants/realtimeFeedEvents.js:1`.

3. AI interview evaluation and scoring.  
Evidence: `server/src/controllers/interview.controller.js:457`, `server/src/controllers/interview.controller.js:464`, `server/src/controllers/interview.controller.js:467`.

4. Storage/uploads: resume and job advert media handling.  
Evidence: `src/pages/jobs/components/JobApplicationForm.jsx:98`, `src/services/apiClient.js:834`, `src/services/apiClient.js:855`, `server/src/controllers/job.controller.js:169`.

### Gaps/contradictions identified

1. Stage model mismatch: application uses `INTERVIEWING/SHORTLISTED`; pipeline uses `INTERVIEW/FINAL`.  
Evidence: `server/src/middleware/inputValidation.middleware.js:125`, `server/src/middleware/inputValidation.middleware.js:129`.

2. Candidate scheduling widget treats `PENDING` as interview status, but backend interview enum excludes `PENDING`.  
Evidence: `src/pages/candidate-dashboard/components/SchedulingWidget.jsx:18`, `server/src/middleware/inputValidation.middleware.js:128`.

3. Company interviews UI does not expose `PAUSED` filter although backend supports it.  
Evidence: `src/pages/company-interviews/index.jsx:435`, `server/src/middleware/inputValidation.middleware.js:128`.

4. Quick actions include placeholders (schedule/template/report).  
Evidence: `src/pages/company-dashboard/index.jsx:350`, `src/pages/company-dashboard/index.jsx:354`, `src/pages/company-dashboard/index.jsx:358`.

5. Documentation says "fully functional/production-ready", but code shows partial areas and placeholders.  
Evidence: `docs/ROLE_BASED_ACCESS_IMPLEMENTATION.md:298`, `src/pages/company-dashboard/index.jsx:357`.

6. Metrics docs explicitly mark partial endpoint coverage while UI includes broader metric concepts.  
Evidence: `docs/COMPANY_DASHBOARD_DUMMY_DATA_CLEANUP.md:174`, `docs/COMPANY_DASHBOARD_DUMMY_DATA_CLEANUP.md:194`.

7. `[UNKNOWN - needs confirmation]` Interview scheduling source of truth (explicit scheduler for `scheduledFor`, timezone, meeting link) appears incomplete in ATS pages and APIs.
   - Missing screen/section: scheduling editor in `src/pages/company-interviews/index.jsx`.
   - Missing API clarity: create-allowed interview fields in `server/src/middleware/inputValidation.middleware.js:762`.

8. `[UNKNOWN - needs confirmation]` Offer lifecycle surface appears absent in company/candidate ATS routes and API groupings.
   - Missing screen/section: any offer page in `src/Routes.jsx` and `src/components/ui/UserContextNavigation.jsx`.
   - Missing API section: no dedicated offers API group in `src/services/apiClient.js`.

9. `[UNKNOWN - needs confirmation]` Background/reference check stage appears absent in ATS flow surfaces.
   - Missing screen/section: candidate/company hiring dashboards (only account onboarding exists).

---

## 2) Real-World Process Research (Current Industry Standard)

### 10-step industry-standard hiring + interview flow

1. Requisition and hiring-plan definition (role scope, competencies, interview kit/scorecards).  
2. Job posting and sourcing activation (job boards, referrals, inbound pipelines).  
3. Application intake and initial screen (knockout criteria, recruiter triage).  
4. Recruiter screening conversation.  
5. Structured interview plan setup by stage/competency with assigned scorecards.  
6. Interview scheduling coordination (self-scheduling/panel/timezone/rescheduling).  
7. Interview execution and scorecard submission by interviewers.  
8. Debrief/roundup and disposition decision (advance, hold, reject).  
9. Offer approvals, issue, and negotiation/revision loop.  
10. Final checks (background/reference when needed), final hire decision, onboarding handoff.

### Common variants

1. Intern/junior flows are typically shorter and fundamentals-heavy.  
2. Senior/lead flows usually add deeper panel and stakeholder rounds.  
3. Technical roles more often include coding or skills assessments before later interviews.  
4. Non-technical roles more often use presentations/case/work-sample evaluation.

### Sources (link + publish/update dates)

1. Greenhouse, "Structured hiring process setup guide," updated June 5, 2024  
https://support.greenhouse.io/hc/en-us/articles/10833864920091-Structured-hiring-process-setup-guide

2. Greenhouse, "Best practices for creating scorecards," updated February 6, 2026  
https://support.greenhouse.io/hc/en-us/articles/115005326003-Best-practices-for-creating-scorecards

3. Greenhouse, "Interview scheduling overview," updated December 17, 2025  
https://support.greenhouse.io/hc/en-us/articles/360015237851-Interview-scheduling-overview

4. Greenhouse, "MyGreenhouse: Candidate stages and statuses," updated January 2, 2026  
https://support.greenhouse.io/hc/en-us/articles/360046465932-MyGreenhouse-Candidate-stages-and-statuses

5. Greenhouse, "Informed Hiring interview process guide," updated July 10, 2025  
https://support.greenhouse.io/hc/en-us/articles/4408838805275-Informed-Hiring-interview-process-guide

6. Lever, "Use Easy Book Links to schedule interviews," published July 24, 2025  
https://help.lever.co/hc/en-us/articles/20087395610269-Use-Easy-Book-Links-to-schedule-interviews

7. Lever, "Understanding Candidate Pipeline Structure," published July 30, 2024  
https://help.lever.co/hc/en-us/articles/360033657251-Understanding-Candidate-Pipeline-Structure

8. Indeed, "The hiring process: A complete guide," updated December 16, 2025  
https://www.indeed.com/hire/c/info/stages-of-the-hiring-process

9. CFPB, "Background Dossiers and Algorithmic Scores for Hiring...," published January 11, 2024; modified October 24, 2024  
https://www.consumerfinance.gov/about-us/newsroom/cfpb-issues-guidance-to-protect-workers-against-the-use-of-biased-and-inaccurate-background-screening-and-hiring-reports/

---

## 3) Proposed End-to-End Flow for OUR System (Final)

### A) Step-by-step process (candidate + company perspectives)

1. Job intake and draft setup
   - Candidate dashboard: not visible yet.
   - Company dashboard: create draft job with requirements, compensation, and custom application questions.
   - Trigger/notifications: none external yet.
   - Required data: job core fields, questions, status=`DRAFT`.

2. Publish role (immediate or scheduled)
   - Candidate dashboard: role appears when public/published conditions are met.
   - Company dashboard: move to `PUBLISHED`, optional `scheduledPublishAt`, manage posting duration.
   - Trigger/notifications: public/org realtime job events.
   - Required data: publish metadata (`status`, `scheduledPublishAt`, `postingDuration`, `publishedAt`).

3. Candidate applies
   - Candidate dashboard: submit application with resume + optional cover letter + required answers.
   - Company dashboard: receives new application in Applications/Candidates views.
   - Trigger/notifications: application-submitted realtime + confirmation email.
   - Required data: Application object with snapshots and initial status history.

4. Initial triage
   - Candidate dashboard: status moves to "Under Review/Screening."
   - Company dashboard: recruiter moves `SUBMITTED -> SCREENING` (or other allowed transitions).
   - Trigger/notifications: status update realtime + email.
   - Required data: status transition metadata, reviewer, optional disposition.

5. Invitation-led path (optional fast-track)
   - Candidate dashboard: accepts invite via tokenized link.
   - Company dashboard: sends invitation (`jobId`, `email`, `stage`) and monitors lifecycle.
   - Trigger/notifications: invite email + invitation-created/accepted realtime.
   - Required data: Invitation object, acceptance lock fields, linked interview/application IDs.

6. Interview planning
   - Candidate dashboard: interview card appears once interview object exists.
   - Company dashboard: configure round (`jobStage`, `pipelineStatus`, reviewers, interview config).
   - Trigger/notifications: interview-created event.
   - Required data: Interview object (`mode`, `jobStage`, `pipelineStatus`, `reviewerAssignments`, `duration`, `config`).

7. Scheduling and rescheduling
   - Candidate dashboard: should confirm/reschedule with timezone-safe details.
   - Company dashboard: should schedule/reschedule/cancel and notify all participants.
   - Trigger/notifications: schedule-change notifications.
   - Required data: Interview Slot object (`scheduledFor`, timezone, meeting link, interviewers, status).
   - `[UNKNOWN - needs confirmation]` explicit scheduling management implementation is incomplete/unclear.

8. Interview execution
   - Candidate dashboard: interview lobby -> live interview session.
   - Company dashboard: monitors in-progress/completed outcomes.
   - Trigger/notifications: interview-started/interview-ended realtime.
   - Required data: answers/transcript, consent metadata, evaluation, overall score.

9. Scorecards and debrief
   - Candidate dashboard: sees resulting stage/status changes only.
   - Company dashboard: reviewers submit decisions/notes/recommendations and optional SME override.
   - Trigger/notifications: review-submitted realtime.
   - Required data: review scores, recommendation, override fields, final score source.

10. Decision and disposition
   - Candidate dashboard: sees final status and outcome label.
   - Company dashboard: sets final decision/disposition (or handles withdrawal/job-closed outcomes).
   - Trigger/notifications: status update email + realtime.
   - Required data: disposition code/category/reason/notes + audit trail.

11. Offer and close (new required module)
   - Candidate dashboard: receive/accept/decline/counter offer.
   - Company dashboard: create/revise/send offers and finalize to `HIRED`.
   - Trigger/notifications: offer lifecycle events.
   - Required data: Offer object with versioning + approvals + acceptance state.
   - `[UNKNOWN - needs confirmation]` dedicated offers surface currently not present.

### B) Canonical stage model and transitions

#### Application pipeline (canonical)

| Stage | Allowed next transitions | Terminal |
|---|---|---|
| `SUBMITTED` | `SCREENING`, `INTERVIEWING`, `SHORTLISTED`, `REJECTED`, `HIRED` | No |
| `SCREENING` | `INTERVIEWING`, `SHORTLISTED`, `REJECTED`, `HIRED` | No |
| `INTERVIEWING` | `SHORTLISTED`, `REJECTED`, `HIRED` | No |
| `SHORTLISTED` | `INTERVIEWING`, `REJECTED`, `HIRED` | No |
| `OFFER_DRAFT` (new) | `OFFER_SENT`, `REJECTED` | No |
| `OFFER_SENT` (new) | `OFFER_ACCEPTED`, `OFFER_DECLINED`, `OFFER_REVISED`, `REJECTED` | No |
| `OFFER_REVISED` (new) | `OFFER_SENT`, `REJECTED` | No |
| `OFFER_ACCEPTED` (new) | `HIRED` | No |
| `OFFER_DECLINED` (new) | `REJECTED` or archive outcome | Yes (business terminal) |
| `REJECTED` | none | Yes |
| `WITHDRAWN` (derived) | none | Yes |
| `POSITION_CLOSED` (derived) | none | Yes |
| `HIRED` | none | Yes |

#### Interview lifecycle sub-state

| Stage | Allowed transitions | Terminal |
|---|---|---|
| `SCHEDULED` | `IN_PROGRESS`, `PAUSED`, `CANCELLED`, `RESCHEDULE_REQUESTED` (new), `NO_SHOW` (new) | No |
| `RESCHEDULE_REQUESTED` (new) | `SCHEDULED`, `CANCELLED` | No |
| `IN_PROGRESS` | `PAUSED`, `COMPLETED`, `CANCELLED` | No |
| `PAUSED` | `IN_PROGRESS`, `CANCELLED` | No |
| `NO_SHOW` (new) | `SCHEDULED` (reschedule) or application rejection path | Yes |
| `COMPLETED` | none | Yes |
| `CANCELLED` | none | Yes |

### C) Core data objects (minimum)

| Entity | Key fields | Relationships |
|---|---|---|
| Job | `id`, `organizationId`, `title`, `department`, `location`, `employmentType`, `experienceLevel`, `compensationRange`, `description`, `requirements[]`, `responsibilities[]`, `skills[]`, `applicationQuestions[]`, `status`, `postingDuration`, `scheduledPublishAt`, `publishedAt`, `expiresAt` | 1 Job -> many Applications, Invitations, Interviews |
| Candidate Profile | `userId`, `fullName`, `email`, `phoneNumber`, `resumeUrl`, `targetRole`, `experienceLevel`, `location`, `linkedinUrl`, `portfolioUrl`, `skills[]` | 1 Candidate -> many Applications and Interviews |
| Application | `id`, `jobId`, `candidateId`, `organizationId`, `status`, `resumeUrl`, `coverLetter`, `answers[]`, `submittedAt`, `reviewedAt`, `reviewedBy`, `statusChangedAt`, `dispositionCode`, `dispositionReason`, `dispositionNotes`, `statusHistory[]`, `interviewId` | Many->1 Job, Many->1 Candidate, optional link to active Interview |
| Interview Plan/Round | `id`, `mode`, `candidateId`, `companyId`, `organizationId`, `jobId`, `jobStage`, `pipelineStatus`, `status`, `reviewerAssignments[]`, `jobRole`, `duration`, `config` | 1 Application -> many Rounds; 1 Round -> many Reviews |
| Interview Slot | `interviewId`, `scheduledFor`, `timezone`, `meetingLink`, `duration`, `interviewerIds[]`, `locationType` | 1 Round -> current slot (+ optional slot history) |
| Feedback/Scorecard | `id`, `interviewId`, `reviewerId`, `decision`, `recommendation`, criterion scores, `notes`, `overrideOverall`, `createdAt` | Many Reviews per Interview |
| Assessment | `id`, `applicationId`/`interviewId`, `type`, `score`, `result`, `provider`, `artifactUrl`, `completedAt` | Optional per stage/role |
| Offer | `id`, `applicationId`, `candidateId`, `jobId`, `status`, `version`, compensation fields, `startDate`, `expiresAt`, `revisionHistory[]`, `acceptedAt`, `declinedAt` | 1 Application -> 0..many Offer versions |
| Message/Notification | `id`, `recipientId`, `channel`, `eventType`, `payload`, `sentAt`, `readAt`, `deliveryStatus` | Event fan-out object |
| Audit Log | `id`, `actorId`, `actorRole/type`, `action`, `targetType`, `targetId`, `metadata`, `createdAt` | Cross-cutting append-only trail |

### D) Edge cases checklist

1. Reschedule/cancel with complete slot history and notification fan-out.
2. Timezone correctness: store UTC + timezone; render local; DST-safe behavior.
3. Multiple interviewers/panel rounds with per-interviewer scorecards.
4. Duplicate applications and policy-driven reapply behavior.
5. Offer negotiation with immutable version history.
6. Candidate no-show handling and configurable follow-up.
7. Role closed during active process with automatic disposition.
8. Invitation acceptance concurrency and idempotency.
9. Late reviewer submissions after debrief.
10. Strict terminal-state protections.

---

## 4) Implementation Notes (Practical)

### MUST

1. Implement explicit interview scheduling APIs/UI (`schedule`, `reschedule`, `cancel`, `no-show`) with timezone-safe slots.  
2. Add Offer module (data model + API + company/candidate screens + notifications + audit).  
3. Normalize stage taxonomy between application status and pipeline board (single canonical mapping).  
4. Add transition guards for interview lifecycle similar to application transition validation.  
5. Add end-to-end tests for invite idempotency, scheduling branches, no-show, offer revisions, and job closure impacts.

### SHOULD

1. Add in-app notification inbox layered over existing realtime/email events.  
2. Add background/reference check tracking with decision gates before hire finalization.  
3. Add calendar integrations and standardized meeting-link generation.  
4. Add interviewer availability and panel conflict checks.

### NICE-TO-HAVE

1. SLA automation for stale applications/pending scorecards.
2. Debrief templates per role family.
3. HRIS/onboarding handoff integrations after accepted offers.
