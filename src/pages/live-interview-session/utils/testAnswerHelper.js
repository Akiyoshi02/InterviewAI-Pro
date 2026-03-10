const toSafeString = (value) => (typeof value === 'string' ? value.trim() : '');

const containsAny = (value, needles = []) => needles.some((needle) => value.includes(needle));

const buildStarAnswer = () => [
  'Situation: In a recent sprint, a high-priority release was at risk because requirements changed late and the timeline was tight.',
  'Task: I needed to deliver a reliable solution quickly while keeping stakeholders aligned.',
  'Action: I broke the work into small milestones, communicated trade-offs early, and implemented tests plus monitoring before release.',
  'Result: We launched on schedule, reduced production incidents, and improved team confidence through clear documentation.',
].join(' ');

const buildGenericTechnicalAnswer = () => [
  'I would start by clarifying the requirement, the expected behavior, and the most important failure cases.',
  'Then I would choose the simplest implementation that is easy to test, reason about, and monitor in production.',
  'After that, I would validate the change with focused tests and observable rollout signals so the team can confirm the behavior safely.',
].join(' ');

const buildQuestionAwareTechnicalAnswer = (questionText) => {
  const normalizedQuestion = toSafeString(questionText).toLowerCase();

  if (!normalizedQuestion) {
    return buildStarAnswer();
  }

  if (containsAny(normalizedQuestion, ['shallow copy', 'deep copy'])) {
    return [
      'A shallow copy creates a new outer object but still shares references to nested objects, while a deep copy recursively duplicates the nested objects too.',
      'I use a shallow copy when I only need an independent top-level container and shared nested state is acceptable.',
      'I use a deep copy when nested values must be isolated before mutation, such as copying a configuration tree or a list of nested records.',
      'In Python, list(my_list) or copy.copy(obj) is shallow, while copy.deepcopy(obj) creates a fully independent clone.',
    ].join(' ');
  }

  if (containsAny(normalizedQuestion, ['rest api', 'restful api', 'http api'])) {
    return [
      'A REST API exposes resources through predictable HTTP endpoints and uses verbs like GET, POST, PATCH, and DELETE to describe the operation.',
      'I focus on clear resource naming, validation, consistent status codes, and idempotent behavior where appropriate.',
      'In production, I also care about authentication, pagination, and observability so the API remains maintainable after launch.',
    ].join(' ');
  }

  if (containsAny(normalizedQuestion, ['unit test', 'integration test', 'testing strategy', 'automated test'])) {
    return [
      'I use unit tests for fast validation of isolated business logic and integration tests to confirm that key components work together correctly.',
      'My usual approach is broad unit coverage on critical rules plus a smaller set of integration or end-to-end tests for the highest-risk workflows.',
      'That balance keeps feedback fast in development while still protecting the behavior most likely to fail in production.',
    ].join(' ');
  }

  if (containsAny(normalizedQuestion, ['sql join', 'inner join', 'left join', 'database join'])) {
    return [
      'An INNER JOIN returns only rows that match in both tables, while a LEFT JOIN keeps every row from the left table and fills missing right-side values with null.',
      'I use INNER JOIN when I only care about confirmed relationships, and LEFT JOIN when I still need the primary record even if related data is missing.',
      'When validating the query, I check row counts and null behavior first because that is where join mistakes show up quickly.',
    ].join(' ');
  }

  if (containsAny(normalizedQuestion, ['react', 'component lifecycle', 'state management', 'frontend'])) {
    return [
      'In React, I try to keep state as close as possible to where it is needed and lift it only when multiple components must coordinate.',
      'I separate server state, UI state, and derived state so updates stay predictable and rerenders remain easier to reason about.',
      'For performance, I add memoization only after the data flow is correct and the bottleneck is measurable.',
    ].join(' ');
  }

  if (containsAny(normalizedQuestion, ['difference between'])) {
    return [
      'I would answer that by first defining both concepts clearly, then comparing ownership, lifecycle, and side effects.',
      'After that, I would give a short example showing when I would choose one over the other in production code.',
      buildGenericTechnicalAnswer(),
    ].join(' ');
  }

  if (containsAny(normalizedQuestion, [
    'tell me about a time',
    'describe a time',
    'give me an example',
    'how did you handle',
    'what did you do when',
    'behavioral',
  ])) {
    return buildStarAnswer();
  }

  return buildGenericTechnicalAnswer();
};

export const buildSuggestedTestAnswer = ({
  phase,
  currentQuestion,
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

  return buildQuestionAwareTechnicalAnswer(currentQuestion);
};

export default buildSuggestedTestAnswer;
