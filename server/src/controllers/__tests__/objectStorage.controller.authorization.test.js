import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ObjectStorageController } from '../objectStorage.controller.js';
import { interviewStore, jobStore } from '../../services/firebaseData.service.js';

describe('ObjectStorageController.validateFileOwnership', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows candidate access to their own resume path', async () => {
    const result = await ObjectStorageController.validateFileOwnership('/uploads/resumes/candidate-resume.pdf', {
      id: 'candidate-1',
      accountType: 'CANDIDATE',
      profile: {
        resumeUrl: '/uploads/resumes/candidate-resume.pdf',
      },
    });

    expect(result).toEqual({ valid: true });
  });

  it('denies candidate access to other candidate resume path', async () => {
    const result = await ObjectStorageController.validateFileOwnership('/uploads/resumes/other-resume.pdf', {
      id: 'candidate-1',
      accountType: 'CANDIDATE',
      profile: {
        resumeUrl: '/uploads/resumes/candidate-resume.pdf',
      },
    });

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/own files/i);
  });

  it('allows company access to own organization job advert media path', async () => {
    jest.spyOn(jobStore, 'listByOrganization').mockResolvedValue([
      {
        id: 'job-1',
        advertImageUrl: '/uploads/job-advert-images/org-media.png',
        advertImageUrls: ['/uploads/job-advert-images/org-media.png'],
        advertVideoUrl: null,
      },
    ]);

    const result = await ObjectStorageController.validateFileOwnership('/uploads/job-advert-images/org-media.png', {
      id: 'company-user-1',
      accountType: 'COMPANY',
      organizationContext: {
        organization: {
          id: 'org-1',
        },
      },
      profile: {},
    });

    expect(result).toEqual({ valid: true });
  });

  it('denies unknown upload categories by default', async () => {
    const result = await ObjectStorageController.validateFileOwnership('/uploads/unknown-category/file.dat', {
      id: 'candidate-1',
      accountType: 'CANDIDATE',
      profile: {},
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Unknown file category');
  });

  it('allows system admin access regardless of category ownership', async () => {
    const result = await ObjectStorageController.validateFileOwnership('/uploads/resumes/another-user.pdf', {
      id: 'admin-1',
      accountType: 'SYSTEM_ADMIN',
      profile: {},
    });

    expect(result).toEqual({ valid: true });
  });

  it('denies reviewer access to interview recordings when not assigned', async () => {
    jest.spyOn(interviewStore, 'getById').mockResolvedValue({
      id: 'interview-1',
      organizationId: 'org-1',
      candidateId: 'candidate-1',
      companyId: 'recruiter-1',
      reviewerAssignments: ['reviewer-2'],
    });

    const result = await ObjectStorageController.validateFileOwnership('/uploads/interviews/interview-1/recording.webm', {
      id: 'reviewer-1',
      accountType: 'COMPANY',
      organizationContext: {
        organization: { id: 'org-1' },
        membership: { role: 'REVIEWER' },
      },
      profile: {},
    });

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/not assigned/i);
  });

  it('allows reviewer access to assigned interview recordings', async () => {
    jest.spyOn(interviewStore, 'getById').mockResolvedValue({
      id: 'interview-1',
      organizationId: 'org-1',
      candidateId: 'candidate-1',
      companyId: 'recruiter-1',
      reviewerAssignments: ['reviewer-1'],
    });

    const result = await ObjectStorageController.validateFileOwnership('/uploads/interviews/interview-1/recording.webm', {
      id: 'reviewer-1',
      accountType: 'COMPANY',
      organizationContext: {
        organization: { id: 'org-1' },
        membership: { role: 'REVIEWER' },
      },
      profile: {},
    });

    expect(result).toEqual({ valid: true });
  });

  it('denies candidate access to another interview recording', async () => {
    jest.spyOn(interviewStore, 'getById').mockResolvedValue({
      id: 'interview-1',
      organizationId: 'org-1',
      candidateId: 'candidate-2',
      companyId: 'recruiter-1',
      reviewerAssignments: ['reviewer-1'],
    });

    const result = await ObjectStorageController.validateFileOwnership('/uploads/interviews/interview-1/recording.webm', {
      id: 'candidate-1',
      accountType: 'CANDIDATE',
      profile: {},
    });

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/own interviews/i);
  });
});
