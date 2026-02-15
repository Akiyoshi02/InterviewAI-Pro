/**
 * FREE Local LLM Service using Ollama
 * No API costs - runs completely locally on your GPU
 *
 * Setup Instructions:
 * 1. Download Ollama: https://ollama.ai/download
 * 2. Install and start Ollama service
 * 3. Pull a model: `ollama pull qwen2.5:7b-instruct`
 * 4. Server runs at: http://localhost:11434
 *
 * Recommended Models (FREE):
 * - qwen2.5:7b-instruct (Best mix of quality + speed, 5.4GB)
 * - llama3.1:8b (Generalist, 4.7GB)
 * - mistral:7b (Fast, 4.1GB)
 */

import logger from '../utils/logger.js';

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct';
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
const WHISPER_BASE_URL = process.env.WHISPER_URL || process.env.LOCAL_WHISPER_URL || null;

const QWEN_GENERATION_DEFAULTS = {
  temperature: 0.65,
  top_p: 0.9,
  top_k: 40,
  repeat_penalty: 1.08,
  num_ctx: 8192,
  num_batch: 256,
  gpu_layers: 999,
  num_predict: 4096,
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
 * Call Ollama API for chat completions
 */
async function callOllama(messages, options = {}) {
  try {
    const response = await fetchWithTimeout(
      `${OLLAMA_BASE_URL}/api/chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model || DEFAULT_MODEL,
          messages,
          stream: false,
          options: buildGenerationOptions(options),
        }),
      },
      options.timeoutMs || OLLAMA_REQUEST_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Ollama API returned empty content');
    }
    return content;
  } catch (error) {
    logger.error('Ollama API call failed:', error);
    throw error;
  }
}

/**
 * Parse JSON response from LLM (handles markdown code blocks)
 */
function parseJSONResponse(text) {
  try {
    const raw = typeof text === 'string' ? text : String(text ?? '');
    const cleaned = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    logger.error('Failed to parse JSON response:', text);
    throw new Error('Invalid JSON response from LLM');
  }
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
  /**
   * Generate interview questions
   */
  static async generateInterviewQuestions(config) {
    try {
      const difficulty = config.difficulty || 'medium';
      const personalityId = config.personality;
      const interviewerName = config.interviewerName || 'Your Interviewer';
      const llmOptions = resolveLlmOptions(config?.llmOptions, {
        model: DEFAULT_MODEL,
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
- Types can be: behavioral, technical, coding, system_design
- Generate questions that align with the interviewer style and personality`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate the interview questions now.' },
      ];

      const response = await callOllama(messages, llmOptions);
      const parsed = parseJSONResponse(response);

      return parsed.questions || [];
    } catch (error) {
      logger.error('Error generating interview questions:', error);
      throw error;
    }
  }

  static async repairInterviewSummaryJson({ rawResponse, validationErrors, llmOptions }) {
    const resolvedLlmOptions = resolveLlmOptions(llmOptions, {
      model: DEFAULT_MODEL,
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

    const repairedText = await callOllama(messages, {
      ...resolvedLlmOptions,
      temperature: 0.2,
      max_tokens: Math.min(3000, resolvedLlmOptions.max_tokens || 2000),
    });

    return parseJSONResponse(repairedText);
  }

  /**
   * Generate interview summary and evaluation
   */
  static async generateInterviewSummary({ interview, questions, llmOptions = null }) {
    try {
      const resolvedLlmOptions = resolveLlmOptions(llmOptions, {
        model: DEFAULT_MODEL,
        temperature: 0.7,
        maxTokens: 3000,
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

      const response = await callOllama(messages, resolvedLlmOptions);
      const parsed = parseJSONResponse(response);
      const validation = validateInterviewSummary(parsed);
      if (validation.valid) {
        return normalizeInterviewSummary(parsed);
      }

      logger.warn('Interview summary JSON schema validation failed; attempting one repair pass.', {
        errors: validation.errors,
      });

      const repaired = await this.repairInterviewSummaryJson({
        rawResponse: response,
        validationErrors: validation.errors,
        llmOptions: resolvedLlmOptions,
      });
      const repairedValidation = validateInterviewSummary(repaired);
      if (!repairedValidation.valid) {
        throw createStructuredOutputError(repairedValidation.errors);
      }
      return normalizeInterviewSummary(repaired);
    } catch (error) {
      logger.error('Error generating interview summary:', error);
      throw error;
    }
  }

  /**
   * Analyze individual answer with STAR method evaluation
   */
  static async analyzeAnswer({ question, answer, criteria, difficulty, llmOptions = null }) {
    try {
      const resolvedLlmOptions = resolveLlmOptions(llmOptions, {
        model: DEFAULT_MODEL,
        temperature: 0.6,
        maxTokens: 2000,
      });
      const systemPrompt = `You are an expert interview evaluator. Analyze the candidate's answer using the STAR method (Situation, Task, Action, Result).

Question: ${question}
Candidate's Answer: ${answer}
Expected Criteria: ${criteria?.join(', ') || 'General assessment'}
Difficulty Level: ${difficulty}

Evaluate based on:
1. STAR Structure (Situation, Task, Action, Result)
2. Completeness and accuracy
3. Technical depth (if applicable)
4. Communication clarity
5. Problem-solving approach

Return ONLY valid JSON (no markdown):
{
  "score": 8,
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

      const response = await callOllama(messages, resolvedLlmOptions);
      return parseJSONResponse(response);
    } catch (error) {
      logger.error('Error analyzing answer:', error);
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

      const response = await callOllama(messages, { max_tokens: 500, temperature: 0.8 });
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

      const response = await callOllama(messages, { max_tokens: 400, temperature: 0.3 });
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
      const truncatedText = documentText?.slice(0, 6000) || '';
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

      const response = await callOllama(messages, { max_tokens: 400, temperature: 0.3 });
      return parseJSONResponse(response);
    } catch (error) {
      logger.error('Error verifying resume document with LLM:', error);
      throw error;
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
        help: 'Install Ollama from https://ollama.ai and run: ollama pull qwen2.5:7b-instruct',
      };
    }
  }

  static async getWhisperHealth() {
    if (!WHISPER_BASE_URL) {
      return {
        configured: false,
        reachable: null,
      };
    }

    try {
      const response = await fetchWithTimeout(
        `${WHISPER_BASE_URL.replace(/\/$/, '')}/health`,
        {},
        OLLAMA_HEALTH_TIMEOUT_MS,
      );
      return {
        configured: true,
        reachable: response.ok,
      };
    } catch {
      return {
        configured: true,
        reachable: false,
      };
    }
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
}
