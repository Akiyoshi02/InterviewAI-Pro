# Firebase Storage Inventory (Complete Code Audit)

Date: 2026-02-11

This is a full code-level inventory of what the system stores in:
- Firestore
- Firebase Realtime Database

Scope:
- `server/src/**`
- `src/**`
- `firebase.database.rules.json`

## 1) Firestore Inventory

### Core collections (from `server/src/services/firebaseData.service.js`)

1. `users`
- Stored fields:
`id`, `email`, `accountType`, `fullName`, `experienceLevel`, `skills`, `gender`, `targetRole`, `careerGoals`, `location`, `preferredLanguage`, `phoneNumber`, `highestQualification`, `fieldOfStudy`, `institutionName`, `graduationYear`, `linkedinUrl`, `githubUrl`, `portfolioUrl`, `certifications`, `availability`, `preferredWorkType`, `preferredEmploymentType`, `expectedSalary`, `companyName`, `companyType`, `companySize`, `industry`, `jobTitle`, `department`, `hiringVolume`, `companyWebsite`, `companyLocation`, `businessRegistrationNumber`, `companyEmail`, `establishedYear`, `companyLinkedinUrl`, `profilePhotoUrl`, `resumeUrl`, `resumeOriginalName`, `resumeHash`, `resumeInsights`, `companyLogoUrl`, `companyVerificationUrl`, `companyVerificationOriginalName`, `companyVerificationHash`, `companyVerificationInsights`, `primaryOrganizationId`, `organizationRoles`, `authProvider`, `createdAt`, `updatedAt`

2. `interviews`
- Stored fields:
`id`, `mode`, `candidateId`, `companyId`, `organizationId`, `jobId`, `jobStage`, `invitationId`, `pipelineStatus`, `reviewerAssignments`, `status`, `jobRole`, `experienceLevel`, `industry`, `interviewTypes`, `skillFocus`, `duration`, `startedAt`, `endedAt`, `transcript`, `evaluation`, `overallScore`, `readinessLevel`, `createdAt`, `updatedAt`
- Also receives updates such as:
`recordingConsentGivenAt`, `recordingConsentVersion`, `finalOverallScore`, `finalScoreSource`

3. `interviews/{interviewId}/questions` (subcollection)
- Stored fields:
`id`, `interviewId`, `sequence`, `question`, `questionType`, `difficulty`, `expectedDuration`, `evaluationCriteria`, `answer`, `answerAudioUrl`, `askedAt`, `answeredAt`, `timeToAnswer`, `score`, `strengths`, `weaknesses`, `feedback`, `followUpQuestion`, `createdAt`, `updatedAt`

4. `interviews/{interviewId}/poseData` (subcollection)
- Stored fields:
`interviewId`, `poseLandmarks`, `gestureData`, `confidence`, `engagementScore`, `postureQuality`, `createdAt`

5. `webrtcSessions`
- Stored fields:
`interviewId`, `roomId`, `peerId`, `isConnected`, `createdAt`, `updatedAt`

6. `organizations`
- Stored fields:
`id`, `name`, `displayName`, `ownerId`, `industry`, `companySize`, `logo`, `website`, `address`, `description`, `facebookUrl`, `linkedinUrl`, `youtubeUrl`, `status`, `branding`, `settings`, `createdAt`, `updatedAt`
- Additional workflow/status fields written over time:
`approvedBy`, `approvedAt`, `rejectedReason`, `rejectedReasonCode`, `rejectedReasonTags`, `rejectedReasonTagOther`, `rejectedBy`, `rejectedAt`, `rejectionHistory`, `reReviewRequestedAt`, `reReviewRequestedBy`, `reReviewRequestNote`, `reReviewRequestCount`, `reReviewRequests`, `suspensionReason`, `suspendedBy`, `suspendedAt`

7. `organizationMembers`
- Stored fields:
`id` (format `organizationId_userId`), `organizationId`, `userId`, `role`, `status`, `permissions`, `createdAt`, `updatedAt`

8. `teamInvitations`
- Stored fields:
`organizationId`, `email`, `role`, `token`, `status`, `invitedBy`, `invitedAt`, `expiresAt`, `acceptedAt`, `acceptedBy`, `updatedAt`

9. `jobs`
- Stored fields:
`id`, `organizationId`, `createdBy`, `title`, `department`, `location`, `employmentType`, `experienceLevel`, `compensationRange`, `salaryCurrency`, `salaryMin`, `salaryMax`, `benefits`, `description`, `requirements`, `responsibilities`, `skills`, `status`, `stages`, `templateConfig`, `reviewerIds`, `hiringManagerId`, `postingDuration`, `scheduledPublishAt`, `publishedAt`, `expiresAt`, `createdAt`, `updatedAt`

10. `invitations`
- Stored fields:
`id`, `token`, `organizationId`, `jobId`, `stage`, `email`, `invitedBy`, `candidateUserId`, `status`, `expiresAt`, `metadata`, `acceptedAt`, `createdAt`, `updatedAt`

11. `interviewReviews`
- Stored fields:
`id`, `interviewId`, `reviewerId`, `reviewerRole`, `score`, `decision`, `strengths`, `weaknesses`, `notes`, `rating`, `technicalScore`, `communicationScore`, `problemSolvingScore`, `culturalFitScore`, `recommendation`, `aiOverallScoreAtReview`, `smeOverallScore`, `overrideOverall`, `createdAt`, `updatedAt`

12. `activityLogs`
- Stored fields:
`id`, `organizationId`, `actorId`, `actorRole`, `action`, `targetType`, `targetId`, `metadata`, `createdAt`

13. `jobApplications`
- Stored fields:
`id`, `jobId`, `candidateId`, `organizationId`, `status`, `resumeUrl`, `coverLetter`, `answers`, `submittedAt`, `createdAt`, `updatedAt`
- Additional status lifecycle fields can be merged in update flows, e.g. withdrawal metadata.

14. `platformAuditLogs`
- Stored fields:
`id`, `actorId`, `actorType`, `action`, `targetType`, `targetId`, `metadata`, `createdAt`

15. `systemSettings` (doc id `main`)
- Stored fields:
`id`, `featureFlags`, `maintenanceMode`, `nonverbalFeedbackEnabled`, `defaultAIConfig`, `dataRetention`, `createdAt`, `updatedAt`, `initializedBy`, `updatedBy`

16. `analyticsSnapshots`
- Organization snapshot fields:
`id`, `organizationId`, `dateKey`, `activeJobPostings`, `pendingReviews`, `upcomingInterviews`, `totalInterviews`, `completedInterviews`, `averageScore`, `totalCandidates`, `hiredCount`, `snapshotDate`, `createdAt`, `updatedAt`
- Candidate snapshot fields:
`id`, `candidateId`, `dateKey`, `type` (`candidate`), `totalInterviews`, `completedInterviews`, `scheduledInterviews`, `inProgressInterviews`, `averageScore`, `currentGrade`, `snapshotDate`, `createdAt`, `updatedAt`

17. `emailVerifications`
- Stored fields:
`id`, `uid`, plus merged verification payload fields, `createdAt`, `updatedAt`

### Additional Firestore collections used outside the main service

18. `trainingDatasets_interviews` (from `server/src/controllers/dataset.controller.js`)
- Stored fields:
`sessionId`, `interviewId`, `userId`, `config`, `data.conversationTurns[]`, `data.questionAnswerPairs[]`, `summary`, `trainingData`, `metadata` (`createdAt`, `updatedAt`, `dataVersion`, `platform`, `qualityScore`)

19. `trainingDatasets_analytics`
- Stored fields:
`sessionId`, `interviewId`, `userId`, `config`, `data.dataPoints[]`, `data.totalFrames`, `data.duration`, `summary`, `referenceComparison`, `metadata` (`createdAt`, `updatedAt`, `dataVersion`, `platform`)

20. `trainingDatasets_metadata`
- Stored fields (merged):
`lastUpdated`, `lastInterviewUpload`, `lastAnalyticsUpload`

21. `interviewTemplates` (from `server/src/controllers/template.controller.js`)
- Stored fields:
`id`, `name`, `description`, `organizationId`, `jobRole`, `experienceLevel`, `industry`, `interviewTypes`, `duration`, `skillFocus`, `questions`, `config`, `isPublic`, `usageCount`, `createdBy`, `createdAt`, `updatedAt`, `lastUsedAt`

22. `newsletterSubscriptions` (from `server/src/controllers/newsletter.controller.js`)
- Stored fields:
`email`, `subscribedAt`, `status`, `source`, `unsubscribedAt`

23. `subscriptions` (from `server/src/services/billing.service.js`)
- Stored fields:
`organizationId`, `planId`, `planName`, `status`, `currentPeriodStart`, `currentPeriodEnd`, `customerId`, `subscriptionId`, `usage` (`interviews`, `jobs`, `storage`), `createdAt`, `updatedAt`, `canceledAt`

24. `billingEvents`
- Stored fields:
`id`, `organizationId`, `eventType`, `metadata`, `timestamp`

## 2) Realtime Database Inventory

### Paths defined/enforced in rules (`firebase.database.rules.json`)

1. `public/systemSettings`
- Stored fields:
`maintenanceMode`, `nonverbalFeedbackEnabled`, `updatedAt`
- Writer:
server sync (`syncPublicSystemSettings`)
- Readers:
maintenance hooks, live interview page

2. `organizationApprovalStatus/{organizationId}`
- Stored fields across lifecycle:
`status`, `organizationId`, `organizationName`, `ownerId`, `ownerEmail`, `createdAt`, `updatedAt`, `approvedBy`, `approvedAt`, `rejectedReason`, `rejectedReasonCode`, `rejectedReasonTags`, `rejectedReasonTagOther`, `rejectedBy`, `rejectedAt`, `reReviewRequestedAt`, `reReviewRequestedBy`, `reReviewRequestNote`, `suspensionReason`, `suspendedBy`, `suspendedAt`
- Writers:
registration + org status operations
- Readers:
registration flow/status polling

3. `sessions/{interviewId}/participants`
- Stored fields:
map of participant IDs to `true`

4. `sessions/{interviewId}/meta`
- Stored fields:
`interviewId`, `candidateId`, `companyId`, `status`, `pipelineStatus`, `jobStage`, `overallScore`, `readinessLevel`, `updatedAt`, plus `lastEventType`, `lastEventAt`

5. `sessions/{interviewId}/events/{eventId}`
- Stored fields:
`eventType`, `payload`, `timestamp`

6. `sessions/{interviewId}/lastEvent`
- Stored fields:
same shape as an event (`eventType`, `payload`, `timestamp`)

7. `sessions/{interviewId}/presence/{participantId}`
- Stored fields:
`connected`, `role`, `socketId`, `updatedAt`

8. `userInterviewFeeds/{uid}/{interviewId}`
- Stored fields:
`interviewId`, `status`, `pipelineStatus`, `jobStage`, `overallScore`, `readinessLevel`, `lastEventType`, `lastEventAt`, `updatedAt`, `lastQuestionId`

9. `userOrganizationMap/{uid}/{organizationId}`
- Stored value:
boolean membership marker (`true`) when active

10. `organizationFeeds/{organizationId}`
11. `candidateFeeds/{uid}`
12. `publicFeeds/{channel}` (e.g. `publicFeeds/jobs`)
13. `adminFeeds/global`
- All four feed paths use the same stored envelope:
`lastEventId`, `lastEventType`, `lastEventAt`, `updatedAt`, `payload`
- `payload` depends on event source.

14. `admins/{uid}`
- Stored fields:
`uid`, `email`, `fullName`, `updatedAt` (server timestamp)

15. `liveChats/{chatId}`
- Stored fields:
`status`, `createdAt`, `lastMessageAt`, `lastMessagePreview`, `user`, `respondedAt`, `respondedBy`, `closedAt`, `closedBy`
- `user` object fields:
`uid`, `displayName`, `accountType`, `email`, `companyName`, `userId`

16. `liveChats/{chatId}/messages/{messageId}`
- Stored fields:
`text`, `createdAt`, `sender`
- `sender` object fields:
`uid`, `role` (`user` or `admin`), `displayName`

### Realtime event payload keys currently emitted

1. Organization feed events (`organizationFeeds/*`)
- `organization-updated`: `organizationId`
- `member-updated`: `organizationId`, `userId`, `role`, `status`
- `member-synced`: `userId`, `role`, `status`
- `job-created`: `jobId`, `status`
- `job-updated`: `jobId`, `status`
- `job-deleted`: `jobId`
- `job-published`: `jobId`, `status`, `publishedAt`
- `application-submitted`: `applicationId`, `jobId`, `candidateId`, `status`
- `application-status-updated`: `applicationId`, `jobId`, `candidateId`, `status`
- `application-withdrawn`: `applicationId`, `jobId`, `candidateId`, `status`
- `invitation-created`: `invitationId`, `jobId`, `email`, `status`
- `invitation-accepted`: `invitationId`, `interviewId`, `candidateId`, `status`
- `team-invitation-created`: `invitationId`, `email`, `role`, `status`
- `team-invitation-revoked`: `invitationId`
- `team-invitation-resent`: `invitationId`, `email`
- `team-invitation-accepted`: `invitationId`, `userId`, `email`, `role`
- `pipeline-updated`: `interviewId`, `candidateId`, `pipelineStatus`, `jobStage`
- `review-submitted`: `interviewId`, `reviewerId`, `decision`, `score`, `overrideOverall`
- `interview-created`: `interviewId`, `status`, `candidateId`, `companyId`, `jobId`
- `interview-started`: `interviewId`, `status`, `startedAt`, `candidateId`, `companyId`, `jobId`
- `interview-ended`: `interviewId`, `status`, `endedAt`, `overallScore`, `readinessLevel`, `candidateId`, `companyId`, `jobId`

2. Candidate feed events (`candidateFeeds/*`)
- `organization-membership-updated`: `organizationId`, `role`, `status`
- `application-submitted`: `applicationId`, `jobId`, `organizationId`, `status`
- `application-status-updated`: `applicationId`, `jobId`, `organizationId`, `status`
- `application-withdrawn`: `applicationId`, `jobId`, `organizationId`, `status`
- `invitation-accepted`: `invitationId`, `interviewId`, `organizationId`, `status`
- `pipeline-updated`: `interviewId`, `organizationId`, `pipelineStatus`, `jobStage`

3. Public feed events (`publicFeeds/jobs`)
- `job-published`: `jobId`, `organizationId`, `publishedAt`
- `job-updated`: `jobId`, `organizationId`, `status`
- `job-deleted`: `jobId`, `organizationId`

4. Admin feed events (`adminFeeds/global`)
- `organization-status-updated`: `organizationId`, `status`, plus optional context (`source`, `ownerId`, `ownerEmail`, `requestedBy`)
- `system-settings-updated`: `maintenanceMode`, `nonverbalFeedbackEnabled`
- `dataset-updated`: `datasetType`, `action`, `datasetId`
- `interview-completed`: `interviewId`, `organizationId`, `status`, `endedAt`, `overallScore`, `readinessLevel`
- `review-submitted`: `interviewId`, `organizationId`, `reviewerId`, `decision`, `score`, `overrideOverall`, `aiOverallScoreAtReview`, `smeOverallScore`

5. Session event payloads (`sessions/*/events`)
- `interview-created`: `actor`, `status`, `mode`
- `interview-started`: `actor`, `status`, `startedAt`
- `interview-ended`: `actor`, `status`, `endedAt`, `overallScore`, `readinessLevel`
- `question-asked`: `actor`, `questionId`, `askedAt`
- `answer-submitted`: `actor`, `questionId`, `answeredAt`, `score`
- `participant-connected` / `participant-disconnected`: `actor`, `role`, `socketId`
- `pose-data`: `actor`, `engagementScore`, `postureQuality`
- `pipeline-updated`: `actor`, `status`, `jobStage`, `pipelineStatus`
- `review-submitted`: `actor`, `status`, `decision`, `score`, `overrideOverall`, `finalOverallScore`

## 3) Automated completeness cross-check

The code scan found these Firestore literal collection names in source:
`activityLogs`, `analyticsSnapshots`, `billingEvents`, `emailVerifications`, `interviewReviews`, `interviewTemplates`, `interviews`, `invitations`, `jobApplications`, `jobs`, `newsletterSubscriptions`, `organizationMembers`, `organizations`, `platformAuditLogs`, `subscriptions`, `systemSettings`, `teamInvitations`, `users`, `webrtcSessions`.

Additional dynamic/constant-based Firestore names also present:
`trainingDatasets_interviews`, `trainingDatasets_analytics`, `trainingDatasets_metadata`, plus interview subcollections `questions` and `poseData`.

The code scan found these RTDB path expressions in source:
`admins/${uid}`, `organizationApprovalStatus/${id}`, `organizationApprovalStatus/${organization.id}`, `organizationApprovalStatus/${organizationId}`, `public/systemSettings`, `sessions/${interview.id}`, `sessions/${interviewId}`, `sessions/${interviewId}/participants`, `userOrganizationMap/${userId}/${organizationId}`, and chat paths under `liveChats/*`.

Additional RTDB paths resolved from hook inputs/event publishers:
`userInterviewFeeds/${uid}`, `organizationFeeds/${organizationId}`, `candidateFeeds/${uid}`, `publicFeeds/jobs`, `adminFeeds/global`, `sessions/${interviewId}/lastEvent`.
