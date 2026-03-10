import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AuthController } from '../auth.controller.js';
import * as dataService from '../../services/firebaseData.service.js';
import { realtimeDb } from '../../config/firebase.js';

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

describe('AuthController.register invited team member profile photo flow', () => {
  beforeEach(() => {
    jest.spyOn(dataService.teamInvitationStore, 'getByToken').mockResolvedValue({
      id: 'invite-1',
      email: 'reviewer@example.com',
      organizationId: 'org-1',
      role: 'REVIEWER',
    });
    jest.spyOn(dataService.teamInvitationStore, 'isValid').mockReturnValue(true);
    jest.spyOn(dataService.teamInvitationStore, 'markAccepted').mockResolvedValue(undefined);
    jest.spyOn(dataService.organizationMemberStore, 'addMember').mockResolvedValue({
      organizationId: 'org-1',
      userId: 'firebase-user-1',
      role: 'REVIEWER',
      status: 'ACTIVE',
      permissions: [],
    });
    jest.spyOn(dataService.userStore, 'getByUid').mockResolvedValue(null);
    jest.spyOn(dataService.userStore, 'getByEmail').mockResolvedValue(null);
    jest.spyOn(realtimeDb, 'ref').mockReturnValue({
      update: jest.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores profilePhotoUrl for invited recruiter/reviewer registrations', async () => {
    jest.spyOn(dataService.userStore, 'create').mockImplementation(async (_uid, payload) => ({
      id: 'firebase-user-1',
      email: 'reviewer@example.com',
      accountType: payload.accountType,
      fullName: payload.fullName,
      jobTitle: payload.jobTitle,
      department: payload.department,
      phoneNumber: payload.phoneNumber,
      profilePhotoUrl: payload.profilePhotoUrl,
      primaryOrganizationId: payload.primaryOrganizationId,
      organizationRoles: payload.organizationRoles,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const req = {
      user: {
        uid: 'firebase-user-1',
        email: 'reviewer@example.com',
        emailVerified: false,
      },
      body: {
        accountType: 'COMPANY',
        fullName: 'Reviewer Example',
        teamInvitationToken: 'invite-token',
        jobTitle: 'Hiring Panelist',
        department: 'engineering',
        phoneNumber: '+94 771234567',
      },
      files: {
        profilePhoto: [{
          filename: 'reviewer-avatar.png',
          path: 'tmp/reviewer-avatar.png',
          size: 1024,
          originalname: 'reviewer-avatar.png',
        }],
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await AuthController.register(req, res, next);

    expect(dataService.userStore.create).toHaveBeenCalledWith('firebase-user-1', expect.objectContaining({
      accountType: 'COMPANY',
      fullName: 'Reviewer Example',
      jobTitle: 'Hiring Panelist',
      department: 'engineering',
      phoneNumber: '+94 771234567',
      primaryOrganizationId: 'org-1',
      organizationRoles: [{ organizationId: 'org-1', role: 'REVIEWER' }],
      profilePhotoUrl: '/uploads/profile-photos/reviewer-avatar.png',
    }));
    expect(dataService.teamInvitationStore.markAccepted).toHaveBeenCalledWith('invite-1', 'firebase-user-1');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      user: expect.objectContaining({
        profilePhotoUrl: '/uploads/profile-photos/reviewer-avatar.png',
      }),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects invited registrations that do not include a profile photo', async () => {
    const createSpy = jest.spyOn(dataService.userStore, 'create').mockResolvedValue(null);
    const req = {
      user: {
        uid: 'firebase-user-2',
        email: 'reviewer@example.com',
        emailVerified: false,
      },
      body: {
        accountType: 'COMPANY',
        fullName: 'Reviewer Example',
        teamInvitationToken: 'invite-token',
        jobTitle: 'Hiring Panelist',
        department: 'engineering',
      },
      files: {},
    };
    const res = createResponse();
    const next = jest.fn();

    await AuthController.register(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Profile picture is required.',
      status: 400,
    }));
    expect(createSpy).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
