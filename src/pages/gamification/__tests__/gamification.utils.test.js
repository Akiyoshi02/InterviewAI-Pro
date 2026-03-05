import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildStreakData, computeXP, getLevel } from '../index.jsx';

describe('gamification utilities', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('buildStreakData counts streaks from completed interview dates only', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-03T10:00:00.000Z'));

    const interviews = [
      {
        id: 'completed-today',
        status: 'COMPLETED',
        endedAt: '2026-03-03T09:15:00.000Z',
        createdAt: '2026-03-01T08:00:00.000Z',
      },
      {
        id: 'scheduled-yesterday',
        status: 'SCHEDULED',
        createdAt: '2026-03-02T08:00:00.000Z',
      },
      {
        id: 'completed-yesterday',
        status: 'COMPLETED',
        endedAt: '2026-03-02T11:00:00.000Z',
      },
    ];

    const { calDays, currentStreak } = buildStreakData(interviews);
    const today = calDays.find((day) => day.date === '2026-03-03');
    const yesterday = calDays.find((day) => day.date === '2026-03-02');

    expect(today?.hasActivity).toBe(true);
    expect(yesterday?.hasActivity).toBe(true);
    expect(currentStreak).toBe(2);
  });

  it('computeXP and getLevel derive deterministic progression from completed interviews', () => {
    const interviews = [
      { id: 'i1', status: 'COMPLETED', overallScore: 82 },
      { id: 'i2', status: 'COMPLETED', overallScore: 91 },
      { id: 'i3', status: 'SCHEDULED', overallScore: 95 },
    ];

    const xp = computeXP(interviews);
    const level = getLevel(xp);

    expect(xp).toBe(210);
    expect(level.level).toBe(2);
    expect(level.title).toBe('Practitioner');
  });
});
