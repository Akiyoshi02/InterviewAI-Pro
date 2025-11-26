/**
 * LLM Services
 * High-level service functions for common LLM operations
 */

import { callOllama, parseJSONResponse } from './llmClient';

/**
 * Generate interview questions based on job role and context
 */
export async function generateInterviewQuestions(config) {
  const {
    jobRole = 'Software Engineer',
    company = 'Tech Company',
    experienceLevel = 'Mid-level',
    questionCount = 10,
    questionTypes = ['technical', 'behavioral']
  } = config;

  const systemPrompt = `You are an expert interviewer creating questions for a ${jobRole} position at ${company}.
The candidate has ${experienceLevel} experience level.
Generate ${questionCount} diverse interview questions covering: ${questionTypes.join(', ')}.

Return ONLY valid JSON in this format:
{
  "questions": [
    {
      "id": 1,
      "type": "technical|behavioral|situational",
      "question": "The interview question text",
      "expectedAnswerPoints": ["point 1", "point 2"],
      "difficulty": "easy|medium|hard"
    }
  ]
}`;

  const userPrompt = `Generate ${questionCount} interview questions now.`;

  try {
    const response = await callOllama([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      temperature: 0.7,
      max_tokens: 1500
    });

    return parseJSONResponse(response);
  } catch (error) {
    console.error('Error generating questions:', error);
    throw new Error('Failed to generate interview questions');
  }
}

/**
 * Evaluate a candidate's answer
 */
export async function evaluateAnswer(question, answer, context = {}) {
  const systemPrompt = `You are an expert interviewer evaluating a candidate's answer.

Question asked: "${question}"
Candidate's answer: "${answer}"

Evaluate the answer on these criteria:
1. Completeness (0-10)
2. Technical accuracy (0-10) 
3. Communication clarity (0-10)
4. Relevance to question (0-10)

Return ONLY valid JSON:
{
  "scores": {
    "completeness": 8,
    "accuracy": 7,
    "clarity": 9,
    "relevance": 8
  },
  "overallScore": 8,
  "feedback": "Brief constructive feedback",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["area 1", "area 2"],
  "followUpSuggestion": "Optional follow-up question if needed"
}`;

  try {
    const response = await callOllama([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Evaluate the answer now.' }
    ], {
      temperature: 0.6,
      max_tokens: 800
    });

    return parseJSONResponse(response);
  } catch (error) {
    console.error('Error evaluating answer:', error);
    throw new Error('Failed to evaluate answer');
  }
}

/**
 * Alias for evaluateAnswer (for backward compatibility)
 */
export const analyzeAnswer = evaluateAnswer;

/**
 * Generate feedback summary for entire interview
 */
export async function generateInterviewSummary(conversationHistory, candidateInfo) {
  const systemPrompt = `You are an expert interviewer providing a comprehensive interview summary.

Candidate Background: ${candidateInfo?.background || 'Not provided'}
Interview Questions & Answers:
${conversationHistory.map((msg, i) => `${i + 1}. ${msg.role}: ${msg.content}`).join('\n\n')}

Provide a comprehensive evaluation in JSON format:
{
  "overallRating": "excellent|good|fair|needs-improvement",
  "scoreBreakdown": {
    "technical": 8,
    "behavioral": 7,
    "communication": 9
  },
  "keyStrengths": ["strength 1", "strength 2"],
  "areasForImprovement": ["area 1", "area 2"],
  "recommendation": "hire|consider|reject",
  "detailedFeedback": "2-3 paragraph summary",
  "nextSteps": "Suggested next steps"
}`;

  try {
    const response = await callOllama([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate the interview summary now.' }
    ], {
      temperature: 0.5,
      max_tokens: 1200
    });

    return parseJSONResponse(response);
  } catch (error) {
    console.error('Error generating summary:', error);
    throw new Error('Failed to generate interview summary');
  }
}

/**
 * Generate a natural follow-up question
 */
export async function generateFollowUpQuestion(previousAnswer, context) {
  const systemPrompt = `You are an interviewer asking a relevant follow-up question.

Previous answer: "${previousAnswer}"
Context: ${context || 'General interview'}

Generate ONE concise follow-up question (1-2 sentences) that:
- Probes deeper into their answer
- Clarifies ambiguous points
- Explores related experience

Return only the question text, no JSON.`;

  try {
    const response = await callOllama([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate follow-up question.' }
    ], {
      temperature: 0.7,
      max_tokens: 150
    });

    return response.trim();
  } catch (error) {
    console.error('Error generating follow-up:', error);
    throw new Error('Failed to generate follow-up question');
  }
}

/**
 * Generate next interview question based on context
 */
export async function generateNextQuestion(context) {
  const {
    jobRole = 'Software Engineer',
    previousQuestions = [],
    candidateResponses = [],
    questionType = 'technical'
  } = context;

  const systemPrompt = `You are an expert interviewer for a ${jobRole} position.

Previous questions asked: ${previousQuestions.length > 0 ? previousQuestions.join(', ') : 'None yet'}
Question type needed: ${questionType}

Generate ONE relevant interview question that:
- Hasn't been asked before
- Matches the ${questionType} category
- Is appropriate for the role

Return ONLY valid JSON:
{
  "question": "The interview question text",
  "type": "${questionType}",
  "difficulty": "easy|medium|hard",
  "expectedPoints": ["point 1", "point 2"]
}`;

  try {
    const response = await callOllama([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate the next question.' }
    ], {
      temperature: 0.7,
      max_tokens: 300
    });

    return parseJSONResponse(response);
  } catch (error) {
    console.error('Error generating next question:', error);
    throw new Error('Failed to generate next question');
  }
}

/**
 * Analyze speech disfluencies and provide improvement suggestions
 */
export async function analyzeSpeechPattern(transcript, metrics) {
  const systemPrompt = `You are a speech coach analyzing a candidate's speaking pattern.

Transcript: "${transcript}"
Detected Issues:
- Filler words: ${metrics.fillerWords?.join(', ') || 'none'}
- Filler count: ${metrics.count || 0}
- Word count: ${metrics.wordCount || 0}

Provide analysis in JSON:
{
  "severity": "low|moderate|high",
  "confidence": "low|moderate|high",
  "mainIssues": ["issue 1", "issue 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "encouragement": "Brief positive note"
}`;

  try {
    const response = await callOllama([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Analyze the speech pattern.' }
    ], {
      temperature: 0.6,
      max_tokens: 400
    });

    return parseJSONResponse(response);
  } catch (error) {
    console.error('Error analyzing speech:', error);
    return {
      severity: 'low',
      confidence: 'low',
      mainIssues: [],
      suggestions: ['Practice speaking clearly and at a steady pace'],
      encouragement: 'Keep practicing!'
    };
  }
}

/**
 * Generate a personalized study plan based on interview performance
 */
export async function generateStudyPlan(evaluationData) {
  const {
    weakAreas = [],
    overallScore = 0,
    jobRole = 'Software Engineer',
    targetDate = 'in 2 weeks'
  } = evaluationData;

  const systemPrompt = `You are a career coach creating a personalized study plan.

Job Role: ${jobRole}
Current Score: ${overallScore}/10
Weak Areas: ${weakAreas.join(', ') || 'None identified'}
Timeline: ${targetDate}

Create a structured study plan in JSON format:
{
  "overallGoal": "Brief goal statement",
  "timeline": "${targetDate}",
  "weeklyPlan": [
    {
      "week": 1,
      "focus": "Area to focus on",
      "tasks": ["task 1", "task 2", "task 3"],
      "resources": ["resource 1", "resource 2"]
    }
  ],
  "dailyRoutine": {
    "morning": "Morning activity suggestion",
    "afternoon": "Afternoon activity suggestion",
    "evening": "Evening activity suggestion"
  },
  "keyResources": ["resource 1", "resource 2", "resource 3"],
  "practiceExercises": ["exercise 1", "exercise 2"],
  "milestones": ["milestone 1", "milestone 2"],
  "motivationalTip": "Encouraging message"
}`;

  try {
    const response = await callOllama([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate the personalized study plan.' }
    ], {
      temperature: 0.7,
      max_tokens: 1500
    });

    return parseJSONResponse(response);
  } catch (error) {
    console.error('Error generating study plan:', error);
    throw new Error('Failed to generate study plan');
  }
}

/**
 * Conversational response for the AI Career Assistant
 */
export async function generateCareerAssistantResponse(options = {}) {
  const {
    conversation = [],
    userProfile = {},
    recentPerformance = {}
  } = options;

  const limitedConversation = conversation
    ?.filter((msg) => msg && typeof msg.content === 'string' && ['user', 'assistant'].includes(msg.role))
    ?.slice(-12)
    ?.map((msg) => ({
      role: msg.role,
      content: msg.content.trim()
    })) || [];

  const profileSummaryParts = [
    userProfile?.name && `Name: ${userProfile.name}`,
    userProfile?.currentRole && `Current role: ${userProfile.currentRole}`,
    userProfile?.experienceLevel && `Experience: ${userProfile.experienceLevel}`,
    userProfile?.targetRole && `Target role: ${userProfile.targetRole}`,
    userProfile?.industry && `Industry focus: ${userProfile.industry}`,
  ].filter(Boolean);

  const latestSession = recentPerformance?.lastSession || {};
  const latestFeedback = recentPerformance?.latestFeedback || {};
  const performanceSummaryParts = [
    (latestSession?.overallScore || latestFeedback?.overallScore) && `Latest score: ${latestSession?.overallScore || latestFeedback?.overallScore}`,
    latestSession?.jobRole && `Recent session role: ${latestSession.jobRole}`,
    Array.isArray(latestFeedback?.feedback?.strengths) && latestFeedback.feedback.strengths.length > 0 &&
      `Strengths: ${latestFeedback.feedback.strengths.join(', ')}`,
    Array.isArray(latestFeedback?.feedback?.areasForImprovement) && latestFeedback.feedback.areasForImprovement.length > 0 &&
      `Areas to improve: ${latestFeedback.feedback.areasForImprovement.join(', ')}`,
  ].filter(Boolean);

  const contextBlock = [
    'Candidate Profile:',
    profileSummaryParts.length > 0 ? profileSummaryParts.join('\n') : 'Not provided.',
    '',
    'Recent Performance Insights:',
    performanceSummaryParts.length > 0 ? performanceSummaryParts.join('\n') : 'Not available.',
  ].join('\n');

  const systemPrompt = `You are an empathetic AI career coach specializing in interview preparation.
Use the provided context (if any) to deliver actionable, encouraging guidance.

Context:
${contextBlock}

Response requirements:
- Use clear markdown structure (headings, bullet points, bold labels) when it helps readability.
- Provide specific tips or next steps tied to the user's goals or performance.
- Reference recent strengths and improvement areas when available.
- Keep tone supportive and confidence-building.
- If information is missing, ask a concise clarifying question before giving generic advice.`;

  const messagePayload = [
    { role: 'system', content: systemPrompt },
    ...(limitedConversation.length > 0
      ? limitedConversation
      : [{ role: 'user', content: "Greet the candidate and explain how you'll assist with their interview prep." }])
  ];

  try {
    const response = await callOllama(messagePayload, {
      temperature: 0.65,
      max_tokens: 900
    });

    return response.trim();
  } catch (error) {
    console.error('Error generating assistant response:', error);
    throw new Error('Failed to generate career assistant response');
  }
}

export default {
  generateInterviewQuestions,
  evaluateAnswer,
  analyzeAnswer,
  generateInterviewSummary,
  generateFollowUpQuestion,
  generateNextQuestion,
  analyzeSpeechPattern,
  generateStudyPlan,
  generateCareerAssistantResponse
};
