import {
  canAdvanceFromInterviewPlanStage,
  normalizeInterviewPlanTemplateConfig,
  updateInterviewPlanStageOutcome,
} from '../interviewPlan.util.js';

describe('normalizeInterviewPlanTemplateConfig', () => {
  it('normalizes duration, interview types, skill focus, and stage definitions', () => {
    const config = normalizeInterviewPlanTemplateConfig({
      duration: '75',
      interviewTypes: ['behavioral', 'technical'],
      skillFocus: [' APIs ', 'Leadership', 'APIs'],
      interviewPlan: {
        stages: [
          {
            name: 'Technical Panel',
            category: 'panel',
            durationMinutes: '90',
            interviewTypes: ['system_design', 'technical'],
            skillFocus: ['Architecture', 'Leadership'],
          },
          {
            name: 'Final Alignment',
            category: 'final',
            required: false,
          },
        ],
      },
    });

    expect(config).toMatchObject({
      duration: 75,
      interviewTypes: ['BEHAVIORAL', 'TECHNICAL'],
      skillFocus: ['APIs', 'Leadership'],
    });

    expect(config.interviewPlan.stages).toEqual([
      {
        id: 'technical-panel',
        sequence: 1,
        name: 'Technical Panel',
        category: 'PANEL',
        required: true,
        advanceRule: 'PASS_REQUIRED',
        autoAdvanceOnPass: false,
        autoAdvanceOnComplete: false,
        failDispositionCode: null,
        durationMinutes: 90,
        interviewTypes: ['SYSTEM_DESIGN', 'TECHNICAL'],
        skillFocus: ['Architecture', 'Leadership'],
        templateId: null,
      },
      {
        id: 'final-alignment',
        sequence: 2,
        name: 'Final Alignment',
        category: 'FINAL',
        required: false,
        advanceRule: 'PASS_REQUIRED',
        autoAdvanceOnPass: false,
        autoAdvanceOnComplete: false,
        failDispositionCode: null,
        durationMinutes: 75,
        interviewTypes: ['BEHAVIORAL', 'TECHNICAL'],
        skillFocus: ['APIs', 'Leadership'],
        templateId: null,
      },
    ]);
  });

  it('preserves and normalizes stage advance rules', () => {
    const config = normalizeInterviewPlanTemplateConfig({
      interviewPlan: {
        stages: [
          {
            name: 'Recruiter Screen',
            advanceRule: 'complete_to_continue',
          },
        ],
      },
    });

    expect(config.interviewPlan.stages[0]).toMatchObject({
      name: 'Recruiter Screen',
      advanceRule: 'COMPLETE_TO_CONTINUE',
    });
  });

  it('preserves auto-advance-on-pass when configured', () => {
    const config = normalizeInterviewPlanTemplateConfig({
      interviewPlan: {
        stages: [
          {
            name: 'SME Interview',
            autoAdvanceOnPass: true,
          },
        ],
      },
    });

    expect(config.interviewPlan.stages[0]).toMatchObject({
      name: 'SME Interview',
      autoAdvanceOnPass: true,
    });
  });

  it('preserves completion automation and fail disposition when configured', () => {
    const config = normalizeInterviewPlanTemplateConfig({
      interviewPlan: {
        stages: [
          {
            name: 'Recruiter Screen',
            advanceRule: 'COMPLETE_TO_CONTINUE',
            autoAdvanceOnComplete: true,
            failDispositionCode: 'experience_mismatch',
          },
        ],
      },
    });

    expect(config.interviewPlan.stages[0]).toMatchObject({
      name: 'Recruiter Screen',
      advanceRule: 'COMPLETE_TO_CONTINUE',
      autoAdvanceOnComplete: true,
      failDispositionCode: 'EXPERIENCE_MISMATCH',
    });
  });
});

describe('interview plan stage outcomes', () => {
  it('records a stage outcome and blocks progression until pass when required', () => {
    const plan = {
      currentStageId: 'recruiter-screen',
      stages: [
        {
          id: 'recruiter-screen',
          name: 'Recruiter Screen',
          sequence: 1,
          category: 'SCREENING',
          status: 'COMPLETED',
          advanceRule: 'PASS_REQUIRED',
          outcome: 'PENDING',
        },
        {
          id: 'sme-interview',
          name: 'SME Interview',
          sequence: 2,
          category: 'TECHNICAL',
          status: 'PENDING',
          advanceRule: 'PASS_REQUIRED',
          outcome: 'PENDING',
        },
      ],
    };

    const heldPlan = updateInterviewPlanStageOutcome(plan, 'recruiter-screen', {
      outcome: 'HOLD',
      note: 'Waiting for recruiter calibration.',
      recordedAt: '2026-03-10T09:00:00.000Z',
      recordedBy: 'recruiter-1',
    });

    expect(canAdvanceFromInterviewPlanStage(heldPlan, 'recruiter-screen')).toMatchObject({
      allowed: false,
      code: 'INTERVIEW_STAGE_OUTCOME_REQUIRED',
    });

    const passedPlan = updateInterviewPlanStageOutcome(plan, 'recruiter-screen', {
      outcome: 'PASS',
    });

    expect(canAdvanceFromInterviewPlanStage(passedPlan, 'recruiter-screen')).toMatchObject({
      allowed: true,
      code: 'PASS_REQUIRED',
    });
  });
});
