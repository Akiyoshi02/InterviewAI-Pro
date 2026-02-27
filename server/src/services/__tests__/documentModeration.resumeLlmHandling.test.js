import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockGetText = jest.fn();
const mockDestroy = jest.fn();
const verifyResumeDocumentMock = jest.fn();

jest.unstable_mockModule('pdf-parse', () => ({
  PDFParse: jest.fn().mockImplementation(() => ({
    getText: mockGetText,
    destroy: mockDestroy,
  })),
}));

jest.unstable_mockModule('../llm.service.js', () => ({
  LLMService: {
    verifyResumeDocument: verifyResumeDocumentMock,
  },
}));

const { validateResumeDocument } = await import('../documentModeration.service.js');

const VALID_RESUME_TEXT = `
John Doe
Email: john.doe@example.com
Phone: +1 555 123 4567

Professional Summary
Results-driven software engineer with experience delivering user-facing products and platform improvements.

Experience
Senior Software Engineer at Acme Labs
Designed distributed services, improved API reliability, reduced latency, and collaborated with product managers.
Led incident response, authored runbooks, mentored junior engineers, and delivered cross-functional initiatives.

Education
Bachelor of Science in Computer Science, State University

Skills
JavaScript TypeScript Node.js Express React SQL Docker Kubernetes AWS CI/CD Testing Monitoring Observability

Projects
Built a candidate interview assistant with rubric scoring, analytics dashboards, transcription workflows,
role-based access controls, queue processing, secure upload validation, and profile enrichment pipelines.

Certifications
AWS Certified Developer Associate
`.trim();

const createTempResumeFile = async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'resume-moderation-'));
  const filePath = path.join(tempDir, 'resume.pdf');
  await fs.writeFile(filePath, 'stub-pdf-content');
  return { tempDir, filePath };
};

describe('documentModeration resume LLM handling', () => {
  const cleanupDirs = [];

  beforeEach(() => {
    mockGetText.mockResolvedValue({ text: VALID_RESUME_TEXT });
    mockDestroy.mockResolvedValue(undefined);
    verifyResumeDocumentMock.mockReset();
  });

  afterEach(async () => {
    await Promise.all(cleanupDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  it('rejects resume when LLM explicitly returns non-official verdict', async () => {
    const { tempDir, filePath } = await createTempResumeFile();
    cleanupDirs.push(tempDir);

    verifyResumeDocumentMock.mockResolvedValue({
      isOfficial: false,
      confidence: 0.92,
      message: 'The resume contains inconsistencies and lacks official formatting.',
    });

    await expect(validateResumeDocument(filePath, {
      originalname: 'resume.pdf',
      mimetype: 'application/pdf',
      size: 16 * 1024,
    }, {
      expectedFullName: 'John Doe',
      expectedEmail: 'john.doe@example.com',
    })).rejects.toThrow('The resume contains inconsistencies');
  });

  it('falls back to heuristic-only decision when LLM is unavailable', async () => {
    const { tempDir, filePath } = await createTempResumeFile();
    cleanupDirs.push(tempDir);

    verifyResumeDocumentMock.mockRejectedValue(new Error('Ollama API unavailable'));

    const result = await validateResumeDocument(filePath, {
      originalname: 'resume.pdf',
      mimetype: 'application/pdf',
      size: 16 * 1024,
    }, {
      expectedFullName: 'John Doe',
      expectedEmail: 'john.doe@example.com',
    });

    expect(result).toEqual(expect.objectContaining({
      docType: 'pdf',
      analysis: expect.objectContaining({
        wordCount: expect.any(Number),
        matchedSections: expect.any(Number),
      }),
    }));
  });
});
