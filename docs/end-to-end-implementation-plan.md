# End-to-End System Implementation Plan

## Overview

This document details the complete implementation plan for the InterviewAI Pro platform based on the defined actor system and workflows.

---

## Actor System Requirements

### 1. System Admin (Platform-Level) - NEW ROLE ⚠️

**Account Type:** `SYSTEM_ADMIN`

**Database Schema Changes:**
```javascript
// users collection - add new accountType
accountType: 'CANDIDATE' | 'COMPANY' | 'SYSTEM_ADMIN'

// organizations collection - add approval fields
{
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED',
  approvedBy: string | null,  // system admin user ID
  approvedAt: string | null,
  rejectedReason: string | null,
  suspensionReason: string | null,
  // ... existing fields
}

// NEW: systemSettings collection
{
  id: string,
  featureFlags: {
    jobBoard: boolean,
    fairnessDashboard: boolean,
    experimentalFeatures: boolean,
  },
  maintenanceMode: boolean,
  defaultAIConfig: {
    model: string,
    temperature: number,
    // ... other AI settings
  },
  dataRetention: {
    defaultDays: number,
    minDays: number,
    maxDays: number,
  },
  updatedBy: string,
  updatedAt: string,
}

// NEW: platformAuditLogs collection
{
  id: string,
  actorId: string,
  actorType: 'SYSTEM_ADMIN',
  action: string,  // ORG_APPROVED, ORG_REJECTED, ORG_SUSPENDED, SETTINGS_UPDATED, etc.
  targetType: string,  // ORGANIZATION, SETTINGS, USER
  targetId: string,
  metadata: object,
  timestamp: string,
}
```

**API Endpoints:**
```
POST   /api/admin/auth/seed-admin          # Create first system admin (one-time)
GET    /api/admin/organizations/pending    # List pending org approvals
GET    /api/admin/organizations            # List all organizations
GET    /api/admin/organizations/:id        # Get organization details
POST   /api/admin/organizations/:id/approve # Approve organization
POST   /api/admin/organizations/:id/reject  # Reject organization
POST   /api/admin/organizations/:id/suspend # Suspend organization
POST   /api/admin/organizations/:id/activate # Reactivate organization
GET    /api/admin/settings                 # Get system settings
PATCH  /api/admin/settings                 # Update system settings
GET    /api/admin/audit-logs               # Get platform audit logs
GET    /api/admin/users                    # List all users (with filters)
GET    /api/admin/stats                    # Platform-wide statistics
```

**Frontend Pages:**
```
/system-admin-dashboard          # Main admin dashboard
  /organizations                 # Organization management
    /pending                     # Pending approvals queue
    /approved                    # Active organizations
    /suspended                   # Suspended organizations
  /settings                      # System configuration
  /audit-logs                    # Platform-wide audit logs
  /users                         # User management
  /analytics                     # Platform analytics
```

**Middleware:**
```javascript
export function requireSystemAdmin(req, res, next) {
  if (req.user.accountType !== 'SYSTEM_ADMIN') {
    return res.status(403).json({ error: 'System admin access required' });
  }
  next();
}
```

**UI Components Needed:**
- SystemAdminDashboard.jsx
- OrganizationApprovalQueue.jsx
- OrganizationDetailsModal.jsx
- SystemSettingsPanel.jsx
- PlatformAuditLogViewer.jsx
- PlatformStatsCards.jsx

---

### 2. Organization Approval Workflow

**Registration Flow Changes:**

**BEFORE:**
```
Company registers → Organization created → Immediately active → Full access
```

**AFTER:**
```
Company registers → Organization created with status='PENDING' 
→ Limited access (can view but not create jobs/invitations)
→ System Admin reviews → Approves/Rejects
→ If approved: status='APPROVED', full access granted
→ If rejected: Notification sent, can appeal or re-register
```

**Implementation Steps:**

1. **Update company registration:**
   - Set initial `organization.status = 'PENDING'`
   - Create notification for system admins
   - Show "pending approval" banner on company dashboard

2. **Add organization status checks:**
   - Middleware: `requireApprovedOrganization`
   - Block job creation, invitations until approved
   - Allow viewing own organization settings

3. **System Admin approval UI:**
   - List pending organizations with details
   - View company verification documents
   - One-click approve/reject with reason
   - Email notification on decision

4. **Organization status management:**
   - Approve: Update status, log action, send email
   - Reject: Update status, store reason, send email with appeal process
   - Suspend: For policy violations, blocks all actions
   - Reactivate: Restore access after suspension

---

### 3. Job Application Flow - NEW FEATURE ⚠️

**Database Schema:**
```javascript
// NEW: jobApplications collection
{
  id: string,
  jobId: string,
  candidateId: string,
  organizationId: string,
  status: 'SUBMITTED' | 'SCREENING' | 'INTERVIEWING' | 'SHORTLISTED' | 'REJECTED' | 'HIRED',
  resumeUrl: string,  // Can use existing resume or upload new one
  coverLetter: string | null,
  answers: {  // Custom application questions
    questionId: string,
    answer: string,
  }[],
  submittedAt: string,
  reviewedAt: string | null,
  reviewedBy: string | null,
  interviewId: string | null,  // Linked interview if created
  createdAt: string,
  updatedAt: string,
}

// Update jobs collection - add application questions
{
  // ... existing fields
  applicationQuestions: {
    id: string,
    question: string,
    type: 'TEXT' | 'TEXTAREA' | 'SELECT' | 'MULTISELECT',
    required: boolean,
    options: string[],  // For SELECT/MULTISELECT
  }[],
  acceptingApplications: boolean,
}
```

**API Endpoints:**
```
POST   /api/jobs/:id/apply                 # Submit job application
GET    /api/candidates/applications        # My applications (candidate view)
GET    /api/applications/:id               # Get application details
PATCH  /api/applications/:id               # Update application status (recruiter)
GET    /api/jobs/:id/applications          # List applications for job (recruiter)
DELETE /api/applications/:id               # Withdraw application (candidate)
```

**Frontend Components:**
```
/jobs/:id/apply                           # Application form page
/candidate-dashboard/applications         # My applications list
/company-dashboard/applications          # Received applications (recruiter)
```

**UI Components Needed:**
- JobApplicationForm.jsx
- ApplicationsList.jsx (candidate view)
- ApplicationsTable.jsx (recruiter view)
- ApplicationDetailsModal.jsx
- ApplicationStatusBadge.jsx

**Application Flow:**
1. Candidate browses jobs → Finds interesting job
2. Clicks "Apply Now" → Application form
3. Form includes:
   - Existing resume (from profile) or upload new
   - Cover letter (optional)
   - Custom questions from job posting
   - Consent checkboxes
4. Submit → Creates jobApplication record
5. Recruiter sees application in dashboard
6. Recruiter can:
   - Review application
   - Send interview invitation (creates invitation linked to application)
   - Reject immediately
   - Move to screening/shortlist

---

### 4. Interview Session Linking

**Problem:** Invited candidates can accept invitations but don't automatically get an interview session.

**Solution:**

**Invitation Acceptance Flow:**
```
1. Candidate clicks invitation link
2. Authenticates/creates account
3. Accepts invitation → Creates HIRING interview automatically
4. Redirects to interview lobby/prep page
5. Can start interview when ready
```

**Implementation:**

1. **Update invitation acceptance endpoint:**
```javascript
// server/src/controllers/invitation.controller.js
static async acceptInvitation(req, res, next) {
  // ... existing validation
  
  const accepted = await invitationStore.markAccepted(token, req.user.id);
  
  // NEW: Auto-create interview for this invitation
  const job = await jobStore.getById(accepted.jobId);
  const interview = await interviewStore.create({
    mode: 'HIRING',
    candidateId: req.user.id,
    companyId: job.createdBy,
    organizationId: accepted.organizationId,
    jobId: accepted.jobId,
    jobStage: accepted.stage,
    invitationId: accepted.id,
    jobRole: job.title,
    experienceLevel: job.experienceLevel,
    industry: job.industry || null,
    interviewTypes: job.templateConfig?.interviewTypes || ['BEHAVIORAL'],
    duration: job.templateConfig?.duration || 30,
    config: job.templateConfig || {},
    status: 'SCHEDULED',
  });
  
  res.json({ 
    success: true, 
    invitation: sanitizeInvitation(accepted),
    interview: { id: interview.id, status: interview.status },
  });
}
```

2. **Update frontend invite page:**
```javascript
// After successful acceptance
if (result.success && result.interview) {
  navigate(`/interview-lobby?interviewId=${result.interview.id}`);
}
```

3. **Create interview lobby page:**
```
/interview-lobby?interviewId=xxx
```
- Shows interview details
- Company info
- Expected duration
- Instructions
- "Start Interview" button → `/live-interview-session?interviewId=xxx`

---

## Implementation Order (Detailed)

### PHASE 1: CRITICAL FOUNDATION

#### Task 1.1: System Admin Infrastructure
**Duration:** 1-2 days

**Files to create:**
1. `server/src/middleware/admin.middleware.js`
2. `server/src/controllers/admin.controller.js`
3. `server/src/routes/admin.routes.js`
4. `server/src/services/systemSettings.service.js`
5. `src/pages/system-admin-dashboard/index.jsx`
6. `src/pages/system-admin-dashboard/components/OrganizationApprovalQueue.jsx`

**Files to modify:**
1. `server/src/services/firebaseData.service.js` - Add system settings store
2. `server/src/routes/index.js` - Mount admin routes
3. `src/Routes.jsx` - Add admin routes
4. `src/components/ProtectedRoute.jsx` - Add SYSTEM_ADMIN check

**Steps:**
1. Add `SYSTEM_ADMIN` to account types
2. Create admin middleware
3. Create system settings collection/service
4. Create admin seeding endpoint
5. Create organization approval endpoints
6. Build admin dashboard UI
7. Build approval queue component
8. Test approval workflow

#### Task 1.2: Organization Approval Workflow
**Duration:** 1 day

**Files to modify:**
1. `server/src/services/firebaseData.service.js` - Add org status fields
2. `server/src/controllers/auth.controller.js` - Set PENDING on registration
3. `server/src/middleware/auth.middleware.js` - Add approval check
4. `src/pages/company-dashboard/index.jsx` - Show pending banner

**Steps:**
1. Add `status` field to organization schema
2. Update registration to set PENDING
3. Create `requireApprovedOrganization` middleware
4. Apply middleware to protected company routes
5. Add pending approval banner to company dashboard
6. Test full approval flow

#### Task 1.3: Job Application Flow
**Duration:** 1-2 days

**Files to create:**
1. `server/src/controllers/application.controller.js`
2. `server/src/routes/application.routes.js`
3. `src/pages/jobs/components/JobApplicationForm.jsx`
4. `src/pages/candidate-dashboard/components/MyApplicationsList.jsx`
5. `src/pages/company-dashboard/components/ApplicationsManager.jsx`

**Files to modify:**
1. `server/src/services/firebaseData.service.js` - Add applications store
2. `FIREBASE_STORAGE_MAP.md` - Document applications collection
3. `src/pages/jobs/index.jsx` - Add apply button
4. `src/services/apiClient.js` - Add application endpoints

**Steps:**
1. Create jobApplications collection schema
2. Add applicationQuestions to jobs
3. Create application CRUD endpoints
4. Build application form component
5. Build candidate applications list
6. Build recruiter applications manager
7. Link applications to invitation flow
8. Test end-to-end application

#### Task 1.4: Interview Session Linking
**Duration:** 1 day

**Files to create:**
1. `src/pages/interview-lobby/index.jsx`

**Files to modify:**
1. `server/src/controllers/invitation.controller.js` - Auto-create interview
2. `src/pages/invite/index.jsx` - Redirect to lobby
3. `src/Routes.jsx` - Add lobby route

**Steps:**
1. Update acceptance endpoint to create interview
2. Create interview lobby page
3. Add navigation from invite → lobby → session
4. Test invitation → interview flow
5. Handle edge cases (already accepted, expired)

---

### PHASE 2: CORE HIRING WORKFLOW

#### Task 2.1: Candidate Management for Recruiters
**Duration:** 1 day

**Features:**
- Manual candidate addition (name, email, resume upload)
- View all candidates (from applications + invitations)
- Candidate detail view
- Send invitation to existing candidate

#### Task 2.2: Interview Review UI Enhancement
**Duration:** 2 days

**Features:**
- Video/audio player component
- Transcript viewer with timestamps
- AI scores visualization
- Side-by-side review interface
- Rubric scoring UI
- Comment threading

#### Task 2.3: Candidate Progress Dashboard
**Duration:** 1 day

**Features:**
- Real-time candidate pipeline view
- Filter by job, stage, status
- Bulk actions (move stage, send email)
- Progress metrics and funnel
- Export capabilities

---

### PHASE 3: ENHANCED FEATURES

#### Task 3.1: Email Notification System
**Duration:** 2 days

**Integration:** SendGrid/Mailgun/AWS SES

**Email Templates:**
- Organization approved/rejected
- Interview invitation sent
- Interview completed
- Application received
- Application status update
- Review submitted

#### Task 3.2: Interview Template Management
**Duration:** 1-2 days

**Features:**
- Template library (create, edit, delete)
- Question bank with categories
- Drag-drop question ordering
- Time limits per question
- Re-record policy settings
- Template preview

#### Task 3.3: Billing & Subscription Framework
**Duration:** 2-3 days

**Integration:** Stripe

**Features:**
- Subscription plans (Free, Pro, Enterprise)
- Usage tracking (interviews, candidates, storage)
- Billing portal
- Invoice history
- Upgrade/downgrade flow

---

## Testing Requirements

### Unit Tests
- [ ] System admin middleware
- [ ] Organization approval logic
- [ ] Application submission validation
- [ ] Interview linking on acceptance

### Integration Tests
- [ ] Full registration → approval → access flow
- [ ] Job application → invitation → interview flow
- [ ] System admin approval workflow
- [ ] Permission enforcement

### E2E Tests
- [ ] Candidate: Browse jobs → Apply → Accept invite → Complete interview
- [ ] Recruiter: Post job → Review applications → Send invites → Review interviews
- [ ] System Admin: Review org → Approve → Monitor activity

---

## Deployment Checklist

- [ ] Database migrations for new collections
- [ ] Environment variables for email service
- [ ] System admin seeding script
- [ ] Documentation updates
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Backup procedures
- [ ] Monitoring and alerts
- [ ] Rollback plan

---

**Document Version:** 1.0
**Last Updated:** 2025-12-31

