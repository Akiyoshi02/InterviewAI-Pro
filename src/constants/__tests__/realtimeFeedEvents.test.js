import { describe, expect, it } from 'vitest';
import {
  INTERVIEW_FEED_EVENTS,
  combineRealtimeEventTypes,
} from '../realtimeFeedEvents.js';

describe('INTERVIEW_FEED_EVENTS', () => {
  it('includes scheduling lifecycle events used by candidate dashboard realtime refresh', () => {
    expect(INTERVIEW_FEED_EVENTS.lifecycle).toContain('interview-scheduled');
    expect(INTERVIEW_FEED_EVENTS.lifecycle).toContain('interview-rescheduled');
  });

  it('combines lifecycle events without duplicates', () => {
    const combined = combineRealtimeEventTypes(
      INTERVIEW_FEED_EVENTS.lifecycle,
      ['interview-scheduled', 'interview-created'],
    );

    expect(combined).toContain('interview-created');
    expect(combined).toContain('interview-scheduled');
    expect(combined).toContain('interview-rescheduled');
    expect(combined.filter((eventType) => eventType === 'interview-scheduled')).toHaveLength(1);
  });
});
