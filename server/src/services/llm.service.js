/**
 * FREE Local LLM Service using Ollama
 * No API costs - runs completely locally on your GPU
 * 
 * Setup Instructions:
 * 1. Download Ollama: https://ollama.ai/download
 * 2. Install and start Ollama service
 * 3. Pull a model: `ollama pull llama3.1:8b`
 * 4. Server runs at: http://localhost:11434
 * 
 * Recommended Models (FREE):
 * - llama3.1:8b (Best for interviews, 4.7GB)
 * - mistral:7b (Fast, 4.1GB)
 * - phi3:medium (Efficient, 7.9GB)
 */

import logger from '../utils/logger.js';

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

/**
 * Call Ollama API for chat completions
 */
async function callOllama(messages, options = {}) {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model || DEFAULT_MODEL,
        messages: messages,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          top_p: options.top_p || 0.9,
          num_predict: options.max_tokens || 2000,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.message.content;
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
    // Remove markdown code blocks if present
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    logger.error('Failed to parse JSON response:', text);
    throw new Error('Invalid JSON response from LLM');
  }
}

export class LLMService {
  /**
   * Generate interview questions
   */
  static async generateInterviewQuestions(config) {
    try {
      const systemPrompt = `You are an expert technical interviewer. Generate ${config.totalQuestions || 10} interview questions based on the following criteria:
- Job Role: ${config.jobRole}
- Experience Level: ${config.experienceLevel}
- Industry: ${config.industry}
- Interview Types: ${config.interviewTypes?.join(', ') || 'General'}
- Focus Areas: ${config.skillFocus?.join(', ') || 'General'}

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "questions": [
    {
      "id": 1,
      "type": "behavioral",
      "difficulty": "medium",
      "question": "Question text here",
      "expectedDuration": "3",
      "evaluationCriteria": ["criteria1", "criteria2"]
    }
  ]
}

Types can be: behavioral, technical, coding, system_design
Difficulty can be: easy, medium, hard`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate the interview questions now.' },
      ];

      const response = await callOllama(messages, { max_tokens: 4000, temperature: 0.8 });
      const parsed = parseJSONResponse(response);
      
      return parsed.questions || [];
    } catch (error) {
      logger.error('Error generating interview questions:', error);
      throw error;
    }
  }

  /**
   * Generate interview summary and evaluation
   */
  static async generateInterviewSummary({ interview, questions }) {
    try {
      const qaPairs = questions.map(q => ({
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
}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate the comprehensive evaluation report.' },
      ];

      const response = await callOllama(messages, { max_tokens: 3000, temperature: 0.7 });
      return parseJSONResponse(response);
    } catch (error) {
      logger.error('Error generating interview summary:', error);
      throw error;
    }
  }

  /**
   * Analyze individual answer with STAR method evaluation
   */
  static async analyzeAnswer({ question, answer, criteria, difficulty }) {
    try {
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

      const response = await callOllama(messages, { max_tokens: 2000, temperature: 0.6 });
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
      const context = previousAnswers.slice(-2).map(qa => 
        `Q: ${qa.question}\nA: ${qa.answer}`
      ).join('\n\n');

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
   * Check if Ollama service is running
   */
  static async healthCheck() {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
      if (!response.ok) {
        return { healthy: false, error: 'Ollama service not responding' };
      }
      const data = await response.json();
      return { 
        healthy: true, 
        models: data.models?.map(m => m.name) || [],
        url: OLLAMA_BASE_URL 
      };
    } catch (error) {
      return { 
        healthy: false, 
        error: error.message,
        help: 'Install Ollama from https://ollama.ai and run: ollama pull llama3.1:8b'
      };
    }
  }
}
