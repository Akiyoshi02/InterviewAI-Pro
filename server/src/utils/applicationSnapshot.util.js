const toStringOrNull = (value) => {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const toStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => toStringOrNull(item))
    .filter(Boolean);
};

export const buildJobSnapshot = (job) => {
  if (!job || typeof job !== 'object') return null;
  return {
    id: toStringOrNull(job.id),
    title: toStringOrNull(job.title),
    department: toStringOrNull(job.department),
    location: toStringOrNull(job.location),
    employmentType: toStringOrNull(job.employmentType),
    experienceLevel: toStringOrNull(job.experienceLevel),
    skills: toStringArray(job.skills),
    capturedAt: new Date().toISOString(),
  };
};

export const buildOrganizationSnapshot = (organization, fallbackOrganizationId = null) => {
  if (!organization && !fallbackOrganizationId) return null;
  return {
    id: toStringOrNull(organization?.id || fallbackOrganizationId),
    name: toStringOrNull(organization?.name || organization?.displayName),
    logo: toStringOrNull(organization?.logo),
    website: toStringOrNull(organization?.website),
    capturedAt: new Date().toISOString(),
  };
};
