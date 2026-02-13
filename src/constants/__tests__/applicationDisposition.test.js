import { describe, expect, it } from 'vitest';
import {
  getDispositionLabel,
  isJobClosedDisposition,
} from '../applicationDisposition.js';

describe('applicationDisposition constants', () => {
  it('returns friendly label for known disposition codes', () => {
    expect(getDispositionLabel('JOB_CLOSED')).toBe('Position Closed');
    expect(getDispositionLabel('candidate_withdrew')).toBe('Candidate Withdrew');
  });

  it('returns formatted fallback label for unknown codes', () => {
    expect(getDispositionLabel('CUSTOM_REASON')).toBe('CUSTOM REASON');
  });

  it('detects job closure disposition states', () => {
    expect(isJobClosedDisposition({ dispositionCode: 'JOB_CLOSED' })).toBe(true);
    expect(isJobClosedDisposition({ job: { isDeleted: true } })).toBe(true);
    expect(isJobClosedDisposition({ dispositionCode: 'NOT_SELECTED' })).toBe(false);
  });
});

