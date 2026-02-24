const ACTIVE_INTERVIEW_STATUSES = new Set(['SCHEDULED', 'IN_PROGRESS']);
const ACTIVE_APPLICATION_STATUSES = new Set(['SUBMITTED', 'SCREENING', 'INTERVIEWING', 'SHORTLISTED']);
const STRONG_APPLICATION_SIGNAL_STATUSES = new Set(['SHORTLISTED', 'INTERVIEWING', 'HIRED']);
const SUPPORTED_INSIGHT_COLORS = new Set(['blue', 'green', 'amber']);

const toSafeArray = (value) => (Array.isArray(value) ? value : []);

const toUpperCode = (value) => (value == null ? '' : String(value).trim().toUpperCase());

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clampPercent = (value) => {
  const parsed = toFiniteNumber(value);
  if (parsed == null) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
};

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    const parsed = value.toDate();
    return Number.isNaN(parsed?.getTime?.()) ? null : parsed;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toIsoDate = (value) => {
  const date = toDate(value);
  return date ? date.toISOString() : null;
};

const toMillis = (value) => toDate(value)?.getTime?.() || 0;

const getInterviewTimestamp = (interview = {}) =>
  interview?.endedAt
  || interview?.updatedAt
  || interview?.createdAt
  || interview?.scheduledFor
  || null;

const sortByTimestampAsc = (items = []) =>
  [...items].sort((left, right) => toMillis(getInterviewTimestamp(left)) - toMillis(getInterviewTimestamp(right)));

const sortByTimestampDesc = (items = []) =>
  [...items].sort((left, right) => toMillis(getInterviewTimestamp(right)) - toMillis(getInterviewTimestamp(left)));

const getRoleKeywordMap = Object.freeze([
  { keywords: ['frontend', 'front-end', 'ui'], role: 'frontend-developer' },
  { keywords: ['backend', 'back-end', 'api'], role: 'backend-developer' },
  { keywords: ['fullstack', 'full-stack'], role: 'fullstack-developer' },
  { keywords: ['devops', 'site reliability', 'sre'], role: 'devops-engineer' },
  { keywords: ['qa', 'quality assurance', 'test automation'], role: 'qa-engineer' },
]);

const inferPracticeRole = (jobRole) => {
  const normalized = String(jobRole || '').toLowerCase().trim();
  if (!normalized) return 'software-engineer';
  const matchingRole = getRoleKeywordMap.find(({ keywords }) => keywords.some((keyword) => normalized.includes(keyword)));
  return matchingRole?.role || 'software-engineer';
};

const inferPracticeDifficulty = (averageScore, completedCount) => {
  if (averageScore == null) {
    if (completedCount >= 8) return 'advanced';
    if (completedCount >= 3) return 'intermediate';
    return 'beginner';
  }
  if (averageScore >= 88) return 'expert';
  if (averageScore >= 75) return 'advanced';
  if (averageScore >= 60) return 'intermediate';
  return 'beginner';
};

const getMostFrequentRole = (interviews = []) => {
  const counts = new Map();
  interviews.forEach((interview) => {
    const role = String(interview?.jobRole || interview?.position || '').trim();
    if (!role) return;
    counts.set(role, (counts.get(role) || 0) + 1);
  });
  if (!counts.size) return 'Software Engineer';
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0][0];
};

const toCompletionPercent = (value, total) => {
  if (!total || total <= 0) return 0;
  return clampPercent((Number(value) / Number(total)) * 100);
};

const resolveMetrics = ({ interviews = [], dashboardMetrics = null, analytics = null, applications = [] } = {}) => {
  const safeInterviews = toSafeArray(interviews);
  const safeApplications = toSafeArray(applications);

  const completedInterviews = safeInterviews.filter((interview) => toUpperCode(interview?.status) === 'COMPLETED');
  const scheduledInterviews = safeInterviews.filter((interview) => toUpperCode(interview?.status) === 'SCHEDULED');
  const inProgressInterviews = safeInterviews.filter((interview) => toUpperCode(interview?.status) === 'IN_PROGRESS');
  const activeInterviews = safeInterviews.filter((interview) => ACTIVE_INTERVIEW_STATUSES.has(toUpperCode(interview?.status)));

  const scoredInterviews = completedInterviews.filter((interview) => toFiniteNumber(interview?.overallScore) != null);
  const calculatedAverageScore = scoredInterviews.length
    ? scoredInterviews.reduce((sum, interview) => sum + Number(interview.overallScore), 0) / scoredInterviews.length
    : null;

  const metricsAverageScore = toFiniteNumber(dashboardMetrics?.averageScore?.value);
  const analyticsAverageScore = toFiniteNumber(analytics?.averageScore);
  const averageScore = metricsAverageScore ?? analyticsAverageScore ?? calculatedAverageScore;

  const completedCount = toFiniteNumber(dashboardMetrics?.completedInterviews?.value) ?? completedInterviews.length;
  const scheduledCount = toFiniteNumber(dashboardMetrics?.scheduledInterviews?.value) ?? scheduledInterviews.length;
  const inProgressCount = toFiniteNumber(dashboardMetrics?.inProgressInterviews) ?? inProgressInterviews.length;
  const totalInterviews = toFiniteNumber(dashboardMetrics?.totalInterviews) ?? safeInterviews.length;

  const activeApplications = safeApplications.filter((application) =>
    ACTIVE_APPLICATION_STATUSES.has(toUpperCode(application?.status)));
  const strongSignalApplications = safeApplications.filter((application) =>
    STRONG_APPLICATION_SIGNAL_STATUSES.has(toUpperCode(application?.status)));

  return {
    interviews: safeInterviews,
    applications: safeApplications,
    completedInterviews,
    scheduledInterviews,
    inProgressInterviews,
    activeInterviews,
    activeApplications,
    strongSignalApplications,
    completedCount,
    scheduledCount,
    inProgressCount,
    totalInterviews,
    averageScore,
    primaryRole: getMostFrequentRole(safeInterviews),
  };
};

const buildBadge = ({
  id,
  name,
  description,
  icon,
  color,
  rarity,
  progress = 0,
  total = 1,
  earnedDate = null,
}) => {
  const safeTotal = Math.max(1, Number(total) || 1);
  const safeProgress = Math.max(0, Math.min(safeTotal, Number(progress) || 0));
  const earned = safeProgress >= safeTotal;
  return {
    id,
    name,
    description,
    icon,
    color,
    rarity,
    earned,
    progress: safeProgress,
    total: safeTotal,
    earnedDate: earned ? toIsoDate(earnedDate) : null,
  };
};

export const deriveAchievementBadges = ({ interviews = [], dashboardMetrics = null, analytics = null, applications = [] } = {}) => {
  const metrics = resolveMetrics({ interviews, dashboardMetrics, analytics, applications });
  const completedByOldest = sortByTimestampAsc(metrics.completedInterviews);
  const allByOldest = sortByTimestampAsc(metrics.interviews);
  const highScoreInterviews = sortByTimestampDesc(
    metrics.completedInterviews.filter((interview) => Number(interview?.overallScore || 0) >= 90),
  );
  const scheduledByOldest = sortByTimestampAsc(metrics.activeInterviews);
  const applicationsByOldest = [...metrics.applications].sort(
    (left, right) => toMillis(left?.submittedAt || left?.createdAt) - toMillis(right?.submittedAt || right?.createdAt),
  );
  const strongSignalApplicationsByOldest = [...metrics.strongSignalApplications].sort(
    (left, right) => toMillis(left?.statusChangedAt || left?.updatedAt || left?.submittedAt || left?.createdAt)
      - toMillis(right?.statusChangedAt || right?.updatedAt || right?.submittedAt || right?.createdAt),
  );

  return [
    buildBadge({
      id: 'first-steps',
      name: 'First Steps',
      description: 'Complete your first interview session',
      icon: 'Award',
      color: 'bg-gradient-to-br from-emerald-500 to-teal-500',
      rarity: 'common',
      progress: metrics.completedCount,
      total: 1,
      earnedDate: getInterviewTimestamp(completedByOldest[0]),
    }),
    buildBadge({
      id: 'high-scorer',
      name: 'High Scorer',
      description: 'Score 90% or higher in an interview',
      icon: 'Star',
      color: 'bg-gradient-to-br from-blue-600 to-purple-600',
      rarity: 'rare',
      progress: highScoreInterviews.length > 0 ? 1 : 0,
      total: 1,
      earnedDate: getInterviewTimestamp(highScoreInterviews[highScoreInterviews.length - 1]),
    }),
    buildBadge({
      id: 'consistency-champion',
      name: 'Consistency Champion',
      description: 'Complete 10 interview sessions',
      icon: 'Target',
      color: 'bg-gradient-to-br from-purple-500 to-pink-500',
      rarity: 'epic',
      progress: metrics.completedCount,
      total: 10,
      earnedDate: getInterviewTimestamp(completedByOldest[9]),
    }),
    buildBadge({
      id: 'pipeline-ready',
      name: 'Pipeline Ready',
      description: 'Keep 3 active interviews scheduled or in progress',
      icon: 'Calendar',
      color: 'bg-gradient-to-br from-cyan-500 to-blue-500',
      rarity: 'uncommon',
      progress: metrics.scheduledCount + metrics.inProgressCount,
      total: 3,
      earnedDate: getInterviewTimestamp(scheduledByOldest[2]),
    }),
    buildBadge({
      id: 'application-explorer',
      name: 'Application Explorer',
      description: 'Submit your first job application',
      icon: 'Briefcase',
      color: 'bg-gradient-to-br from-amber-500 to-orange-500',
      rarity: 'common',
      progress: metrics.applications.length,
      total: 1,
      earnedDate: applicationsByOldest[0]?.submittedAt || applicationsByOldest[0]?.createdAt,
    }),
    buildBadge({
      id: 'shortlist-momentum',
      name: 'Shortlist Momentum',
      description: 'Reach shortlist/interview/hired stage twice',
      icon: 'Zap',
      color: 'bg-gradient-to-br from-rose-500 to-pink-500',
      rarity: 'legendary',
      progress: metrics.strongSignalApplications.length,
      total: 2,
      earnedDate:
        strongSignalApplicationsByOldest[1]?.statusChangedAt
        || strongSignalApplicationsByOldest[1]?.updatedAt
        || strongSignalApplicationsByOldest[1]?.submittedAt
        || strongSignalApplicationsByOldest[1]?.createdAt,
    }),
    buildBadge({
      id: 'interview-marathon',
      name: 'Interview Marathon',
      description: 'Participate in 15 total interview sessions',
      icon: 'Flame',
      color: 'bg-gradient-to-br from-orange-500 to-rose-500',
      rarity: 'rare',
      progress: metrics.totalInterviews,
      total: 15,
      earnedDate: getInterviewTimestamp(allByOldest[14]),
    }),
  ];
};

const getTopicPriorityRank = (priority) => {
  const normalized = toUpperCode(priority);
  if (normalized === 'HIGH') return 3;
  if (normalized === 'MEDIUM') return 2;
  return 1;
};

const inferDifficultyLabel = (difficultyCode) => {
  const normalized = toUpperCode(difficultyCode);
  if (normalized === 'BEGINNER') return 'Beginner';
  if (normalized === 'ADVANCED') return 'Advanced';
  if (normalized === 'EXPERT') return 'Advanced';
  return 'Intermediate';
};

const buildTopic = ({
  id,
  title,
  description,
  difficulty = 'intermediate',
  estimatedTime = '30 min',
  category = 'Interview Practice',
  priority = 'medium',
  completionRate = 0,
  icon = 'BookOpen',
  practiceRole = 'software-engineer',
  practiceDifficulty = 'intermediate',
}) => ({
  id,
  title,
  description,
  difficulty: inferDifficultyLabel(difficulty),
  estimatedTime,
  category,
  priority: String(priority || 'medium').toLowerCase(),
  completionRate: clampPercent(completionRate),
  icon,
  practiceRole,
  practiceDifficulty: String(practiceDifficulty || 'intermediate').toLowerCase(),
});

export const deriveRecommendedTopics = ({ interviews = [], dashboardMetrics = null, analytics = null, applications = [] } = {}) => {
  const metrics = resolveMetrics({ interviews, dashboardMetrics, analytics, applications });
  const practiceRole = inferPracticeRole(metrics.primaryRole);
  const practiceDifficulty = inferPracticeDifficulty(metrics.averageScore, metrics.completedCount);
  const scorePercent = clampPercent(metrics.averageScore);
  const activeApplicationCount = metrics.activeApplications.length;
  const strongSignalApplicationCount = metrics.strongSignalApplications.length;

  const topics = [
    buildTopic({
      id: 'role-foundations',
      title: `${metrics.primaryRole} interview foundations`,
      description: `Strengthen role-specific fundamentals and sharpen your opening responses for ${metrics.primaryRole}.`,
      difficulty: metrics.completedCount < 3 ? 'beginner' : (metrics.completedCount < 8 ? 'intermediate' : 'advanced'),
      estimatedTime: '35 min',
      category: 'Technical',
      priority: metrics.completedCount < 4 ? 'high' : 'medium',
      completionRate: toCompletionPercent(metrics.completedCount, 8),
      icon: 'Target',
      practiceRole,
      practiceDifficulty,
    }),
    buildTopic({
      id: 'communication-clarity',
      title: 'Communication clarity and structure',
      description: 'Practice concise STAR-based answers to improve confidence, pacing, and interviewer clarity.',
      difficulty: scorePercent >= 80 ? 'intermediate' : 'beginner',
      estimatedTime: '25 min',
      category: 'Soft Skills',
      priority: scorePercent < 70 ? 'high' : (scorePercent < 85 ? 'medium' : 'low'),
      completionRate: scorePercent || toCompletionPercent(metrics.completedCount, 6),
      icon: 'MessageCircle',
      practiceRole,
      practiceDifficulty: scorePercent < 70 ? 'beginner' : 'intermediate',
    }),
    buildTopic({
      id: 'problem-solving-depth',
      title: 'Problem solving and system thinking',
      description: 'Focus on trade-offs, scalability, and structured breakdowns for technical interview prompts.',
      difficulty: scorePercent >= 78 ? 'advanced' : 'intermediate',
      estimatedTime: '45 min',
      category: 'Technical',
      priority: scorePercent < 78 ? 'high' : 'medium',
      completionRate: clampPercent((scorePercent || 45) - 8),
      icon: 'Cpu',
      practiceRole,
      practiceDifficulty: scorePercent >= 82 ? 'advanced' : 'intermediate',
    }),
    buildTopic({
      id: 'interview-rhythm',
      title: 'Interview rhythm and consistency',
      description: 'Build a consistent weekly interview cadence to maintain momentum and reduce last-minute anxiety.',
      difficulty: 'beginner',
      estimatedTime: '20 min',
      category: 'Practice Strategy',
      priority: metrics.scheduledCount + metrics.inProgressCount === 0 ? 'high' : 'medium',
      completionRate: toCompletionPercent(metrics.scheduledCount + metrics.inProgressCount, 3),
      icon: 'Calendar',
      practiceRole,
      practiceDifficulty: 'beginner',
    }),
    buildTopic({
      id: 'application-to-interview',
      title: 'Application-to-interview conversion',
      description: 'Align your resume stories with role goals and sharpen follow-up strategy after applying.',
      difficulty: activeApplicationCount > 0 ? 'intermediate' : 'beginner',
      estimatedTime: '30 min',
      category: 'Career Strategy',
      priority: activeApplicationCount > 2 ? 'high' : (metrics.applications.length > 0 ? 'medium' : 'low'),
      completionRate: metrics.applications.length
        ? toCompletionPercent(strongSignalApplicationCount, Math.max(metrics.applications.length, 1))
        : 0,
      icon: 'Briefcase',
      practiceRole,
      practiceDifficulty: activeApplicationCount > 0 ? 'intermediate' : 'beginner',
    }),
  ];

  return topics.sort((left, right) => {
    const priorityDelta = getTopicPriorityRank(right.priority) - getTopicPriorityRank(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    if (left.completionRate !== right.completionRate) return left.completionRate - right.completionRate;
    return String(left.title || '').localeCompare(String(right.title || ''));
  });
};

const pluralize = (count, label) => `${count} ${label}${count === 1 ? '' : 's'}`;

export const deriveDashboardInsights = ({ interviews = [], dashboardMetrics = null, analytics = null, applications = [] } = {}) => {
  const backendInsights = Array.isArray(dashboardMetrics?.insights)
    ? dashboardMetrics.insights
      .filter((insight) => insight && typeof insight === 'object')
      .map((insight, index) => ({
        id: String(insight.id || `backend-insight-${index}`),
        color: SUPPORTED_INSIGHT_COLORS.has(String(insight.color || '').toLowerCase())
          ? String(insight.color).toLowerCase()
          : 'blue',
        title: String(insight.title || '').trim(),
        detail: String(insight.detail || '').trim(),
      }))
      .filter((insight) => insight.title.length > 0 && insight.detail.length > 0)
    : [];

  if (backendInsights.length > 0) {
    return backendInsights;
  }

  const metrics = resolveMetrics({ interviews, dashboardMetrics, analytics, applications });
  const completedCount = Math.max(0, Math.round(Number(metrics.completedCount) || 0));
  const scheduledCount = Math.max(0, Math.round(Number(metrics.scheduledCount) || 0));
  const inProgressCount = Math.max(0, Math.round(Number(metrics.inProgressCount) || 0));
  const averageScore = toFiniteNumber(metrics.averageScore);
  const averageScorePercent = clampPercent(averageScore);
  const hasScoreSignal = averageScore != null && completedCount > 0;
  const activeApplicationCount = metrics.activeApplications.length;
  const strongSignalApplicationCount = metrics.strongSignalApplications.length;
  const nextScheduledInterview = [...metrics.scheduledInterviews]
    .sort((left, right) => toMillis(left?.scheduledFor) - toMillis(right?.scheduledFor))[0];
  const nextScheduledDate = toDate(nextScheduledInterview?.scheduledFor);
  const nextScheduledLabel = nextScheduledDate ? nextScheduledDate.toLocaleDateString() : null;

  const scoreInsight = !hasScoreSignal
    ? {
      id: 'score-baseline',
      color: 'blue',
      title: 'No scored interviews yet',
      detail: 'Complete a practice interview to unlock score trends and confidence tracking.',
    }
    : {
      id: 'score-trend',
      color: averageScorePercent >= 85 ? 'green' : (averageScorePercent >= 70 ? 'blue' : 'amber'),
      title: `Average interview score ${averageScorePercent}%`,
      detail:
          dashboardMetrics?.averageScore?.changeText
          || `Based on ${pluralize(completedCount, 'completed interview')}.`,
    };

  let pipelineInsight = null;
  if (scheduledCount + inProgressCount > 0) {
    pipelineInsight = {
      id: 'pipeline-active',
      color: 'green',
      title: `${pluralize(scheduledCount + inProgressCount, 'active interview')} in your pipeline`,
      detail: nextScheduledLabel
        ? `Next scheduled interview on ${nextScheduledLabel}.`
        : 'Keep your scheduling details updated to stay interview-ready.',
    };
  } else if (activeApplicationCount > 0) {
    pipelineInsight = {
      id: 'pipeline-applications',
      color: 'blue',
      title: `${pluralize(activeApplicationCount, 'active application')} awaiting interview stages`,
      detail: 'Keep practicing while waiting for recruiter responses.',
    };
  } else {
    pipelineInsight = {
      id: 'pipeline-empty',
      color: 'amber',
      title: 'Interview pipeline is currently empty',
      detail: 'Apply to roles or start AI practice to build momentum.',
    };
  }

  let coachingInsight = null;
  if (strongSignalApplicationCount > 0) {
    coachingInsight = {
      id: 'coaching-signal',
      color: 'green',
      title: `${pluralize(strongSignalApplicationCount, 'application')} in strong-signal stages`,
      detail: 'Prepare targeted stories for shortlist and interview-round conversations.',
    };
  } else if (completedCount >= 5) {
    coachingInsight = {
      id: 'coaching-consistency',
      color: 'blue',
      title: 'Consistency milestone unlocked',
      detail: `${pluralize(completedCount, 'completed interview')} gives you a strong preparation base.`,
    };
  } else if (completedCount > 0) {
    const remainingToMilestone = Math.max(1, 5 - completedCount);
    coachingInsight = {
      id: 'coaching-momentum',
      color: 'amber',
      title: 'Keep momentum toward your consistency goal',
      detail: `${pluralize(remainingToMilestone, 'more session')} to reach your first 5-session milestone.`,
    };
  } else {
    coachingInsight = {
      id: 'coaching-kickoff',
      color: 'amber',
      title: 'Opportunity: strengthen communication structure',
      detail: 'Use quick-start practice to build STAR-based response confidence.',
    };
  }

  return [scoreInsight, pipelineInsight, coachingInsight];
};
