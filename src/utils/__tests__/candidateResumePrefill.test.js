import { describe, it, expect } from 'vitest';
import { deriveCandidatePrefillUpdates } from '../candidateResumePrefill.js';

const baseForm = {
  fullName: '',
  phoneNumber: '',
  targetRole: '',
  experienceLevel: '',
  industry: '',
  highestQualification: '',
  fieldOfStudy: '',
  institutionName: '',
  graduationYear: '',
  location: '',
  careerGoals: '',
  skills: [],
  certifications: [],
  linkedinUrl: '',
  githubUrl: '',
  portfolioUrl: '',
};

describe('deriveCandidatePrefillUpdates', () => {
  it('auto-applies high-confidence values for empty fields', () => {
    const result = deriveCandidatePrefillUpdates(
      baseForm,
      {
        fullName: 'Jane Doe',
        targetRole: 'Software Engineer',
        industry: 'Technology & Software',
        skills: ['React', 'Node.js'],
      },
      {
        confidence: {
          fullName: 0.95,
          targetRole: 0.93,
          industry: 0.9,
          skills: 0.9,
        },
      },
    );

    expect(result.updates).toMatchObject({
      fullName: 'Jane Doe',
      targetRole: 'software-engineer',
      industry: 'technology',
      skills: ['react', 'nodejs'],
    });
    expect(result.suggestions).toHaveLength(0);
  });

  it('adds low-confidence values as suggestions instead of auto-applying', () => {
    const result = deriveCandidatePrefillUpdates(
      baseForm,
      {
        phone: '+94711234567',
        experienceLevel: 'senior',
      },
      {
        confidence: {
          phone: 0.7,
          experienceLevel: 0.6,
        },
      },
    );

    expect(result.updates.phoneNumber).toBeUndefined();
    expect(result.updates.experienceLevel).toBeUndefined();
    expect(result.suggestions.map((item) => item.field)).toEqual(
      expect.arrayContaining(['phoneNumber', 'experienceLevel']),
    );
  });

  it('does not overwrite existing values', () => {
    const result = deriveCandidatePrefillUpdates(
      {
        ...baseForm,
        fullName: 'Existing Name',
        skills: ['python'],
      },
      {
        fullName: 'Parsed Name',
        skills: ['React', 'Node.js'],
      },
      {
        confidence: {
          fullName: 0.99,
          skills: 0.99,
        },
      },
    );

    expect(result.updates.fullName).toBeUndefined();
    expect(result.updates.skills).toBeUndefined();
    expect(result.suggestions).toHaveLength(0);
  });

  it('requires confidence for auto-apply and falls back to suggestions when confidence is missing', () => {
    const result = deriveCandidatePrefillUpdates(baseForm, {
      fullName: 'No Confidence Name',
      targetRole: 'Software Engineer',
    });

    expect(result.updates.fullName).toBeUndefined();
    expect(result.updates.targetRole).toBeUndefined();
    expect(result.suggestions.map((item) => item.field)).toEqual(
      expect.arrayContaining(['fullName', 'targetRole']),
    );
  });
});
