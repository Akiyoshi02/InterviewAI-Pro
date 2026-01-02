# InterviewAI Pro - Quick Testing Guide

**Purpose:** Verify all implemented features are working correctly  
**Estimated Time:** 30-45 minutes for complete walkthrough

---

## 🚀 SETUP

### Prerequisites
1. Backend server running on `http://localhost:3000`
2. Frontend running on `http://localhost:5173`
3. Firebase project configured
4. .env files properly set up

### Initial Setup
```bash
# Start backend
cd server
npm install
npm run dev

# Start frontend (in new terminal)
cd ..
npm install
npm run dev
```

---

## 🧪 TEST SCENARIOS

### Scenario 1: System Admin Setup (5 minutes)

**Goal:** Create system admin and verify dashboard access

1. **Seed System Admin**
   ```bash
   curl -X POST http://localhost:3000/api/admin/auth/seed-admin \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@example.com",
       "password": "Admin123!@#",
       "fullName": "System Administrator"
     }'
   ```

2. **Login as Admin**
   - Go to `http://localhost:5173/login`
   - Email: `admin@example.com`
   - Password: `Admin123!@#`
   - Should redirect to system admin dashboard

3. **Verify Dashboard**
   - ✅ See 4 stat cards (Users, Organizations, Interviews, Jobs)
   - ✅ Organization approval queue is visible
   - ✅ Can navigate to Settings and Audit Logs tabs

**Expected Result:** ✅ Admin can access all system admin features

---

### Scenario 2: Company Registration & Approval (10 minutes)

**Goal:** Test organization approval workflow

#### Step 1: Register Company Account
1. Logout from admin account
2. Go to `/register`
3. Select "Company" account type
4. Fill in:
   - Email: `recruiter@techcorp.com`
   - Password: `Recruit123!@#`
   - Company Name: `TechCorp Inc`
   - Full Name: `Jane Recruiter`
   - Company Size: `50-200`
   - Industry: `Technology`
5. Complete registration

#### Step 2: Verify Pending Status
1. Login as `recruiter@techcorp.com`
2. ✅ See yellow "Organization Approval Pending" banner
3. ✅ Try to create a job → Should see error/restriction
4. ✅ Dashboard shows limited functionality

#### Step 3: Approve Organization
1. Logout and login as system admin
2. Go to system admin dashboard
3. ✅ See TechCorp Inc in pending queue
4. Click "Approve"
5. Confirm approval
6. ✅ Organization disappears from pending queue

#### Step 4: Verify Approval
1. Logout and login as `recruiter@techcorp.com`
2. ✅ No more pending banner
3. ✅ Can now access job creation
4. ✅ Full dashboard features unlocked

**Expected Result:** ✅ Complete approval workflow functions correctly

---

### Scenario 3: Job Posting (5 minutes)

**Goal:** Create and publish a job posting

1. **Login as Recruiter** (`recruiter@techcorp.com`)

2. **Create Job**
   - Navigate to Jobs section
   - Click "Create New Job"
   - Fill in:
     - Title: `Senior Frontend Developer`
     - Department: `Engineering`
     - Location: `San Francisco, CA`
     - Employment Type: `Full-time`
     - Experience Level: `Senior`
     - Description: `We're looking for an experienced React developer...`
     - Required Skills: `React`, `TypeScript`, `Node.js`
   - Set Status: `Published`
   - Save

3. **Verify Job is Public**
   - Logout
   - Go to `/jobs` (public page)
   - ✅ See "Senior Frontend Developer" in job listings
   - Click on job
   - ✅ See full job details

**Expected Result:** ✅ Job creation and public listing works

---

### Scenario 4: Candidate Application (10 minutes)

**Goal:** Test complete job application flow

#### Step 1: Register Candidate
1. Go to `/register`
2. Select "Candidate" account type
3. Fill in:
   - Email: `candidate@example.com`
   - Password: `Candidate123!@#`
   - Full Name: `John Candidate`
   - Experience Level: `Mid-Level`
   - Skills: `React`, `JavaScript`, `CSS`

#### Step 2: Upload Resume
1. Login as candidate
2. Go to Profile
3. Upload resume (PDF)
4. ✅ Resume saved successfully

#### Step 3: Apply to Job
1. Go to `/jobs`
2. Find "Senior Frontend Developer"
3. Click "Apply"
4. ✅ Application form modal opens
5. Fill in:
   - Cover Letter: `I'm excited to apply for this position...`
   - Answer any additional questions
6. Click "Submit Application"
7. ✅ Success notification appears
8. ✅ Redirected or modal closes

#### Step 4: View Application Status
1. Go to Candidate Dashboard
2. ✅ See application in "My Applications" section
3. ✅ Status shows "Submitted"
4. ✅ Can see job details

**Expected Result:** ✅ End-to-end application flow works

---

### Scenario 5: Recruiter Application Management (8 minutes)

**Goal:** Recruiter reviews and manages applications

1. **Login as Recruiter** (`recruiter@techcorp.com`)

2. **View Applications**
   - Go to Company Dashboard
   - Navigate to "Applications" section
   - ✅ See John Candidate's application
   - ✅ Status shows "New" or "Submitted"

3. **Review Application**
   - Click "View" on application
   - ✅ Modal opens with candidate details
   - ✅ Can see resume link
   - ✅ Can see cover letter
   - ✅ Can see application responses

4. **Update Status**
   - Change status to "Screening"
   - ✅ Status updates successfully
   - Click "Contact Candidate"
   - ✅ Email client opens

5. **Verify Candidate Sees Update**
   - Logout and login as candidate
   - Go to "My Applications"
   - ✅ Status changed to "Screening"

**Expected Result:** ✅ Application management works for both sides

---

### Scenario 6: Interview Invitation & Auto-Linking (10 minutes)

**Goal:** Test invitation acceptance and interview creation

#### Step 1: Send Invitation
1. **Login as Recruiter**
2. Navigate to Invitations section
3. Create new invitation:
   - Email: `candidate@example.com`
   - Job: `Senior Frontend Developer`
   - Stage: `Technical Interview`
   - Expiry: 7 days from now
4. ✅ Invitation created
5. ✅ Copy invitation link/token

#### Step 2: Preview Invitation
1. **Logout** (or open incognito)
2. Visit invitation link: `/invite?token=xxx`
3. ✅ See invitation preview
4. ✅ Shows job details
5. ✅ Shows company info

#### Step 3: Accept Invitation
1. **Login as Candidate**
2. Go to invitation link again
3. Click "Accept Invitation"
4. ✅ Invitation accepted
5. ✅ Automatically redirected to Interview Lobby

#### Step 4: Verify Interview Lobby
1. ✅ Shows interview details
2. ✅ Shows job role and duration
3. ✅ Shows "Before You Start" checklist
4. ✅ "Start Interview" button visible

#### Step 5: Verify Interview Created
1. Login as recruiter
2. Go to Interviews section
3. ✅ New interview exists
4. ✅ Linked to candidate
5. ✅ Status shows "Scheduled"

**Expected Result:** ✅ Complete invitation → interview flow works

---

### Scenario 7: Candidate Management (5 minutes)

**Goal:** Recruiter manages candidate pipeline

1. **Login as Recruiter**

2. **Access Candidate Manager**
   - Go to Company Dashboard
   - Navigate to "Candidates" section
   - ✅ See list of all candidates

3. **Filter Candidates**
   - Filter by job: "Senior Frontend Developer"
   - ✅ Shows only relevant candidates
   - Filter by status: "Screening"
   - ✅ Updates list

4. **View Candidate Profile**
   - Click "View" on candidate
   - ✅ Modal shows full profile
   - ✅ Can see skills
   - ✅ Can access resume
   - ✅ Can see application history

**Expected Result:** ✅ Candidate management features work

---

### Scenario 8: System Settings & Audit (5 minutes)

**Goal:** Verify admin can manage settings and view logs

1. **Login as System Admin**

2. **Manage Settings**
   - Go to Settings tab
   - Toggle feature flags (e.g., Job Board)
   - Update AI configuration
   - Change data retention policies
   - Click "Save Changes"
   - ✅ Settings saved successfully

3. **View Audit Logs**
   - Go to Audit Logs tab
   - ✅ See recent activities:
     - Organization approved
     - Application submitted
     - Settings updated
   - ✅ Each log shows actor, action, timestamp
   - ✅ Can paginate through logs

4. **View Statistics**
   - Go back to main admin page
   - ✅ Stats reflect current data
   - Refresh page
   - ✅ Stats update

**Expected Result:** ✅ Admin features fully functional

---

## ✅ CHECKLIST

After completing all scenarios, verify:

### Backend
- [ ] All API endpoints respond correctly
- [ ] No 500 errors in server logs
- [ ] Authentication works for all user types
- [ ] Role-based access control enforced
- [ ] Firebase operations successful

### Frontend
- [ ] No console errors
- [ ] All modals open/close properly
- [ ] Loading states show correctly
- [ ] Error messages are clear
- [ ] Success notifications appear
- [ ] Navigation works smoothly
- [ ] Dark mode works (toggle and test)
- [ ] Mobile responsive (test on small screen)

### Data Integrity
- [ ] User registrations create proper records
- [ ] Applications link to correct jobs/candidates
- [ ] Interviews link to invitations
- [ ] Organization memberships correct
- [ ] Activity logs recorded properly

### Edge Cases
- [ ] Can't access unauthorized pages
- [ ] Can't apply to same job twice
- [ ] Can't accept expired invitation
- [ ] Pending org can't create jobs
- [ ] Proper error messages for invalid inputs

---

## 🐛 COMMON ISSUES & FIXES

### Issue: "Network Error" on API calls
**Fix:** 
- Check backend is running
- Verify VITE_API_URL in .env
- Check browser console for CORS errors

### Issue: "Unauthorized" after login
**Fix:**
- Clear browser storage
- Re-login
- Verify Firebase token is being sent

### Issue: "Organization not found"
**Fix:**
- Make sure organization was created during registration
- Check organizationContext in AuthContext
- Verify loadOrganizationContext middleware

### Issue: Application form doesn't open
**Fix:**
- Check candidate has resume uploaded
- Verify job is PUBLISHED status
- Check browser console for errors

### Issue: Interview not created after accepting invitation
**Fix:**
- Check backend logs for errors
- Verify interviewStore.create is called
- Check invitation status is PENDING

---

## 📊 SUCCESS CRITERIA

### Critical (Must Pass)
- ✅ Admin can approve organizations
- ✅ Candidates can apply to jobs
- ✅ Recruiters can view applications
- ✅ Interview auto-created on invitation accept
- ✅ Access control works for all roles

### Important (Should Pass)
- ✅ Settings update correctly
- ✅ Audit logs show activities
- ✅ Application status updates
- ✅ Candidate manager filters work
- ✅ Resume upload/download works

### Nice to Have
- ✅ Smooth animations
- ✅ Fast load times
- ✅ No UI glitches
- ✅ Good mobile experience
- ✅ Dark mode looks good

---

## 🎓 TESTING TIPS

1. **Use Different Browsers:**
   - Test in Chrome, Firefox, Safari
   - Check incognito/private mode

2. **Test Mobile:**
   - Use browser DevTools
   - Resize to mobile width
   - Check touch interactions

3. **Test Performance:**
   - Open Network tab
   - Check API response times
   - Verify no unnecessary requests

4. **Test Error Handling:**
   - Try invalid inputs
   - Disconnect network mid-action
   - Test with empty fields

5. **Document Bugs:**
   - Take screenshots
   - Note steps to reproduce
   - Check browser console

---

## 📝 TEST REPORT TEMPLATE

After testing, document findings:

```markdown
# Test Report - [Date]

## Environment
- Backend: Running
- Frontend: Running
- Browser: Chrome 120

## Scenarios Tested
1. ✅ System Admin Setup - PASS
2. ✅ Company Registration - PASS
3. ✅ Organization Approval - PASS
4. ✅ Job Posting - PASS
5. ✅ Candidate Application - PASS
6. ✅ Application Management - PASS
7. ✅ Interview Invitation - PASS
8. ✅ Candidate Management - PASS
9. ✅ System Settings - PASS

## Bugs Found
1. [Bug Description]
   - Severity: High/Medium/Low
   - Steps to Reproduce: ...
   - Expected: ...
   - Actual: ...

## Performance Notes
- Page load times: Good
- API response times: Fast
- No memory leaks observed

## Recommendations
1. [Recommendation]
2. [Recommendation]

## Overall Status
✅ Ready for Production / ⚠️ Needs Fixes / ❌ Critical Issues
```

---

## 🎉 COMPLETION

Once all scenarios pass:
1. ✅ Mark Phase 1 as production-ready
2. ✅ Deploy to staging environment
3. ✅ Begin user acceptance testing
4. ✅ Start Phase 2 development

**Good luck with testing!** 🚀

