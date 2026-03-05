import { describe, expect, it, jest } from '@jest/globals';
import { requireCandidate } from '../auth.middleware.js';
import { requireSystemAdmin } from '../admin.middleware.js';

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

describe('RBAC middleware guards', () => {
  it('allows candidate through requireCandidate', () => {
    const req = {
      user: {
        accountType: 'CANDIDATE',
      },
    };
    const res = createResponse();
    const next = jest.fn();

    requireCandidate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks non-candidate from requireCandidate', () => {
    const req = {
      user: {
        accountType: 'COMPANY',
      },
    };
    const res = createResponse();
    const next = jest.fn();

    requireCandidate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Candidate access required' });
  });

  it('blocks non-system-admin from requireSystemAdmin', () => {
    const req = {
      user: {
        id: 'candidate-1',
        accountType: 'CANDIDATE',
      },
    };
    const res = createResponse();
    const next = jest.fn();

    requireSystemAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'System administrator access required' });
  });

  it('allows system admin through requireSystemAdmin', () => {
    const req = {
      user: {
        id: 'admin-1',
        accountType: 'SYSTEM_ADMIN',
      },
    };
    const res = createResponse();
    const next = jest.fn();

    requireSystemAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
