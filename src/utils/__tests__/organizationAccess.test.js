import { describe, it, expect } from 'vitest';
import {
  buildPendingApprovalRoute,
  getAccountType,
  getOrganizationId,
  getOrganizationRejectionReason,
  getOrganizationSuspensionReason,
  getOrganizationStatus,
  isCompanyUser,
  isPendingCompanyUser,
  isRejectedCompanyUser,
  isRestrictedCompanyUser,
  isSuspendedCompanyUser,
} from '../organizationAccess.js';

describe('organizationAccess helpers', () => {
  it('normalizes account type from accountType or account_type', () => {
    expect(getAccountType({ accountType: 'company' })).toBe('COMPANY');
    expect(getAccountType({ account_type: 'candidate' })).toBe('CANDIDATE');
    expect(getAccountType({})).toBe('');
  });

  it('detects company and organization status correctly', () => {
    const user = {
      accountType: 'company',
      organizationContext: {
        organization: {
          id: 'org_123',
          status: 'pending',
        },
      },
    };

    expect(isCompanyUser(user)).toBe(true);
    expect(getOrganizationId(user)).toBe('org_123');
    expect(getOrganizationStatus(user)).toBe('PENDING');
    expect(isPendingCompanyUser(user)).toBe(true);
    expect(isRejectedCompanyUser(user)).toBe(false);
  });

  it('builds pending approval route with org id when available', () => {
    const user = {
      accountType: 'COMPANY',
      organizationContext: {
        organization: {
          id: 'org_abc',
          status: 'PENDING',
        },
      },
    };

    expect(buildPendingApprovalRoute(user)).toBe('/register?pendingApproval=true&orgId=org_abc');
  });

  it('builds pending approval route without org id when unavailable', () => {
    const user = {
      accountType: 'COMPANY',
      organizationContext: {
        organization: {
          status: 'PENDING',
        },
      },
    };

    expect(buildPendingApprovalRoute(user)).toBe('/register?pendingApproval=true');
  });

  it('returns rejection reason and rejected status for rejected company users', () => {
    const user = {
      accountType: 'company',
      organizationContext: {
        organization: {
          id: 'org_rejected_1',
          status: 'REJECTED',
          rejectedReason: 'Business registration number did not match uploaded document.',
        },
      },
    };

    expect(getOrganizationStatus(user)).toBe('REJECTED');
    expect(isRejectedCompanyUser(user)).toBe(true);
    expect(isRestrictedCompanyUser(user)).toBe(true);
    expect(getOrganizationRejectionReason(user)).toBe(
      'Business registration number did not match uploaded document.',
    );
  });

  it('detects suspended company users as restricted', () => {
    const user = {
      accountType: 'company',
      organizationContext: {
        organization: {
          id: 'org_suspended_1',
          status: 'SUSPENDED',
          suspensionReason: 'Repeated policy violations.',
        },
      },
    };

    expect(getOrganizationStatus(user)).toBe('SUSPENDED');
    expect(getOrganizationSuspensionReason(user)).toBe('Repeated policy violations.');
    expect(isSuspendedCompanyUser(user)).toBe(true);
    expect(isRestrictedCompanyUser(user)).toBe(true);
  });
});
