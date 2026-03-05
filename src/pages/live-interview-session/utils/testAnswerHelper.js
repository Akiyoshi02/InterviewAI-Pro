const toSafeString = (value) => (typeof value === 'string' ? value.trim() : '');

export const buildSuggestedTestAnswer = ({
  phase,
  jobRole,
  experienceLevel,
  industry,
} = {}) => {
  const normalizedPhase = toSafeString(phase).toLowerCase();
  const safeRole = toSafeString(jobRole) || 'Software Engineer';
  const safeLevel = toSafeString(experienceLevel) || 'mid-level';
  const safeIndustry = toSafeString(industry) || 'technology';

  if (normalizedPhase === 'introduction') {
    return [
      `Hi, I am a ${safeLevel} ${safeRole} focused on ${safeIndustry} work.`,
      'I usually solve user-facing problems with clear communication and measurable outcomes.',
      'Over the last year, I improved feature delivery speed by partnering closely with product and QA teams.',
      'I am excited about this role because it matches both my technical strengths and growth goals.',
    ].join(' ');
  }

  if (normalizedPhase === 'candidate_questions') {
    return [
      `Thanks for the discussion on ${safeRole}.`,
      'I have two quick questions:',
      '1) What does success look like in the first 90 days?',
      '2) Which skills are most important for top performers on this team?',
    ].join(' ');
  }

  return [
    'Situation: In a recent sprint, a high-priority release was at risk because requirements changed late and the timeline was tight.',
    'Task: I needed to deliver a reliable solution quickly while keeping stakeholders aligned.',
    'Action: I broke the work into small milestones, communicated trade-offs early, and implemented tests plus monitoring before release.',
    'Result: We launched on schedule, reduced production incidents, and improved team confidence through clear documentation.',
  ].join(' ');
};

export default buildSuggestedTestAnswer;
