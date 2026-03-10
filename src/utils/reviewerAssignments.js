import { getRoleDisplayName, hasPermission } from './rolePermissions.js';

const normalizeId = (value) => (typeof value === 'string' ? value.trim() : '');

export const isAssignableReviewerMember = (member) => {
  if (!member) return false;
  const status = String(member.status || '').trim().toUpperCase();
  const role = String(member.role || '').trim().toUpperCase();
  return status === 'ACTIVE' && hasPermission(role, 'SUBMIT_REVIEWS');
};

export const buildReviewerAssignmentOptions = (members = []) => (
  (Array.isArray(members) ? members : [])
    .filter(isAssignableReviewerMember)
    .map((member) => {
      const fullName = member?.user?.fullName || member?.user?.email || member?.userId || 'Team member';
      const email = member?.user?.email || '';
      const roleLabel = getRoleDisplayName(member.role);
      return {
        value: normalizeId(member.userId),
        label: fullName,
        description: `${roleLabel}${email ? ` - ${email}` : ''}`,
        roleLabel,
        email,
        role: String(member.role || '').trim().toUpperCase(),
      };
    })
    .filter((option) => option.value)
    .sort((left, right) => left.label.localeCompare(right.label))
);

export const summarizeReviewerAssignees = (reviewerAssignees = []) => {
  const names = (Array.isArray(reviewerAssignees) ? reviewerAssignees : [])
    .map((reviewer) => reviewer?.fullName || reviewer?.email || '')
    .filter(Boolean);

  if (names.length === 0) return 'No reviewers assigned yet';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]}, +${names.length - 2} more`;
};

