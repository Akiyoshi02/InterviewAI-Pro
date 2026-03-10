import { describe, expect, it, jest } from '@jest/globals';
import {
  stripUnexpectedFields,
  validationSchemas,
} from '../inputValidation.middleware.js';

describe('interview create validation schema', () => {
  it('keeps ATS hiring linkage fields in allowedFields', () => {
    const fields = validationSchemas.interview.create.allowedFields;
    expect(fields).toContain('candidateId');
    expect(fields).toContain('jobId');
    expect(fields).toContain('jobStage');
    expect(fields).toContain('config');
  });

  it('stripUnexpectedFields preserves interview linkage/config payload fields', () => {
    const middleware = stripUnexpectedFields(validationSchemas.interview.create.allowedFields);
    const req = {
      body: {
        mode: 'HIRING',
        candidateId: 'cand-1',
        jobId: 'job-1',
        jobStage: 'INITIAL_SCREENING',
        config: {
          interviewerName: 'Aiva',
        },
        unknownField: 'should-be-removed',
      },
    };
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.mode).toBe('HIRING');
    expect(req.body.candidateId).toBe('cand-1');
    expect(req.body.jobId).toBe('job-1');
    expect(req.body.jobStage).toBe('INITIAL_SCREENING');
    expect(req.body.config).toEqual({ interviewerName: 'Aiva' });
    expect(req.body.unknownField).toBeUndefined();
  });
});

