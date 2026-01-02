FIREBASE STORAGE MAP
====================

Overview
--------
- Authentication is handled via Firebase Auth on the client (email/password and Google).
- Firestore and Realtime Database are accessed on the server only.

Authentication (Firebase Auth)
------------------------------
Stored by Firebase Auth (managed by Firebase):
- uid
- email
- emailVerified
- provider data
- creation / last sign-in metadata

Set/updated by this app:
- displayName (from sign-up metadata full name)
- photoURL (Google provider)

Firestore Collections
---------------------
users
- id
- email
- accountType (CANDIDATE | COMPANY | SYSTEM_ADMIN)
- fullName
- experienceLevel
- skills
- companyName
- companySize
- industry
- gender
- targetRole
- careerGoals
- location
- preferredLanguage
- jobTitle
- department
- hiringVolume
- companyWebsite
- companyLocation
- phoneNumber
- profilePhotoUrl
- resumeUrl
- resumeOriginalName
- resumeHash
- resumeInsights
- companyLogoUrl
- companyVerificationUrl
- companyVerificationOriginalName
- companyVerificationHash
- companyVerificationInsights
- primaryOrganizationId
- organizationRoles
- authProvider
- createdAt
- updatedAt

interviews
- id
- mode
- candidateId
- companyId
- organizationId
- jobId
- jobStage
- invitationId
- pipelineStatus
- reviewerAssignments
- status
- jobRole
- experienceLevel
- industry
- interviewTypes
- skillFocus
- duration
- startedAt
- endedAt
- transcript
- evaluation
- overallScore
- readinessLevel
- config
- createdAt
- updatedAt

interviews/{interviewId}/questions
- id
- interviewId
- sequence
- question
- questionType
- difficulty
- expectedDuration
- evaluationCriteria
- answer
- answerAudioUrl
- askedAt
- answeredAt
- timeToAnswer
- score
- strengths
- weaknesses
- feedback
- followUpQuestion
- createdAt
- updatedAt

interviews/{interviewId}/poseData
- interviewId
- poseLandmarks
- gestureData
- confidence
- engagementScore
- postureQuality
- createdAt

webrtcSessions
- interviewId
- roomId
- peerId
- isConnected
- createdAt
- updatedAt

organizations
- id
- name
- displayName
- ownerId
- industry
- companySize
- status (PENDING | APPROVED | REJECTED | SUSPENDED)
- approvedBy
- approvedAt
- rejectedReason
- suspensionReason
- branding
- settings
- createdAt
- updatedAt

organizationMembers
- id
- organizationId
- userId
- role
- status
- permissions
- createdAt
- updatedAt

jobs
- id
- organizationId
- createdBy
- title
- department
- location
- employmentType
- experienceLevel
- compensationRange
- description
- requirements
- responsibilities
- skills
- status
- stages
- templateConfig
- applicationQuestions
- acceptingApplications
- reviewerIds
- hiringManagerId
- publishedAt
- createdAt
- updatedAt

invitations
- id
- token
- organizationId
- jobId
- stage
- email
- invitedBy
- candidateUserId
- status
- expiresAt
- metadata
- acceptedAt
- createdAt
- updatedAt

interviewReviews
- id
- interviewId
- reviewerId
- reviewerRole
- score
- decision
- strengths
- weaknesses
- notes
- createdAt
- updatedAt

activityLogs
- id
- organizationId
- actorId
- actorRole
- action
- targetType
- targetId
- metadata
- createdAt

jobApplications
- id
- jobId
- candidateId
- organizationId
- status (SUBMITTED | SCREENING | INTERVIEWING | SHORTLISTED | REJECTED | HIRED)
- resumeUrl
- coverLetter
- answers
- submittedAt
- reviewedAt
- reviewedBy
- interviewId
- createdAt
- updatedAt

systemSettings
- id (always 'global')
- featureFlags
- maintenanceMode
- defaultAIConfig
- dataRetention
- updatedBy
- createdAt
- updatedAt

platformAuditLogs
- id
- actorId
- actorType
- action
- targetType
- targetId
- metadata
- timestamp

Realtime Database Paths
-----------------------
sessions/{interviewId}/events/{eventId}
- eventType
- payload
- timestamp

sessions/{interviewId}/lastEvent
- eventType
- payload
- timestamp

Event Types Recorded
--------------------
- question-asked: payload includes questionId and actor
- answer-submitted: payload includes questionId and actor
- pose-data: payload includes actor, engagementScore, postureQuality
