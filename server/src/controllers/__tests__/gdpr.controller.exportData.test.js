import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { GDPRController } from '../gdpr.controller.js';
import { firestore as db } from '../../config/firebase.js';

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.setHeader = jest.fn();
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

const makeQuerySnapshot = (rows = []) => ({
  empty: rows.length === 0,
  docs: rows.map((row) => ({
    id: row.id,
    data: () => ({ ...row }),
  })),
});

describe('GDPRController.exportData', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exports interviews/applications from current collections with legacy fallback', async () => {
    const usersDocGet = jest.fn().mockResolvedValue({
      exists: true,
      id: 'candidate-1',
      data: () => ({
        id: 'candidate-1',
        email: 'candidate@example.com',
        passwordHash: 'secret',
        refreshToken: 'secret-refresh',
      }),
    });

    const interviewCandidateSnap = makeQuerySnapshot([
      { id: 'interview-1', candidateId: 'candidate-1', status: 'COMPLETED' },
    ]);
    const interviewCompanySnap = makeQuerySnapshot([]);
    const interviewLegacySnap = makeQuerySnapshot([
      { id: 'interview-1', candidateId: 'candidate-1', status: 'COMPLETED' },
      { id: 'interview-2', userId: 'candidate-1', status: 'COMPLETED' },
    ]);

    const jobApplicationsSnap = makeQuerySnapshot([
      { id: 'application-1', candidateId: 'candidate-1', jobId: 'job-1' },
    ]);
    const legacyApplicationsSnap = makeQuerySnapshot([
      { id: 'application-legacy-1', candidateId: 'candidate-1', jobId: 'legacy-job-1' },
    ]);

    const notificationsSnap = makeQuerySnapshot([
      { id: 'notification-1', userId: 'candidate-1', title: 'Hi' },
    ]);
    const consentsSnap = makeQuerySnapshot([]);

    const auditAdd = jest.fn().mockResolvedValue({ id: 'audit-1' });

    const collectionSpy = jest.spyOn(db, 'collection').mockImplementation((name) => {
      if (name === 'users') {
        return {
          doc: jest.fn(() => ({ get: usersDocGet })),
        };
      }

      if (name === 'interviews') {
        return {
          where: jest.fn((field) => {
            if (field === 'candidateId') {
              return { get: jest.fn().mockResolvedValue(interviewCandidateSnap) };
            }
            if (field === 'companyId') {
              return { get: jest.fn().mockResolvedValue(interviewCompanySnap) };
            }
            if (field === 'userId') {
              return { get: jest.fn().mockResolvedValue(interviewLegacySnap) };
            }
            return { get: jest.fn().mockResolvedValue(makeQuerySnapshot([])) };
          }),
        };
      }

      if (name === 'jobApplications') {
        return {
          where: jest.fn(() => ({ get: jest.fn().mockResolvedValue(jobApplicationsSnap) })),
        };
      }

      if (name === 'applications') {
        return {
          where: jest.fn(() => ({ get: jest.fn().mockResolvedValue(legacyApplicationsSnap) })),
        };
      }

      if (name === 'notifications') {
        return {
          where: jest.fn(() => ({ get: jest.fn().mockResolvedValue(notificationsSnap) })),
        };
      }

      if (name === 'gdpr_consents') {
        return {
          where: jest.fn(() => ({ get: jest.fn().mockResolvedValue(consentsSnap) })),
        };
      }

      if (name === 'gdpr_audit_log') {
        return {
          add: auditAdd,
        };
      }

      return {
        where: jest.fn(() => ({ get: jest.fn().mockResolvedValue(makeQuerySnapshot([])) })),
        doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ exists: false }) })),
        add: jest.fn().mockResolvedValue({ id: 'noop' }),
      };
    });

    const req = {
      user: {
        id: 'candidate-1',
        email: 'candidate@example.com',
        accountType: 'CANDIDATE',
      },
      ip: '127.0.0.1',
    };
    const res = createResponse();
    const next = jest.fn();

    await GDPRController.exportData(req, res, next);

    const payload = res.json.mock.calls[0][0].data;

    expect(payload.profile.passwordHash).toBeUndefined();
    expect(payload.profile.refreshToken).toBeUndefined();
    expect(payload.interviews).toHaveLength(2);
    expect(payload.applications).toHaveLength(2);
    expect(payload.applications.some((item) => item.id === 'application-1')).toBe(true);
    expect(payload.applications.some((item) => item.id === 'application-legacy-1')).toBe(true);
    expect(payload.companyApplications).toEqual([]);

    expect(collectionSpy).toHaveBeenCalledWith('jobApplications');
    expect(next).not.toHaveBeenCalled();
  });
});
