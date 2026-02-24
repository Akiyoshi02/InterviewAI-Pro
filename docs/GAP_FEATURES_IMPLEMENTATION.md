# GAP FEATURES IMPLEMENTATION PLAN
## AI Interviewer Pro - Completing Missing Features

**Implementation Date:** February 16, 2026  
**Purpose:** Close all gaps from original design document  
**Status:** 🔄 IN PROGRESS

---

## FEATURES TO IMPLEMENT

### **Priority 1: Core Missing Features**
1. ✅ Personal Answer Library
2. ✅ Practice Streak Tracking
3. ✅ Notes Box During Prep
4. ✅ CSV Candidate Import
5. ✅ Interview Completion Check Before Review
6. ✅ Auto-update Application Status After Interview

### **Priority 2: Enhancements**
7. ✅ Visual Practice Trends (Basic Implementation)
8. ✅ Reviewer Assignment Validation

---

## IMPLEMENTATION DETAILS

### **FEATURE 1: Personal Answer Library**

**Purpose:** Allow candidates to save their best practice answers for future reference.

**Database Schema:**
```javascript
// Collection: savedAnswers
{
  id: string,
  userId: string,  // Candidate ID
  questionText: string,
  answer: string,
  interviewId: string,  // Source interview
  questionId: string,   // Source question
  savedAt: ISO timestamp,
  notes: string,  // Optional notes
  tags: string[],  // Custom tags
  rating: number   // Self-rating 1-5
}
```

**API Endpoints:**
- POST /api/interviews/saved-answers - Save answer
- GET /api/interviews/saved-answers - List saved answers
- DELETE /api/interviews/saved-answers/:id - Remove saved answer
- PATCH /api/interviews/saved-answers/:id - Update notes/tags

**Frontend Components:**
- SaveAnswerButton in interview review
- SavedAnswersLibrary page
- AnswerCard component

---

### **FEATURE 2: Practice Streak Tracking**

**Purpose:** Gamify practice mode to encourage consistent practice.

**Database Schema:**
```javascript
// Add to user profile
{
  practiceStats: {
    currentStreak: number,  // Current consecutive days
    longestStreak: number,  // All-time best
    lastPracticeDate: ISO date,  // YYYY-MM-DD
    totalPracticeSessions: number,
    practiceHistory: {
      [dateKey: YYYY-MM-DD]: {
        sessionsCompleted: number,
        questionsAnswered: number,
        averageScore: number
      }
    }
  }
}
```

**Backend Logic:**
- Update streak on interview completion
- Calculate streak based on consecutive days
- Reset streak if >24 hours gap

**Frontend Components:**
- PracticeStreakBadge in dashboard
- StreakCalendar component
- Celebration animation on milestone

---

### **FEATURE 3: Notes Box During Prep**

**Purpose:** Allow candidates to jot down key points during prep phase.

**Database Schema:**
```javascript
// Add to interview question
{
  prepNotes: string,  // Candidate's prep notes
  prepTime: number    // Seconds spent in prep
}
```

**API Endpoints:**
- PATCH /api/interviews/:id/question/:questionId/notes - Save prep notes

**Frontend Components:**
- NotesTextarea in prep phase
- LocalStorage backup (in case of refresh)
- Character counter (max 500 chars)

---

### **FEATURE 4: CSV Candidate Import**

**Purpose:** Allow recruiters to bulk import candidates from CSV.

**CSV Format:**
```csv
email,fullName,phoneNumber,location,skills,notes
john@example.com,John Doe,+1234567890,New York,"JavaScript,React",Great portfolio
```

**API Endpoints:**
- POST /api/candidates/import - Upload CSV and import
- GET /api/candidates/import/template - Download CSV template

**Validation:**
- Email format and uniqueness
- Required fields check
- Duplicate detection
- Max 1000 rows per upload

**Frontend Components:**
- CSVImportModal
- DragDropUpload
- ImportPreview with validation errors
- BulkInviteSend after import

---

### **FEATURE 5: Interview Completion Check Before Review**

**Purpose:** Prevent reviews on incomplete interviews.

**Backend Validation:**
```javascript
// In review.controller.js
if (interview.status !== 'COMPLETED') {
  return res.status(409).json({
    error: 'Can only review completed interviews',
    code: 'INTERVIEW_NOT_COMPLETED',
    currentStatus: interview.status
  });
}
```

**Location:** server/src/controllers/review.controller.js

---

### **FEATURE 6: Auto-update Application Status**

**Purpose:** Automatically update application status when interview completes.

**Backend Logic:**
```javascript
// In interview.controller.js endInterview()
if (interview.mode === 'HIRING' && interview.applicationId) {
  await jobApplicationStore.update(interview.applicationId, {
    status: 'INTERVIEWING',  // Keep in interviewing until review
    interviewCompletedAt: now()
  });
}
```

**Location:** server/src/controllers/interview.controller.js

---

### **FEATURE 7: Visual Practice Trends**

**Purpose:** Show candidates their progress over time.

**Data Source:**
- Use analyticsSnapshots collection (already exists)
- Aggregate by dateKey
- Calculate trend (improving/declining/stable)

**Frontend Component:**
```jsx
<PracticeTrendChart
  data={historicalMetrics}
  metric="averageScore"
  timeRange="30days"
/>
```

**Library:** recharts (already in project if used elsewhere, or use simple CSS charts)

---

### **FEATURE 8: Reviewer Assignment Validation**

**Purpose:** Ensure reviewers are assigned before they can review.

**Backend Validation:**
```javascript
// In review.controller.js
if (interview.reviewerAssignments && interview.reviewerAssignments.length > 0) {
  if (!interview.reviewerAssignments.includes(req.user.id)) {
    return res.status(403).json({
      error: 'You are not assigned to review this interview',
      code: 'NOT_ASSIGNED_REVIEWER'
    });
  }
}
```

---

## IMPLEMENTATION ORDER

1. ✅ **Backend First** - Database models and API endpoints
2. ✅ **Frontend Components** - UI components for new features  
3. ✅ **Integration** - Connect frontend to backend
4. ✅ **Testing** - Verify all features work
5. ✅ **Documentation** - Update API docs and user guides

---

## ESTIMATED IMPLEMENTATION TIME

- Feature 1: Personal Answer Library - 2 hours
- Feature 2: Practice Streak Tracking - 1.5 hours
- Feature 3: Notes Box During Prep - 1 hour
- Feature 4: CSV Candidate Import - 2 hours
- Feature 5: Interview Completion Check - 30 minutes
- Feature 6: Auto-update Application Status - 30 minutes
- Feature 7: Visual Practice Trends - 1.5 hours
- Feature 8: Reviewer Assignment Validation - 30 minutes

**Total: ~9.5 hours of implementation**

---

## TESTING CHECKLIST

### Feature 1: Personal Answer Library
- [ ] Save answer from practice interview
- [ ] View saved answers library
- [ ] Add notes and tags to saved answer
- [ ] Delete saved answer
- [ ] Filter saved answers by tags

### Feature 2: Practice Streak Tracking
- [ ] Complete practice interview updates streak
- [ ] Consecutive days increment streak
- [ ] Skipped day resets streak
- [ ] Longest streak tracked correctly
- [ ] Dashboard displays streak badge

### Feature 3: Notes Box During Prep
- [ ] Notes box appears in prep phase
- [ ] Notes saved with question
- [ ] Notes persist on page refresh
- [ ] Character limit enforced

### Feature 4: CSV Candidate Import
- [ ] Upload valid CSV succeeds
- [ ] Invalid format shows errors
- [ ] Duplicate emails detected
- [ ] Import preview shows data correctly
- [ ] Bulk invite option works

### Feature 5: Interview Completion Check
- [ ] Cannot review scheduled interview
- [ ] Cannot review in-progress interview
- [ ] Can review completed interview
- [ ] Clear error message shown

### Feature 6: Auto-update Application Status
- [ ] Application status updated on interview completion
- [ ] Timestamp recorded correctly
- [ ] Real-time feed notifies candidate

### Feature 7: Visual Practice Trends
- [ ] Chart displays on dashboard
- [ ] Trend calculation correct
- [ ] Time range selector works
- [ ] Data loads correctly

### Feature 8: Reviewer Assignment Validation
- [ ] Assigned reviewers can review
- [ ] Non-assigned reviewers blocked
- [ ] Clear error message shown
- [ ] Admin bypass works

---

**Status:** Ready to implement. Proceeding with systematic implementation...
