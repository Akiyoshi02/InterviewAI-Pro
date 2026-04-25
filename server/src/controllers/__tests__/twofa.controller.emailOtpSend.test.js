import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockUser2faSet = jest.fn();
const mockUser2faDoc = jest.fn(() => ({
  set: mockUser2faSet,
}));
const mockFirestore = {
  collection: jest.fn(() => ({
    doc: mockUser2faDoc,
  })),
};

const mockSendTwoFactorVerificationCode = jest.fn();
const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

jest.unstable_mockModule('../../config/firebase.js', () => ({
  firestore: mockFirestore,
}));

jest.unstable_mockModule('../../services/email.service.js', () => ({
  emailService: {
    sendTwoFactorVerificationCode: mockSendTwoFactorVerificationCode,
  },
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: mockLogger,
}));

const { TwoFAController } = await import('../twofa.controller.js');

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

describe('TwoFAController.emailOtpSend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-01T12:00:00.000Z'));
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    mockUser2faSet.mockResolvedValue(undefined);
    mockSendTwoFactorVerificationCode.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('sends the OTP through the shared branded email helper', async () => {
    const req = {
      user: {
        id: 'user-1',
        email: 'candidate@example.com',
        fullName: 'Candidate One',
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await TwoFAController.emailOtpSend(req, res, next);

    expect(mockFirestore.collection).toHaveBeenCalledWith('user_2fa');
    expect(mockUser2faDoc).toHaveBeenCalledWith('user-1');
    expect(mockUser2faSet).toHaveBeenCalledWith({
      emailOtp: '550000',
      emailOtpExpiresAt: '2026-04-01T12:10:00.000Z',
      emailOtpAttempts: 0,
      updatedAt: '2026-04-01T12:00:00.000Z',
    }, { merge: true });
    expect(mockSendTwoFactorVerificationCode).toHaveBeenCalledWith({
      email: 'candidate@example.com',
      fullName: 'Candidate One',
      verificationCode: '550000',
      expiresInMinutes: 10,
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Verification code sent to candidate@example.com',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
