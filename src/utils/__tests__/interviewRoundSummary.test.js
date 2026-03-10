import { describe, expect, it } from 'vitest';
import {
  canMoveInterviewApplicationToOffer,
  getApplicationOfferStageEligibility,
  getApplicationRoundSummary,
  getInterviewRoundSummary,
} from '../interviewRoundSummary.js';

describe('interviewRoundSummary', () => {
  it('builds interview round metadata from the active stage', () => {
    const summary = getInterviewRoundSummary({
      planStageSequence: 2,
      planStageTotal: 3,
      planStageName: 'SME Interview',
      planStageCategory: 'TECHNICAL',
    });

    expect(summary).toEqual({
      badge: 'Round 2 of 3',
      title: 'SME Interview',
      detail: 'Technical round',
    });
  });

  it('builds the candidate-facing offer-stage summary once interviews are complete', () => {
    const summary = getApplicationRoundSummary({
      status: 'OFFER',
      interviewPlan: {
        currentStageId: 'final-stage',
        stages: [
          { id: 'recruiter-screen', sequence: 1, status: 'COMPLETED', name: 'Recruiter Screen' },
          { id: 'sme-stage', sequence: 2, status: 'COMPLETED', name: 'SME Interview' },
          { id: 'final-stage', sequence: 3, status: 'COMPLETED', name: 'Final Interview' },
        ],
      },
    });

    expect(summary).toEqual({
      badge: 'Offer stage',
      title: 'Offer in progress',
      detail: 'All 3 interview rounds are complete. The hiring team is preparing the offer.',
    });
  });

  it('allows moving a completed final round to offer when progression requirements are satisfied', () => {
    expect(
      canMoveInterviewApplicationToOffer({
        applicationId: 'application-1',
        mode: 'HIRING',
        status: 'COMPLETED',
        applicationStatus: 'SHORTLISTED',
        hasNextPlanStage: false,
        planStageId: 'final-stage',
        applicationInterviewPlan: {
          currentStageId: 'final-stage',
          stages: [
            {
              id: 'final-stage',
              name: 'Final Interview',
              sequence: 3,
              status: 'COMPLETED',
              outcome: 'PASS',
              advanceRule: 'PASS_REQUIRED',
            },
          ],
        },
      }),
    ).toBe(true);
  });

  it('blocks moving to offer when the current stage still has another round to create or has failed', () => {
    expect(
      canMoveInterviewApplicationToOffer({
        applicationId: 'application-1',
        mode: 'HIRING',
        status: 'COMPLETED',
        applicationStatus: 'SHORTLISTED',
        hasNextPlanStage: true,
        planStageId: 'sme-stage',
        applicationInterviewPlan: {
          currentStageId: 'sme-stage',
          stages: [
            {
              id: 'sme-stage',
              name: 'SME Interview',
              sequence: 2,
              status: 'COMPLETED',
              outcome: 'PASS',
              advanceRule: 'PASS_REQUIRED',
            },
          ],
        },
      }),
    ).toBe(false);

    expect(
      canMoveInterviewApplicationToOffer({
        applicationId: 'application-1',
        mode: 'HIRING',
        status: 'COMPLETED',
        applicationStatus: 'SHORTLISTED',
        hasNextPlanStage: false,
        planStageId: 'final-stage',
        applicationInterviewPlan: {
          currentStageId: 'final-stage',
          stages: [
            {
              id: 'final-stage',
              name: 'Final Interview',
              sequence: 3,
              status: 'COMPLETED',
              outcome: 'FAIL',
              advanceRule: 'PASS_REQUIRED',
            },
          ],
        },
      }),
    ).toBe(false);
  });

  it('blocks offer-stage application transitions until the final round outcome is eligible', () => {
    expect(
      getApplicationOfferStageEligibility({
        id: 'application-1',
        status: 'INTERVIEWING',
        interviewPlan: {
          currentStageId: 'final-stage',
          stages: [
            {
              id: 'recruiter-screen',
              sequence: 1,
              status: 'COMPLETED',
              outcome: 'PASS',
              advanceRule: 'PASS_REQUIRED',
            },
            {
              id: 'final-stage',
              sequence: 2,
              status: 'COMPLETED',
              outcome: 'PENDING',
              advanceRule: 'PASS_REQUIRED',
            },
          ],
        },
      }),
    ).toEqual({
      allowed: false,
      reason: 'Record a Pass outcome for the final interview round before moving to Offer.',
    });

    expect(
      getApplicationOfferStageEligibility({
        id: 'application-1',
        status: 'INTERVIEWING',
        interviewPlan: {
          currentStageId: 'final-stage',
          stages: [
            {
              id: 'recruiter-screen',
              sequence: 1,
              status: 'COMPLETED',
              outcome: 'PASS',
              advanceRule: 'PASS_REQUIRED',
            },
            {
              id: 'final-stage',
              sequence: 2,
              status: 'COMPLETED',
              outcome: 'PASS',
              advanceRule: 'PASS_REQUIRED',
            },
          ],
        },
      }),
    ).toEqual({
      allowed: true,
      reason: null,
    });
  });
});
