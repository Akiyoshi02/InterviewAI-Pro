const candidateFieldLabels = {
  targetRole: {
    'software-engineer': 'Software Engineer',
    'frontend-developer': 'Frontend Engineer',
    'backend-developer': 'Backend Engineer',
    'fullstack-developer': 'Full Stack Engineer',
    'devops-engineer': 'DevOps Engineer',
    'qa-engineer': 'QA Engineer',
  },
  industry: {
    'technology': 'Technology & Software',
  },
};

const toTitleCase = (value) => {
  const normalized = value.replace(/[_-]+/g, ' ').trim();
  if (!normalized) return '';
  return normalized
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      return lower ? `${lower[0].toUpperCase()}${lower.slice(1)}` : '';
    })
    .join(' ');
};

export const formatCandidateFieldValue = (field, value) => {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  const fieldLabels = candidateFieldLabels[field] || {};
  const mapped = fieldLabels[trimmed.toLowerCase()];
  if (mapped) return mapped;

  const isAllLower = trimmed === trimmed.toLowerCase();
  const hasDelimiters = /[-_]/.test(trimmed);

  return isAllLower || hasDelimiters ? toTitleCase(trimmed) : trimmed;
};
