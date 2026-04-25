import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockVerify = jest.fn();
const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({
  verify: mockVerify,
  sendMail: mockSendMail,
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: mockLogger,
}));

jest.unstable_mockModule('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}));

const restoreEnv = () => {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
};

describe('email.service', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    restoreEnv();

    process.env.NODE_ENV = 'development';
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'sender@gmail.com';
    process.env.SMTP_PASS = 'abcdefghijklmnop';
    process.env.FROM_EMAIL = 'sender@gmail.com';
    process.env.FROM_NAME = 'InterviewAI Pro';
    process.env.FRONTEND_URL = 'http://localhost:5173';

    mockVerify.mockResolvedValue(undefined);
    mockSendMail.mockResolvedValue({ messageId: 'smtp-message-1' });
  });

  afterEach(() => {
    restoreEnv();
  });

  it('logs reserved local recipients without attempting SMTP in auto mode', async () => {
    const { emailService } = await import('../email.service.js');

    const result = await emailService.sendEmail({
      to: 'gapclosure.candidate.runtime@interviewaipro.local',
      subject: 'Interview Scheduled',
      text: 'Interview Scheduled',
      html: '<p>Interview Scheduled</p>',
    });

    expect(result).toMatchObject({
      success: true,
      logged: true,
      skipped: true,
      deliveryMode: 'LOG',
    });
    expect(mockCreateTransport).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Email captured locally without SMTP'),
      expect.objectContaining({
        deliveryMode: 'LOG',
        recipientDomain: 'interviewaipro.local',
      }),
    );
  });

  it('marks SMTP auth failures as non-retryable', async () => {
    const smtpAuthError = Object.assign(
      new Error('Invalid login: 535-5.7.8 Username and Password not accepted.'),
      {
        code: 'EAUTH',
        responseCode: 535,
        command: 'AUTH PLAIN',
        response: '535-5.7.8 Username and Password not accepted.',
      },
    );
    mockVerify.mockRejectedValue(smtpAuthError);

    const { emailService } = await import('../email.service.js');

    await expect(emailService.sendEmail({
      to: 'candidate@example.com',
      subject: 'Interview Scheduled',
      text: 'Interview Scheduled',
      html: '<p>Interview Scheduled</p>',
    })).rejects.toMatchObject({
      code: 'EMAIL_SMTP_AUTH_FAILED',
      status: 503,
      retryable: false,
    });

    expect(mockCreateTransport).toHaveBeenCalledTimes(1);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('renders team invitation emails through the shared template pipeline', async () => {
    const { emailService } = await import('../email.service.js');

    const result = await emailService.sendTeamInvitation({
      to: 'invitee@example.com',
      organizationName: 'Acme Hiring',
      role: 'RECRUITER',
      inviteLink: 'https://example.com/accept/team-token',
      expiresInDays: 5,
    });

    expect(result).toEqual({ success: true, messageId: 'smtp-message-1' });
    expect(mockCreateTransport).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'invitee@example.com',
      subject: 'You\'ve been invited to join Acme Hiring',
      text: expect.stringContaining('Acme Hiring'),
      html: expect.stringContaining('Accept Invitation & Create Account'),
    }));
  });
});
