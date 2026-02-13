export const APPLICATION_DISPOSITION_OPTIONS = [
  { value: 'NOT_SELECTED', label: 'Not Selected', category: 'ASSESSMENT', reason: 'Another candidate was selected for this role.' },
  { value: 'SKILL_MISMATCH', label: 'Skill Mismatch', category: 'ASSESSMENT', reason: 'Required skills did not align closely enough with this role.' },
  { value: 'EXPERIENCE_MISMATCH', label: 'Experience Mismatch', category: 'ASSESSMENT', reason: 'Experience level did not match the role requirements.' },
  { value: 'SALARY_MISMATCH', label: 'Compensation Mismatch', category: 'COMPENSATION', reason: 'Compensation expectations were not aligned for this role.' },
  { value: 'POSITION_FILLED', label: 'Position Filled', category: 'ROLE_OUTCOME', reason: 'This position has been filled.' },
  { value: 'JOB_CLOSED', label: 'Position Closed', category: 'ROLE_OUTCOME', reason: 'This role has been closed by the company.' },
  { value: 'CANDIDATE_WITHDREW', label: 'Candidate Withdrew', category: 'CANDIDATE_ACTION', reason: 'Application withdrawn by candidate.' },
  { value: 'HIRED', label: 'Hired', category: 'FINAL_DECISION', reason: 'Candidate selected for hire.' },
  { value: 'OTHER', label: 'Other', category: 'OTHER', reason: 'Application outcome recorded.' },
];

const DISPOSITION_LABEL_MAP = APPLICATION_DISPOSITION_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

export const getDispositionLabel = (code) => {
  if (!code) return null;
  const normalized = String(code).trim().toUpperCase();
  return DISPOSITION_LABEL_MAP[normalized] || normalized.replaceAll('_', ' ');
};

export const isJobClosedDisposition = (application) => {
  const code = String(application?.dispositionCode || '').toUpperCase();
  return code === 'JOB_CLOSED' || Boolean(application?.job?.isDeleted);
};
