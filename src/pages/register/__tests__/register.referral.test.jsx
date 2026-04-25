import { describe, expect, it } from 'vitest';
import {
  getAccountTypeFromSearchParams,
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

  it('extracts candidate account type from search params', () => {
    const params = new URLSearchParams('accountType=candidate');
    expect(getAccountTypeFromSearchParams(params)).toBe('candidate');
  });

  it('extracts company account type aliases from search params', () => {
    const params = new URLSearchParams('accountType=employer');
    expect(getAccountTypeFromSearchParams(params)).toBe('company');
  });

  it('returns empty account type when search params are unsupported', () => {
    const params = new URLSearchParams('accountType=admin');
    expect(getAccountTypeFromSearchParams(params)).toBe('');
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
