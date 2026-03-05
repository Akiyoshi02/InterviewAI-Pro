import { describe, expect, it } from '@jest/globals';
import { buildStructuredInterviewQuestionPlanAsync } from '../structuredInterview.service.js';

const makeQuestion = (id, prompt, type = 'BEHAVIORAL') => ({
  id,
  prompt,
  type,
  difficulty: 'MEDIUM',
  approved: true,
  reviewStatus: 'APPROVED',
  jobFamilies: ['software-engineering', 'any'],
  experienceLevels: ['junior', 'mid', 'any'],
  industries: ['technology', 'any'],
  skills: [],
  competencies: [],
  evaluationCriteria: [],
});

describe('structuredInterview.service catalog runtime path', () => {
  it('builds practice question plan from approved runtime catalog', async () => {
    const catalog = {
      source: 'FIRESTORE',
      library: {
        version: 'catalog-v3',
        questions: [
          makeQuestion('cat-q1', 'Tell me about a production incident you handled.', 'BEHAVIORAL'),
          makeQuestion('cat-q2', 'How do you design API versioning strategy?', 'TECHNICAL'),
          makeQuestion('cat-q3', 'How would you optimize SQL query performance?', 'TECHNICAL'),
          makeQuestion('cat-q4', 'Explain a trade-off you made in architecture.', 'SYSTEM_DESIGN'),
        ],
      },
      templates: [
        {
          id: 'practice-general-v1',
          name: 'Practice General',
          mode: 'PRACTICE',
          source: 'INTERNAL',
          jobFamilies: ['any'],
          experienceLevels: ['any'],
          interviewTypes: ['BEHAVIORAL', 'TECHNICAL', 'SYSTEM_DESIGN'],
          coreQuestionIds: ['cat-q1', 'cat-q2'],
          randomPoolIds: ['cat-q3', 'cat-q4'],
          enabled: true,
        },
      ],
    };

    const plan = await buildStructuredInterviewQuestionPlanAsync({
      interview: {
        id: 'practice-cat-1',
        mode: 'PRACTICE',
        jobRole: 'Software Engineer',
        experienceLevel: 'mid',
        industry: 'technology',
        interviewTypes: ['behavioral', 'technical', 'system-design'],
        config: {
          questionStrategy: {
            enabled: true,
            mode: 'HYBRID_TEMPLATE',
            templateId: 'practice-general-v1',
            enforceCoreQuestions: true,
            coreQuestionRatio: 0.6,
            minCoreQuestions: 2,
            allowLlmFill: true,
            randomizationScope: 'INTERVIEW',
          },
        },
      },
      totalQuestions: 4,
      catalog,
    });

    expect(plan.enabled).toBe(true);
    expect(plan.questions).toHaveLength(4);
    expect(plan.metadata.libraryVersion).toBe('catalog-v3');
    expect(plan.metadata.catalogSource).toBe('FIRESTORE');
    expect(plan.metadata.approvedPoolSize).toBe(4);
    expect(plan.llmFillCount).toBe(0);
    expect(plan.questions.every((q) => ['cat-q1', 'cat-q2', 'cat-q3', 'cat-q4'].includes(q.questionBankId))).toBe(true);
  });

  it('reports llm fill needed when approved catalog pool is insufficient', async () => {
    const catalog = {
      source: 'FIRESTORE',
      library: {
        version: 'catalog-v4',
        questions: [
          makeQuestion('cat-short-1', 'Share an example of conflict resolution.', 'BEHAVIORAL'),
        ],
      },
      templates: [
        {
          id: 'practice-general-v1',
          name: 'Practice General',
          mode: 'PRACTICE',
          source: 'INTERNAL',
          jobFamilies: ['any'],
          experienceLevels: ['any'],
          interviewTypes: ['BEHAVIORAL'],
          coreQuestionIds: ['cat-short-1'],
          randomPoolIds: [],
          enabled: true,
        },
      ],
    };

    const plan = await buildStructuredInterviewQuestionPlanAsync({
      interview: {
        id: 'practice-cat-2',
        mode: 'PRACTICE',
        jobRole: 'Software Engineer',
        experienceLevel: 'entry',
        interviewTypes: ['behavioral'],
        config: {
          questionStrategy: {
            enabled: true,
            mode: 'HYBRID_TEMPLATE',
            templateId: 'practice-general-v1',
            allowLlmFill: false,
            minCoreQuestions: 1,
            coreQuestionRatio: 0.6,
          },
        },
      },
      totalQuestions: 3,
      catalog,
    });

    expect(plan.enabled).toBe(true);
    expect(plan.questions.length).toBeLessThan(3);
    expect(plan.llmFillCount).toBeGreaterThan(0);
  });
});

