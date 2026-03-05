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

const normalizeQuestionSnapshot = (job) => {
  const rawQuestions = Array.isArray(job?.applicationQuestions) && job.applicationQuestions.length > 0
    ? job.applicationQuestions
    : (Array.isArray(job?.customFormFields) ? job.customFormFields : []);

  return rawQuestions
    .map((rawQuestion, index) => {
      const question = rawQuestion && typeof rawQuestion === 'object'
        ? rawQuestion
        : { question: rawQuestion };
      const id = toStringOrNull(question.id) || `question_${index + 1}`;
      const prompt = toStringOrNull(question.question || question.label);
      if (!prompt) return null;
      return {
        id,
        question: prompt,
        required: Boolean(question.required),
      };
    })
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
    applicationQuestions: normalizeQuestionSnapshot(job),
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
