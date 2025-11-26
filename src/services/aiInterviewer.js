/**
 * AI Interviewer Service
 * 
 * This service creates a realistic, interactive AI interviewer that can:
 * - Conduct natural conversations
 * - Ask position-related questions
 * - Listen and evaluate candidate responses
 * - Provide corrections and feedback
 * - Ask follow-up and counter questions
 * - Answer candidate's questions about the role/company
 * - Maintain context throughout the interview
 */

import { callOllama, parseJSONResponse } from './llmClient.js';

/**
 * AI Interviewer Class
 * Manages the entire interview conversation flow
 */
export class AIInterviewer {
  constructor(config = {}) {
    this.config = {
      jobRole: config.jobRole || 'Software Engineer',
      company: config.company || 'Tech Company',
      experienceLevel: config.experienceLevel || 'Mid-level',
      industry: config.industry || 'Technology',
      interviewTypes: config.interviewTypes || ['technical', 'behavioral'],
      interviewDuration: config.interviewDuration || 30,
      totalQuestions: config.totalQuestions || 10,
      ...config
    };
    
    this.conversationHistory = [];
    this.currentPhase = 'introduction'; // introduction, questions, candidate_questions, closing
    this.questionsAsked = 0;
    this.candidateScore = 0;
    this.contextMemory = {
      candidateBackground: null,
      strengths: [],
      weaknesses: [],
      areasToProbe: []
    };
  }

  /**
   * Initialize the interview with a personalized introduction
   */
  async startInterview() {
    const systemPrompt = `You're an interviewer for ${this.config.jobRole} at ${this.config.company}. Welcome the candidate warmly and ask them to introduce themselves. Keep it brief (2-3 sentences).`;

    const userPrompt = `Welcome the candidate and ask for their introduction.`;

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const response = await callOllama(messages, { 
        temperature: 0.8,
        max_tokens: 150
      });

      this.conversationHistory.push({
        role: 'interviewer',
        content: response,
        timestamp: new Date().toISOString(),
        phase: 'introduction'
      });

      return {
        message: response,
        phase: 'introduction',
        nextAction: 'wait_for_introduction'
      };
    } catch (error) {
      console.error('Error starting interview:', error);
      throw new Error('Failed to start interview');
    }
  }

  /**
   * Process candidate's introduction
   */
  async processIntroduction(candidateIntroduction) {
    this.conversationHistory.push({
      role: 'candidate',
      content: candidateIntroduction,
      timestamp: new Date().toISOString(),
      phase: 'introduction'
    });

    const systemPrompt = `You're interviewing for ${this.config.jobRole} at ${this.config.company}.
Candidate introduced themselves. Acknowledge briefly and ask a relevant interview question.

Respond in JSON:
{
  "message": "Brief acknowledgment + your question",
  "type": "behavioral|technical",
  "insights": ["key point 1", "key point 2"]
}`;

    const userPrompt = `Candidate: "${candidateIntroduction}"

Acknowledge and ask first question.`;

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const response = await callOllama(messages, { 
        temperature: 0.7,
        max_tokens: 400
      });

      const parsed = parseJSONResponse(response);
      
      // Update context memory
      this.contextMemory.candidateBackground = parsed.insights?.join(', ') || '';
      this.contextMemory.strengths = parsed.insights || [];
      
      // Update phase
      this.currentPhase = 'questions';
      this.questionsAsked = 1;

      this.conversationHistory.push({
        role: 'interviewer',
        content: parsed.message,
        timestamp: new Date().toISOString(),
        phase: 'questions',
        questionNumber: 1
      });

      return {
        message: parsed.message,
        phase: 'questions',
        questionNumber: 1,
        totalQuestions: this.config.totalQuestions,
        nextAction: 'wait_for_answer'
      };
    } catch (error) {
      console.error('Error processing introduction:', error);
      throw new Error('Failed to process introduction');
    }
  }

  /**
   * Evaluate candidate's answer and determine next action
   * - If answer is good: move to next question
   * - If answer needs clarification: ask follow-up
   * - If answer has errors: provide correction and ask for better response
   */
  async processAnswer(candidateAnswer) {
    this.conversationHistory.push({
      role: 'candidate',
      content: candidateAnswer,
      timestamp: new Date().toISOString(),
      phase: this.currentPhase
    });

    // Get recent context (last 2 exchanges)
    const recentContext = this.conversationHistory
      .slice(-4)
      .map(msg => `${msg.role === 'interviewer' ? 'You' : 'Candidate'}: ${msg.content}`)
      .join('\n');

    const systemPrompt = `You're interviewing for ${this.config.jobRole}. Question ${this.questionsAsked}/${this.config.totalQuestions}.

Recent exchange:
${recentContext}

Evaluate answer (1-10) and respond as interviewer.

JSON format:
{
  "score": 7,
  "action": "next_question|follow_up|correction",
  "message": "Your response + next question if action is next_question"
}

- next_question: Good answer, ask new question
- follow_up: Ask for more detail/example  
- correction: Point out issue, ask again`;

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Evaluate and respond.' }
      ];

      const response = await callOllama(messages, { 
        temperature: 0.6,
        max_tokens: 350
      });

      const parsed = parseJSONResponse(response);

      // Update score
      this.candidateScore += (parsed.score || 5);

      // Determine if moving to next question
      if (parsed.action === 'next_question') {
        this.questionsAsked++;
      }

      this.conversationHistory.push({
        role: 'interviewer',
        content: parsed.message,
        timestamp: new Date().toISOString(),
        phase: 'questions',
        questionNumber: this.questionsAsked,
        actionType: parsed.action,
        evaluation: { score: parsed.score }
      });

      // Check if we should end the question phase
      const shouldEndQuestions = this.questionsAsked >= this.config.totalQuestions;

      return {
        message: parsed.message,
        phase: shouldEndQuestions ? 'candidate_questions' : 'questions',
        questionNumber: this.questionsAsked,
        totalQuestions: this.config.totalQuestions,
        actionType: parsed.action,
        evaluation: { score: parsed.score },
        nextAction: shouldEndQuestions ? 'ask_candidate_questions' : 'wait_for_answer'
      };
    } catch (error) {
      console.error('Error processing answer:', error);
      throw new Error('Failed to process answer');
    }
  }

  /**
   * Handle candidate's questions about the role/company
   */
  async answerCandidateQuestion(candidateQuestion) {
    this.conversationHistory.push({
      role: 'candidate',
      content: candidateQuestion,
      timestamp: new Date().toISOString(),
      phase: 'candidate_questions'
    });

    const systemPrompt = `You are an interviewer for a ${this.config.jobRole} position at ${this.config.company} in the ${this.config.industry} industry.
The candidate is now asking you questions about the role, company, or team.

Company/Role context:
- Job Role: ${this.config.jobRole}
- Company: ${this.config.company}
- Industry: ${this.config.industry}
- Experience Level: ${this.config.experienceLevel}

Your task:
1. Answer their question professionally and thoroughly
2. Be honest and realistic
3. Provide insights that would be valuable to a candidate
4. Ask if they have more questions or if they're ready to conclude

Keep your answer informative but concise (2-3 paragraphs).`;

    const userPrompt = `The candidate asked: "${candidateQuestion}"

Provide a thorough, professional answer.`;

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const response = await callOllama(messages, { 
        temperature: 0.7,
        max_tokens: 500 
      });

      this.conversationHistory.push({
        role: 'interviewer',
        content: response,
        timestamp: new Date().toISOString(),
        phase: 'candidate_questions'
      });

      return {
        message: response,
        phase: 'candidate_questions',
        nextAction: 'wait_for_next_question_or_end'
      };
    } catch (error) {
      console.error('Error answering candidate question:', error);
      throw new Error('Failed to answer candidate question');
    }
  }

  /**
   * Conclude the interview with a summary
   */
  async concludeInterview() {
    this.currentPhase = 'closing';

    const avgScore = this.candidateScore / this.questionsAsked;
    
    const systemPrompt = `You are concluding an interview for a ${this.config.jobRole} position at ${this.config.company}.

Interview Summary:
- Questions asked: ${this.questionsAsked}
- Average performance: ${avgScore.toFixed(1)}/10
- Key strengths observed: ${this.contextMemory.strengths.slice(0, 3).join(', ')}
- Areas for improvement: ${this.contextMemory.weaknesses.slice(0, 2).join(', ')}

Your task:
1. Thank the candidate professionally
2. Briefly mention 1-2 positive observations
3. Explain next steps in the hiring process
4. Encourage them

Keep it warm, professional, and encouraging (2-3 sentences).`;

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Conclude the interview professionally.' }
      ];

      const response = await callOllama(messages, { 
        temperature: 0.7,
        max_tokens: 300 
      });

      this.conversationHistory.push({
        role: 'interviewer',
        content: response,
        timestamp: new Date().toISOString(),
        phase: 'closing'
      });

      return {
        message: response,
        phase: 'closing',
        nextAction: 'interview_complete',
        summary: {
          totalQuestions: this.questionsAsked,
          averageScore: avgScore.toFixed(1),
          strengths: [...new Set(this.contextMemory.strengths)].slice(0, 5),
          weaknesses: [...new Set(this.contextMemory.weaknesses)].slice(0, 3),
          conversationHistory: this.conversationHistory
        }
      };
    } catch (error) {
      console.error('Error concluding interview:', error);
      throw new Error('Failed to conclude interview');
    }
  }

  /**
   * Get current interview state
   */
  getState() {
    return {
      phase: this.currentPhase,
      questionsAsked: this.questionsAsked,
      totalQuestions: this.config.totalQuestions,
      currentScore: this.candidateScore,
      averageScore: this.questionsAsked > 0 ? (this.candidateScore / this.questionsAsked).toFixed(1) : 0,
      conversationLength: this.conversationHistory.length,
      contextMemory: this.contextMemory
    };
  }

  /**
   * Export conversation history
   */
  exportConversation() {
    return {
      config: this.config,
      conversationHistory: this.conversationHistory,
      finalState: this.getState(),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Helper function to create a new AI Interviewer instance
 */
export function createAIInterviewer(config) {
  return new AIInterviewer(config);
}

export default AIInterviewer;
