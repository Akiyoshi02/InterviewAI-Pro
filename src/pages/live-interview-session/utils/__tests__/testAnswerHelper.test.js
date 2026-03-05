import { describe, expect, it } from 'vitest';
import { buildSuggestedTestAnswer } from '../testAnswerHelper.js';

describe('buildSuggestedTestAnswer', () => {
  it('returns a role-aware introduction answer in introduction phase', () => {
    const answer = buildSuggestedTestAnswer({
      phase: 'introduction',
      jobRole: 'Backend Engineer',
      experienceLevel: 'Senior',
      industry: 'Fintech',
    });

    expect(answer).toContain('Senior');
    expect(answer).toContain('Backend Engineer');
    expect(answer.toLowerCase()).toContain('fintech');
  });

  it('returns candidate questions in candidate_questions phase', () => {
    const answer = buildSuggestedTestAnswer({
      phase: 'candidate_questions',
      jobRole: 'QA Engineer',
    });

    expect(answer.toLowerCase()).toContain('90 days');
    expect(answer).toContain('?');
  });

  it('returns STAR-style answer for normal interview questions', () => {
    const question = 'Tell me about a time you handled conflict in your team.';
    const answer = buildSuggestedTestAnswer({
      phase: 'questions',
      currentQuestion: question,
    });

    expect(answer).toContain('Situation:');
    expect(answer).toContain('Task:');
    expect(answer).toContain('Action:');
    expect(answer).toContain('Result:');
    expect(answer.toLowerCase()).not.toContain(question.toLowerCase());
  });
});
