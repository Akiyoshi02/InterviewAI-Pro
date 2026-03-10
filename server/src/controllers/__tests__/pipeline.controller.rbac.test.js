import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { PipelineController } from '../pipeline.controller.js';
import {
  interviewStore,
  invitationStore,
  jobStore,
  userStore,
} from '../../services/firebaseData.service.js';

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

describe('PipelineController RBAC', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects reviewer access to the organization pipeline', async () => {
    const req = {
      user: {
        id: 'reviewer-1',
        organizationContext: {
          organization: { id: 'org-1', status: 'APPROVED' },
          membership: { role: 'REVIEWER' },
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await PipelineController.getPipeline(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'INSUFFICIENT_ORG_PERMISSIONS',
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns pipeline data for recruiter users', async () => {
    jest.spyOn(interviewStore, 'listByOrganization').mockResolvedValue([
      {
        id: 'interview-1',
        candidateId: 'candidate-1',
        jobId: 'job-1',
        invitationId: 'invite-1',
        status: 'COMPLETED',
      },
    ]);
    jest.spyOn(jobStore, 'listByOrganization').mockResolvedValue([
      { id: 'job-1', title: 'Platform Engineer' },
    ]);
    jest.spyOn(invitationStore, 'listByOrganization').mockResolvedValue([
      { id: 'invite-1', status: 'ACCEPTED' },
    ]);
    jest.spyOn(userStore, 'getSummaries').mockResolvedValue(new Map([
      ['candidate-1', { id: 'candidate-1', fullName: 'Candidate One' }],
    ]));

    const req = {
      user: {
        id: 'recruiter-1',
        organizationContext: {
          organization: { id: 'org-1', status: 'APPROVED' },
          membership: { role: 'RECRUITER' },
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await PipelineController.getPipeline(req, res, next);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      pipeline: [
        expect.objectContaining({
          interviewId: 'interview-1',
          candidate: expect.objectContaining({ id: 'candidate-1' }),
          job: expect.objectContaining({ id: 'job-1' }),
          invitation: expect.objectContaining({ id: 'invite-1' }),
        }),
      ],
    }));
    expect(next).not.toHaveBeenCalled();
  });
});
