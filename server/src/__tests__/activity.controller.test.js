import { describe, it, expect } from 'vitest';
import { sanitizeActivity } from '../controllers/activity.controller.js';

describe('sanitizeActivity', () => {
  it('returns structured activity with actor summary when provided', () => {
    const entry = {
      id: 'log123',
      organizationId: 'org1',
      actorId: 'user1',
      actorRole: 'ADMIN',
      action: 'JOB_CREATED',
      targetType: 'JOB',
      targetId: 'job1',
      metadata: { title: 'Senior Dev' },
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    const actor = {
      id: 'user1',
      email: 'demo@example.com',
      fullName: 'Demo User',
    };

    const sanitized = sanitizeActivity(entry, actor);
    expect(sanitized).toMatchObject({
      id: 'log123',
      action: 'JOB_CREATED',
      metadata: { title: 'Senior Dev' },
      actor: {
        id: 'user1',
        email: 'demo@example.com',
        fullName: 'Demo User',
      },
    });
  });

  it('handles missing actor summary gracefully', () => {
    const sanitized = sanitizeActivity(
      {
        id: 'log456',
        organizationId: 'org1',
        actorId: null,
        actorRole: null,
        action: 'PIPELINE_MOVED',
        targetType: 'INTERVIEW',
        targetId: 'int1',
        metadata: {},
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      null,
    );

    expect(sanitized.actor).toBeNull();
    expect(sanitized.action).toBe('PIPELINE_MOVED');
  });
});

