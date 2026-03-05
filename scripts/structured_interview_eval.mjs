#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import {
  buildStructuredInterviewQuestionPlan,
  getStructuredInterviewCatalog,
} from '../server/src/services/structuredInterview.service.js';

const DEFAULT_SCENARIOS = [
  {
    name: 'Hiring SWE Mid',
    interview: {
      id: 'scenario-hiring-swe',
      mode: 'HIRING',
      candidateId: 'candidate-a',
      organizationId: 'org-a',
      jobRole: 'Software Engineer',
      experienceLevel: 'mid',
      industry: 'technology',
      interviewTypes: ['behavioral', 'technical', 'system-design', 'coding'],
      skillFocus: ['system-design', 'api-design'],
      config: {
        advancedSettings: { difficulty: 'medium' },
        questionStrategy: {
          enabled: true,
          mode: 'HYBRID_TEMPLATE',
          randomizationScope: 'INTERVIEW',
          coreQuestionRatio: 0.7,
          minCoreQuestions: 4,
        },
      },
    },
    totalQuestions: 8,
  },
  {
    name: 'Hiring Data Mid',
    interview: {
      id: 'scenario-hiring-data',
      mode: 'HIRING',
      candidateId: 'candidate-b',
      organizationId: 'org-a',
      jobRole: 'Data Scientist',
      experienceLevel: 'mid',
      industry: 'technology',
      interviewTypes: ['behavioral', 'technical', 'case-study'],
      skillFocus: ['ml-ops', 'analytics'],
      config: {
        advancedSettings: { difficulty: 'hard' },
        questionStrategy: {
          enabled: true,
          mode: 'HYBRID_TEMPLATE',
          randomizationScope: 'CANDIDATE',
          coreQuestionRatio: 0.65,
          minCoreQuestions: 4,
        },
      },
    },
    totalQuestions: 7,
  },
  {
    name: 'Practice Default',
    interview: {
      id: 'scenario-practice-default',
      mode: 'PRACTICE',
      candidateId: 'candidate-c',
      jobRole: 'Product Manager',
      experienceLevel: 'mid',
      industry: 'technology',
      interviewTypes: ['behavioral', 'case-study'],
      skillFocus: ['prioritization'],
      config: {
        advancedSettings: { difficulty: 'medium' },
      },
    },
    totalQuestions: 6,
  },
  {
    name: 'Practice Structured Override',
    interview: {
      id: 'scenario-practice-structured',
      mode: 'PRACTICE',
      candidateId: 'candidate-d',
      jobRole: 'Software Engineer',
      experienceLevel: 'mid',
      industry: 'technology',
      interviewTypes: ['behavioral', 'technical'],
      skillFocus: ['testing', 'performance'],
      config: {
        advancedSettings: { difficulty: 'medium' },
        questionStrategy: {
          enabled: true,
          mode: 'HYBRID_TEMPLATE',
          templateId: 'practice-general-v1',
          coreQuestionRatio: 0.6,
          minCoreQuestions: 3,
          randomizationScope: 'INTERVIEW',
          allowLlmFill: true,
        },
      },
    },
    totalQuestions: 6,
  },
];

const parseArgs = (argv) => {
  const args = { out: null };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--out') {
      args.out = argv[index + 1] || null;
      index += 1;
    }
  }
  return args;
};

const summarizePlan = (scenarioName, plan, totalQuestions) => {
  const questions = Array.isArray(plan?.questions) ? plan.questions : [];
  const typeCounts = questions.reduce((acc, question) => {
    const type = question?.type || 'UNKNOWN';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const coreCount = Number(plan?.coreQuestionCount) || 0;
  const randomizedCount = Number(plan?.randomizedQuestionCount) || 0;
  const llmFill = Number(plan?.llmFillCount) || 0;
  const denominator = coreCount + randomizedCount + llmFill;

  return {
    scenarioName,
    enabled: Boolean(plan?.enabled),
    templateId: plan?.template?.id || null,
    templateName: plan?.template?.name || null,
    totalQuestionsRequested: totalQuestions,
    totalStructuredQuestions: questions.length,
    coreCount,
    randomizedCount,
    llmFill,
    coreRatio: denominator > 0 ? Number((coreCount / denominator).toFixed(3)) : null,
    typeCounts,
    firstThreeQuestions: questions.slice(0, 3).map((question) => ({
      id: question.id,
      type: question.type,
      isCoreQuestion: Boolean(question.isCoreQuestion),
      text: question.question,
    })),
  };
};

const run = async () => {
  const args = parseArgs(process.argv);
  const catalog = getStructuredInterviewCatalog();

  const results = DEFAULT_SCENARIOS.map((scenario) => {
    const plan = buildStructuredInterviewQuestionPlan({
      interview: scenario.interview,
      totalQuestions: scenario.totalQuestions,
    });
    return summarizePlan(scenario.name, plan, scenario.totalQuestions);
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    catalog: {
      version: catalog?.library?.version,
      totalQuestions: catalog?.library?.totalQuestions,
      totalTemplates: Array.isArray(catalog?.templates) ? catalog.templates.length : 0,
    },
    results,
  };

  const output = JSON.stringify(summary, null, 2);

  if (args.out) {
    const resolved = path.resolve(process.cwd(), args.out);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, output, 'utf-8');
    console.log(`Structured interview evaluation saved to ${resolved}`);
  } else {
    console.log(output);
  }
};

run().catch((error) => {
  console.error('Structured interview evaluation failed:', error?.message || error);
  process.exitCode = 1;
});
