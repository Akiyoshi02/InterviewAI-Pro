const SPECIAL_CHAR_REGEX = /[!@#$%^&*(),.?":{}|<>]/;

export const PASSWORD_REQUIREMENTS = [
  { key: 'length', label: 'At least 8 characters', test: (pwd = '') => (pwd || '').length >= 8 },
  { key: 'lowercase', label: 'Lowercase letter', test: (pwd = '') => /[a-z]/.test(pwd || '') },
  { key: 'uppercase', label: 'Uppercase letter', test: (pwd = '') => /[A-Z]/.test(pwd || '') },
  { key: 'number', label: 'Number', test: (pwd = '') => /\d/.test(pwd || '') },
  { key: 'special', label: 'Special character', test: (pwd = '') => SPECIAL_CHAR_REGEX.test(pwd || '') },
];

export const getPasswordChecks = (password = '') => {
  const safePassword = password || '';
  return PASSWORD_REQUIREMENTS.reduce((acc, requirement) => {
    acc[requirement.key] = requirement.test(safePassword);
    return acc;
  }, {});
};

export const passwordMeetsAllRequirements = (password = '') =>
  PASSWORD_REQUIREMENTS.every((requirement) => requirement.test(password || ''));

export const getMissingPasswordRequirementLabels = (password = '') =>
  PASSWORD_REQUIREMENTS
    .filter((requirement) => !requirement.test(password || ''))
    .map((requirement) => requirement.label);

export const PASSWORD_REQUIREMENT_MESSAGE = 'Meet all password requirements.';


