const toUpper = (value) => String(value || '').trim().toUpperCase();

export const canAccessApplicationOnboarding = (application) =>
  toUpper(application?.status) === 'HIRED' && Array.isArray(application?.onboarding?.tasks);

export const ONBOARDING_STATUS_LABELS = {
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

export const ONBOARDING_TASK_STATUS_LABELS = {
  PENDING: 'Pending',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Needs Update',
  COMPLETED: 'Completed',
};

export const ONBOARDING_HISTORY_EVENT_LABELS = {
  CREATED: 'Checklist created',
  UPDATED: 'Checklist updated',
  TASK_SUBMITTED: 'Candidate submitted task',
  TASK_APPROVED: 'Task approved',
  TASK_REJECTED: 'Task sent back',
  TASK_COMPLETED: 'Task completed',
};

export const formatOnboardingStatusLabel = (status) =>
  ONBOARDING_STATUS_LABELS[toUpper(status)] || 'In Progress';

export const formatOnboardingTaskStatusLabel = (status) =>
  ONBOARDING_TASK_STATUS_LABELS[toUpper(status)] || 'Pending';

export const formatOnboardingHistoryEventLabel = (eventType) =>
  ONBOARDING_HISTORY_EVENT_LABELS[toUpper(eventType)] || 'Checklist updated';

export const getOnboardingProgress = (onboarding) => ({
  totalTasks: onboarding?.progress?.totalTasks || 0,
  requiredTasks: onboarding?.progress?.requiredTasks || 0,
  completedTasks: onboarding?.progress?.completedTasks || 0,
  percentComplete: onboarding?.progress?.percentComplete || 0,
});

export const groupOnboardingTasksByOwner = (onboarding) => {
  const tasks = Array.isArray(onboarding?.tasks) ? onboarding.tasks : [];
  return {
    candidateTasks: tasks.filter((task) => toUpper(task.owner) === 'CANDIDATE'),
    teamTasks: tasks.filter((task) => toUpper(task.owner) === 'TEAM'),
  };
};

export const getOnboardingTaskTone = (status) => {
  const normalized = toUpper(status);
  if (normalized === 'COMPLETED' || normalized === 'APPROVED') {
    return 'border-emerald-200 bg-emerald-50/70 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200';
  }
  if (normalized === 'SUBMITTED') {
    return 'border-blue-200 bg-blue-50/70 text-blue-700 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-200';
  }
  if (normalized === 'REJECTED') {
    return 'border-rose-200 bg-rose-50/70 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200';
  }
  return 'border-amber-200 bg-amber-50/70 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200';
};
