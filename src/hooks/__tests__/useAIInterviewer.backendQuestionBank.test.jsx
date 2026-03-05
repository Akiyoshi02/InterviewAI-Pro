import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useAIInterviewer } from '../useAIInterviewer';
import { createAIInterviewer } from '../../services/aiInterviewer';
import InterviewBackendSync from '../../services/interviewBackendSync';

vi.mock('../../services/aiInterviewer', () => ({
  createAIInterviewer: vi.fn(),
}));

vi.mock('../../services/interviewBackendSync', () => ({
  default: vi.fn(),
}));

vi.mock('../../services/speechService', () => ({
  default: {
    speak: vi.fn(async (_message, options = {}) => {
      options.onEnd?.();
    }),
    cancel: vi.fn(),
  },
}));

vi.mock('../../services/speechRecognitionService', () => ({
  default: {
    stop: vi.fn(),
    start: vi.fn(() => false),
    getTranscript: vi.fn(() => ({ final: '', full: '' })),
  },
}));

vi.mock('../../services/audioRecorderService', () => ({
  default: {
    abort: vi.fn(),
    start: vi.fn(async () => false),
    stop: vi.fn(async () => null),
    isRecording: false,
  },
}));

vi.mock('../../services/localWhisperService', () => ({
  checkLocalWhisperHealth: vi.fn(async () => false),
  transcribeWithFallback: vi.fn(async () => ({ text: '' })),
}));

const backendQuestions = [
  { id: 'backend-q1', question: 'Describe a difficult bug you fixed.', type: 'behavioral' },
  { id: 'backend-q2', question: 'How would you scale an API read path?', type: 'technical' },
];

let hookApi = null;

const HookHarness = ({ config }) => {
  hookApi = useAIInterviewer(config);
  return null;
};

describe('useAIInterviewer backend question bank precedence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookApi = null;
  });

  afterEach(() => {
    hookApi = null;
  });

  it('prefers backend question bank when interviewId is provided', async () => {
    const interviewerInstance = {
      startInterview: vi.fn(async () => ({ message: 'Welcome', phase: 'introduction' })),
      getState: vi.fn(() => ({ phase: 'introduction' })),
    };
    createAIInterviewer.mockReturnValue(interviewerInstance);

    const backendSyncInstance = {
      initialize: vi.fn(async () => {}),
      startInterview: vi.fn(async () => {}),
      getQuestions: vi.fn(() => backendQuestions),
      subscribeToRealtime: vi.fn(() => {}),
      destroy: vi.fn(() => {}),
    };
    InterviewBackendSync.mockImplementation(() => backendSyncInstance);

    render(<HookHarness config={{ totalQuestions: 10, questionBank: [{ id: 'local-q', question: 'Local q' }] }} />);

    await act(async () => {
      await hookApi.initializeInterview({ interviewId: 'interview-123' });
    });

    expect(InterviewBackendSync).toHaveBeenCalledWith('interview-123');
    expect(createAIInterviewer).toHaveBeenCalledTimes(1);

    const effectiveConfig = createAIInterviewer.mock.calls[0][0];
    expect(effectiveConfig.totalQuestions).toBe(backendQuestions.length);
    expect(effectiveConfig.questionBank).toEqual([
      {
        id: 'backend-q1',
        question: 'Describe a difficult bug you fixed.',
        questionType: 'behavioral',
      },
      {
        id: 'backend-q2',
        question: 'How would you scale an API read path?',
        questionType: 'technical',
      },
    ]);
  });
});

