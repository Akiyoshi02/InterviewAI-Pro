const normalizeText = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');

const normalizeKey = (value) => normalizeText(value).toLowerCase();

const sanitizeReadableText = (value, maxLength = 120) => {
  const cleaned = normalizeText(value);
  if (!cleaned || cleaned.length > maxLength) return '';
  if (!/[a-zA-Z]/.test(cleaned)) return '';
  if (/https?:\/\/|www\.|@/.test(cleaned)) return '';
  return cleaned;
};

const KNOWN_FIELD_OF_STUDY = [
  'Computer Science',
  'Software Engineering',
  'Information Technology',
  'Information Systems',
  'Data Science',
  'Artificial Intelligence',
  'Cyber Security',
  'Computer Engineering',
  'Electrical Engineering',
  'Electronics Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Industrial Engineering',
  'Business Administration',
  'Management',
  'Marketing',
  'Finance',
  'Accounting',
  'Economics',
  'Statistics',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Biotechnology',
  'Psychology',
  'Human Resources',
  'Project Management',
  'Graphic Design',
  'UX/UI Design',
  'Communication',
  'English',
  'Education',
  'Agriculture',
  'Medicine',
  'Nursing',
  'Public Health',
  'Hospitality',
  'Tourism',
];

const KNOWN_INSTITUTIONS = [
  'University of Colombo',
  'University of Moratuwa',
  'University of Sri Jayewardenepura',
  'University of Kelaniya',
  'University of Peradeniya',
  'University of Ruhuna',
  'University of Jaffna',
  'Eastern University, Sri Lanka',
  'Rajarata University of Sri Lanka',
  'Sabaragamuwa University of Sri Lanka',
  'Wayamba University of Sri Lanka',
  'Uva Wellassa University',
  'Open University of Sri Lanka',
  'Sri Lanka Institute of Information Technology (SLIIT)',
  'Informatics Institute of Technology (IIT)',
  'National School of Business Management (NSBM)',
  'Sri Lanka Institute of Advanced Technological Education (SLIATE)',
  'National Institute of Business Management (NIBM)',
  'Academy of Design (AOD)',
  'APIIT Sri Lanka',
  'CINEC Campus',
  'University of the Visual and Performing Arts',
];

const parseYears = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const inferExperienceLevelFromYears = (years) => {
  if (typeof years !== 'number' || !Number.isFinite(years)) return '';
  if (years <= 2) return 'entry';
  if (years <= 5) return 'mid';
  if (years <= 10) return 'senior';
  if (years <= 15) return 'lead';
  return 'executive';
};

const normalizeExperienceLevel = (value) => {
  const normalized = normalizeKey(value);
  if (!normalized) return '';
  if (['entry', 'junior', 'intern', 'graduate', 'fresher'].some((token) => normalized.includes(token))) return 'entry';
  if (normalized.includes('mid')) return 'mid';
  if (['senior', 'sr'].some((token) => normalized.includes(token))) return 'senior';
  if (['lead', 'principal', 'staff'].some((token) => normalized.includes(token))) return 'lead';
  if (['executive', 'director', 'head', 'c-level', 'vp'].some((token) => normalized.includes(token))) return 'executive';
  return '';
};

const normalizeTargetRole = (value) => {
  const normalized = normalizeKey(value);
  if (!normalized) return '';

  const roleMap = [
    ['software engineer', 'software-engineer'],
    ['frontend engineer', 'frontend-developer'],
    ['frontend developer', 'frontend-developer'],
    ['backend engineer', 'backend-developer'],
    ['backend developer', 'backend-developer'],
    ['full stack engineer', 'fullstack-developer'],
    ['full-stack engineer', 'fullstack-developer'],
    ['full stack developer', 'fullstack-developer'],
    ['full-stack developer', 'fullstack-developer'],
    ['devops engineer', 'devops-engineer'],
    ['qa engineer', 'qa-engineer'],
    ['quality assurance engineer', 'qa-engineer'],
  ];

  const matched = roleMap.find(([label]) => normalized.includes(label));
  return matched ? matched[1] : '';
};

const normalizeIndustry = (value) => {
  const normalized = normalizeKey(value);
  if (!normalized) return '';
  if (
    normalized.includes('technology')
    || normalized.includes('software')
    || normalized.includes('information technology')
    || normalized === 'it'
  ) {
    return 'technology';
  }
  return '';
};

const normalizeQualification = (value) => {
  const normalized = normalizeKey(value);
  if (!normalized) return '';
  if (normalized.includes('phd') || normalized.includes('doctor')) return 'phd';
  if (normalized.includes('master')) return 'masters';
  if (normalized.includes('bachelor')) return 'bachelors';
  if (normalized.includes('hnd') || normalized.includes('higher national diploma')) return 'hnd';
  if (normalized.includes('diploma') || normalized.includes('certificate')) return 'diploma';
  if (normalized.includes('advanced level') || normalized.includes('a/l')) return 'al';
  if (normalized.includes('ordinary level') || normalized.includes('o/l')) return 'ol';
  return '';
};

const matchKnownValue = (value, knownValues = []) => {
  const normalized = normalizeKey(value);
  if (!normalized) return '';

  const exact = knownValues.find((item) => normalizeKey(item) === normalized);
  if (exact) return exact;

  const contains = knownValues.find((item) => {
    const itemKey = normalizeKey(item);
    return normalized.includes(itemKey) || itemKey.includes(normalized);
  });
  return contains || '';
};

const normalizeFieldOfStudy = (value) => {
  const exact = matchKnownValue(value, KNOWN_FIELD_OF_STUDY);
  if (exact) return exact;
  const inferred = inferFieldOfStudy(value);
  if (inferred) return inferred;

  const readable = sanitizeReadableText(value, 80);
  if (!readable) return '';
  if (/\b(19|20)\d{2}\b/.test(readable)) return '';
  if (/(university|institute|college|school|campus|academy)/i.test(readable)) return '';
  if (readable.split(/\s+/).length > 8) return '';
  return readable;
};

const normalizeInstitutionName = (value) => {
  const exact = matchKnownValue(value, KNOWN_INSTITUTIONS);
  if (exact) return exact;

  const readable = sanitizeReadableText(value, 140);
  if (!readable) return '';

  const segments = readable.split(/[,;|]/).map((segment) => segment.trim()).filter(Boolean);
  const keywordSegment = segments.find((segment) => (
    /(university|institute|college|school|campus|academy|polytechnic)/i.test(segment)
  ));

  const candidate = keywordSegment || readable;
  if (!/(university|institute|college|school|campus|academy|polytechnic)/i.test(candidate)) {
    return '';
  }
  return candidate;
};

const inferFieldOfStudy = (value) => {
  const normalized = normalizeKey(value);
  if (!normalized) return '';
  if (normalized.includes('software engineering')) return 'Software Engineering';
  if (normalized.includes('computer science')) return 'Computer Science';
  if (normalized.includes('information technology')) return 'Information Technology';
  if (normalized.includes('information systems')) return 'Information Systems';
  if (normalized.includes('data science')) return 'Data Science';
  if (normalized.includes('artificial intelligence')) return 'Artificial Intelligence';
  if (normalized.includes('cyber security') || normalized.includes('cybersecurity')) return 'Cyber Security';
  return '';
};

const normalizeGraduationYear = (value) => {
  const currentYear = new Date().getFullYear();
  const minimumYear = currentYear - 39;
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value >= minimumYear && value <= currentYear ? value.toString() : '';
  }
  if (typeof value !== 'string') return '';
  const yearMatch = value.match(/\b(19|20)\d{2}\b/g);
  if (!yearMatch || yearMatch.length === 0) return '';
  const latest = yearMatch
    .map((candidate) => Number.parseInt(candidate, 10))
    .filter((year) => Number.isInteger(year))
    .sort((a, b) => b - a)[0];
  if (!Number.isInteger(latest)) return '';
  return latest >= minimumYear && latest <= currentYear ? latest.toString() : '';
};

const normalizePhoneNumber = (value) => {
  const raw = normalizeText(value);
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('94') && digits.length >= 11) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+94${digits.slice(1)}`;
  }
  if (digits.length === 9) {
    return `+94${digits}`;
  }
  if (raw.startsWith('+')) {
    return raw;
  }
  return `+${digits}`;
};

const normalizeUrl = (value) => {
  const raw = normalizeText(value);
  if (!raw) return '';
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withScheme);
    return parsed.href.replace(/\/+$/, '');
  } catch {
    return '';
  }
};

const normalizeLinkedInUrl = (value) => {
  const normalized = normalizeUrl(value);
  if (!normalized) return '';
  return /linkedin\.com/i.test(normalized) ? normalized : '';
};

const normalizeGitHubUrl = (value) => {
  const normalized = normalizeUrl(value);
  if (!normalized) return '';
  return /github\.com/i.test(normalized) ? normalized : '';
};

const normalizePortfolioUrl = (value) => {
  const normalized = normalizeUrl(value);
  if (!normalized) return '';
  if (/linkedin\.com|github\.com/i.test(normalized)) return '';
  return normalized;
};

const skillAliasMap = new Map([
  ['javascript', 'javascript'],
  ['typescript', 'typescript'],
  ['python', 'python'],
  ['java', 'java'],
  ['c#', 'csharp'],
  ['csharp', 'csharp'],
  ['c++', 'cpp'],
  ['cpp', 'cpp'],
  ['react', 'react'],
  ['react.js', 'react'],
  ['angular', 'angular'],
  ['vue', 'vue'],
  ['vue.js', 'vue'],
  ['node', 'nodejs'],
  ['nodejs', 'nodejs'],
  ['node.js', 'nodejs'],
  ['express', 'express'],
  ['express.js', 'express'],
  ['django', 'django'],
  ['spring', 'spring'],
  ['spring boot', 'spring'],
  ['.net', 'dotnet'],
  ['dotnet', 'dotnet'],
  ['sql', 'sql'],
  ['mongodb', 'mongodb'],
  ['postgresql', 'postgresql'],
  ['postgres', 'postgresql'],
  ['aws', 'aws'],
  ['azure', 'azure'],
  ['docker', 'docker'],
  ['kubernetes', 'kubernetes'],
  ['git', 'git'],
  ['agile', 'agile'],
  ['scrum', 'agile'],
  ['testing', 'testing'],
  ['qa', 'testing'],
  ['quality assurance', 'testing'],
]);

const certificationPatterns = [
  { pattern: /(aws).*(solutions).*(architect)/i, value: 'aws-solutions-architect' },
  { pattern: /(aws).*(developer)/i, value: 'aws-developer' },
  { pattern: /(aws).*(sysops)/i, value: 'aws-sysops' },
  { pattern: /(azure).*(fundamentals)/i, value: 'azure-fundamentals' },
  { pattern: /(azure).*(administrator)/i, value: 'azure-administrator' },
  { pattern: /(azure).*(developer)/i, value: 'azure-developer' },
  { pattern: /(google cloud|gcp).*(associate)/i, value: 'gcp-associate' },
  { pattern: /(google cloud|gcp).*(professional)/i, value: 'gcp-professional' },
  { pattern: /(kubernetes).*(cka)/i, value: 'kubernetes-cka' },
  { pattern: /(kubernetes).*(ckad)/i, value: 'kubernetes-ckad' },
  { pattern: /(docker).*(dca)/i, value: 'docker-dca' },
  { pattern: /(security\+)/i, value: 'comptia-security' },
  { pattern: /(network\+)/i, value: 'comptia-network' },
  { pattern: /(ccna)/i, value: 'cisco-ccna' },
  { pattern: /\bpmp\b/i, value: 'pmp' },
  { pattern: /(scrum).*(master)/i, value: 'scrum-master' },
  { pattern: /(istqb)/i, value: 'istqb' },
  { pattern: /(oracle).*(java)/i, value: 'oracle-java' },
  { pattern: /(mcsa|microsoft certified solutions associate)/i, value: 'microsoft-mcsa' },
];

const normalizeSkills = (skills) => {
  if (!Array.isArray(skills)) return [];
  const seen = new Set();
  const normalized = [];

  skills.forEach((rawSkill) => {
    const cleaned = normalizeText(rawSkill);
    if (!cleaned) return;
    const alias = skillAliasMap.get(normalizeKey(cleaned)) || cleaned;
    const key = normalizeKey(alias);
    if (!key || seen.has(key)) return;
    seen.add(key);
    normalized.push(alias);
  });

  return normalized.slice(0, 25);
};

const normalizeCertifications = (certifications) => {
  const values = Array.isArray(certifications)
    ? certifications
    : typeof certifications === 'string'
      ? certifications.split(/[,\n|/\u2022·]/)
      : [];
  const seen = new Set();
  const normalized = [];

  values.forEach((rawItem) => {
    const cleaned = normalizeText(rawItem);
    if (!cleaned) return;
    const known = certificationPatterns.find(({ pattern }) => pattern.test(cleaned))?.value || cleaned;
    const key = normalizeKey(known);
    if (!key || seen.has(key)) return;
    seen.add(key);
    normalized.push(known);
  });

  return normalized.slice(0, 20);
};

const isEmptyValue = (value) => {
  if (Array.isArray(value)) return value.length === 0;
  return normalizeText(value) === '';
};

const hasValue = (value) => !isEmptyValue(value);

const DEFAULT_AUTO_APPLY_THRESHOLD = 0.84;

const fieldAutoApplyThreshold = {
  fullName: 0.9,
  phoneNumber: 0.9,
  targetRole: 0.86,
  experienceLevel: 0.84,
  industry: 0.84,
  highestQualification: 0.86,
  fieldOfStudy: 0.84,
  institutionName: 0.84,
  graduationYear: 0.9,
  location: 0.82,
  careerGoals: 0.8,
  skills: 0.84,
  certifications: 0.84,
  linkedinUrl: 0.92,
  githubUrl: 0.92,
  portfolioUrl: 0.9,
};

const resolveConfidence = (confidenceMap, keys = []) => {
  if (!confidenceMap || typeof confidenceMap !== 'object') return null;
  const values = keys
    .map((key) => confidenceMap?.[key])
    .filter((value) => typeof value === 'number' && Number.isFinite(value))
    .map((value) => Math.max(0, Math.min(1, value)));
  if (values.length === 0) return null;
  return Math.max(...values);
};

const fieldLabelByKey = {
  fullName: 'full name',
  phoneNumber: 'phone number',
  targetRole: 'target role',
  experienceLevel: 'experience level',
  industry: 'industry',
  highestQualification: 'highest qualification',
  fieldOfStudy: 'field of study',
  institutionName: 'institution name',
  graduationYear: 'graduation year',
  certifications: 'certifications',
  linkedinUrl: 'LinkedIn profile',
  githubUrl: 'GitHub profile',
  portfolioUrl: 'portfolio website',
  location: 'location',
  careerGoals: 'career goals',
  skills: 'skills',
};

export const formatAppliedPrefillFields = (fieldKeys = []) => (
  fieldKeys
    .map((key) => fieldLabelByKey[key] || key)
    .join(', ')
);

const formatSuggestionValue = (value) => {
  if (Array.isArray(value)) return value.join(', ');
  return String(value || '').trim();
};

const createSuggestion = (field, value, confidence) => ({
  field,
  label: fieldLabelByKey[field] || field,
  value,
  displayValue: formatSuggestionValue(value),
  confidence: typeof confidence === 'number' ? Math.max(0, Math.min(1, confidence)) : null,
});

export const deriveCandidatePrefillUpdates = (currentForm, extracted, options = {}) => {
  const updates = {};
  const suggestions = [];
  if (!currentForm || !extracted) {
    return { updates, appliedFields: [], suggestions };
  }

  const confidenceMap = options?.confidence || {};
  const years = parseYears(extracted.yearsOfExperience);
  const normalizedExperience = normalizeExperienceLevel(extracted.experienceLevel)
    || inferExperienceLevelFromYears(years);
  const normalizedRole = normalizeTargetRole(extracted.targetRole);
  const normalizedIndustry = normalizeIndustry(extracted.industry);
  const normalizedQualification = normalizeQualification(extracted.education);
  const inferredFieldOfStudy = normalizeFieldOfStudy(extracted.fieldOfStudy) || inferFieldOfStudy(extracted.education);
  const normalizedInstitution = normalizeInstitutionName(
    extracted.institutionName || extracted.educationInstitution || extracted.education,
  );
  const normalizedGraduationYear = normalizeGraduationYear(extracted.graduationYear || extracted.education);
  const normalizedPhone = normalizePhoneNumber(extracted.phone);
  const normalizedLocation = normalizeText(extracted.location);
  const normalizedSummary = normalizeText(extracted.summary);
  const normalizedSkills = normalizeSkills(extracted.skills);
  const normalizedCertifications = normalizeCertifications(extracted.certifications);
  const normalizedLinkedIn = normalizeLinkedInUrl(extracted.linkedinUrl);
  const normalizedGitHub = normalizeGitHubUrl(extracted.githubUrl);
  const normalizedPortfolio = normalizePortfolioUrl(extracted.portfolioUrl);
  const normalizedName = normalizeText(extracted.fullName);

  const maybeApplyField = (field, value, confidenceKeys = []) => {
    if (!hasValue(value) || !isEmptyValue(currentForm[field])) return;

    const confidence = resolveConfidence(confidenceMap, confidenceKeys);
    const threshold = fieldAutoApplyThreshold[field] ?? DEFAULT_AUTO_APPLY_THRESHOLD;
    const hasConfidence = typeof confidence === 'number';
    const canAutoApply = hasConfidence && confidence >= threshold;

    if (canAutoApply) {
      updates[field] = value;
      return;
    }

    const shouldSuggest = hasConfidence ? confidence >= 0.45 : true;
    if (shouldSuggest) {
      suggestions.push(createSuggestion(field, value, hasConfidence ? confidence : null));
    }
  };

  maybeApplyField('fullName', normalizedName, ['fullName']);
  maybeApplyField('phoneNumber', normalizedPhone, ['phone']);
  maybeApplyField('targetRole', normalizedRole, ['targetRole']);
  maybeApplyField('experienceLevel', normalizedExperience, ['experienceLevel', 'yearsOfExperience']);
  maybeApplyField('industry', normalizedIndustry, ['industry']);
  maybeApplyField('highestQualification', normalizedQualification, ['education']);
  maybeApplyField('fieldOfStudy', inferredFieldOfStudy, ['fieldOfStudy', 'education']);
  maybeApplyField('institutionName', normalizedInstitution, ['institutionName', 'education']);
  maybeApplyField('graduationYear', normalizedGraduationYear, ['graduationYear', 'education']);
  maybeApplyField('location', normalizedLocation, ['location']);
  maybeApplyField('careerGoals', normalizedSummary, ['summary']);
  maybeApplyField('skills', normalizedSkills, ['skills']);
  maybeApplyField('certifications', normalizedCertifications, ['certifications']);
  maybeApplyField('linkedinUrl', normalizedLinkedIn, ['linkedinUrl']);
  maybeApplyField('githubUrl', normalizedGitHub, ['githubUrl']);
  maybeApplyField('portfolioUrl', normalizedPortfolio, ['portfolioUrl']);

  return {
    updates,
    appliedFields: Object.keys(updates),
    suggestions,
  };
};
