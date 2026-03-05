import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { AuthController } from '../auth.controller.js';
import { userStore } from '../../services/firebaseData.service.js';

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

describe('AuthController.updateMe account-type field controls', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects candidate attempts to update company-only fields', async () => {
    const req = {
      user: {
        uid: 'candidate-1',
        profile: {
          id: 'candidate-1',
          accountType: 'CANDIDATE',
        },
      },
      body: {
        companyName: 'Should Not Be Allowed',
      },
    };
    const res = createResponse();
    const next = jest.fn();
    const updateSpy = jest.spyOn(userStore, 'update');

    await AuthController.updateMe(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'PROFILE_FIELDS_NOT_ALLOWED',
      disallowedFields: ['companyName'],
    }));
    expect(updateSpy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects company attempts to update candidate-only fields', async () => {
    const req = {
      user: {
        uid: 'company-1',
        profile: {
          id: 'company-1',
          accountType: 'COMPANY',
        },
      },
      body: {
        targetRole: 'backend-engineer',
      },
    };
    const res = createResponse();
    const next = jest.fn();
    const updateSpy = jest.spyOn(userStore, 'update');

    await AuthController.updateMe(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'PROFILE_FIELDS_NOT_ALLOWED',
      disallowedFields: ['targetRole'],
    }));
    expect(updateSpy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('allows candidate updates for candidate fields and normalizes skills input', async () => {
    const req = {
      user: {
        uid: 'candidate-2',
        profile: {
          id: 'candidate-2',
          accountType: 'CANDIDATE',
          primaryOrganizationId: null,
        },
      },
      body: {
        fullName: 'Candidate Two',
        skills: 'node, react , testing',
      },
    };
    const res = createResponse();
    const next = jest.fn();

    const updatedUser = {
      id: 'candidate-2',
      accountType: 'CANDIDATE',
      fullName: 'Candidate Two',
      skills: ['node', 'react', 'testing'],
      primaryOrganizationId: null,
    };

    const updateSpy = jest.spyOn(userStore, 'update').mockResolvedValue(updatedUser);

    await AuthController.updateMe(req, res, next);

    expect(updateSpy).toHaveBeenCalledWith('candidate-2', expect.objectContaining({
      fullName: 'Candidate Two',
      skills: ['node', 'react', 'testing'],
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      user: expect.objectContaining({
        id: 'candidate-2',
        accountType: 'CANDIDATE',
      }),
    }));
    expect(next).not.toHaveBeenCalled();
  });
});
