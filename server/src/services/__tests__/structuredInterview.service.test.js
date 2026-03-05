import { describe, expect, it } from '@jest/globals';
import {
  buildStructuredInterviewQuestionPlan,
  computeRubricWeightedScore,
  normalizeOrganizationTemplateForPlanner,
} from '../structuredInterview.service.js';

describe('structuredInterview.service', () => {
  it('keeps hiring core questions deterministic while random pool can vary per interview', () => {
    const baseInterview = {
      mode: 'HIRING',
      jobRole: 'Software Engineer',
      experienceLevel: 'mid',
      industry: 'technology',
      interviewTypes: ['behavioral', 'technical', 'system-design', 'coding'],
      config: {
        advancedSettings: { difficulty: 'medium' },
      },
    };

    const firstPlan = buildStructuredInterviewQuestionPlan({
      interview: {
        ...baseInterview,
        id: 'int-001',
        candidateId: 'cand-a',
      },
      totalQuestions: 8,
    });

    const secondPlan = buildStructuredInterviewQuestionPlan({
      interview: {
        ...baseInterview,
        id: 'int-002',
        candidateId: 'cand-b',
      },
      totalQuestions: 8,
    });

    expect(firstPlan.enabled).toBe(true);
    expect(secondPlan.enabled).toBe(true);

    const firstCore = firstPlan.questions.filter((question) => question.isCoreQuestion).map((question) => question.questionBankId);
    const secondCore = secondPlan.questions.filter((question) => question.isCoreQuestion).map((question) => question.questionBankId);

    expect(firstCore.length).toBeGreaterThan(0);
    expect(firstCore).toEqual(secondCore);

    const firstRandom = firstPlan.questions.filter((question) => !question.isCoreQuestion).map((question) => question.questionBankId);
    const secondRandom = secondPlan.questions.filter((question) => !question.isCoreQuestion).map((question) => question.questionBankId);

    expect(firstRandom.length).toBeGreaterThan(0);
    expect(firstRandom).not.toEqual(secondRandom);
  });

  it('returns practice mode as LLM-only by default when strategy not enabled', () => {
    const plan = buildStructuredInterviewQuestionPlan({
      interview: {
        id: 'practice-1',
        mode: 'PRACTICE',
        jobRole: 'Software Engineer',
        experienceLevel: 'mid',
        industry: 'technology',
        interviewTypes: ['behavioral', 'technical'],
      },
      totalQuestions: 10,
    });

    expect(plan.enabled).toBe(false);
    expect(plan.llmFillCount).toBe(10);
  });

  it('maps situational interview type to behavioral-compatible structured questions', () => {
    const plan = buildStructuredInterviewQuestionPlan({
      interview: {
        id: 'hiring-situational-1',
        mode: 'HIRING',
        jobRole: 'Software Engineer',
        experienceLevel: 'mid',
        industry: 'technology',
        interviewTypes: ['situational'],
        config: {
          advancedSettings: { difficulty: 'medium' },
        },
      },
      totalQuestions: 4,
    });

    expect(plan.enabled).toBe(true);
    expect(plan.questions.length).toBeGreaterThan(0);
    expect(plan.questions.some((question) => question.type === 'BEHAVIORAL')).toBe(true);
  });

  it('uses organization template override when explicit templateId is set', () => {
    const organizationTemplate = normalizeOrganizationTemplateForPlanner({
      id: 'org-template-1',
      name: 'Org Structured Template',
      organizationId: 'org-1',
      interviewTypes: ['behavioral', 'technical'],
      structuredQuestionSet: {
        mode: 'HIRING',
        coreQuestionIds: ['beh_deadline_star', 'tech_api_design'],
        randomPoolIds: ['beh_conflict_resolution', 'tech_testing_strategy'],
      },
    }, { fallbackMode: 'HIRING' });

    const plan = buildStructuredInterviewQuestionPlan({
      interview: {
        id: 'int-org-1',
        mode: 'HIRING',
        jobRole: 'Software Engineer',
        experienceLevel: 'mid',
        industry: 'technology',
        interviewTypes: ['behavioral', 'technical'],
        config: {
          questionStrategy: {
            enabled: true,
            mode: 'HYBRID_TEMPLATE',
            templateId: 'org-template-1',
            coreQuestionRatio: 0.5,
            minCoreQuestions: 2,
            allowLlmFill: false,
          },
          advancedSettings: { difficulty: 'medium' },
        },
      },
      totalQuestions: 4,
      templateOverrides: [organizationTemplate],
    });

    expect(plan.enabled).toBe(true);
    expect(plan.template.id).toBe('org-template-1');
    expect(plan.template.source).toBe('ORGANIZATION');
    expect(plan.questions.length).toBe(4);
    expect(plan.questions.some((question) => question.questionBankId === 'beh_deadline_star')).toBe(true);
  });

  it('normalizes legacy organization template question entries', () => {
    const normalized = normalizeOrganizationTemplateForPlanner({
      id: 'org-template-legacy',
      name: 'Legacy Template',
      organizationId: 'org-legacy',
      questions: [
        { questionBankId: 'beh_deadline_star', isCoreQuestion: true },
        { questionBankId: 'beh_conflict_resolution', isCoreQuestion: false },
      ],
    }, { fallbackMode: 'HIRING' });

    expect(normalized).toEqual(expect.objectContaining({
      id: 'org-template-legacy',
      source: 'ORGANIZATION',
    }));
    expect(normalized.coreQuestionIds).toContain('beh_deadline_star');
    expect(normalized.randomPoolIds).toContain('beh_conflict_resolution');
  });

  it('computes weighted rubric score on 0-10 scale', () => {
    const rubric = {
      scale: { min: 1, max: 5 },
      dimensions: [
        { key: 'correctness', weight: 60 },
        { key: 'communication', weight: 40 },
      ],
    };

    const rubricScore = computeRubricWeightedScore({
      rubric,
      criterionScores: [
        { criterion: 'correctness', score: 4 },
        { criterion: 'communication', score: 5 },
      ],
    });

    expect(rubricScore).toBeCloseTo(8.8, 1);
  });
});
