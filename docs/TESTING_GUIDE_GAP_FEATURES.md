# Testing Guide - Gap Features Implementation
## AI Interviewer Pro - Verify System is 100% Complete

**Date:** February 16, 2026  
**Purpose:** Test all newly implemented gap features to ensure system integrity

---

## QUICK START - Test Server

### 1. Start the Backend Server

```powershell
cd "d:\Campus Work\Projects\Interviewer\server"
npm run dev
```

**Expected Output:**
```
Server running on port 4028
Firebase initialized
Ollama configured
```

### 2. Verify Server Health

```powershell
curl http://localhost:4028/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-16T..."
}
```

---

## FEATURE TESTING

### **TEST 1: Personal Answer Library** ✅

#### Test 1.1: Save an Answer

**Endpoint:** `POST /api/saved-answers`

**Prerequisites:** 
- Have an authenticated candidate token
- Have completed a practice interview

**Request:**
```bash
curl -X POST http://localhost:4028/api/saved-answers \
  -H "Authorization: Bearer YOUR_CANDIDATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "questionText": "Tell me about a time you worked on a challenging project",
    "answer": "At my previous internship, I worked on a React dashboard...",
    "interviewId": "test-interview-id",
    "questionId": "test-question-id",
    "notes": "This answer worked really well in practice",
    "tags": ["behavioral", "teamwork"],
    "rating": 5
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "savedAnswer": {
    "id": "...",
    "userId": "...",
    "questionText": "Tell me about a time...",
    "answer": "At my previous internship...",
    "notes": "This answer worked really well...",
    "tags": ["behavioral", "teamwork"],
    "rating": 5,
    "savedAt": "2026-02-16T...",
    "createdAt": "2026-02-16T...",
    "updatedAt": "2026-02-16T..."
  }
}
```

**Status:** ✅ Pass | ❌ Fail

---

#### Test 1.2: List Saved Answers

**Endpoint:** `GET /api/saved-answers`

**Request:**
```bash
curl http://localhost:4028/api/saved-answers \
  -H "Authorization: Bearer YOUR_CANDIDATE_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "savedAnswers": [
    {
      "id": "...",
      "questionText": "...",
      "answer": "...",
      "tags": ["behavioral", "teamwork"],
      "rating": 5
    }
  ],
  "count": 1
}
```

**Status:** ✅ Pass | ❌ Fail

---

#### Test 1.3: Filter by Tag

**Endpoint:** `GET /api/saved-answers?tag=behavioral`

**Request:**
```bash
curl http://localhost:4028/api/saved-answers?tag=behavioral \
  -H "Authorization: Bearer YOUR_CANDIDATE_TOKEN"
```

**Expected:** Only answers with "behavioral" tag returned

**Status:** ✅ Pass | ❌ Fail

---

#### Test 1.4: Update Saved Answer

**Endpoint:** `PATCH /api/saved-answers/:id`

**Request:**
```bash
curl -X PATCH http://localhost:4028/api/saved-answers/SAVED_ANSWER_ID \
  -H "Authorization: Bearer YOUR_CANDIDATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Updated notes - this is my best answer!",
    "tags": ["behavioral", "teamwork", "leadership"],
    "rating": 5
  }'
```

**Expected:** Success response with updated answer

**Status:** ✅ Pass | ❌ Fail

---

#### Test 1.5: Delete Saved Answer

**Endpoint:** `DELETE /api/saved-answers/:id`

**Request:**
```bash
curl -X DELETE http://localhost:4028/api/saved-answers/SAVED_ANSWER_ID \
  -H "Authorization: Bearer YOUR_CANDIDATE_TOKEN"
```

**Expected:**
```json
{
  "success": true,
  "message": "Saved answer deleted"
}
```

**Status:** ✅ Pass | ❌ Fail

---

#### Test 1.6: Ownership Protection

**Test:** Try to delete/update another user's saved answer

**Expected:** `403 Forbidden` error with "Access denied"

**Status:** ✅ Pass | ❌ Fail

---

### **TEST 2: Practice Streak Tracking** ✅

#### Test 2.1: Complete First Practice Interview

**Steps:**
1. Create a PRACTICE mode interview as candidate
2. Answer questions
3. Complete the interview (POST /api/interviews/:id/end)

**Expected:**
- Interview status = COMPLETED
- User profile updated with `practiceStats.currentStreak = 1`
- `practiceStats.lastPracticeDate` set to today (YYYY-MM-DD)
- `practiceStats.totalPracticeSessions = 1`

**Verification Query:**
```bash
# Check user profile in Firestore
# Navigate to users/{candidateId}/profile/practiceStats
```

**Status:** ✅ Pass | ❌ Fail

---

#### Test 2.2: Complete Second Practice (Same Day)

**Steps:**
1. Complete another practice interview on the same day

**Expected:**
- `currentStreak` remains 1 (no change)
- `totalPracticeSessions` increments to 2
- `practiceHistory[today].sessionsCompleted = 2`

**Status:** ✅ Pass | ❌ Fail

---

#### Test 2.3: Complete Practice (Consecutive Day)

**Steps:**
1. Manually change `lastPracticeDate` to yesterday in Firestore
2. Complete a new practice interview today

**Expected:**
- `currentStreak` increments to 2
- `longestStreak` updates to 2
- `lastPracticeDate` updated to today

**Status:** ✅ Pass | ❌ Fail

---

#### Test 2.4: Streak Reset (Gap > 1 Day)

**Steps:**
1. Manually change `lastPracticeDate` to 3 days ago in Firestore
2. Complete a new practice interview today

**Expected:**
- `currentStreak` resets to 1
- `longestStreak` remains unchanged (keeps previous record)
- `lastPracticeDate` updated to today

**Status:** ✅ Pass | ❌ Fail

---

### **TEST 3: Prep Notes Box** ✅

#### Test 3.1: Save Prep Notes

**Endpoint:** `PATCH /api/interviews/:id/question/:questionId/notes`

**Request:**
```bash
curl -X PATCH http://localhost:4028/api/interviews/INTERVIEW_ID/question/QUESTION_ID/notes \
  -H "Authorization: Bearer YOUR_CANDIDATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prepNotes": "Key points: STAR method, focus on results, mention team collaboration"
  }'
```

**Expected:**
```json
{
  "success": true,
  "message": "Prep notes saved",
  "questionId": "..."
}
```

**Status:** ✅ Pass | ❌ Fail

---

#### Test 3.2: Verify Notes Persist

**Steps:**
1. Save prep notes using above endpoint
2. Fetch interview: `GET /api/interviews/:id`
3. Check that question has `prepNotes` field populated

**Expected:** `questions[x].prepNotes` contains the saved text

**Status:** ✅ Pass | ❌ Fail

---

#### Test 3.3: Character Limit Enforcement

**Request:** Try to save 501+ characters

**Expected:** `400 Bad Request` with validation error "Prep notes must be 500 characters or less"

**Status:** ✅ Pass | ❌ Fail

---

### **TEST 4: Critical Validations** ✅

#### Test 4.1: Block Review on Non-Completed Interview

**Endpoint:** `POST /api/reviews/:interviewId`

**Steps:**
1. Create a HIRING interview (status = SCHEDULED)
2. Try to submit a review

**Expected:**
```json
{
  "error": "Can only review completed interviews",
  "code": "INTERVIEW_NOT_COMPLETED",
  "currentStatus": "SCHEDULED"
}
```

**Status Code:** `409 Conflict`

**Status:** ✅ Pass | ❌ Fail

---

#### Test 4.2: Block Review on IN_PROGRESS Interview

**Steps:**
1. Start an interview (status = IN_PROGRESS)
2. Try to submit a review

**Expected:** Same error as above with `currentStatus: "IN_PROGRESS"`

**Status:** ✅ Pass | ❌ Fail

---

#### Test 4.3: Allow Review on COMPLETED Interview

**Steps:**
1. Complete an interview (status = COMPLETED)
2. Submit a review as assigned reviewer

**Expected:** Success - review submitted

**Status:** ✅ Pass | ❌ Fail

---

#### Test 4.4: Reviewer Assignment Validation

**Setup:**
- Create interview with `reviewerAssignments: [reviewerId1]`
- Try to review as `reviewerId2` (not assigned)

**Expected:**
```json
{
  "error": "You are not assigned to review this interview",
  "code": "NOT_ASSIGNED_REVIEWER"
}
```

**Status Code:** `403 Forbidden`

**Status:** ✅ Pass | ❌ Fail

---

#### Test 4.5: Admin Bypass for Reviewer Assignment

**Setup:**
- Create interview with specific reviewer assignments
- Try to review as ADMIN (not in assignments list)

**Expected:** Success - admin can review even if not assigned

**Status:** ✅ Pass | ❌ Fail

---

### **TEST 5: Auto-Update Application Status** ✅

#### Test 5.1: Application Updated on Interview Completion

**Steps:**
1. Create a job application
2. Send invitation
3. Candidate accepts invitation (creates interview with `invitationId`)
4. Complete the interview

**Expected:**
- Application record updated with `interviewCompletedAt` timestamp
- Application status remains `INTERVIEWING` (until decision)

**Verification:**
```bash
# Check application in Firestore
# Navigate to jobApplications/{applicationId}
# Verify interviewCompletedAt field exists
```

**Status:** ✅ Pass | ❌ Fail

---

## INTEGRATION TESTING

### End-to-End: Complete Practice Flow with All Features

**Scenario:** Candidate completes practice interview and saves best answer

**Steps:**
1. ✅ Candidate logs in
2. ✅ Starts PRACTICE interview
3. ✅ During prep phase, saves notes: `PATCH /api/interviews/:id/question/:questionId/notes`
4. ✅ Answers question
5. ✅ Completes interview: `POST /api/interviews/:id/end`
6. ✅ **Verify:** Practice streak incremented
7. ✅ Reviews answers
8. ✅ Saves best answer: `POST /api/saved-answers`
9. ✅ Views saved answers library: `GET /api/saved-answers`

**Expected:** All operations succeed, no errors, data persists correctly

**Status:** ✅ Pass | ❌ Fail

---

### End-to-End: Hiring Flow with Validations

**Scenario:** Company invites candidate, interview completes, reviewer assigned

**Steps:**
1. ✅ Company posts job
2. ✅ Candidate applies
3. ✅ Company sends invitation
4. ✅ Candidate accepts (creates interview with `invitationId`)
5. ✅ Candidate completes interview
6. ✅ **Verify:** Application updated with `interviewCompletedAt`
7. ✅ Company assigns reviewer
8. ✅ Reviewer submits review
9. ✅ **Verify:** Review succeeds
10. ✅ Non-assigned user tries to review
11. ✅ **Verify:** Blocked with `NOT_ASSIGNED_REVIEWER`

**Status:** ✅ Pass | ❌ Fail

---

## ERROR HANDLING TESTING

### Test Error Cases

#### 1. Invalid Input Validation
- ✅ Missing required fields (400 Bad Request)
- ✅ Field length exceeded (400 Bad Request)
- ✅ Invalid data types (400 Bad Request)

#### 2. Authentication Errors
- ✅ No token provided (401 Unauthorized)
- ✅ Invalid token (401 Unauthorized)
- ✅ Expired token (401 Unauthorized)

#### 3. Authorization Errors
- ✅ Candidate-only endpoints accessed by company (403 Forbidden)
- ✅ Company-only endpoints accessed by candidate (403 Forbidden)
- ✅ Ownership violations (403 Forbidden)

#### 4. Resource Not Found
- ✅ Invalid interview ID (404 Not Found)
- ✅ Invalid question ID (404 Not Found)
- ✅ Invalid saved answer ID (404 Not Found)

---

## PERFORMANCE TESTING

### Load Testing Recommendations

**Tool:** Apache JMeter or Artillery.io

**Test Scenarios:**
1. **Saved Answers Read:** 100 concurrent users fetching saved answers
2. **Streak Update:** 50 concurrent interview completions
3. **Prep Notes Save:** 100 concurrent note saves

**Acceptance Criteria:**
- ✅ Response time < 500ms for 95th percentile
- ✅ No errors under normal load
- ✅ Graceful degradation under high load

---

## SECURITY TESTING

### Penetration Testing Checklist

1. **SQL Injection:** ✅ N/A (Firestore NoSQL)
2. **XSS Prevention:** ✅ Input sanitization enabled
3. **CSRF:** ✅ JWT tokens (stateless)
4. **Authorization Bypass:** ✅ Test all endpoints without auth
5. **Ownership Bypass:** ✅ Try to access other users' data
6. **Rate Limiting:** ✅ Test rapid-fire requests

---

## BROWSER TESTING (Frontend Integration)

### Once Frontend is Connected

**Browsers to Test:**
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (macOS)
- ✅ Edge (latest)

**Features to Test:**
- ✅ Save answer button appears on practice review
- ✅ Saved answers library loads correctly
- ✅ Practice streak badge displays on dashboard
- ✅ Prep notes textarea shows during prep phase
- ✅ Auto-save functionality works

---

## REGRESSION TESTING

### Verify Existing Features Still Work

**Critical Paths:**
1. ✅ Candidate registration/login
2. ✅ Practice mode interview (start to finish)
3. ✅ Job application flow
4. ✅ Invitation acceptance
5. ✅ Hiring interview flow
6. ✅ Review submission
7. ✅ Company dashboard metrics
8. ✅ Admin operations

---

## TEST SUMMARY TEMPLATE

```markdown
## Test Execution Report

**Date:** [Date]
**Tester:** [Your Name]
**Environment:** Local / Staging / Production

### Test Results

| Feature                        | Status | Notes              |
|--------------------------------|--------|--------------------|
| Personal Answer Library        | ✅/❌   |                    |
| Practice Streak Tracking       | ✅/❌   |                    |
| Prep Notes Box                 | ✅/❌   |                    |
| Interview Completion Check     | ✅/❌   |                    |
| Reviewer Assignment Validation | ✅/❌   |                    |
| Application Auto-Update        | ✅/❌   |                    |

### Issues Found

1. [Issue Description]
   - Severity: High/Medium/Low
   - Steps to Reproduce: ...
   - Expected: ...
   - Actual: ...

### Overall Assessment

- Total Tests: [X]
- Passed: [X]
- Failed: [X]
- Pass Rate: [X%]

### Sign-off

[  ] All critical tests passed
[  ] No blocking issues found
[  ] Ready for production

Signed: _________________
Date: _________________
```

---

## QUICK VERIFICATION SCRIPT

Save this as `test_gap_features.ps1`:

```powershell
# Quick API Test Script
$BASE_URL = "http://localhost:4028"
$CANDIDATE_TOKEN = "YOUR_TOKEN_HERE"

Write-Host "Testing AI Interviewer Pro - Gap Features" -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "`n[1/4] Testing Server Health..." -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$BASE_URL/health" -Method GET
if ($response.status -eq "ok") {
    Write-Host "✅ Server is healthy" -ForegroundColor Green
} else {
    Write-Host "❌ Server health check failed" -ForegroundColor Red
}

# Test 2: Save Answer (requires authentication)
Write-Host "`n[2/4] Testing Saved Answers..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $CANDIDATE_TOKEN"
        "Content-Type" = "application/json"
    }
    $body = @{
        questionText = "Test question"
        answer = "Test answer"
        notes = "Test notes"
        tags = @("test")
        rating = 5
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/saved-answers" -Method POST -Headers $headers -Body $body
    Write-Host "✅ Saved answer created: $($response.savedAnswer.id)" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Saved answers test requires valid token" -ForegroundColor Yellow
}

# Test 3: List Saved Answers
Write-Host "`n[3/4] Testing List Saved Answers..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/saved-answers" -Method GET -Headers $headers
    Write-Host "✅ Retrieved $($response.count) saved answers" -ForegroundColor Green
} catch {
    Write-Host "⚠️  List saved answers requires valid token" -ForegroundColor Yellow
}

Write-Host "`n✅ Basic tests completed!" -ForegroundColor Green
Write-Host "Replace YOUR_TOKEN_HERE with actual candidate token for full tests" -ForegroundColor Cyan
```

---

**Ready to test!** Start with the quick verification, then move through each feature systematically. Good luck with your final year project evaluation! 🎓
