# Realtime Verification Checklist

Use this checklist to confirm the full realtime implementation in a live environment.

## 1. One-time setup

1. Login to Firebase CLI:
```bash
firebase login
```
2. Select project:
```bash
firebase use <YOUR_FIREBASE_PROJECT_ID>
```
3. Deploy database rules:
```bash
firebase deploy --only database
```
4. Start backend and frontend.

## 2. Local verification already completed

- `npm test -- --run` passed.
- `npm run build` passed.
- `node --check` passed for all edited backend files.

## 3. Live multi-user verification

Open at least 3 sessions:

- Candidate user
- Company user (org member)
- System admin user

### A. Jobs realtime

1. Open company jobs page in one tab.
2. Open public jobs page in another tab.
3. Create/update/publish/archive/delete a job from company side.

Expected:

- Company jobs page shows an "updates available" indicator and lets the recruiter refresh when ready (non-disruptive list mode).
- Public job detail page updates without manual refresh when that specific job changes.
- Public job detail page does not refetch for unrelated jobs (event payload is scoped by `jobId`).
- Public jobs list page does not auto-refresh by design (to avoid disruptive list churn while browsing).
- Public jobs list page shows an "updates available" indicator and refreshes when the user clicks refresh.

### A2. Company interviews list realtime (non-disruptive mode)

1. Open company interviews page.
2. Trigger interview lifecycle changes from another tab (create/start/end/pipeline/review events).

Expected:

- Company interviews list shows an "updates available" indicator instead of force-refreshing while browsing.
- Refresh action applies the latest interview list state.
- Interview detail-focused views still update in realtime.

### B. Applications realtime

1. Candidate applies to a job.
2. Company applications panel is open.
3. Company changes application status.
4. Candidate applications list is open.

Expected:

- Company sees submission instantly.
- Candidate sees status changes instantly.
- Withdrawals update both candidate and company views instantly.

### C. Invitations realtime

1. Open invitation manager.
2. Create invitations from another tab.
3. Accept invitation as candidate.

Expected:

- Invitation list updates instantly.
- Interview creation side-effects appear without manual refresh.

### D. Team member + team invitation realtime

1. Open team members page.
2. Send/revoke/resend team invitations from another tab.
3. Accept a team invitation in a separate account/tab.
4. Add/update member role.

Expected:

- Team member and pending invitation lists update instantly.

### E. Pipeline realtime

1. Open recruiter pipeline board.
2. Move candidate stage from another tab.

Expected:

- Pipeline board updates instantly.

### F. Admin panel realtime

Keep these open while performing admin actions in another tab:

- Pending approvals
- All organizations
- Platform audit logs
- System settings
- Fairness panel
- Training data manager
- Also validate two non-admin triggers:
- New company registration (should appear in pending approvals)
- Organization re-review request (should reappear in pending approvals)

Expected:

- All panels refresh automatically from admin feed updates.

### G. Review realtime

1. Open reviewer panel / interview review view.
2. Submit a review from another tab.
3. Submit a review with score override enabled.

Expected:

- Reviewer-facing views update instantly.
- Interview feed-driven pages refresh without manual reload.
- Score override changes propagate instantly.

### H. Existing realtime flows regression check

Confirm still working:

- Interview session realtime (`sessions/*`)
- Interview feed-driven dashboards
- Live chat realtime
- Maintenance mode realtime
- Organization approval status realtime

## 4. Security checks

1. Non-member user attempts to read another organization feed.
2. Non-admin user attempts to read admin feed.
3. Non-owner user attempts to read another candidate feed.

Expected:

- Access denied by RTDB rules.

## 5. Final pass criteria

- [ ] Rules deployed.
- [ ] Jobs realtime verified.
- [ ] Applications realtime verified.
- [ ] Invitations realtime verified.
- [ ] Team/member realtime verified.
- [ ] Pipeline realtime verified.
- [ ] Admin panels realtime verified.
- [ ] Review realtime verified.
- [ ] Existing realtime flows not broken.
- [ ] Security checks passed.

## 6. ATS lifecycle hardening verification (new)

### A. Soft-delete behavior

1. Create and publish a job.
2. Archive the job.
3. Delete the job from company jobs page.

Expected:

- Job disappears from active company job listings.
- Job is no longer returned in public job listings/detail.
- Existing applications remain accessible in application views via snapshot context.

### B. Active application resolution guard

1. Keep at least one application in a non-terminal state.
2. Attempt job delete without resolution options.

Expected:

- API/UI blocks delete with active-resolution requirement.
- When user confirms resolve flow, active applications become terminal before job removal from active lists.

### C. Candidate transparency for closed roles

1. Resolve-and-delete a job with active applications.
2. Open candidate applications view.

Expected:

- Application displays closed/deleted role context (not blank/unknown).
- Status is visible with closure context (Position Closed / rejected via closure disposition).
- Candidate receives closure status communication if notifications were enabled.

### D. Disposition reason capture

1. Recruiter manually sets an application to `REJECTED`.
2. Provide a disposition option in the prompt.
3. Re-open application details.

Expected:

- Disposition reason/code appears in recruiter view.
- Candidate view surfaces the disposition label/reason.
- Status trail metadata is persisted by backend.

## 7. ATS core governance + scale verification (new)

### A. Status transition guardrails

1. Move an application through normal stages (e.g., `SUBMITTED -> SCREENING -> INTERVIEWING -> REJECTED`).
2. Attempt invalid transition from terminal state (e.g., `REJECTED -> SCREENING`).

Expected:

- Valid transitions succeed.
- Invalid terminal transition is rejected with conflict response and allowed-next-status metadata.

### B. Bulk application updates

1. Select a set of applications in different jobs within same organization.
2. Call bulk status endpoint (or wire UI action) with one target status.

Expected:

- Endpoint returns updated/skipped summary with per-item result.
- Realtime feeds update for candidate and organization viewers.

### C. Invitation-to-application continuity

1. Create a job invitation.
2. Accept invitation as candidate.
3. Open company applications view and candidate applications view.

Expected:

- Accepted invitation creates or advances an ATS application into interviewing flow.
- Application appears in both company and candidate application surfaces.
- Duplicate active invitation for same job+email is blocked.

### D. Organization interview scope

1. Create interview with one recruiter in organization.
2. Open company interview list and interview detail with a different recruiter/reviewer in same organization.

Expected:

- Interview appears in organization-scoped company list.
- Authorized organization member can access detail successfully.
