import { organizationMemberStore } from '../services/firebaseData.service.js';

const ASSIGNABLE_REVIEWER_ROLES = new Set(['ADMIN', 'RECRUITER', 'REVIEWER']);

const normalizeId = (value) => (typeof value === 'string' ? value.trim() : '');

export const isAssignableReviewerRole = (role) => (
  ASSIGNABLE_REVIEWER_ROLES.has(String(role || '').trim().toUpperCase())
);

export const normalizeReviewerAssignments = (reviewerAssignments = []) => (
  Array.isArray(reviewerAssignments)
    ? Array.from(
      new Set(
        reviewerAssignments
          .map((reviewerId) => normalizeId(reviewerId))
          .filter(Boolean),
      ),
    )
    : []
);

export const validateReviewerAssignmentsForOrganization = async ({
  organizationId,
  reviewerAssignments,
} = {}) => {
  const normalizedAssignments = normalizeReviewerAssignments(reviewerAssignments);
  if (!normalizedAssignments.length) {
    return {
      ok: true,
      reviewerAssignments: [],
    };
  }

  if (!organizationId) {
    return {
      ok: false,
      status: 400,
      error: 'Organization context is required to assign reviewers.',
      code: 'ORGANIZATION_REQUIRED_FOR_REVIEWERS',
    };
  }

  const memberships = await organizationMemberStore.listByOrganization(organizationId);
  const eligibleMemberIds = new Set(
    memberships
      .filter((membership) => String(membership?.status || '').toUpperCase() === 'ACTIVE')
      .filter((membership) => isAssignableReviewerRole(membership?.role))
      .map((membership) => normalizeId(membership?.userId))
      .filter(Boolean),
  );

  const invalidReviewerIds = normalizedAssignments.filter(
    (reviewerId) => !eligibleMemberIds.has(reviewerId),
  );

  if (invalidReviewerIds.length > 0) {
    return {
      ok: false,
      status: 400,
      error: 'One or more assigned reviewers are not active review-capable members of this organization.',
      code: 'INVALID_REVIEWER_ASSIGNMENTS',
      details: {
        invalidReviewerIds,
      },
    };
  }

  return {
    ok: true,
    reviewerAssignments: normalizedAssignments,
  };
};
