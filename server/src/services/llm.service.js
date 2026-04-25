/**
 * FREE Local LLM Service using Ollama
 * No API costs - runs completely locally on your GPU
 *
 * Setup Instructions:
 * 1. Download Ollama: https://ollama.ai/download
 * 2. Install and start Ollama service
 * 3. Pull a model: `ollama pull qwen3:8b`
 * 4. Server runs at: http://localhost:11434
 *
 * Recommended Models (FREE):
 * - qwen3:8b (Best evaluation accuracy + structured output, 5.2GB)
 * - qwen2.5:7b-instruct (Fallback model, 4.7GB)
 */

import logger from '../utils/logger.js';
import {
  getLatestFineTuneQualification,
  MIN_TRAINING_PAIRS_FOR_ACTIVATION,
} from './modelFineTuning.service.js';

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'qwen3:8b';
const DEFAULT_FALLBACK_MODEL = process.env.OLLAMA_FALLBACK_MODEL || 'qwen2.5:7b-instruct';
const FINE_TUNED_MODEL_NAME = `interviewai-${DEFAULT_MODEL.replace(':', '-')}`;
const GROQ_BASE_URL = (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const INTERVIEW_LLM_PROVIDER = String(
  process.env.INTERVIEW_LLM_PROVIDER || (GROQ_API_KEY ? 'groq' : 'ollama'),
).trim().toLowerCase();
const INTERVIEW_GROQ_MODEL = process.env.INTERVIEW_GROQ_MODEL || 'openai/gpt-oss-20b';
const INTERVIEW_GROQ_LIMIT_FALLBACK_TO_OLLAMA = String(
  process.env.INTERVIEW_GROQ_LIMIT_FALLBACK_TO_OLLAMA || 'true',
).trim().toLowerCase() !== 'false';
const GROQ_REQUEST_TIMEOUT_MS = Math.max(
  2000,
  Number.parseInt(process.env.GROQ_REQUEST_TIMEOUT_MS || '45000', 10) || 45000,
);
const GROQ_HEALTH_TIMEOUT_MS = Math.max(
  1000,
  Number.parseInt(process.env.GROQ_HEALTH_TIMEOUT_MS || '5000', 10) || 5000,
);

let _modelRuntimeStatus = {
  totalCalls: 0,
  successfulCalls: 0,
  failedCalls: 0,
  fallbackUsedCalls: 0,
  emptyContentEvents: 0,
  lastOutcome: null,
  lastCallAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastRequestedProvider: null,
  lastSuccessfulProvider: null,
  lastRequestedModel: null,
  lastSuccessfulModel: null,
  lastUsedFallback: false,
  lastFallbackAttempted: false,
  lastAttemptedModels: [],
  lastEmptyContentAt: null,
  lastEmptyContentModel: null,
  lastEmptyContentDoneReason: null,
  lastEmptyContentHadThinking: false,
  lastEmptyContentRetryExhausted: false,
  lastEmptyContentSummary: null,
  lastError: null,
};

let _fineTunedModelAvailable = null;
let _fineTunedModelCheckedAt = 0;
const FINE_TUNE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
let _lastGroqRateLimitSnapshot = null;

/**
 * Check if the fine-tuned model variant exists in Ollama AND meets the
 * minimum training quality gate (MIN_TRAINING_PAIRS_FOR_ACTIVATION).
 *
 * Both checks are cached together for 5 minutes. The quality gate prevents
 * a model trained on too few interviews from being used at runtime — which
 * would introduce scoring inconsistency rather than improving accuracy.
 *
 * Decision logic:
 *  - Model doesn't exist in Ollama            → false (not created yet)
 *  - Model exists but < threshold pairs used  → false (not reliable yet)
 *  - Model exists AND >= threshold pairs used → true  (safe to prefer)
 */
async function isFineTunedModelAvailable() {
  if (_fineTunedModelAvailable !== null && Date.now() - _fineTunedModelCheckedAt < FINE_TUNE_CHECK_INTERVAL_MS) {
    return _fineTunedModelAvailable;
  }

  try {
    // Step 1: Does the model exist in Ollama at all?
    const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FINE_TUNED_MODEL_NAME }),
      signal: AbortSignal.timeout(3000),
    });

    if (!ollamaResponse.ok) {
      _fineTunedModelAvailable = false;
      _fineTunedModelCheckedAt = Date.now();
      return false;
    }

    // Step 2: Was it trained on enough data to be trustworthy?
    const qualification = await getLatestFineTuneQualification();
    if (!qualification.qualifies) {
      logger.info(
        `Fine-tuned model exists but quality gate not met: ` +
        `${qualification.examplesUsed}/${MIN_TRAINING_PAIRS_FOR_ACTIVATION} training pairs. ` +
        `Using base model instead.`,
      );
      _fineTunedModelAvailable = false;
      _fineTunedModelCheckedAt = Date.now();
      return false;
    }

    _fineTunedModelAvailable = true;
  } catch {
    _fineTunedModelAvailable = false;
  }

  _fineTunedModelCheckedAt = Date.now();
  return _fineTunedModelAvailable;
}

/**
 * Resolve which model to use. Prefers fine-tuned model when available,
 * unless the caller explicitly specified a model.
 */
async function resolveModel(requestedModel) {
  if (requestedModel && requestedModel !== DEFAULT_MODEL) {
    return requestedModel;
  }
  const fineTunedAvailable = await isFineTunedModelAvailable();
  return fineTunedAvailable ? FINE_TUNED_MODEL_NAME : DEFAULT_MODEL;
}

const buildModelAttemptOrder = async (requestedModel) => {
  const attempts = [];
  const pushUnique = (modelName) => {
    if (typeof modelName === 'string' && modelName.trim() && !attempts.includes(modelName.trim())) {
      attempts.push(modelName.trim());
    }
  };

  const effectiveModel = await resolveModel(requestedModel);
  pushUnique(effectiveModel);

  // If a fine-tuned variant fails, retry with the base primary model first.
  if (effectiveModel === FINE_TUNED_MODEL_NAME) {
    pushUnique(DEFAULT_MODEL);
  }

  pushUnique(DEFAULT_FALLBACK_MODEL);
  return attempts;
};

const recordModelRuntimeCall = ({
  provider = 'ollama',
  requestedModel = null,
  attemptedModels = [],
  successfulModel = null,
  usedFallback = false,
  fallbackAttempted = false,
  error = null,
} = {}) => {
  const timestamp = new Date().toISOString();
  _modelRuntimeStatus.totalCalls += 1;
  _modelRuntimeStatus.lastCallAt = timestamp;
  _modelRuntimeStatus.lastRequestedProvider = provider;
  _modelRuntimeStatus.lastRequestedModel = requestedModel || null;
  _modelRuntimeStatus.lastAttemptedModels = Array.isArray(attemptedModels)
    ? attemptedModels.filter((item) => typeof item === 'string' && item.trim())
    : [];
  _modelRuntimeStatus.lastUsedFallback = Boolean(usedFallback);
  _modelRuntimeStatus.lastFallbackAttempted = Boolean(fallbackAttempted);
  _modelRuntimeStatus.lastError = error ? String(error) : null;

  if (successfulModel) {
    _modelRuntimeStatus.successfulCalls += 1;
    _modelRuntimeStatus.lastOutcome = 'success';
    _modelRuntimeStatus.lastSuccessAt = timestamp;
    _modelRuntimeStatus.lastSuccessfulProvider = provider;
    _modelRuntimeStatus.lastSuccessfulModel = successfulModel;
    if (usedFallback) {
      _modelRuntimeStatus.fallbackUsedCalls += 1;
    }
    return;
  }

  _modelRuntimeStatus.failedCalls += 1;
  _modelRuntimeStatus.lastOutcome = 'failed';
  _modelRuntimeStatus.lastFailureAt = timestamp;
};

const recordEmptyContentEvent = ({
  model = null,
  doneReason = null,
  hasThinking = false,
  contentChars = 0,
  thinkingChars = 0,
  retriesExhausted = false,
} = {}) => {
  const timestamp = new Date().toISOString();
  _modelRuntimeStatus.emptyContentEvents += 1;
  _modelRuntimeStatus.lastEmptyContentAt = timestamp;
  _modelRuntimeStatus.lastEmptyContentModel = model || null;
  _modelRuntimeStatus.lastEmptyContentDoneReason = doneReason || null;
  _modelRuntimeStatus.lastEmptyContentHadThinking = Boolean(hasThinking);
  _modelRuntimeStatus.lastEmptyContentRetryExhausted = Boolean(retriesExhausted);
  _modelRuntimeStatus.lastEmptyContentSummary = {
    contentChars: Number.isFinite(contentChars) ? contentChars : 0,
    thinkingChars: Number.isFinite(thinkingChars) ? thinkingChars : 0,
    retriesExhausted: Boolean(retriesExhausted),
  };
};

const OLLAMA_REQUEST_TIMEOUT_MS = Math.max(
  2000,
  Number.parseInt(process.env.OLLAMA_REQUEST_TIMEOUT_MS || '45000', 10) || 45000,
);
const OLLAMA_HEALTH_TIMEOUT_MS = Math.max(
  1000,
  Number.parseInt(process.env.OLLAMA_HEALTH_TIMEOUT_MS || '5000', 10) || 5000,
);
const OLLAMA_WARMUP_TIMEOUT_MS = Math.max(
  3000,
  Number.parseInt(process.env.OLLAMA_WARMUP_TIMEOUT_MS || '60000', 10) || 60000,
);
const OLLAMA_THINKING_TIMEOUT_MS = Math.max(
  10000,
  Number.parseInt(process.env.OLLAMA_THINKING_TIMEOUT_MS || '120000', 10) || 120000,
);
const OLLAMA_EMPTY_CONTENT_RETRIES = Math.max(
  0,
  Number.parseInt(process.env.OLLAMA_EMPTY_CONTENT_RETRIES || '1', 10) || 1,
);
const WHISPER_BASE_URL = (
  process.env.WHISPER_URL
  || process.env.WHISPER_SERVER_URL
  || process.env.WHISPER_BASE_URL
  || process.env.LOCAL_WHISPER_URL
  || null
);
const getWhisperBaseUrl = () => WHISPER_BASE_URL?.replace(/\/$/, '') || null;
const THINKING_UNSUPPORTED_ERROR_PATTERN = /does not support thinking/i;
const DEFAULT_NON_THINKING_MODELS = ['qwen2.5:7b-instruct'];
const OLLAMA_NON_THINKING_MODELS = (process.env.OLLAMA_NON_THINKING_MODELS || DEFAULT_NON_THINKING_MODELS.join(','))
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
const _modelsWithoutThinkingSupport = new Set(OLLAMA_NON_THINKING_MODELS);
const GROQ_MODEL_HINT_PATTERN = /^(openai\/|qwen\/|meta-llama\/|llama-)/i;
const isGroqInterviewProviderEnabled = () => INTERVIEW_LLM_PROVIDER === 'groq' && Boolean(GROQ_API_KEY);
const getInterviewProvider = () => (isGroqInterviewProviderEnabled() ? 'groq' : 'ollama');
const getInterviewPrimaryModel = () => (
  getInterviewProvider() === 'groq' ? INTERVIEW_GROQ_MODEL : DEFAULT_MODEL
);
const resolveInterviewModelName = (requestedModel) => {
  const trimmed = typeof requestedModel === 'string' ? requestedModel.trim() : '';
  if (getInterviewProvider() !== 'groq') {
    return trimmed || DEFAULT_MODEL;
  }
  if (trimmed && !trimmed.includes(':') && GROQ_MODEL_HINT_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return INTERVIEW_GROQ_MODEL;
};

const QWEN_GENERATION_DEFAULTS = {
  temperature: 0.65,
  top_p: 0.9,
  top_k: 40,
  repeat_penalty: 1.0,
  num_ctx: 16384,
  num_batch: 256,
  gpu_layers: 999,
  num_predict: 4096,
};
const GROQ_LIMIT_ERROR_PATTERN = /rate[\s_-]*limit|quota|daily[\s_-]*limit|requests?\s*per\s*day|tokens?\s*per\s*day|\brpd\b|\btpd\b|\brpm\b|\btpm\b|exceeded/i;

const mergeAttemptedModels = (...sources) => {
  const merged = [];
  sources.forEach((source) => {
    if (!Array.isArray(source)) return;
    source.forEach((item) => {
      if (typeof item !== 'string') return;
      const trimmed = item.trim();
      if (trimmed && !merged.includes(trimmed)) {
        merged.push(trimmed);
      }
    });
  });
  return merged;
};

const shouldFallbackToOllamaOnGroqError = (error) => {
  if (!INTERVIEW_GROQ_LIMIT_FALLBACK_TO_OLLAMA) return false;
  const status = Number(error?.status);
  const errorText = [error?.message, error?.bodyText, error?.responseText]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(' ');
  return status === 429 || GROQ_LIMIT_ERROR_PATTERN.test(errorText);
};
const readHeaderValue = (headers, headerName) => {
  if (!headers || typeof headers.get !== 'function') return null;
  const value = headers.get(headerName);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};
const parseOptionalInteger = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};
const calculateRemainingPercent = (remaining, limit) => {
  if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((remaining / limit) * 1000) / 10));
};
const snapshotGroqRateLimitHeaders = (headers, meta = {}) => {
  const requestsLimit = parseOptionalInteger(readHeaderValue(headers, 'x-ratelimit-limit-requests'));
  const requestsRemaining = parseOptionalInteger(readHeaderValue(headers, 'x-ratelimit-remaining-requests'));
  const tokensLimit = parseOptionalInteger(readHeaderValue(headers, 'x-ratelimit-limit-tokens'));
  const tokensRemaining = parseOptionalInteger(readHeaderValue(headers, 'x-ratelimit-remaining-tokens'));
  const requestsReset = readHeaderValue(headers, 'x-ratelimit-reset-requests');
  const tokensReset = readHeaderValue(headers, 'x-ratelimit-reset-tokens');
  const retryAfter = readHeaderValue(headers, 'retry-after');

  const hasAnyValue = [
    requestsLimit,
    requestsRemaining,
    tokensLimit,
    tokensRemaining,
    requestsReset,
    tokensReset,
    retryAfter,
  ].some((value) => value !== null && value !== undefined);

  if (!hasAnyValue) {
    return _lastGroqRateLimitSnapshot;
  }

  const snapshot = {
    source: meta.source || 'unknown',
    model: meta.model || null,
    status: Number.isFinite(Number(meta.status)) ? Number(meta.status) : null,
    observedAt: new Date().toISOString(),
    requestsLimit,
    requestsRemaining,
    requestsUsed: Number.isFinite(requestsLimit) && Number.isFinite(requestsRemaining)
      ? Math.max(0, requestsLimit - requestsRemaining)
      : null,
    requestsRemainingPercent: calculateRemainingPercent(requestsRemaining, requestsLimit),
    requestsReset,
    tokensLimit,
    tokensRemaining,
    tokensUsed: Number.isFinite(tokensLimit) && Number.isFinite(tokensRemaining)
      ? Math.max(0, tokensLimit - tokensRemaining)
      : null,
    tokensRemainingPercent: calculateRemainingPercent(tokensRemaining, tokensLimit),
    tokensReset,
    retryAfter,
    semantics: {
      requests: 'Remaining requests refer to Requests Per Day (RPD).',
      tokens: 'Remaining tokens refer to Tokens Per Minute (TPM).',
    },
  };

  _lastGroqRateLimitSnapshot = snapshot;
  return snapshot;
};

const STAR_COMPONENT_SCHEMA = {
  type: 'object',
  properties: {
    present: { type: 'boolean' },
    quality: { type: 'string' },
    feedback: { type: 'string' },
  },
  required: ['present', 'quality', 'feedback'],
};

const STRUCTURED_SCHEMAS = {
  interviewSummary: {
    type: 'object',
    properties: {
      overallScore: { type: 'number' },
      readinessLevel: { type: 'string' },
      strengths: { type: 'array', items: { type: 'string' } },
      weaknesses: { type: 'array', items: { type: 'string' } },
      technicalSkills: {
        type: 'object',
        properties: {
          score: { type: 'number' },
          feedback: { type: 'string' },
        },
        required: ['score', 'feedback'],
      },
      communicationSkills: {
        type: 'object',
        properties: {
          score: { type: 'number' },
          feedback: { type: 'string' },
        },
        required: ['score', 'feedback'],
      },
      recommendations: { type: 'array', items: { type: 'string' } },
      detailedFeedback: { type: 'string' },
    },
    required: [
      'overallScore', 'readinessLevel', 'strengths', 'weaknesses',
      'technicalSkills', 'communicationSkills', 'recommendations', 'detailedFeedback',
    ],
  },

  answerAnalysis: {
    type: 'object',
    properties: {
      score: { type: 'number' },
      criterionScores: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            criterion: { type: 'string' },
            score: { type: 'number' },
            feedback: { type: 'string' },
          },
          required: ['criterion', 'score', 'feedback'],
        },
      },
      starAnalysis: {
        type: 'object',
        properties: {
          situation: STAR_COMPONENT_SCHEMA,
          task: STAR_COMPONENT_SCHEMA,
          action: STAR_COMPONENT_SCHEMA,
          result: STAR_COMPONENT_SCHEMA,
        },
        required: ['situation', 'task', 'action', 'result'],
      },
      strengths: { type: 'array', items: { type: 'string' } },
      weaknesses: { type: 'array', items: { type: 'string' } },
      detailedFeedback: { type: 'string' },
      suggestions: { type: 'array', items: { type: 'string' } },
      coherenceScore: { type: 'number' },
      friendlinessScore: { type: 'number' },
    },
    required: [
      'score', 'starAnalysis', 'strengths', 'weaknesses',
      'detailedFeedback', 'suggestions', 'coherenceScore', 'friendlinessScore',
    ],
  },

  businessDocVerification: {
    type: 'object',
    properties: {
      isOfficial: { type: 'boolean' },
      confidence: { type: 'number' },
      reasons: { type: 'array', items: { type: 'string' } },
    },
    required: ['isOfficial', 'confidence', 'reasons'],
  },

  resumeVerification: {
    type: 'object',
    properties: {
      isOfficial: { type: 'boolean' },
      confidence: { type: 'number' },
      message: { type: 'string' },
    },
    required: ['isOfficial', 'confidence', 'message'],
  },

  questionGeneration: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            type: { type: 'string' },
            difficulty: { type: 'string' },
            question: { type: 'string' },
            expectedDuration: { type: 'string' },
            evaluationCriteria: { type: 'array', items: { type: 'string' } },
          },
          required: ['id', 'type', 'difficulty', 'question', 'expectedDuration', 'evaluationCriteria'],
        },
      },
    },
    required: ['questions'],
  },

  nextQuestion: {
    type: 'object',
    properties: {
      question: { type: 'string' },
      type: { type: 'string' },
      difficulty: { type: 'string' },
      expectedDuration: { type: 'string' },
    },
    required: ['question', 'type', 'difficulty', 'expectedDuration'],
  },

  rubricFollowUp: {
    type: 'object',
    properties: {
      question: { type: 'string' },
      targetCriterion: { type: 'string' },
      rationale: { type: 'string' },
      expectedDuration: { type: 'string' },
    },
    required: ['question', 'targetCriterion', 'rationale', 'expectedDuration'],
  },
};

const buildGenerationOptions = (options = {}) => ({
  ...QWEN_GENERATION_DEFAULTS,
  ...(options.extraOptions || {}),
  temperature: options.temperature ?? QWEN_GENERATION_DEFAULTS.temperature,
  top_p: options.top_p ?? QWEN_GENERATION_DEFAULTS.top_p,
  top_k: options.top_k ?? QWEN_GENERATION_DEFAULTS.top_k,
  repeat_penalty: options.repeat_penalty ?? QWEN_GENERATION_DEFAULTS.repeat_penalty,
  num_ctx: options.num_ctx ?? QWEN_GENERATION_DEFAULTS.num_ctx,
  num_batch: options.num_batch ?? QWEN_GENERATION_DEFAULTS.num_batch,
  gpu_layers: options.gpu_layers ?? QWEN_GENERATION_DEFAULTS.gpu_layers,
  num_predict: options.max_tokens ?? QWEN_GENERATION_DEFAULTS.num_predict,
});

const resolveLlmOptions = (llmOptions, defaults = {}) => {
  const source = llmOptions && typeof llmOptions === 'object' ? llmOptions : {};
  const model = typeof source.model === 'string' && source.model.trim()
    ? source.model.trim()
    : defaults.model;

  const parsedTemperature = Number(source.temperature);
  const temperature = Number.isFinite(parsedTemperature)
    ? Math.min(1, Math.max(0, parsedTemperature))
    : defaults.temperature;

  const rawMaxTokens = source.maxTokens ?? source.max_tokens;
  const parsedMaxTokens = Number(rawMaxTokens);
  const maxTokens = Number.isFinite(parsedMaxTokens)
    ? Math.round(Math.min(32768, Math.max(256, parsedMaxTokens)))
    : defaults.maxTokens;

  return {
    model: model || DEFAULT_MODEL,
    temperature: Number.isFinite(temperature) ? temperature : QWEN_GENERATION_DEFAULTS.temperature,
    max_tokens: Number.isFinite(maxTokens) ? maxTokens : QWEN_GENERATION_DEFAULTS.num_predict,
  };
};

const normalizeStringArray = (value, fallback = []) => {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  return cleaned.length ? cleaned : fallback;
};

const normalizeScore = (value, { min = 0, max = 100, fallback = null } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};

const normalizeFeedbackBlock = (value, fallbackLabel) => {
  const source = value && typeof value === 'object' ? value : {};
  const score = normalizeScore(source.score, { min: 0, max: 100, fallback: null });
  const feedback = typeof source.feedback === 'string' && source.feedback.trim()
    ? source.feedback.trim()
    : `${fallbackLabel} assessment unavailable.`;
  return { score, feedback };
};

const normalizeInterviewSummary = (value) => {
  const source = value && typeof value === 'object' ? value : {};
  return {
    overallScore: normalizeScore(source.overallScore, { min: 0, max: 100, fallback: null }),
    readinessLevel: typeof source.readinessLevel === 'string' && source.readinessLevel.trim()
      ? source.readinessLevel.trim()
      : 'Not Assessed',
    strengths: normalizeStringArray(source.strengths, []),
    weaknesses: normalizeStringArray(source.weaknesses, []),
    technicalSkills: normalizeFeedbackBlock(source.technicalSkills, 'Technical skills'),
    communicationSkills: normalizeFeedbackBlock(source.communicationSkills, 'Communication skills'),
    recommendations: normalizeStringArray(source.recommendations, []),
    detailedFeedback: typeof source.detailedFeedback === 'string' && source.detailedFeedback.trim()
      ? source.detailedFeedback.trim()
      : 'Detailed feedback unavailable.',
  };
};

const validateInterviewSummary = (value) => {
  const errors = [];
  if (!value || typeof value !== 'object') {
    return { valid: false, errors: ['Response must be an object'] };
  }

  const overallScore = Number(value.overallScore);
  if (!Number.isFinite(overallScore) || overallScore < 0 || overallScore > 100) {
    errors.push('overallScore must be a number between 0 and 100');
  }

  if (typeof value.readinessLevel !== 'string' || !value.readinessLevel.trim()) {
    errors.push('readinessLevel must be a non-empty string');
  }

  if (!Array.isArray(value.strengths)) {
    errors.push('strengths must be an array of strings');
  }

  if (!Array.isArray(value.weaknesses)) {
    errors.push('weaknesses must be an array of strings');
  }

  const validateFeedbackBlock = (fieldName) => {
    const block = value[fieldName];
    if (!block || typeof block !== 'object') {
      errors.push(`${fieldName} must be an object`);
      return;
    }
    const blockScore = Number(block.score);
    if (!Number.isFinite(blockScore) || blockScore < 0 || blockScore > 100) {
      errors.push(`${fieldName}.score must be a number between 0 and 100`);
    }
    if (typeof block.feedback !== 'string' || !block.feedback.trim()) {
      errors.push(`${fieldName}.feedback must be a non-empty string`);
    }
  };

  validateFeedbackBlock('technicalSkills');
  validateFeedbackBlock('communicationSkills');

  if (!Array.isArray(value.recommendations)) {
    errors.push('recommendations must be an array of strings');
  }

  if (typeof value.detailedFeedback !== 'string' || !value.detailedFeedback.trim()) {
    errors.push('detailedFeedback must be a non-empty string');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const createStructuredOutputError = (errors = []) => {
  const error = new Error(`Invalid structured interview summary output: ${errors.join('; ')}`);
  error.code = 'LLM_STRUCTURED_OUTPUT_INVALID';
  error.validationErrors = errors;
  return error;
};

const fetchWithTimeout = async (url, init = {}, timeoutMs = OLLAMA_REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Request timed out after ${timeoutMs}ms`);
      timeoutError.code = 'ETIMEDOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Strip Qwen3 thinking blocks from model output.
 * Safety net in case the model emits <think>…</think> blocks despite
 * the think:false API parameter — ensures downstream consumers always
 * receive clean content.
 */
const stripThinkingTags = (text) => text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
const cloneJsonSchema = (schema) => (
  schema && typeof schema === 'object'
    ? JSON.parse(JSON.stringify(schema))
    : null
);
const toGroqResponseFormat = (schema, schemaName = 'interview_structured_output') => {
  const clonedSchema = cloneJsonSchema(schema);
  if (!clonedSchema) return undefined;
  const normalizedName = String(schemaName || 'interview_structured_output')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'interview_structured_output';
  return {
    type: 'json_schema',
    json_schema: {
      name: normalizedName,
      strict: false,
      schema: clonedSchema,
    },
  };
};
const extractGroqMessageContent = (message) => {
  if (!message) return '';
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item?.type === 'text' && typeof item?.text === 'string') return item.text;
        return '';
      })
      .join('')
      .trim();
  }
  return '';
};
async function callGroq(messages, options = {}) {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API key is not configured');
  }

  const modelName = resolveInterviewModelName(options.model);
  const requestBody = {
    model: modelName,
    messages,
    stream: false,
    temperature: options.temperature ?? QWEN_GENERATION_DEFAULTS.temperature,
    max_completion_tokens: options.max_tokens ?? QWEN_GENERATION_DEFAULTS.num_predict,
    ...(options.format
      ? { response_format: toGroqResponseFormat(options.format, options.responseSchemaName || modelName) }
      : {}),
  };

  try {
    const response = await fetchWithTimeout(
      `${GROQ_BASE_URL}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      },
      options.timeoutMs || GROQ_REQUEST_TIMEOUT_MS,
    );
    snapshotGroqRateLimitHeaders(response.headers, {
      source: 'chat_completions',
      model: modelName,
      status: response.status,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const groqError = new Error(`Groq API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText.slice(0, 300)}` : ''}`);
      groqError.status = response.status;
      groqError.statusText = response.statusText;
      groqError.bodyText = errorText;
      throw groqError;
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message;
    const refusal = typeof message?.refusal === 'string' ? message.refusal.trim() : '';
    if (refusal) {
      throw new Error(`Groq model refused the request: ${refusal}`);
    }

    const content = stripThinkingTags(extractGroqMessageContent(message));
    if (!content) {
      throw new Error('Groq API returned empty content');
    }

    recordModelRuntimeCall({
      provider: 'groq',
      requestedModel: modelName,
      attemptedModels: [modelName],
      successfulModel: modelName,
      usedFallback: false,
      fallbackAttempted: false,
    });

    if (options.returnMetadata) {
      return {
        content,
        model: modelName,
        provider: 'groq',
        usedFallback: false,
        attemptedModels: [modelName],
        fallbackAttempted: false,
      };
    }

    return content;
  } catch (error) {
    if (!options.skipFailureRuntimeRecord) {
      recordModelRuntimeCall({
        provider: 'groq',
        requestedModel: modelName,
        attemptedModels: [modelName],
        successfulModel: null,
        usedFallback: false,
        fallbackAttempted: false,
        error: error?.message || String(error),
      });
    }
    throw error;
  }
}
const callInterviewLLM = async (messages, options = {}) => {
  if (getInterviewProvider() === 'groq') {
    const groqModel = resolveInterviewModelName(options.model);
    try {
      return await callGroq(messages, {
        ...options,
        model: groqModel,
        skipFailureRuntimeRecord: true,
      });
    } catch (error) {
      if (!shouldFallbackToOllamaOnGroqError(error)) {
        recordModelRuntimeCall({
          provider: 'groq',
          requestedModel: groqModel,
          attemptedModels: [groqModel],
          successfulModel: null,
          usedFallback: false,
          fallbackAttempted: false,
          error: error?.message || String(error),
        });
        throw error;
      }

      logger.warn('Groq interview model hit a quota/rate limit; falling back to local Ollama.', {
        groqModel,
        fallbackModel: DEFAULT_MODEL,
        error: error?.message || String(error),
      });

      return callOllama(messages, {
        ...options,
        model: DEFAULT_MODEL,
        runtimeProvider: 'groq->ollama',
        runtimeRequestedModel: groqModel,
        runtimeAttemptedModelsPrefix: [groqModel],
        runtimeForceUsedFallback: true,
        runtimeForceFallbackAttempted: true,
      });
    }
  }
  return callOllama(messages, options);
};

/**
 * Call Ollama API for chat completions.
 * Supports configurable thinking mode (options.think) and structured output
 * enforcement via JSON schema (options.format). Evaluation tasks enable
 * thinking for deeper reasoning; conversational tasks disable it for speed.
 *
 * Set options.returnMetadata=true to receive model routing details alongside
 * the generated content.
 */
async function callOllama(messages, options = {}) {
  const modelAttempts = await buildModelAttemptOrder(options.model);
  const requestedModel = typeof options?.model === 'string' && options.model.trim()
    ? options.model.trim()
    : null;
  const runtimeProvider = typeof options?.runtimeProvider === 'string' && options.runtimeProvider.trim()
    ? options.runtimeProvider.trim()
    : 'ollama';
  const runtimeRequestedModel = typeof options?.runtimeRequestedModel === 'string' && options.runtimeRequestedModel.trim()
    ? options.runtimeRequestedModel.trim()
    : requestedModel;
  const runtimeAttemptedModels = mergeAttemptedModels(options?.runtimeAttemptedModelsPrefix, modelAttempts);
  const requestedThink = options.think ?? false;
  let fallbackAttempted = false;
  let lastError = null;

  for (let index = 0; index < modelAttempts.length; index += 1) {
    const modelName = modelAttempts[index];
    let modelError = null;
    const resolvedThink = Boolean(requestedThink);
    let thinkValue = resolvedThink;
    let sendThinkParameter = !_modelsWithoutThinkingSupport.has(modelName);
    let emptyContentRetries = 0;

    while (true) {
      try {
        const response = await fetchWithTimeout(
          `${OLLAMA_BASE_URL}/api/chat`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: modelName,
              messages,
              stream: false,
              ...(sendThinkParameter ? { think: thinkValue } : {}),
              ...(options.format ? { format: options.format } : {}),
              options: buildGenerationOptions(options),
            }),
          },
          options.timeoutMs || OLLAMA_REQUEST_TIMEOUT_MS,
        );

        if (!response.ok) {
          let bodyMessage = '';
          let rawBodyText = '';
          try {
            const bodyText = await response.text();
            rawBodyText = bodyText || '';
            if (bodyText) {
              try {
                const bodyJson = JSON.parse(bodyText);
                if (typeof bodyJson?.error === 'string') {
                  bodyMessage = ` - ${bodyJson.error}`;
                } else {
                  bodyMessage = ` - ${bodyText.slice(0, 200)}`;
                }
              } catch {
                bodyMessage = bodyText.slice(0, 200) ? ` - ${bodyText.slice(0, 200)}` : '';
              }
            }
          } catch (_) {
            // ignore body read errors
          }

          const isThinkingUnsupported = (
            response.status === 400
            && sendThinkParameter
            && THINKING_UNSUPPORTED_ERROR_PATTERN.test(rawBodyText || bodyMessage)
          );

          if (isThinkingUnsupported) {
            _modelsWithoutThinkingSupport.add(modelName);
            sendThinkParameter = false;
            logger.warn('Ollama model does not support thinking; retrying without think parameter.', {
              model: modelName,
            });
            continue;
          }

          const message = `Ollama API error: ${response.status} ${response.statusText}${bodyMessage}`;
          logger.error('Ollama API error response', {
            model: modelName,
            status: response.status,
            statusText: response.statusText,
            body: bodyMessage,
          });
          throw new Error(message);
        }

        const data = await response.json();
        const content = data?.message?.content;
        if (typeof content !== 'string' || !content.trim()) {
          const thinking = data?.message?.thinking;
          const hasThinking = typeof thinking === 'string' && Boolean(thinking.trim());
          const emptyContentDiagnostics = {
            model: modelName,
            doneReason: data?.done_reason || null,
            hasThinking,
            contentChars: typeof content === 'string' ? content.length : 0,
            thinkingChars: hasThinking ? thinking.trim().length : 0,
            promptEvalCount: Number.isFinite(data?.prompt_eval_count) ? data.prompt_eval_count : null,
            evalCount: Number.isFinite(data?.eval_count) ? data.eval_count : null,
          };

          // Some models occasionally return only `message.thinking` with empty `message.content`
          // when thinking is enabled. Retry same model with explicit think:false first.
          if (sendThinkParameter && thinkValue && hasThinking) {
            recordEmptyContentEvent({
              model: modelName,
              doneReason: data?.done_reason || null,
              hasThinking,
              contentChars: typeof content === 'string' ? content.length : 0,
              thinkingChars: hasThinking ? thinking.trim().length : 0,
              retriesExhausted: false,
            });
            thinkValue = false;
            logger.warn('Ollama returned thinking-only output; retrying same model with think:false.', {
              ...emptyContentDiagnostics,
            });
            continue;
          }

          if (emptyContentRetries < OLLAMA_EMPTY_CONTENT_RETRIES) {
            emptyContentRetries += 1;
            recordEmptyContentEvent({
              model: modelName,
              doneReason: data?.done_reason || null,
              hasThinking,
              contentChars: typeof content === 'string' ? content.length : 0,
              thinkingChars: hasThinking ? thinking.trim().length : 0,
              retriesExhausted: false,
            });
            logger.warn('Ollama API returned empty content; retrying same model.', {
              retryAttempt: emptyContentRetries,
              maxRetries: OLLAMA_EMPTY_CONTENT_RETRIES,
              ...emptyContentDiagnostics,
            });
            continue;
          }
          recordEmptyContentEvent({
            model: modelName,
            doneReason: data?.done_reason || null,
            hasThinking,
            contentChars: typeof content === 'string' ? content.length : 0,
            thinkingChars: hasThinking ? thinking.trim().length : 0,
            retriesExhausted: true,
          });
          logger.error('Ollama API kept returning empty content after retries.', {
            maxRetries: OLLAMA_EMPTY_CONTENT_RETRIES,
            ...emptyContentDiagnostics,
          });
          throw new Error('Ollama API returned empty content');
        }
        const usedFallback = index > 0;
        const runtimeUsedFallback = typeof options?.runtimeForceUsedFallback === 'boolean'
          ? options.runtimeForceUsedFallback
          : usedFallback;
        const runtimeFallbackAttempted = typeof options?.runtimeForceFallbackAttempted === 'boolean'
          ? options.runtimeForceFallbackAttempted
          : fallbackAttempted;
        const cleanedContent = stripThinkingTags(content);
        recordModelRuntimeCall({
          provider: runtimeProvider,
          requestedModel: runtimeRequestedModel,
          attemptedModels: runtimeAttemptedModels,
          successfulModel: modelName,
          usedFallback: runtimeUsedFallback,
          fallbackAttempted: runtimeFallbackAttempted,
        });
        if (options.returnMetadata) {
          return {
            content: cleanedContent,
            model: modelName,
            provider: runtimeProvider,
            usedFallback: runtimeUsedFallback,
            attemptedModels: [...runtimeAttemptedModels],
            fallbackAttempted: runtimeFallbackAttempted,
          };
        }
        return cleanedContent;
      } catch (error) {
        modelError = error;
        break;
      }
    }

    lastError = modelError;
    const nextModel = modelAttempts[index + 1] || null;
    if (nextModel) {
      fallbackAttempted = true;
      logger.warn('Ollama call failed, retrying with fallback model.', {
        failedModel: modelName,
        fallbackModel: nextModel,
        error: modelError?.message || String(modelError),
      });
      continue;
    }

    logger.error('Ollama API call failed:', {
      model: modelName,
      error: modelError?.message || String(modelError),
    });
    recordModelRuntimeCall({
      provider: runtimeProvider,
      requestedModel: runtimeRequestedModel,
      attemptedModels: runtimeAttemptedModels,
      successfulModel: null,
      usedFallback: typeof options?.runtimeForceUsedFallback === 'boolean'
        ? options.runtimeForceUsedFallback
        : false,
      fallbackAttempted: typeof options?.runtimeForceFallbackAttempted === 'boolean'
        ? options.runtimeForceFallbackAttempted
        : fallbackAttempted,
      error: modelError?.message || String(modelError),
    });
    throw modelError;
  }

  recordModelRuntimeCall({
    provider: runtimeProvider,
    requestedModel: runtimeRequestedModel,
    attemptedModels: runtimeAttemptedModels,
    successfulModel: null,
    usedFallback: typeof options?.runtimeForceUsedFallback === 'boolean'
      ? options.runtimeForceUsedFallback
      : false,
    fallbackAttempted: typeof options?.runtimeForceFallbackAttempted === 'boolean'
      ? options.runtimeForceFallbackAttempted
      : fallbackAttempted,
    error: lastError?.message || 'Ollama API call failed',
  });
  throw lastError || new Error('Ollama API call failed');
}

/**
 * Parse JSON response from LLM (handles markdown code blocks and Qwen3 thinking tags)
 */
function parseJSONResponse(text) {
  try {
    const raw = typeof text === 'string' ? text : String(text ?? '');
    const noThink = raw.replace(/<think>[\s\S]*?<\/think>/g, '');
    const cleaned = noThink.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    logger.error('Failed to parse JSON response:', text);
    throw new Error('Invalid JSON response from LLM');
  }
}

function extractLlmResponseContent(response) {
  if (typeof response === 'string') {
    return response;
  }
  if (response && typeof response === 'object' && typeof response.content === 'string') {
    return response.content;
  }
  return String(response ?? '');
}

function extractLlmResponseMetadata(response) {
  if (!response || typeof response !== 'object' || typeof response === 'string') {
    return {
      provider: null,
      model: null,
      usedFallback: false,
      attemptedModels: [],
      fallbackAttempted: false,
    };
  }

  return {
    provider: typeof response.provider === 'string' ? response.provider : null,
    model: typeof response.model === 'string' ? response.model : null,
    usedFallback: Boolean(response.usedFallback),
    attemptedModels: Array.isArray(response.attemptedModels)
      ? response.attemptedModels.filter((item) => typeof item === 'string' && item.trim())
      : [],
    fallbackAttempted: Boolean(response.fallbackAttempted),
  };
}

// Personality descriptions for backend use
const PERSONALITY_DESCRIPTIONS = {
  'professional-encouraging': 'Professional, thorough, and encouraging. Maintains a balanced and supportive approach, providing constructive feedback while keeping the candidate at ease.',
  'warm-insightful': 'Warm, insightful, and detail-oriented. Has a friendly and empathetic style, showing genuine interest in responses and helping candidates showcase their best self.',
  'strategic-analytical': 'Strategic, analytical, and forward-thinking. Takes a thoughtful and methodical approach, asking probing questions that reveal deep thinking and strategic capabilities.',
  'experienced-challenging': 'Experienced, challenging, and insightful. Uses a rigorous and thought-provoking style, pushing candidates to demonstrate their true expertise and problem-solving abilities.',
  'data-driven-methodical': 'Data-driven, methodical, and curious. Takes an evidence-based and systematic approach, asking questions that require concrete examples and measurable outcomes.',
  'fast-paced-innovative': 'Fast-paced, innovative, and results-oriented. Uses a dynamic and action-focused style, moving quickly through questions while emphasizing practical results and innovation.',
  'user-focused-empathetic': 'User-focused, empathetic, and creative. Takes a human-centered and understanding approach, emphasizing how solutions impact real people and communities.',
  'collaborative-team-oriented': 'Collaborative, team-oriented, and inclusive. Emphasizes teamwork and diverse perspectives, asking questions that reveal how candidates work with others.',
  'direct-transparent': 'Direct, transparent, and candid. Uses straightforward and honest communication, asking clear questions and providing direct feedback.',
  'growth-oriented-developmental': 'Growth-oriented, developmental, and supportive. Focuses on learning and continuous improvement, helping candidates reflect on their experiences and growth potential.',
  'conversational-authentic': 'Conversational, authentic, and relatable. Uses a natural and genuine interaction style, making the interview feel like a real conversation between professionals.',
  'outcome-focused-metrics': 'Outcome-focused, metrics-driven, and results-oriented. Emphasizes measurable impact and performance, asking questions that reveal concrete achievements and quantifiable results.',
};

function getPersonalityDescription(personalityId) {
  return PERSONALITY_DESCRIPTIONS[personalityId] || PERSONALITY_DESCRIPTIONS['professional-encouraging'];
}

export class LLMService {
  static getRuntimeModelStatus() {
    return {
      primaryModel: DEFAULT_MODEL,
      fallbackModel: DEFAULT_FALLBACK_MODEL,
      fineTunedModel: FINE_TUNED_MODEL_NAME,
      interviewProvider: getInterviewProvider(),
      interviewModel: getInterviewPrimaryModel(),
      interviewFallbackModel: DEFAULT_MODEL,
      interviewGroqLimitFallbackToOllama: INTERVIEW_GROQ_LIMIT_FALLBACK_TO_OLLAMA,
      groqRateLimits: _lastGroqRateLimitSnapshot ? { ..._lastGroqRateLimitSnapshot } : null,
      groqConfigured: Boolean(GROQ_API_KEY),
      ..._modelRuntimeStatus,
      lastAttemptedModels: Array.isArray(_modelRuntimeStatus.lastAttemptedModels)
        ? [..._modelRuntimeStatus.lastAttemptedModels]
        : [],
    };
  }

  /**
   * Generate interview questions
   */
  static async generateInterviewQuestions(config) {
    try {
      const difficulty = config.difficulty || 'medium';
      const personalityId = config.personality;
      const interviewerName = config.interviewerName || 'Your Interviewer';
      const llmOptions = resolveLlmOptions(config?.llmOptions, {
        model: getInterviewPrimaryModel(),
        temperature: 0.8,
        maxTokens: 4000,
      });

      let personalityContext = '';
      if (personalityId) {
        const personalityDesc = getPersonalityDescription(personalityId);
        personalityContext = `\n\nInterviewer Style: ${personalityDesc}`;
      }

      const difficultyInstruction = difficulty === 'easy'
        ? 'Basic questions suitable for junior candidates. Focus on fundamental concepts and straightforward scenarios.'
        : difficulty === 'hard'
          ? 'Challenging questions requiring deep expertise. Include complex scenarios, edge cases, and advanced problem-solving.'
          : 'Moderate questions appropriate for mid-level candidates. Balance between fundamentals and advanced topics.';

      const systemPrompt = `You are ${interviewerName}, an expert technical interviewer. Generate ${config.totalQuestions || 10} interview questions based on the following criteria:
- Job Role: ${config.jobRole}
- Experience Level: ${config.experienceLevel}
- Industry: ${config.industry}
- Interview Types: ${config.interviewTypes?.join(', ') || 'General'}
- Focus Areas: ${config.skillFocus?.join(', ') || 'General'}
- Difficulty Level: ${difficulty} - ${difficultyInstruction}${personalityContext}

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "questions": [
    {
      "id": 1,
      "type": "behavioral",
      "difficulty": "${difficulty}",
      "question": "Question text here",
      "expectedDuration": "3",
      "evaluationCriteria": ["criteria1", "criteria2"]
    }
  ]
}

Important:
- ALL questions must have difficulty set to "${difficulty}"
- Match the difficulty level: ${difficultyInstruction}
- Types can be: behavioral, technical, coding, system_design, case_study, situational
- Generate questions that align with the interviewer style and personality`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate the interview questions now.' },
      ];

      const response = await callInterviewLLM(messages, {
        ...llmOptions,
        format: STRUCTURED_SCHEMAS.questionGeneration,
        responseSchemaName: 'interview_question_generation',
      });
      const parsed = parseJSONResponse(response);

      return parsed.questions || [];
    } catch (error) {
      logger.error('Error generating interview questions:', error);
      throw error;
    }
  }

  static async repairInterviewSummaryJson({ rawResponse, validationErrors, llmOptions }) {
    const resolvedLlmOptions = resolveLlmOptions(llmOptions, {
      model: getInterviewPrimaryModel(),
      temperature: 0.2,
      maxTokens: 2000,
    });

    const prompt = `Fix the following invalid JSON so it strictly matches this schema and return JSON only:
{
  "overallScore": number (0-100),
  "readinessLevel": string,
  "strengths": string[],
  "weaknesses": string[],
  "technicalSkills": { "score": number (0-100), "feedback": string },
  "communicationSkills": { "score": number (0-100), "feedback": string },
  "recommendations": string[],
  "detailedFeedback": string
}
Validation errors:
${(validationErrors || []).join('; ') || 'Unknown'}

Invalid payload:
${rawResponse}`;

    const messages = [
      { role: 'system', content: 'You are a strict JSON repair assistant.' },
      { role: 'user', content: prompt },
    ];

    const repairedResponse = await callInterviewLLM(messages, {
      ...resolvedLlmOptions,
      temperature: 0.2,
      max_tokens: Math.min(3000, resolvedLlmOptions.max_tokens || 2000),
      format: STRUCTURED_SCHEMAS.interviewSummary,
      responseSchemaName: 'interview_summary_repair',
      returnMetadata: true,
    });

    return {
      payload: parseJSONResponse(extractLlmResponseContent(repairedResponse)),
      meta: extractLlmResponseMetadata(repairedResponse),
    };
  }

  /**
   * Generate interview summary and evaluation
   */
  static async generateInterviewSummary({ interview, questions, llmOptions = null }) {
    try {
      const resolvedLlmOptions = resolveLlmOptions(llmOptions, {
        model: getInterviewPrimaryModel(),
        temperature: 0.5,
        maxTokens: 4000,
      });
      const qaPairs = questions.map((q) => ({
        question: q.question,
        answer: q.answer || 'Not answered',
        score: q.score || 0,
      }));

      const systemPrompt = `You are an expert interview evaluator. Generate a comprehensive interview summary.

Interview Configuration:
- Position: ${interview.jobRole}
- Experience Level: ${interview.experienceLevel}
- Industry: ${interview.industry}
- Total Questions: ${questions.length}

Questions and Answers:
${JSON.stringify(qaPairs, null, 2)}

Provide a detailed evaluation. Return ONLY valid JSON (no markdown):
{
  "overallScore": 75,
  "readinessLevel": "Intermediate",
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "technicalSkills": {
    "score": 70,
    "feedback": "Detailed technical feedback"
  },
  "communicationSkills": {
    "score": 80,
    "feedback": "Detailed communication feedback"
  },
  "recommendations": ["recommendation1", "recommendation2"],
  "detailedFeedback": "Overall detailed feedback about the interview performance"
}
When relevant (e.g. if the candidate seemed nervous or rushed), include in recommendations one brief, supportive tip for managing anxiety or building confidence (e.g. pausing before answering, using STAR structure, or practising aloud).`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate the comprehensive evaluation report.' },
      ];

      const response = await callInterviewLLM(messages, {
        ...resolvedLlmOptions,
        think: true,
        format: STRUCTURED_SCHEMAS.interviewSummary,
        timeoutMs: OLLAMA_THINKING_TIMEOUT_MS,
        responseSchemaName: 'interview_summary',
        returnMetadata: true,
      });
      const parsed = parseJSONResponse(extractLlmResponseContent(response));
      const responseMeta = extractLlmResponseMetadata(response);
      const validation = validateInterviewSummary(parsed);
      if (validation.valid) {
        return {
          ...normalizeInterviewSummary(parsed),
          _meta: responseMeta,
        };
      }

      logger.warn('Interview summary JSON schema validation failed; attempting one repair pass.', {
        errors: validation.errors,
      });

      const repaired = await this.repairInterviewSummaryJson({
        rawResponse: extractLlmResponseContent(response),
        validationErrors: validation.errors,
        llmOptions: resolvedLlmOptions,
      });
      const repairedValidation = validateInterviewSummary(repaired.payload);
      if (!repairedValidation.valid) {
        throw createStructuredOutputError(repairedValidation.errors);
      }
      return {
        ...normalizeInterviewSummary(repaired.payload),
        _meta: repaired.meta,
      };
    } catch (error) {
      logger.error('Error generating interview summary:', error);
      throw error;
    }
  }

  /**
   * Analyze individual answer with STAR method evaluation
   */
  static async analyzeAnswer({ question, answer, criteria, difficulty, rubric = null, llmOptions = null }) {
    try {
      const resolvedLlmOptions = resolveLlmOptions(llmOptions, {
        model: getInterviewPrimaryModel(),
        temperature: 0.45,
        maxTokens: 3000,
      });
      const rubricJson = rubric && typeof rubric === 'object'
        ? JSON.stringify(rubric, null, 2)
        : 'None provided';
      const systemPrompt = `You are an expert interview evaluator. Analyze the candidate's answer using the STAR method (Situation, Task, Action, Result).

Question: ${question}
Candidate's Answer: ${answer}
Expected Criteria: ${criteria?.join(', ') || 'General assessment'}
Difficulty Level: ${difficulty}
Rubric (JSON): ${rubricJson}

Evaluate based on:
1. STAR Structure (Situation, Task, Action, Result)
2. Completeness and accuracy
3. Technical depth (if applicable)
4. Communication clarity
5. Problem-solving approach
6. Rubric dimensions (if rubric provided)

Return ONLY valid JSON (no markdown):
{
  "score": 8,
  "criterionScores": [
    { "criterion": "dimension name", "score": 4, "feedback": "..." }
  ],
  "starAnalysis": {
    "situation": { "present": true, "quality": "good", "feedback": "..." },
    "task": { "present": true, "quality": "good", "feedback": "..." },
    "action": { "present": true, "quality": "excellent", "feedback": "..." },
    "result": { "present": false, "quality": "missing", "feedback": "..." }
  },
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1"],
  "detailedFeedback": "Overall feedback about the answer",
  "suggestions": ["suggestion1", "suggestion2"],
  "coherenceScore": 8,
  "friendlinessScore": 9
}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Analyze this answer and provide structured feedback.' },
      ];

      const response = await callInterviewLLM(messages, {
        ...resolvedLlmOptions,
        think: true,
        format: STRUCTURED_SCHEMAS.answerAnalysis,
        timeoutMs: OLLAMA_THINKING_TIMEOUT_MS,
        responseSchemaName: 'interview_answer_analysis',
      });
      return parseJSONResponse(response);
    } catch (error) {
      logger.error('Error analyzing answer:', error);
      throw error;
    }
  }

  /**
   * Generate a focused follow-up question aligned to weak rubric criteria.
   */
  static async generateRubricFollowUpQuestion({
    question,
    answer,
    analysis,
    rubric,
    llmOptions = null,
  }) {
    try {
      const resolvedLlmOptions = resolveLlmOptions(llmOptions, {
        model: getInterviewPrimaryModel(),
        temperature: 0.4,
        maxTokens: 800,
      });

      const criterionScores = Array.isArray(analysis?.criterionScores) ? analysis.criterionScores : [];
      const weakCriteria = criterionScores
        .map((item) => ({
          criterion: item?.criterion || item?.key || '',
          score: Number(item?.score),
          feedback: item?.feedback || '',
        }))
        .filter((item) => item.criterion && Number.isFinite(item.score))
        .sort((left, right) => left.score - right.score)
        .slice(0, 2);

      const prompt = `Create ONE short interview follow-up question that helps the candidate improve weak areas.

Original Question:
${question}

Candidate Answer:
${answer}

Current Analysis:
${JSON.stringify({
        score: analysis?.score ?? null,
        weaknesses: analysis?.weaknesses || [],
        criterionScores: weakCriteria,
      }, null, 2)}

Rubric:
${JSON.stringify(rubric || {}, null, 2)}

Constraints:
- Ask exactly one follow-up question.
- Target one weak rubric criterion.
- Keep it specific and fair.
- No hints that reveal the ideal answer.
- Max 30 words.

Return JSON only:
{
  "question": "follow-up question text",
  "targetCriterion": "criterion name",
  "rationale": "short reason",
  "expectedDuration": "2"
}`;

      const messages = [
        { role: 'system', content: 'You are a structured interview assistant.' },
        { role: 'user', content: prompt },
      ];

      const response = await callInterviewLLM(messages, {
        ...resolvedLlmOptions,
        format: STRUCTURED_SCHEMAS.rubricFollowUp,
        responseSchemaName: 'interview_rubric_follow_up',
      });
      return parseJSONResponse(response);
    } catch (error) {
      logger.error('Error generating rubric follow-up question:', error);
      throw error;
    }
  }

  /**
   * Generate next question dynamically based on context
   */
  static async generateNextQuestion({ currentQuestion, totalQuestions, config, previousAnswers = [] }) {
    try {
      const context = previousAnswers.slice(-2).map((qa) =>
        `Q: ${qa.question}\nA: ${qa.answer}`)
        .join('\n\n');

      const systemPrompt = `You are conducting an interview for a ${config.jobRole} position at ${config.experienceLevel} level in the ${config.industry} industry.

Current progress: Question ${currentQuestion} of ${totalQuestions}

Previous conversation:
${context || 'This is the first question.'}

Generate the next appropriate question based on the conversation flow. Return ONLY valid JSON:
{
  "question": "Your next interview question here",
  "type": "behavioral",
  "difficulty": "medium",
  "expectedDuration": "3"
}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate the next question.' },
      ];

      const response = await callInterviewLLM(messages, {
        max_tokens: 500,
        temperature: 0.8,
        model: getInterviewPrimaryModel(),
        format: STRUCTURED_SCHEMAS.nextQuestion,
        responseSchemaName: 'interview_next_question',
      });
      return parseJSONResponse(response);
    } catch (error) {
      logger.error('Error generating next question:', error);
      throw error;
    }
  }

  /**
   * Verify whether a business document appears official
   */
  static async verifyBusinessDocument({ documentText, summary }) {
    try {
      const truncatedText = documentText?.slice(0, 8000) || '';
      const systemPrompt = `You are a compliance analyst. Determine whether the provided text comes from an official business registration/tax/license certificate.

Provide a JSON response with:
{
  "isOfficial": true,
  "confidence": 0.85,
  "reasons": ["brief reason 1", "brief reason 2"]
}

Confidence should be between 0 and 1.`;

      const userContent = [
        'Document Summary:',
        summary || 'None',
        '',
        'Document Extract:',
        truncatedText || 'No text available.',
      ].join('\n');

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ];

      const response = await callOllama(messages, {
        max_tokens: 600,
        temperature: 0.3,
        think: true,
        format: STRUCTURED_SCHEMAS.businessDocVerification,
        timeoutMs: OLLAMA_THINKING_TIMEOUT_MS,
      });
      return parseJSONResponse(response);
    } catch (error) {
      logger.error('Error verifying business document with LLM:', error);
      throw error;
    }
  }

  /**
   * Verify whether a resume looks authentic
   */
  static async verifyResumeDocument({ documentText, summary, expectedName }) {
    try {
      // Keep payload smaller to avoid Ollama context/OOM issues (500)
      const truncatedText = documentText?.slice(0, 4000) || '';
      const systemPrompt = `You are a resume compliance checker. Determine whether the text appears to be a real job resume for ${expectedName || 'the candidate'}.

Return strict JSON:
{
  "isOfficial": true,
  "confidence": 0.9,
  "message": "short reason"
}

Confidence must be between 0 and 1.`;

      const userContent = [
        'Resume Summary:',
        summary || 'None',
        '',
        'Resume Extract:',
        truncatedText || 'No text available.',
      ].join('\n');

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ];

      const response = await callOllama(messages, {
        max_tokens: 600,
        temperature: 0.3,
        num_ctx: 4096,
        think: true,
        format: STRUCTURED_SCHEMAS.resumeVerification,
        timeoutMs: OLLAMA_THINKING_TIMEOUT_MS,
        returnMetadata: true,
      });
      const parsedVerdict = parseJSONResponse(response.content);
      return {
        ...parsedVerdict,
        _meta: {
          model: response.model || null,
          usedFallback: Boolean(response.usedFallback),
          attemptedModels: Array.isArray(response.attemptedModels) ? response.attemptedModels : [],
          fallbackAttempted: Boolean(response.fallbackAttempted),
        },
      };
    } catch (error) {
      logger.error('Error verifying resume document with LLM:', error);
      throw error;
    }
  }

  static async getInterviewProviderHealth() {
    const provider = getInterviewProvider();

    if (provider !== 'groq') {
      return {
        provider,
        configured: true,
        reachable: true,
        modelReady: true,
        expectedModel: DEFAULT_MODEL,
        url: OLLAMA_BASE_URL,
        rateLimits: _lastGroqRateLimitSnapshot ? { ..._lastGroqRateLimitSnapshot } : null,
      };
    }

    if (!GROQ_API_KEY) {
      return {
        provider: 'groq',
        configured: false,
        reachable: false,
        modelReady: false,
        expectedModel: INTERVIEW_GROQ_MODEL,
        url: GROQ_BASE_URL,
        rateLimits: _lastGroqRateLimitSnapshot ? { ..._lastGroqRateLimitSnapshot } : null,
        error: 'Groq API key not configured',
      };
    }

    try {
      const response = await fetchWithTimeout(
        `${GROQ_BASE_URL}/models`,
        {
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
        },
        GROQ_HEALTH_TIMEOUT_MS,
      );
      const rateLimits = snapshotGroqRateLimitHeaders(response.headers, {
        source: 'models_health',
        model: INTERVIEW_GROQ_MODEL,
        status: response.status,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return {
          provider: 'groq',
          configured: true,
          reachable: false,
          modelReady: false,
          expectedModel: INTERVIEW_GROQ_MODEL,
          url: GROQ_BASE_URL,
          rateLimits: rateLimits ? { ...rateLimits } : null,
          error: `Groq API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText.slice(0, 200)}` : ''}`,
        };
      }

      const data = await response.json();
      const models = Array.isArray(data?.data)
        ? data.data.map((item) => item?.id).filter(Boolean)
        : [];

      return {
        provider: 'groq',
        configured: true,
        reachable: true,
        modelReady: models.includes(INTERVIEW_GROQ_MODEL),
        expectedModel: INTERVIEW_GROQ_MODEL,
        models,
        url: GROQ_BASE_URL,
        rateLimits: rateLimits ? { ...rateLimits } : null,
      };
    } catch (error) {
      return {
        provider: 'groq',
        configured: true,
        reachable: false,
        modelReady: false,
        expectedModel: INTERVIEW_GROQ_MODEL,
        url: GROQ_BASE_URL,
        rateLimits: _lastGroqRateLimitSnapshot ? { ..._lastGroqRateLimitSnapshot } : null,
        error: error?.message || 'Groq provider check failed',
      };
    }
  }

  /**
   * Check if Ollama service is running.
   */
  static async healthCheck({ expectedModel = DEFAULT_MODEL } = {}) {
    try {
      const response = await fetchWithTimeout(
        `${OLLAMA_BASE_URL}/api/tags`,
        {},
        OLLAMA_HEALTH_TIMEOUT_MS,
      );
      if (!response.ok) {
        return {
          healthy: false,
          modelReady: false,
          expectedModel,
          error: 'Ollama service not responding',
        };
      }
      const data = await response.json();
      const models = (data.models || []).map((model) => model?.name).filter(Boolean);
      const modelReady = models.includes(expectedModel);
      return {
        healthy: true,
        modelReady,
        expectedModel,
        models,
        url: OLLAMA_BASE_URL,
      };
    } catch (error) {
      return {
        healthy: false,
        modelReady: false,
        expectedModel,
        error: error.message,
        help: 'Install Ollama from https://ollama.ai and run: ollama pull qwen3:8b && ollama pull qwen2.5:7b-instruct',
      };
    }
  }

  static async getWhisperHealth() {
    const whisperBaseUrl = getWhisperBaseUrl();
    if (!whisperBaseUrl) {
      return {
        configured: false,
        reachable: null,
      };
    }

    try {
      const response = await fetchWithTimeout(
        `${whisperBaseUrl}/health`,
        {},
        OLLAMA_HEALTH_TIMEOUT_MS,
      );
      const payload = response.ok
        ? await response.json().catch(() => null)
        : null;
      return {
        configured: true,
        reachable: response.ok,
        ...(payload && typeof payload === 'object'
          ? {
            status: payload.status || null,
            model: payload.model || null,
            device: payload.device || null,
            computeType: payload.compute_type || null,
          }
          : {}),
      };
    } catch {
      return {
        configured: true,
        reachable: false,
      };
    }
  }

  static async getWhisperModels() {
    const whisperBaseUrl = getWhisperBaseUrl();
    if (!whisperBaseUrl) {
      const error = new Error('Whisper service is not configured');
      error.code = 'WHISPER_NOT_CONFIGURED';
      throw error;
    }

    const response = await fetchWithTimeout(
      `${whisperBaseUrl}/models`,
      {},
      OLLAMA_HEALTH_TIMEOUT_MS,
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const error = new Error(errorText || `Whisper models request failed with status ${response.status}`);
      error.code = 'WHISPER_MODELS_FAILED';
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  static async proxyWhisperTranscription({
    audioBuffer,
    fileName = 'recording.webm',
    mimeType = 'audio/webm',
    language = 'en',
    task = 'transcribe',
  } = {}) {
    const whisperBaseUrl = getWhisperBaseUrl();
    if (!whisperBaseUrl) {
      const error = new Error('Whisper service is not configured');
      error.code = 'WHISPER_NOT_CONFIGURED';
      throw error;
    }

    if (!audioBuffer || !audioBuffer.length) {
      const error = new Error('No audio data provided for transcription');
      error.code = 'WHISPER_AUDIO_REQUIRED';
      throw error;
    }

    const formData = new FormData();
    const audioFile = new File([audioBuffer], String(fileName || 'recording.webm'), {
      type: String(mimeType || 'audio/webm'),
    });

    formData.append('audio', audioFile);
    formData.append('language', String(language || 'en').trim() || 'en');
    formData.append('task', task === 'translate' ? 'translate' : 'transcribe');

    const response = await fetchWithTimeout(
      `${whisperBaseUrl}/transcribe`,
      {
        method: 'POST',
        body: formData,
      },
      OLLAMA_THINKING_TIMEOUT_MS,
    );

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const error = new Error(payload?.error || `Whisper transcription failed with status ${response.status}`);
      error.code = 'WHISPER_TRANSCRIPTION_FAILED';
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  /**
   * Warm the configured model so first scoring request is less likely to timeout.
   */
  static async warmUp({ model = DEFAULT_MODEL } = {}) {
    try {
      await callOllama(
        [
          { role: 'system', content: 'You are a lightweight model warm-up probe.' },
          { role: 'user', content: 'Reply with {"ok": true}' },
        ],
        {
          model,
          temperature: 0,
          max_tokens: 64,
          timeoutMs: OLLAMA_WARMUP_TIMEOUT_MS,
        },
      );
      return { ok: true, model, url: OLLAMA_BASE_URL };
    } catch (error) {
      return { ok: false, model, url: OLLAMA_BASE_URL, error: error.message };
    }
  }

  /**
   * Generic text generation with a system + user message.
   * Returns raw text response.
   */
  static async generateWithFallback({ systemPrompt, userMessage, llmOptions = {} }) {
    const resolvedOptions = resolveLlmOptions(llmOptions, {
      model: DEFAULT_MODEL,
      temperature: 0.3,
      maxTokens: 1000,
    });
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];
    return callOllama(messages, {
      ...resolvedOptions,
      timeoutMs: OLLAMA_THINKING_TIMEOUT_MS,
    });
  }
}
