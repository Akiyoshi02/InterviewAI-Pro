import { describe, expect, it } from 'vitest';
import {
  buildDefaultInterviewPlanStages,
  normalizeJobTemplateConfig,
  parseInterviewPlanSkillFocus,
} from '../interviewPlanConfig.js';

describe('interviewPlanConfig', () => {
  it('builds a default stage plan with recruiter, SME, and final rounds', () => {
    const stages = buildDefaultInterviewPlanStages({
      duration: 45,
      interviewTypes: ['BEHAVIORAL', 'TECHNICAL', 'SYSTEM_DESIGN'],
      skillFocus: ['APIs', 'Communication'],
    });

    expect(stages).toHaveLength(3);
    expect(stages[0]).toMatchObject({
      id: 'recruiter-screen',
      category: 'SCREENING',
      advanceRule: 'PASS_REQUIRED',
      autoAdvanceOnPass: false,
      autoAdvanceOnComplete: false,
      failDispositionCode: null,
    });
    expect(stages[1]).toMatchObject({
      id: 'sme-interview',
      category: 'TECHNICAL',
    });
    expect(stages[2]).toMatchObject({
      id: 'final-interview',
      category: 'FINAL',
    });
  });

  it('normalizes template config and stage definitions into a stable payload', () => {
    const config = normalizeJobTemplateConfig({
      duration: '60',
      interviewTypes: ['behavioral', 'technical', 'TECHNICAL'],
      skillFocus: [' APIs ', 'Leadership', 'APIs'],
      interviewPlan: {
        stages: [
          {
            name: 'Architecture Review',
            category: 'technical',
            advanceRule: 'complete_to_continue',
            durationMinutes: '90',
            interviewTypes: ['system_design', 'technical'],
            skillFocus: [' Architecture ', 'Leadership'],
          },
        ],
      },
    });

    expect(config).toMatchObject({
      duration: 60,
      interviewTypes: ['BEHAVIORAL', 'TECHNICAL'],
      skillFocus: ['APIs', 'Leadership'],
    });
    expect(config.interviewPlan.stages).toHaveLength(1);
    expect(config.interviewPlan.stages[0]).toMatchObject({
      id: 'architecture-review',
      name: 'Architecture Review',
      category: 'TECHNICAL',
      required: true,
      advanceRule: 'COMPLETE_TO_CONTINUE',
      autoAdvanceOnPass: false,
      autoAdvanceOnComplete: false,
      failDispositionCode: null,
      durationMinutes: 90,
      interviewTypes: ['SYSTEM_DESIGN', 'TECHNICAL'],
      skillFocus: ['Architecture', 'Leadership'],
    });
  });

  it('parses comma-separated skill focus text', () => {
    expect(parseInterviewPlanSkillFocus(' APIs, Leadership , APIs,  ')).toEqual(['APIs', 'Leadership']);
  });

  it('keeps auto-advance-on-pass in the normalized payload', () => {
    const config = normalizeJobTemplateConfig({
      interviewPlan: {
        stages: [
          {
            name: 'Final Review',
            autoAdvanceOnPass: true,
          },
        ],
      },
    });

    expect(config.interviewPlan.stages[0]).toMatchObject({
      name: 'Final Review',
      autoAdvanceOnPass: true,
    });
  });

  it('keeps completion automation and fail disposition in the normalized payload', () => {
    const config = normalizeJobTemplateConfig({
      interviewPlan: {
        stages: [
          {
            name: 'Recruiter Screen',
            advanceRule: 'COMPLETE_TO_CONTINUE',
            autoAdvanceOnComplete: true,
            failDispositionCode: 'skill_mismatch',
          },
        ],
      },
    });

    expect(config.interviewPlan.stages[0]).toMatchObject({
      name: 'Recruiter Screen',
      advanceRule: 'COMPLETE_TO_CONTINUE',
      autoAdvanceOnComplete: true,
      failDispositionCode: 'SKILL_MISMATCH',
    });
  });
});
