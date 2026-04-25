import { describe, expect, it } from 'vitest';
import {
  deriveAchievementBadges,
  deriveDashboardInsights,
  deriveRecommendedTopics,
} from '../candidateInsights.js';

const futureIso = (daysAhead) => new Date(Date.now() + (daysAhead * 24 * 60 * 60 * 1000)).toISOString();
const pastIso = (daysAgo) => new Date(Date.now() - (daysAgo * 24 * 60 * 60 * 1000)).toISOString();

describe('candidateInsights', () => {
  it('derives achievement badges from live interview and application metrics', () => {
    const badges = deriveAchievementBadges({
      interviews: [
        { id: 'i1', status: 'COMPLETED', overallScore: 92, createdAt: '2026-02-01T10:00:00.000Z' },
        { id: 'i2', status: 'COMPLETED', overallScore: 74, createdAt: '2026-02-05T10:00:00.000Z' },
        { id: 'i3', status: 'SCHEDULED', createdAt: '2026-02-09T10:00:00.000Z' },
      ],
      dashboardMetrics: {
        completedInterviews: { value: 2 },
        scheduledInterviews: { value: 1 },
        inProgressInterviews: 0,
        totalInterviews: 3,
        averageScore: { value: 83 },
      },
      applications: [
        { id: 'a1', status: 'SUBMITTED', createdAt: '2026-02-02T10:00:00.000Z' },
        { id: 'a2', status: 'SHORTLISTED', createdAt: '2026-02-06T10:00:00.000Z' },
      ],
    });

    const byId = new Map(badges.map((badge) => [badge.id, badge]));
    expect(byId.get('first-steps')?.earned).toBe(true);
    expect(byId.get('high-scorer')?.earned).toBe(true);
    expect(byId.get('consistency-champion')?.earned).toBe(false);
    expect(byId.get('consistency-champion')?.progress).toBe(2);
    expect(byId.get('application-explorer')?.earned).toBe(true);
    expect(byId.get('shortlist-momentum')?.progress).toBe(1);
  });

  it('derives role-aware recommendations with practice defaults', () => {
    const recommendations = deriveRecommendedTopics({
      interviews: [
        { id: 'i1', status: 'COMPLETED', jobRole: 'Backend Engineer', overallScore: 62, createdAt: '2026-02-01T10:00:00.000Z' },
        { id: 'i2', status: 'SCHEDULED', jobRole: 'Backend Engineer', createdAt: '2026-02-08T10:00:00.000Z' },
      ],
      dashboardMetrics: {
        completedInterviews: { value: 1 },
        scheduledInterviews: { value: 1 },
        averageScore: { value: 62 },
      },
      applications: [{ id: 'a1', status: 'SUBMITTED', createdAt: '2026-02-04T10:00:00.000Z' }],
    });

    expect(recommendations.length).toBeGreaterThanOrEqual(4);
    const roleTopic = recommendations.find((topic) => topic.id === 'role-foundations');
    expect(roleTopic?.title).toContain('Backend Engineer');
    expect(roleTopic?.practiceRole).toBe('backend-developer');
    expect(roleTopic?.practiceDifficulty).toBe('intermediate');
    expect(recommendations[0]?.priority).toBe('high');
  });

  it('falls back to default role and beginner planning when there is no history', () => {
    const recommendations = deriveRecommendedTopics({});
    expect(recommendations.length).toBeGreaterThanOrEqual(4);
    expect(recommendations.every((topic) => topic.practiceRole)).toBe(true);
    expect(recommendations[0]?.practiceRole).toBe('software-engineer');
  });

  it('derives dashboard insight feed from live metrics and pipeline data', () => {
    const insights = deriveDashboardInsights({
      interviews: [
        { id: 'i1', status: 'COMPLETED', overallScore: 88, createdAt: '2026-02-01T10:00:00.000Z' },
        { id: 'i2', status: 'SCHEDULED', scheduledFor: futureIso(7), createdAt: '2026-02-10T10:00:00.000Z' },
      ],
      dashboardMetrics: {
        averageScore: { value: 88 },
        completedInterviews: { value: 1 },
        scheduledInterviews: { value: 1 },
        inProgressInterviews: 0,
      },
      applications: [{ id: 'a1', status: 'SHORTLISTED', createdAt: '2026-02-08T10:00:00.000Z' }],
    });

    expect(insights).toHaveLength(3);
    expect(insights[0]?.title).toContain('Average interview score 88%');
    expect(insights[1]?.title).toContain('active interview');
    expect(insights[2]?.title).toContain('strong-signal');
  });

  it('does not treat an expired scheduled interview as the next active pipeline item', () => {
    const insights = deriveDashboardInsights({
      interviews: [
        { id: 'expired', status: 'SCHEDULED', scheduledFor: pastIso(7), duration: 30 },
      ],
      dashboardMetrics: {
        averageScore: { value: 88 },
        completedInterviews: { value: 1 },
        scheduledInterviews: { value: 1 },
        inProgressInterviews: 0,
      },
      applications: [{ id: 'a1', status: 'SCREENING', createdAt: '2026-03-08T10:00:00.000Z' }],
    });

    expect(insights[1]?.title).toContain('active application');
    expect(insights[1]?.detail).toContain('Keep practicing while waiting for recruiter responses.');
  });

  it('treats unscheduled interview workflows as active without pretending they are upcoming interviews', () => {
    const insights = deriveDashboardInsights({
      interviews: [
        { id: 'pending-1', status: 'SCHEDULED', createdAt: '2026-03-10T10:00:00.000Z' },
        { id: 'pending-2', status: 'SCHEDULED', createdAt: '2026-03-10T12:00:00.000Z' },
      ],
      applications: [{ id: 'a1', status: 'INTERVIEWING', createdAt: '2026-03-10T10:00:00.000Z' }],
    });

    expect(insights[1]?.title).toContain('active interview workflow');
    expect(insights[1]?.detail).toContain('waiting for scheduling details');
  });

  it('avoids misleading 0% score insight when there are no completed interviews', () => {
    const insights = deriveDashboardInsights({
      dashboardMetrics: {
        averageScore: { value: 0 },
        completedInterviews: { value: 0 },
      },
    });

    expect(insights[0]?.title).toBe('No scored interviews yet');
  });

  it('prefers backend-provided dashboard insights when available', () => {
    const insights = deriveDashboardInsights({
      dashboardMetrics: {
        insights: [
          { id: 'server-score', color: 'green', title: 'Server score insight', detail: 'From analytics service' },
          { id: 'server-pipeline', color: 'amber', title: 'Server pipeline insight', detail: 'From analytics service' },
        ],
      },
    });

    expect(insights).toHaveLength(2);
    expect(insights[0]).toMatchObject({
      id: 'server-score',
      color: 'green',
      title: 'Server score insight',
      detail: 'From analytics service',
    });
  });
});
