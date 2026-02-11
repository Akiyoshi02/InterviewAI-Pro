# Firebase Storage Decision Matrix (Complete System)

Date: 2026-02-11

This document defines where each part of the system should be stored:
- Firestore (durable business data / query-heavy records)
- Realtime Database (low-latency signaling, presence, feed invalidation, chat)
- Firestore + Realtime projection (Firestore is source of truth, Realtime mirrors minimal event state)

## Storage Rules

1. Firestore should be the source of truth for durable business records, history, analytics, and admin/reporting data.
2. Realtime Database should be used for instant UI synchronization, short-lived session state, presence, and push-style feed updates.
3. If both are used, Firestore is canonical and Realtime contains only projection/feed payloads needed for low-latency updates.
4. Do not store large, long-term historical datasets in Realtime DB.

## A) Firestore Collections: What They Should Be

| Data Area | Firestore Location | Should Be Realtime in RTDB? | Correct Storage Decision |
|---|---|---|---|
| User profiles/accounts | `users` | No | Firestore only |
| Interview records | `interviews` | Yes, as projection only | Firestore + RTDB session/feed projection |
| Interview questions | `interviews/{interviewId}/questions` | Event-only | Firestore + RTDB event notifications |
| Pose analytics snapshots | `interviews/{interviewId}/poseData` | Optional event signal only | Firestore only for data, RTDB only for lightweight event signal |
| WebRTC session metadata | `webrtcSessions` | Not required currently | Firestore only |
| Organizations | `organizations` | Yes, for status/feed mirrors | Firestore + RTDB status/feed projection |
| Organization memberships | `organizationMembers` | Yes, for access/feed mirrors | Firestore + RTDB membership mirror (`userOrganizationMap`) |
| Team invitations | `teamInvitations` | Yes, for instant org dashboard updates | Firestore + RTDB org feed projection |
| Jobs | `jobs` | Yes | Firestore + RTDB org/public feed projection |
| Candidate invitations | `invitations` | Yes | Firestore + RTDB org/candidate/interview projection |
| Interview reviews | `interviewReviews` | Yes | Firestore + RTDB org/interview event projection |
| Organization activity logs | `activityLogs` | No hard requirement | Firestore only |
| Job applications | `jobApplications` | Yes | Firestore + RTDB org/candidate feed projection |
| Platform audit logs | `platformAuditLogs` | Optional signal only | Firestore only (admin feed can trigger refresh) |
| System settings | `systemSettings` | Yes (public toggles and admin refresh) | Firestore + RTDB public/admin projection |
| Analytics snapshots | `analyticsSnapshots` | No | Firestore only |
| Email verification state | `emailVerifications` | No | Firestore only |
| Interview training datasets | `trainingDatasets_interviews` | No | Firestore only |
| Analytics training datasets | `trainingDatasets_analytics` | No | Firestore only |
| Dataset metadata | `trainingDatasets_metadata` | Optional signal only | Firestore only (admin feed event on changes) |
| Interview templates | `interviewTemplates` | No current requirement | Firestore only |
| Newsletter subscriptions | `newsletterSubscriptions` | No | Firestore only |
| Subscription state | `subscriptions` | No | Firestore only |
| Billing event history | `billingEvents` | No | Firestore only |

## B) Realtime Database Paths: What They Should Be

| Realtime Path | Purpose | Should Be in Firestore Instead? | Correct Storage Decision |
|---|---|---|---|
| `public/systemSettings` | Public low-latency flags (`maintenanceMode`, `nonverbalFeedbackEnabled`) | No (for instant client updates) | Keep in RTDB as projection from Firestore |
| `organizationApprovalStatus/{organizationId}` | Immediate approval/review status visibility | No | Keep in RTDB as projection from Firestore `organizations.status` |
| `sessions/{interviewId}/participants` | Live participant access map | No | RTDB authoritative session state |
| `sessions/{interviewId}/meta` | Live interview status/meta for instant sync | No | RTDB projection of interview live state |
| `sessions/{interviewId}/events/{eventId}` | Live event stream | No | RTDB authoritative for stream delivery |
| `sessions/{interviewId}/lastEvent` | Fast latest-event cursor | No | RTDB authoritative |
| `sessions/{interviewId}/presence/{participantId}` | Presence/connectivity | No | RTDB authoritative |
| `userInterviewFeeds/{uid}/{interviewId}` | Per-user interview feed invalidation/update cursor | No | RTDB projection |
| `userOrganizationMap/{uid}/{organizationId}` | Membership projection for RTDB rules | No | RTDB projection (derived from Firestore memberships) |
| `organizationFeeds/{organizationId}` | Org-level invalidation/feed events | No | RTDB projection |
| `candidateFeeds/{uid}` | Candidate-level invalidation/feed events | No | RTDB projection |
| `publicFeeds/{channel}` | Public feed invalidation (e.g. jobs) | No | RTDB projection |
| `adminFeeds/global` | Admin panel invalidation/feed events | No | RTDB projection |
| `admins/{uid}` | Realtime rules gate for admin-only feeds | No | RTDB access-control projection |
| `liveChats/{chatId}` | Live chat session state | No | RTDB authoritative |
| `liveChats/{chatId}/messages/{messageId}` | Live chat messages | No | RTDB authoritative |

## C) Complete Domain-by-Domain Decision

| Domain | Canonical Store | Realtime Mirror Needed? | Realtime Paths |
|---|---|---|---|
| Authentication/profile | Firestore (`users`) | No | None |
| Organization onboarding and approval | Firestore (`organizations`) | Yes | `organizationApprovalStatus/*`, `adminFeeds/global` |
| Organization membership/roles | Firestore (`organizationMembers`) | Yes | `userOrganizationMap/*`, `organizationFeeds/*`, `candidateFeeds/*` |
| Job posting lifecycle | Firestore (`jobs`) | Yes | `organizationFeeds/*`, `publicFeeds/jobs` |
| Application lifecycle | Firestore (`jobApplications`) | Yes | `organizationFeeds/*`, `candidateFeeds/*` |
| Invitation lifecycle | Firestore (`invitations`) | Yes | `organizationFeeds/*`, `candidateFeeds/*`, interview `sessions/*` events |
| Team invitation lifecycle | Firestore (`teamInvitations`) | Yes | `organizationFeeds/*` |
| Interview lifecycle/live status | Firestore (`interviews`, `questions`) | Yes | `sessions/*`, `userInterviewFeeds/*` |
| Review submission and override | Firestore (`interviewReviews`) | Yes | `organizationFeeds/*`, `sessions/*` event (`review-submitted`) |
| System settings | Firestore (`systemSettings`) | Yes | `public/systemSettings`, `adminFeeds/global` |
| Admin organization queues/lists | Firestore (`organizations`) | Yes, as refresh signal | `adminFeeds/global` |
| Datasets and training data | Firestore (`trainingDatasets_*`) | Yes, only for panel refresh signal | `adminFeeds/global` |
| Live support chat | RTDB (`liveChats/*`) | Native realtime | `liveChats/*` |
| Newsletter/billing | Firestore (`newsletterSubscriptions`, `subscriptions`, `billingEvents`) | No | None |
| Historical analytics and audit | Firestore (`analyticsSnapshots`, `platformAuditLogs`, `activityLogs`) | Optional refresh signal only | `adminFeeds/global` or `organizationFeeds/*` triggers |

## D) Verification Against Current Code

Status summary after audit:
- Interview/session realtime: implemented.
- Jobs/applications/invitations/team-invitations realtime feed projection: implemented.
- Organization/member updates and membership map projection: implemented.
- Review submission realtime projection: implemented.
- Interview lifecycle projection to organization/admin feeds for analytics/fairness refresh: implemented.
- Admin feed updates for org status, system settings, datasets, registration/re-review triggers: implemented.
- Public settings realtime mirror: implemented.
- Live chat realtime: implemented.

## E) Final System Recommendation

1. Keep Firestore as canonical business datastore.
2. Keep Realtime Database as low-latency projection/signaling layer.
3. Continue dual-write only where instant multi-user UI updates are required.
4. Avoid moving business-history entities (datasets, billing, templates, analytics snapshots, newsletter, audit logs) into RTDB.
5. Treat RTDB feed records as invalidation/event cursors, not primary records.
