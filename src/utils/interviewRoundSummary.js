const toUpperCode = (value) => String(value || '').trim().toUpperCase();

const toStageCategoryLabel = (value) => {
  const normalized = toUpperCode(value);
  if (!normalized) return null;
  return normalized.charAt(0) + normalized.slice(1).toLowerCase();
};

const resolvePlanStages = (plan) => (Array.isArray(plan?.stages) ? plan.stages : []);

const resolveCurrentPlanStage = (plan, explicitStageId = null) => {
  const stages = resolvePlanStages(plan);
  if (stages.length === 0) return null;
  return stages.find((stage) => stage?.id === explicitStageId)
    || stages.find((stage) => stage?.id === plan?.currentStageId)
    || stages.find((stage) => toUpperCode(stage?.status) === 'ACTIVE')
    || stages.find((stage) => toUpperCode(stage?.status) === 'PENDING')
    || stages[stages.length - 1]
    || null;
};

const getCompletedStageCount = (plan) => (
  resolvePlanStages(plan).filter((stage) => ['COMPLETED', 'SKIPPED'].includes(toUpperCode(stage?.status))).length
);

export const getInterviewRoundSummary = (interview = {}) => {
  const total = Number(
    interview?.planStageTotal
      || resolvePlanStages(interview?.applicationInterviewPlan).length
      || 0,
  );
  const sequence = Number(interview?.planStageSequence || 0);
  const stageName = String(interview?.planStageName || '').trim();
  const stageCategoryLabel = toStageCategoryLabel(interview?.planStageCategory);

  if (!total && !stageName) return null;

  return {
    badge: total > 0 && sequence > 0 ? `Round ${sequence} of ${total}` : 'Interview round',
    title: stageName || 'Interview round',
    detail: stageCategoryLabel ? `${stageCategoryLabel} round` : 'Structured interview round',
  };
};

export const getApplicationRoundSummary = (application = {}) => {
  const plan = application?.interviewPlan;
  const stages = resolvePlanStages(plan);
  if (stages.length === 0) return null;

  const total = stages.length;
  const completedCount = getCompletedStageCount(plan);
  const currentStage = resolveCurrentPlanStage(plan);
  const sequence = Number(currentStage?.sequence || completedCount || 0);
  const stageName = String(currentStage?.name || '').trim() || 'Interview stage';
  const stageCategoryLabel = toStageCategoryLabel(currentStage?.category);
  const status = toUpperCode(application?.status);

  if (status === 'OFFER') {
    return {
      badge: 'Offer stage',
      title: 'Offer in progress',
      detail: `All ${total} interview round${total === 1 ? '' : 's'} are complete. The hiring team is preparing the offer.`,
    };
  }

  if (status === 'HIRED') {
    return {
      badge: 'Offer accepted',
      title: 'Hired',
      detail: `The application completed ${total} interview round${total === 1 ? '' : 's'} before hire confirmation.`,
    };
  }

  if (status === 'REJECTED' && completedCount > 0) {
    return {
      badge: completedCount >= total ? 'Interview process closed' : `Closed after round ${Math.max(1, completedCount)}`,
      title: 'Interview process ended',
      detail: `${completedCount} of ${total} interview round${total === 1 ? '' : 's'} were completed before the final decision.`,
    };
  }

  const roundBadge = total > 0 && sequence > 0 ? `Round ${sequence} of ${total}` : 'Interview round';
  const defaultDetail = `${stageName}${stageCategoryLabel ? ` - ${stageCategoryLabel} round` : ''}`;

  if (status === 'INTERVIEWING') {
    return {
      badge: roundBadge,
      title: 'Interview stage active',
      detail: defaultDetail,
    };
  }

  if (status === 'SHORTLISTED') {
    return {
      badge: roundBadge,
      title: 'Interview rounds progressing',
      detail: completedCount >= total
        ? 'All planned interview rounds are complete and the hiring team is reviewing the outcome.'
        : `${completedCount} of ${total} interview rounds completed.`,
    };
  }

  return {
    badge: roundBadge,
    title: 'Interview plan ready',
    detail: defaultDetail,
  };
};

export const canMoveInterviewApplicationToOffer = (interview = {}) => {
  if (!interview?.applicationId) return false;
  if (toUpperCode(interview?.mode) !== 'HIRING') return false;
  if (toUpperCode(interview?.status) !== 'COMPLETED') return false;
  if (['OFFER', 'HIRED', 'REJECTED'].includes(toUpperCode(interview?.applicationStatus))) return false;
  if (interview?.hasNextPlanStage) return false;

  const currentStage = resolveCurrentPlanStage(interview?.applicationInterviewPlan, interview?.planStageId);
  if (!currentStage) return false;

  const outcome = toUpperCode(currentStage?.outcome);
  const advanceRule = toUpperCode(currentStage?.advanceRule || 'PASS_REQUIRED');
  if (advanceRule === 'COMPLETE_TO_CONTINUE') {
    return outcome !== 'FAIL' && outcome !== 'HOLD';
  }
  return outcome === 'PASS';
};

export const getApplicationOfferStageEligibility = (application = {}) => {
  if (!application?.id) {
    return {
      allowed: false,
      reason: 'Select an application to continue.',
    };
  }

  const status = toUpperCode(application?.status);
  if (!['INTERVIEWING', 'SHORTLISTED', 'OFFER', 'HIRED'].includes(status)) {
    return {
      allowed: false,
      reason: 'Move the candidate into the interview workflow before using the offer stage.',
    };
  }

  if (status === 'OFFER' || status === 'HIRED') {
    return {
      allowed: true,
      reason: null,
    };
  }

  const plan = application?.interviewPlan;
  const stages = resolvePlanStages(plan);
  if (stages.length === 0) {
    return {
      allowed: true,
      reason: null,
    };
  }

  const incompleteStage = stages.find((stage) => !['COMPLETED', 'SKIPPED'].includes(toUpperCode(stage?.status)));
  if (incompleteStage) {
    return {
      allowed: false,
      reason: 'Complete all planned interview rounds before moving the application to Offer.',
    };
  }

  const finalStage = stages[stages.length - 1] || null;
  const outcome = toUpperCode(finalStage?.outcome);
  const advanceRule = toUpperCode(finalStage?.advanceRule || 'PASS_REQUIRED');
  if (advanceRule === 'COMPLETE_TO_CONTINUE') {
    if (outcome === 'FAIL' || outcome === 'HOLD') {
      return {
        allowed: false,
        reason: outcome === 'FAIL'
          ? 'The final round is marked as failed. Update the round outcome before moving to Offer.'
          : 'The final round is on hold. Resolve the hold before moving to Offer.',
      };
    }
    return { allowed: true, reason: null };
  }

  if (outcome !== 'PASS') {
    return {
      allowed: false,
      reason: 'Record a Pass outcome for the final interview round before moving to Offer.',
    };
  }

  return { allowed: true, reason: null };
};
