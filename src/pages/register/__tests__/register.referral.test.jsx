import { describe, expect, it } from 'vitest';
import {
  getReferralCodeFromSearchParams,
  withRegistrationReferralCode,
} from '../index.jsx';

describe('Register referral propagation helpers', () => {
  it('extracts and trims referral code from search params', () => {
    const params = new URLSearchParams('ref=  REFABC123  ');
    expect(getReferralCodeFromSearchParams(params)).toBe('REFABC123');
  });

  it('returns empty referral code when ref param is absent', () => {
    const params = new URLSearchParams('redirect=%2Fcandidate-dashboard');
    expect(getReferralCodeFromSearchParams(params)).toBe('');
  });

  it('injects refCode into registration payload when referral exists', () => {
    const payload = {
      accountType: 'CANDIDATE',
      email: 'candidate@example.com',
    };

    const next = withRegistrationReferralCode(payload, 'REF-BETA-001');

    expect(next).toEqual(expect.objectContaining({
      accountType: 'CANDIDATE',
      email: 'candidate@example.com',
      refCode: 'REF-BETA-001',
    }));
  });

  it('keeps payload unchanged when referral code is empty', () => {
    const payload = {
      accountType: 'CANDIDATE',
      email: 'candidate@example.com',
    };

    expect(withRegistrationReferralCode(payload, '   ')).toEqual(payload);
  });
});
