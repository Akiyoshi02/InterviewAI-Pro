import { describe, expect, it } from '@jest/globals';

import { createApplicationOnboarding, sanitizeApplicationOnboarding } from '../applicationOnboarding.util.js';

describe('applicationOnboarding.util', () => {
  it('does not create immediately overdue tasks when the start date is near', () => {
    const application = {
      offer: {
        startDate: '2026-03-15T00:00:00.000Z',
      },
      organizationSnapshot: { name: 'Cynectex' },
      jobSnapshot: { title: 'ATS Multi-Stage QA Engineer' },
    };

    const onboarding = createApplicationOnboarding(application, {
      actorId: 'candidate-1',
      actorRole: 'CANDIDATE',
    });

    const createdAt = new Date(onboarding.createdAt).getTime();

    for (const task of onboarding.tasks) {
      expect(new Date(task.dueAt).getTime()).toBeGreaterThan(createdAt);
    }
  });

  it('keeps later stage tasks ordered closer to the start date when enough runway exists', () => {
    const application = {
      offer: {
        startDate: '2026-04-20T00:00:00.000Z',
      },
    };

    const onboarding = createApplicationOnboarding(application, {
      actorId: 'recruiter-1',
      actorRole: 'RECRUITER',
    });

    const confirmTask = onboarding.tasks.find((task) => task.id === 'candidate-confirm-details');
    const documentTask = onboarding.tasks.find((task) => task.id === 'candidate-share-documents');
    const policyTask = onboarding.tasks.find((task) => task.id === 'candidate-review-policies');
    const accessTask = onboarding.tasks.find((task) => task.id === 'team-prepare-access');
    const firstDayTask = onboarding.tasks.find((task) => task.id === 'team-confirm-first-day');

    expect(new Date(confirmTask.dueAt).getTime()).toBeLessThanOrEqual(new Date(documentTask.dueAt).getTime());
    expect(new Date(documentTask.dueAt).getTime()).toBeLessThanOrEqual(new Date(accessTask.dueAt).getTime());
    expect(new Date(accessTask.dueAt).getTime()).toBeLessThanOrEqual(new Date(policyTask.dueAt).getTime());
    expect(new Date(policyTask.dueAt).getTime()).toBeLessThanOrEqual(new Date(firstDayTask.dueAt).getTime());
  });

  it('repairs stale pending task due dates for existing onboarding records', () => {
    const repaired = sanitizeApplicationOnboarding({
      status: 'IN_PROGRESS',
      startDate: '2026-03-15T00:00:00.000Z',
      createdAt: '2026-03-10T09:50:51.564Z',
      tasks: [
        {
          id: 'candidate-confirm-details',
          title: 'Confirm personal details',
          owner: 'CANDIDATE',
          type: 'ACKNOWLEDGEMENT',
          status: 'PENDING',
          dueAt: '2026-03-08T00:00:00.000Z',
        },
        {
          id: 'candidate-share-documents',
          title: 'Share onboarding documents',
          owner: 'CANDIDATE',
          type: 'DOCUMENT',
          status: 'PENDING',
          dueAt: '2026-03-10T00:00:00.000Z',
        },
      ],
    });

    const confirmTask = repaired.tasks.find((task) => task.id === 'candidate-confirm-details');
    const documentTask = repaired.tasks.find((task) => task.id === 'candidate-share-documents');

    expect(confirmTask.dueAt).toBe('2026-03-11T09:50:51.564Z');
    expect(documentTask.dueAt).toBe('2026-03-11T09:50:51.564Z');
  });
});
