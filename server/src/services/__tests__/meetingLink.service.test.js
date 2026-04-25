import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const {
  generateMeetingToken,
  buildMeetingJoinUrl,
  validateMeetingToken,
  validateMeetingAccess,
  getMeetingAccessWindow,
  isWithinMeetingAccessWindow,
  shouldSendMeetingLinkEmail,
  MEETING_LINK_ACCESS_WINDOW_MINUTES,
  MEETING_LINK_POST_END_GRACE_MINUTES,
  MEETING_LINK_EMAIL_MINUTES_BEFORE,
  MEETING_LINK_EMAIL_PENDING_GRACE_MINUTES,
  MEETING_LINK_EMAIL_FAILURE_RETRY_MINUTES,
} = await import('../meetingLink.service.js');

// ── Helpers ────────────────────────────────────────────────────────────────
const futureMs = (minutes) => Date.now() + minutes * 60_000;
const futureIso = (minutes) => new Date(futureMs(minutes)).toISOString();
const pastIso = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

// ============================================================================
// generateMeetingToken
// ============================================================================
describe('generateMeetingToken', () => {
  it('returns meetingToken, meetingTokenGeneratedAt and meetingLinkEmailSent', () => {
    const result = generateMeetingToken();
    expect(result).toHaveProperty('meetingToken');
    expect(result).toHaveProperty('meetingTokenGeneratedAt');
    expect(result).toHaveProperty('meetingLinkEmailSent', false);
  });

  it('generates a 64-char hex string (256-bit)', () => {
    const { meetingToken } = generateMeetingToken();
    expect(meetingToken).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces unique tokens on each call', () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateMeetingToken().meetingToken));
    expect(tokens.size).toBe(20);
  });

  it('producesiso timestamp for meetingTokenGeneratedAt', () => {
    const { meetingTokenGeneratedAt } = generateMeetingToken();
    expect(Number.isNaN(Date.parse(meetingTokenGeneratedAt))).toBe(false);
  });
});

// ============================================================================
// buildMeetingJoinUrl
// ============================================================================
describe('buildMeetingJoinUrl', () => {
  it('builds a valid URL with interviewId and token', () => {
    const url = buildMeetingJoinUrl('int-abc', 'tok-123');
    expect(url).toContain('/interview-lobby/int-abc');
    expect(url).toContain('token=tok-123');
  });

  it('encodes special characters in interviewId and token', () => {
    const url = buildMeetingJoinUrl('id with spaces', 'token=&special');
    expect(url).toContain('id%20with%20spaces');
    expect(url).toContain('token%3D%26special');
  });

  it('returns null when interviewId is missing', () => {
    expect(buildMeetingJoinUrl(null, 'tok')).toBeNull();
    expect(buildMeetingJoinUrl('', 'tok')).toBeNull();
  });

  it('returns null when meetingToken is missing', () => {
    expect(buildMeetingJoinUrl('int-1', null)).toBeNull();
    expect(buildMeetingJoinUrl('int-1', '')).toBeNull();
  });
});

describe('validateMeetingToken', () => {
  const validToken = 'a'.repeat(64);
  const buildInterview = (overrides = {}) => ({
    id: 'int-1',
    meetingToken: validToken,
    ...overrides,
  });

  it('accepts a matching token without checking the schedule window', () => {
    expect(validateMeetingToken(buildInterview(), validToken)).toEqual({ valid: true });
  });

  it('rejects a mismatched token', () => {
    expect(validateMeetingToken(buildInterview(), 'wrong-token')).toEqual(expect.objectContaining({
      valid: false,
      code: 'INVALID_TOKEN',
    }));
  });
});

// ============================================================================
// validateMeetingAccess
// ============================================================================
describe('validateMeetingAccess', () => {
  const validToken = 'a'.repeat(64);

  const buildInterview = (overrides = {}) => ({
    id: 'int-1',
    meetingToken: validToken,
    scheduledFor: futureIso(15), // 15 min from now → inside 30-min window
    duration: 30,
    ...overrides,
  });

  // ── Happy path ──
  it('returns { valid: true } when token matches and time is within the window', () => {
    const interview = buildInterview();
    const result = validateMeetingAccess(interview, validToken);
    expect(result).toEqual({ valid: true });
  });

  // ── Interview / token edge cases ──
  it('rejects when interview is null', () => {
    const r = validateMeetingAccess(null, validToken);
    expect(r.valid).toBe(false);
    expect(r.code).toBe('NOT_FOUND');
  });

  it('rejects when interview has no meetingToken', () => {
    const r = validateMeetingAccess(buildInterview({ meetingToken: null }), validToken);
    expect(r.valid).toBe(false);
    expect(r.code).toBe('NO_TOKEN');
  });

  it('rejects when supplied token does not match', () => {
    const r = validateMeetingAccess(buildInterview(), 'wrong-token');
    expect(r.valid).toBe(false);
    expect(r.code).toBe('INVALID_TOKEN');
  });

  it('rejects when supplied token is empty', () => {
    const r = validateMeetingAccess(buildInterview(), '');
    expect(r.valid).toBe(false);
    expect(r.code).toBe('INVALID_TOKEN');
  });

  it('rejects when supplied token is undefined', () => {
    const r = validateMeetingAccess(buildInterview(), undefined);
    expect(r.valid).toBe(false);
    expect(r.code).toBe('INVALID_TOKEN');
  });

  // ── Schedule date edge cases ──
  it('rejects when scheduledFor is missing', () => {
    const r = validateMeetingAccess(buildInterview({ scheduledFor: null }), validToken);
    expect(r.valid).toBe(false);
    expect(r.code).toBe('NOT_SCHEDULED');
  });

  it('rejects when scheduledFor is invalid date', () => {
    const r = validateMeetingAccess(buildInterview({ scheduledFor: 'not-a-date' }), validToken);
    expect(r.valid).toBe(false);
    expect(r.code).toBe('INVALID_SCHEDULE');
  });

  // ── Time window ──
  it('rejects when current time is too early (before 30-min window)', () => {
    const r = validateMeetingAccess(
      buildInterview({ scheduledFor: futureIso(60) }), // 60 min away
      validToken,
    );
    expect(r.valid).toBe(false);
    expect(r.code).toBe('TOO_EARLY');
    expect(r.message).toMatch(/minute/);
  });

  it('allows access exactly at the window opening (30 min before)', () => {
    // Schedule exactly 30 min from now
    const r = validateMeetingAccess(
      buildInterview({ scheduledFor: futureIso(MEETING_LINK_ACCESS_WINDOW_MINUTES) }),
      validToken,
    );
    expect(r.valid).toBe(true);
  });

  it('allows access at the scheduled time', () => {
    const r = validateMeetingAccess(
      buildInterview({ scheduledFor: new Date().toISOString() }),
      validToken,
    );
    expect(r.valid).toBe(true);
  });

  it('allows access during the interview (scheduledFor in the past but within duration)', () => {
    // Scheduled 10 min ago, duration 30 min → ends in 20 min
    const r = validateMeetingAccess(
      buildInterview({ scheduledFor: pastIso(10), duration: 30 }),
      validToken,
    );
    expect(r.valid).toBe(true);
  });

  it('rejects after the interview window has closed', () => {
    // Scheduled 120 min ago, duration 30 min → ended 90 min ago
    const r = validateMeetingAccess(
      buildInterview({ scheduledFor: pastIso(120), duration: 30 }),
      validToken,
    );
    expect(r.valid).toBe(false);
    expect(r.code).toBe('EXPIRED');
  });

  it('uses 30-minute default duration when duration is not set', () => {
    // Scheduled 20 min ago, no duration → default 30 min → ends in 10 min
    const r = validateMeetingAccess(
      buildInterview({ scheduledFor: pastIso(20), duration: undefined }),
      validToken,
    );
    expect(r.valid).toBe(true);
  });

  it('rejects after default 30-minute duration window when duration is missing', () => {
    // Scheduled 40 min ago, no duration → default 30 min → ended 10 min ago
    const r = validateMeetingAccess(
      buildInterview({ scheduledFor: pastIso(70), duration: undefined }),
      validToken,
    );
    expect(r.valid).toBe(false);
    expect(r.code).toBe('EXPIRED');
  });

  it('keeps access valid during the post-end grace period', () => {
    const r = validateMeetingAccess(
      buildInterview({ scheduledFor: pastIso(45), duration: 30 }),
      validToken,
    );
    expect(r.valid).toBe(true);
  });

  // ── Token comparison security ──
  it('does constant-time comparison (different-length tokens still rejected)', () => {
    const r = validateMeetingAccess(buildInterview(), 'short');
    expect(r.valid).toBe(false);
    expect(r.code).toBe('INVALID_TOKEN');
  });
});

// ============================================================================
// shouldSendMeetingLinkEmail
// ============================================================================
describe('shouldSendMeetingLinkEmail', () => {
  const buildInterview = (overrides = {}) => ({
    id: 'int-1',
    meetingToken: 'a'.repeat(64),
    scheduledFor: futureIso(20), // 20 min from now → inside 30-min window
    meetingLinkEmailSent: false,
    status: 'SCHEDULED',
    ...overrides,
  });

  it('returns true when interview is within the email window and not yet sent', () => {
    expect(shouldSendMeetingLinkEmail(buildInterview())).toBe(true);
  });

  it('returns false when email was already sent', () => {
    expect(shouldSendMeetingLinkEmail(buildInterview({ meetingLinkEmailSent: true }))).toBe(false);
  });

  it('returns false when scheduledFor is missing', () => {
    expect(shouldSendMeetingLinkEmail(buildInterview({ scheduledFor: null }))).toBe(false);
  });

  it('returns false when meetingToken is missing', () => {
    expect(shouldSendMeetingLinkEmail(buildInterview({ meetingToken: null }))).toBe(false);
  });

  it('returns false when status is COMPLETED', () => {
    expect(shouldSendMeetingLinkEmail(buildInterview({ status: 'COMPLETED' }))).toBe(false);
  });

  it('returns false when status is CANCELLED', () => {
    expect(shouldSendMeetingLinkEmail(buildInterview({ status: 'CANCELLED' }))).toBe(false);
  });

  it('returns false when interview is null', () => {
    expect(shouldSendMeetingLinkEmail(null)).toBe(false);
  });

  it('returns false when interview is far in the future', () => {
    expect(shouldSendMeetingLinkEmail(
      buildInterview({ scheduledFor: futureIso(120) }),
    )).toBe(false);
  });

  it('returns false when interview scheduledFor is in the past', () => {
    expect(shouldSendMeetingLinkEmail(
      buildInterview({ scheduledFor: pastIso(10) }),
    )).toBe(false);
  });

  it('returns false while a reminder is already pending dispatch', () => {
    expect(shouldSendMeetingLinkEmail(
      buildInterview({ meetingLinkEmailPendingAt: futureIso(-1) }),
    )).toBe(false);
  });

  it('returns true again once a pending reminder has gone stale', () => {
    const stalePendingAt = new Date(
      Date.now() - ((MEETING_LINK_EMAIL_PENDING_GRACE_MINUTES + 1) * 60 * 1000),
    ).toISOString();
    expect(shouldSendMeetingLinkEmail(
      buildInterview({ meetingLinkEmailPendingAt: stalePendingAt }),
    )).toBe(true);
  });

  it('returns false immediately after a permanent reminder failure', () => {
    expect(shouldSendMeetingLinkEmail(
      buildInterview({ meetingLinkEmailFailureAt: futureIso(-1) }),
    )).toBe(false);
  });

  it('allows a retry after the reminder-failure cooldown elapses', () => {
    const retryEligibleFailureAt = new Date(
      Date.now() - ((MEETING_LINK_EMAIL_FAILURE_RETRY_MINUTES + 1) * 60 * 1000),
    ).toISOString();
    expect(shouldSendMeetingLinkEmail(
      buildInterview({ meetingLinkEmailFailureAt: retryEligibleFailureAt }),
    )).toBe(true);
  });

  it('returns true at exactly the email send threshold', () => {
    // scheduledFor exactly MEETING_LINK_EMAIL_MINUTES_BEFORE from now
    expect(shouldSendMeetingLinkEmail(
      buildInterview({ scheduledFor: futureIso(MEETING_LINK_EMAIL_MINUTES_BEFORE) }),
    )).toBe(true);
  });

  it('returns false when scheduledFor is invalid', () => {
    expect(shouldSendMeetingLinkEmail(buildInterview({ scheduledFor: 'garbage' }))).toBe(false);
  });
});

// ============================================================================
// Exported constants
// ============================================================================
describe('exported constants', () => {
  it('MEETING_LINK_ACCESS_WINDOW_MINUTES is 30', () => {
    expect(MEETING_LINK_ACCESS_WINDOW_MINUTES).toBe(30);
  });

  it('MEETING_LINK_EMAIL_MINUTES_BEFORE is 30', () => {
    expect(MEETING_LINK_EMAIL_MINUTES_BEFORE).toBe(30);
  });

  it('MEETING_LINK_POST_END_GRACE_MINUTES is positive', () => {
    expect(MEETING_LINK_POST_END_GRACE_MINUTES).toBeGreaterThan(0);
  });

  it('MEETING_LINK_EMAIL_PENDING_GRACE_MINUTES is positive', () => {
    expect(MEETING_LINK_EMAIL_PENDING_GRACE_MINUTES).toBeGreaterThan(0);
  });

  it('MEETING_LINK_EMAIL_FAILURE_RETRY_MINUTES is positive', () => {
    expect(MEETING_LINK_EMAIL_FAILURE_RETRY_MINUTES).toBeGreaterThan(0);
  });
});

describe('meeting access window helpers', () => {
  it('computes a close window that includes the post-end grace period', () => {
    const interview = {
      scheduledFor: futureIso(15),
      duration: 45,
    };

    const window = getMeetingAccessWindow(interview);
    expect(window).not.toBeNull();
    expect(window.windowCloseMs - window.scheduledMs).toBe((45 + MEETING_LINK_POST_END_GRACE_MINUTES) * 60 * 1000);
  });

  it('recognizes when now is outside the meeting access window', () => {
    const interview = {
      scheduledFor: pastIso(90),
      duration: 30,
    };

    expect(isWithinMeetingAccessWindow(interview)).toBe(false);
  });
});
