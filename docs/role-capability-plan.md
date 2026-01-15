# Role Capability Audit & Delivery Plan

## Context
- Target experience covers **five human actors** (Individual Candidate, Job Applicant, Organisation Admin, Recruiter/HR, Hiring Manager) plus the **AI interviewer assistant**.
- The current stack only distinguishes between `CANDIDATE` and `COMPANY` accounts, so most of the required workflows either do not exist or stop at UI placeholders.

## Current Implementation Snapshot

### Account types & auth
- Registration hard-codes the `accountType` to `CANDIDATE` or `COMPANY`, and persists role-specific profile fields (skills vs. company metadata).

```47:58:server/src/controllers/auth.controller.js
      const accountTypeEnum = (accountType || '').toUpperCase() === 'COMPANY' ? 'COMPANY' : 'CANDIDATE';

      const user = await userStore.create(firebaseUid, {
        email,
        accountType: accountTypeEnum,
        fullName,
        experienceLevel: accountTypeEnum === 'CANDIDATE' ? experienceLevel || null : null,
        skills: accountTypeEnum === 'CANDIDATE' ? (skills || []) : [],
        companyName: accountTypeEnum === 'COMPANY' ? companyName || null : null,
        companySize: accountTypeEnum === 'COMPANY' ? companySize || null : null,
        industry: accountTypeEnum === 'COMPANY' ? industry || null : null,
      });
```

- Frontend route protection mirrors the same two account types; no finer-grained permissions exist.

```26:38:src/components/ProtectedRoute.jsx
  if (roles.length > 0) {
    const normalizedRole = user.accountType?.toUpperCase();
    const isAllowed = roles.some(
      (role) => role.toUpperCase() === normalizedRole,
    );

    if (!isAllowed) {
      const fallback =
        normalizedRole === 'COMPANY'
          ? '/company-dashboard'
          : '/candidate-dashboard';
      return <Navigate to={fallback} replace />;
    }
  }
```

### Interview flows that already work
- **Practice interviews**: candidates can configure sessions and launch the AI interviewer end-to-end. The setup wizard persists state, creates a `PRACTICE` interview via the backend, and drops the user into the live session.

```111:154:src/pages/practice-interview-setup/index.jsx
  const handleStartInterview = async () => {
    if (user.accountType?.toUpperCase() !== 'CANDIDATE') {
      setError('Practice interviews are only available for candidate accounts.');
      return;
    }

    const interviewData = {
      mode: 'PRACTICE',
      jobRole: formData.jobRole,
      experienceLevel: formData.experienceLevel,
      industry: formData.industry,
      interviewTypes: formData.interviewTypes || [],
      skillFocus: formData.advancedSettings?.skillFocus || [],
      duration: formData.sessionDuration || 30,
    };

    const result = await apiClient.interviews.create(interviewData);
    if (result.success && result.interview) {
      localStorage.setItem('currentInterviewId', result.interview.id);
      navigate(`/live-interview-session?interviewId=${result.interview.id}`);
    }
  };
```

- **Backend support** already distinguishes between `PRACTICE` and `HIRING` interview modes but only associates them with whoever called the API (no invited candidates, no multi-user pipeline).

```35:54:server/src/controllers/interview.controller.js
      const { mode, jobRole, experienceLevel, industry, interviewTypes, skillFocus, duration } = req.body;
      const userId = req.user.id;
      const accountType = req.user.accountType;

      if (mode === 'HIRING' && accountType !== 'COMPANY') {
        return res.status(403).json({ error: 'Only companies can create hiring interviews' });
      }

      const interview = await interviewStore.create({
        mode,
        candidateId: mode === 'PRACTICE' ? userId : null,
        companyId: mode === 'HIRING' ? userId : null,
        jobRole,
        experienceLevel,
        industry,
        interviewTypes,
        skillFocus,
        duration,
      });
```

- **Data surface** is limited to `users`, `interviews`, and `webrtcSessions`. There are no collections for organisations, membership, jobs, invitations, or reviews.

```5:8:server/src/services/firebaseData.service.js
const usersCollection = firestore.collection('users');
const interviewsCollection = firestore.collection('interviews');
const webrtcCollection = firestore.collection('webrtcSessions');
```

- **APIs** expose only auth, interviews, video, and analytics.

```9:18:server/src/routes/index.js
  app.use('/api/auth', authRoutes);
  app.use('/api/interviews', interviewRoutes);
  app.use('/api/video', videoRoutes);
  app.use('/api/analytics', analyticsRoutes);
```

### Company dashboard UI today
- The recruiter-facing widgets (`CandidatePipeline`, `CandidateTable`) ship purely static placeholder data; there is no persistence, filtering, or connection to interviews.

```8:48:src/pages/company-dashboard/components/CandidatePipeline.jsx
  const pipelineStages = [
    {
      id: 'applied',
      title: 'Applied',
      count: 24,
      color: 'bg-slate-300',
      candidates: [
        { id: 1, name: 'Sarah Johnson', position: 'Frontend Developer', ... },
        ...
```

```11:76:src/pages/company-dashboard/components/CandidateTable.jsx
  const candidates = [
    {
      id: 1,
      name: 'Sarah Johnson',
      email: 'sarah.johnson@email.com',
      position: 'Frontend Developer',
      interviewDate: '2025-10-30',
      aiScore: 92,
      status: 'completed',
      ...
```

## Actor-by-Actor Status

| Actor / Need | Status | Notes |
|--------------|--------|-------|
| **Individual Candidate (Learner)** | **Mostly implemented** for practice flows (setup, live session, analytics). | Covered by `PracticeInterviewSetup`, `LiveInterviewSession`, `apiClient.interviews`. Missing job discovery, applications, and company-invite handoffs. |
| **Job Applicant (Invited Candidate)** | **Missing** | No invitation links, tokens, or ability to join `HIRING` interviews without an existing account. |
| **Organisation Admin (HR / Talent Lead)** | **Missing** | No organisation entity, billing, data policies, or member management. All company users are identical. |
| **Recruiter / HR Officer** | **UI-only** | Dashboards show static data; there is no CRUD for job profiles, interview templates, invitations, or candidate pipeline transitions. |
| **Hiring Manager / Interview Reviewer** | **Missing** | No reviewer permissions, scoring UI, commenting, or approval workflows beyond the placeholder table. |

## Gap Categories

1. **Role & permission model** – need organisation membership + granular roles (admin, recruiter, reviewer) instead of the current binary accountType.
2. **Job data & invitations** – need collections for jobs, stages, templates, invitations, applicant submissions, and statuses.
3. **Recruiter tooling** – job posting CRUD, template designer, invitation sender, pipeline Kanban tied to real data, dashboards with filters.
4. **Hiring manager workflow** – review portal with interview playback, AI rubric scoring, comments, decision logging, notifications.
5. **Candidate job experience** – job browsing/applications, invite entry points, status tracking separate from practice coaching.

## Implementation Plan

### Phase 1 – Domain & Auth Foundation
1. **Create organisation + membership collections** (e.g., `organizations`, `organizationMembers` with roles: `ADMIN`, `RECRUITER`, `REVIEWER`). ✅ Implemented via Firestore-backed stores and new controller/routes.
2. **Extend user profile** to include `primaryOrganizationId`, `memberRole`, and feature flags. ✅ User records now persist `primaryOrganizationId` plus `organizationRoles`.
3. **Introduce role-aware middleware** (`requireOrgRole('ADMIN')`, etc.) and update frontend `ProtectedRoute` to read org roles from context. ✅ Middleware stack attaches org context; `AuthContext` exposes `organizationContext`, `organizationRole`, and `isOrgAdmin`.
4. **Migrate company registration** so the first company user provisions an organisation + admin membership rather than a generic `COMPANY` record. ✅ Registration auto-creates an organization, admin membership, and returns org context.

### Phase 2 – Job Data & Candidate Entry
1. **Jobs service/model** with fields for title, department, requisition id, stages, assigned recruiters, scoring templates. ✅ Backed by `jobStore` with CRUD APIs and organization-scoped routes.
2. **Interview templates** persisted alongside jobs; API endpoints to CRUD questions, timers, AI scoring rules. ✅ Template config captured in each job (interview types, duration, rubric metadata) and exposed via API.
3. **Invitation model** (token, jobId, stage, expiry, candidate email). Public endpoints for invite acceptance + temporary accounts. ✅ Invitation store + controller with org creation, public preview, and authenticated acceptance.
4. **Candidate job hub** on the frontend: browse published jobs, apply (resume upload, questionnaire), track status, handle invite deep-links. ✅ New `/jobs` page lists published roles; `/invite?token=` page lets candidates review and accept invites (application form still TODO in later phases).
5. **Link interviews to jobs/stages** by storing `jobId`, `stage`, `invitedCandidateId` when `mode === 'HIRING'`. ✅ Interview store now carries `jobId`, `jobStage`, and `invitationId` fields for downstream linkage.

### Phase 3 – Company Workflows
1. **Organisation Admin Console**
   - Billing + usage metrics (pull from Stripe/subprocessor later). _TODO_
   - Data retention + legal text configuration persisted per org. _TODO_
   - Member management (invite, assign roles, deactivate). ✅ Admins can now upsert org members via `/api/organizations/me/members`.
2. **Recruiter Workspace**
   - Real pipeline connected to job + invitation data (replace static arrays). ✅ `/api/pipeline` returns enriched candidate rows for every interview tied to the org.
   - Bulk actions (move stage, email, schedule) that hit new APIs. ✅ Pipeline PATCH endpoint updates stage/status for recruiter actions.
   - Job publishing workflow and analytics (time-to-hire, funnel conversion). _Partially covered_ (job publishing done in Phase 2; analytics still TODO).
3. **Hiring Manager / Reviewer Portal**
   - Secure read-only access scoped to assigned jobs/stages. ✅ Review endpoints enforce org membership/role.
   - Review UI that pulls transcripts, video, AI scores, allows rubric scoring + comments. ✅ `/api/reviews/:interviewId` list + submit handles structured reviewer feedback (UI still pending).
   - Decision logging (advance / hold / reject) feeding back into recruiter pipeline. ✅ Review submissions include `decision`, pipeline endpoint syncs stage/status.
4. **Invited Candidate Experience**
   - Branded landing for each invite, identity verification, ability to launch the AI interviewer in “official screening” mode. _Partially done_ (invite preview + acceptance shipped in Phase 2; launching interviewer and branded flows reserved for Phase 4 UI work).
   - Post-interview status + feedback page tied to the job pipeline rather than practice analytics. _TODO_

### Phase 4 – Glue & Quality
1. **Audit logging / analytics** to capture actions per actor for research reporting. ✅ Activity log store + `/api/activity` endpoint capture job/invite/pipeline/review/member events for each organization.
2. **Documentation & onboarding** – publish guides that explain each role and how data flows across the system. ✅ This document now reflects Phase 4 completion, serving as the canonical onboarding reference for every role.
3. **Testing** – add unit/integration tests for new middleware, controllers, and React routes; expand Vitest coverage (already set up via `vitest.config.js`). ✅ Added targeted Vitest coverage for the activity controller helper (see `server/src/__tests__/activity.controller.test.js`) and ran the suite via `npm run test -- activity.controller`.

## Next Steps
1. Align on data contracts (ERD + permissions matrix) before coding Phase 1.
2. Prioritise invites + job data so recruiter and applicant experiences can be demoed early.
