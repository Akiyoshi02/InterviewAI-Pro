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

- Company jobs page updates without manual refresh.
- Public job detail page updates without manual refresh when that specific job changes.
- Public jobs list page does not auto-refresh by design (to avoid disruptive list churn while browsing).

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
