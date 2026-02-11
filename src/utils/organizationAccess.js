const normalizeText = (value) => (value || '').toString().trim().toUpperCase();

export const getAccountType = (user) =>
  normalizeText(user?.accountType || user?.account_type);

export const isCompanyUser = (user) => getAccountType(user) === 'COMPANY';

export const getOrganizationStatus = (user) =>
  normalizeText(
    user?.organizationContext?.organization?.status
      || user?.organizationStatus
      || user?.organization_state,
  );

export const getOrganizationId = (user) =>
  user?.organizationContext?.organization?.id
  || user?.primaryOrganizationId
  || user?.organizationId
  || null;

export const getOrganizationRejectionReason = (user) =>
  user?.organizationContext?.organization?.rejectedReason
  || user?.organizationRejectionReason
  || null;

export const getOrganizationSuspensionReason = (user) =>
  user?.organizationContext?.organization?.suspensionReason
  || user?.organizationSuspensionReason
  || null;

export const isPendingCompanyUser = (user) =>
  isCompanyUser(user) && getOrganizationStatus(user) === 'PENDING';

export const isRejectedCompanyUser = (user) =>
  isCompanyUser(user) && getOrganizationStatus(user) === 'REJECTED';

export const isSuspendedCompanyUser = (user) =>
  isCompanyUser(user) && getOrganizationStatus(user) === 'SUSPENDED';

export const isRestrictedCompanyUser = (user) =>
  isPendingCompanyUser(user) || isRejectedCompanyUser(user) || isSuspendedCompanyUser(user);

export const buildPendingApprovalRoute = (user) => {
  const params = new URLSearchParams({ pendingApproval: 'true' });
  const organizationId = getOrganizationId(user);

  if (organizationId) {
    params.set('orgId', organizationId);
  }

  return `/register?${params.toString()}`;
};
