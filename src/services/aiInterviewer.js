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

const DEFAULT_MAX_FOLLOW_UPS_PER_QUESTION = 2;
const REPEATED_ANSWER_FORCE_ADVANCE_THRESHOLD = 2;
const MESSAGE_SIMILARITY_THRESHOLD = 0.86;
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'could', 'did',
  'do', 'for', 'from', 'how', 'i', 'in', 'is', 'it', 'me', 'of', 'on', 'or', 'please',
  'the', 'this', 'to', 'we', 'what', 'when', 'with', 'would', 'you', 'your',
]);

const INTERVIEW_SCHEMAS = {
  introduction: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      type: { type: 'string' },
      insights: { type: 'array', items: { type: 'string' } },
    },
    required: ['message', 'type', 'insights'],
  },
  answerEvaluation: {
    type: 'object',
    properties: {
      score: { type: 'number' },
      action: { type: 'string' },
      questionType: { type: 'string' },
      message: { type: 'string' },
    },
    required: ['score', 'action', 'questionType', 'message'],
  },
};

/**
 * AI Interviewer Class
 * Manages the entire interview conversation flow
 */
export class AIInterviewer {
  constructor(config = {}) {
    const advancedSettings = config?.advancedSettings || {};
    const interviewTypes = Array.isArray(config.interviewTypes) && config.interviewTypes.length > 0
      ? config.interviewTypes
      : ['technical', 'behavioral'];
    this.config = {
      jobRole: config.jobRole || 'Software Engineer',
      company: config.company || 'Tech Company',
      experienceLevel: config.experienceLevel || 'Mid-level',
      industry: config.industry || 'Technology',
      interviewTypes,
      interviewDuration: config.interviewDuration || 30,
      totalQuestions: config.totalQuestions || 10,
      skillFocus: config.skillFocus || advancedSettings.skillFocus || [],
      followUpQuestions: config.followUpQuestions ?? advancedSettings.followUpQuestions ?? true,
      practiceMode: config.practiceMode ?? advancedSettings.practiceMode ?? false,
      language: config.language || advancedSettings.language || 'en',
      personality: config.personality || null,
      interviewerName: config.interviewerName || 'AI Interviewer',
      ...config
    };

    this.questionBank = this.normalizeQuestionBank(config.questionBank || config.questions);
    if (this.questionBank.length > 0) {
      this.config.totalQuestions = this.questionBank.length;
    }
    const configuredFollowUpLimit = Number(
      config.maxFollowUpsPerQuestion ?? advancedSettings.maxFollowUpsPerQuestion,
    );
    this.maxFollowUpsPerQuestion = Number.isFinite(configuredFollowUpLimit) && configuredFollowUpLimit >= 0
      ? configuredFollowUpLimit
      : DEFAULT_MAX_FOLLOW_UPS_PER_QUESTION;
    
    this.conversationHistory = [];
    this.currentPhase = 'introduction'; // introduction, questions, candidate_questions, closing
    this.questionsAsked = 0;
    this.currentQuestionIndex = -1;
    this.followUpAttemptsForCurrentQuestion = 0;
    this.lastAnswerSignature = null;
    this.repeatedAnswerCount = 0;
    this.candidateScore = 0;
    this.contextMemory = {
      candidateBackground: null,
      strengths: [],
      weaknesses: [],
      areasToProbe: []
    };
  }

  normalizeQuestionBank(rawQuestions = []) {
    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
      return [];
    }

    return rawQuestions
      .map((entry, index) => {
        if (typeof entry === 'string') {
          const text = entry.trim();
          if (!text) return null;
          return {
            id: `q_${index + 1}`,
            question: text,
            questionType: this.config?.interviewTypes?.[index % this.config.interviewTypes.length] || 'behavioral',
          };
        }

        if (!entry || typeof entry !== 'object') return null;
        const questionText = String(
          entry.question
          || entry.questionText
          || entry.prompt
          || '',
        ).trim();
        if (!questionText) return null;

        return {
          id: entry.id || `q_${index + 1}`,
          question: questionText,
          questionType: String(
            entry.questionType
            || entry.type
            || this.config?.interviewTypes?.[index % this.config.interviewTypes.length]
            || 'behavioral',
          ).toLowerCase(),
          rubric: entry.rubric || null,
        };
      })
      .filter(Boolean);
  }

  getQuestionFromBank(index) {
    if (!Array.isArray(this.questionBank) || index < 0 || index >= this.questionBank.length) {
      return null;
    }
    return this.questionBank[index];
  }

  buildQuestionPrompt(question, index) {
    if (!question?.question) return '';
    return `Question ${index + 1}/${this.config.totalQuestions}: ${question.question}`;
  }

  buildAnswerSignature(answer) {
    return String(answer || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 220);
  }

  trackRepeatedAnswer(answer) {
    const signature = this.buildAnswerSignature(answer);
    if (!signature) {
      this.repeatedAnswerCount = 0;
      this.lastAnswerSignature = null;
      return 0;
    }

    if (signature === this.lastAnswerSignature) {
      this.repeatedAnswerCount += 1;
    } else {
      this.repeatedAnswerCount = 0;
      this.lastAnswerSignature = signature;
    }
    return this.repeatedAnswerCount;
  }

  resetQuestionAttemptState() {
    this.followUpAttemptsForCurrentQuestion = 0;
    this.repeatedAnswerCount = 0;
    this.lastAnswerSignature = null;
  }

  normalizeMessageForComparison(message) {
    return String(message || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  tokenizeForSimilarity(message) {
    return this.normalizeMessageForComparison(message)
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !STOPWORDS.has(token));
  }

  computeMessageSimilarity(messageA, messageB) {
    const tokensA = this.tokenizeForSimilarity(messageA);
    const tokensB = this.tokenizeForSimilarity(messageB);
    if (!tokensA.length || !tokensB.length) return 0;

    const setB = new Set(tokensB);
    const overlap = tokensA.filter((token) => setB.has(token)).length;
    return overlap / Math.max(Math.min(tokensA.length, tokensB.length), 1);
  }

  isNearDuplicateMessage(candidateMessage, previousMessage) {
    const normalizedCandidate = this.normalizeMessageForComparison(candidateMessage);
    const normalizedPrevious = this.normalizeMessageForComparison(previousMessage);
    if (!normalizedCandidate || !normalizedPrevious) return false;
    if (normalizedCandidate === normalizedPrevious) return true;
    if (
      normalizedCandidate.length > 40
      && normalizedPrevious.length > 40
      && (normalizedCandidate.includes(normalizedPrevious) || normalizedPrevious.includes(normalizedCandidate))
    ) {
      return true;
    }
    return this.computeMessageSimilarity(normalizedCandidate, normalizedPrevious) >= MESSAGE_SIMILARITY_THRESHOLD;
  }

  getRecentInterviewerMessages(limit = 6) {
    return this.conversationHistory
      .filter((entry) => entry.role === 'interviewer')
      .slice(-limit)
      .map((entry) => String(entry.content || '').trim())
      .filter(Boolean);
  }

  buildDeterministicFollowUpMessage({ currentQuestionText = '', attempt = 1 }) {
    const basePrompts = [
      'Please give one concrete example with the exact action you took, the communication method you used, and the measurable outcome.',
      'Use STAR briefly and include specifics: what artifact or forum you used (for example doc, dashboard, or meeting), what trade-off you presented, and the final decision.',
      'Add detail on stakeholder alignment: who needed convincing, what options were compared, and which metric proved the chosen approach was right.',
    ];
    const selectedPrompt = basePrompts[Math.max(attempt - 1, 0) % basePrompts.length];
    if (!currentQuestionText) return selectedPrompt;
    return `${selectedPrompt} Stay focused on this question: ${currentQuestionText}`;
  }

  ensureNonRepetitiveMessage({ message, action, currentQuestionText }) {
    const normalizedMessage = String(message || '').trim();
    if (!normalizedMessage) {
      return this.buildDeterministicFollowUpMessage({
        currentQuestionText,
        attempt: this.followUpAttemptsForCurrentQuestion + 1,
      });
    }

    if (action === 'next_question') return normalizedMessage;

    const recentMessages = this.getRecentInterviewerMessages(6);
    const isDuplicate = recentMessages.some((previousMessage) =>
      this.isNearDuplicateMessage(normalizedMessage, previousMessage),
    );

    if (!isDuplicate) return normalizedMessage;

    return this.buildDeterministicFollowUpMessage({
      currentQuestionText,
      attempt: this.followUpAttemptsForCurrentQuestion + 1,
    });
  }

  splitIntoSentences(message) {
    const normalized = String(message || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return [];

    const segments = normalized.split(/([.?!])/g);
    const sentences = [];
    let current = '';

    segments.forEach((segment) => {
      const token = String(segment || '');
      if (!token) return;
      current += token;
      if (token === '.' || token === '?' || token === '!') {
        if (current.trim()) sentences.push(current.trim());
        current = '';
      }
    });

    if (current.trim()) sentences.push(current.trim());
    return sentences;
  }

  extractFeedbackOnlyForBankMode(message) {
    const sentences = this.splitIntoSentences(message);
    if (!sentences.length) return '';

    const nonQuestionSentences = sentences.filter((sentence) => !sentence.includes('?'));
    const feedback = (nonQuestionSentences.length > 0 ? nonQuestionSentences : [sentences[0]])
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return feedback;
  }

  composeBankTransitionMessage({ feedbackMessage, nextQuestion, nextIndex }) {
    const feedback = this.extractFeedbackOnlyForBankMode(feedbackMessage) || 'Thanks for your answer.';
    return `${feedback} ${this.buildQuestionPrompt(nextQuestion, nextIndex)}`.trim();
  }

  buildFallbackInterviewerResponse({ message, phase, questionNumber, questionType, actionType, nextAction, score = 5 }) {
    const fallbackMessage = String(message || '').trim() || 'Thanks. Let us continue.';
    this.currentPhase = phase;
    this.conversationHistory.push({
      role: 'interviewer',
      content: fallbackMessage,
      timestamp: new Date().toISOString(),
      phase,
      questionNumber,
      actionType,
      questionType,
      evaluation: { score, fallback: true },
    });

    return {
      message: fallbackMessage,
      phase,
      questionNumber,
      totalQuestions: this.config.totalQuestions,
      actionType,
      questionType,
      evaluation: { score, fallback: true },
      nextAction,
      fallback: true,
    };
  }

  buildFallbackQuestionAdvance({ feedbackMessage = 'Thanks for your answer.' } = {}) {
    this.resetQuestionAttemptState();
    if (this.questionBank.length > 0) {
      const nextIndex = this.currentQuestionIndex + 1;
      const nextQuestion = this.getQuestionFromBank(nextIndex);

      if (nextQuestion) {
        this.currentQuestionIndex = nextIndex;
        this.questionsAsked = nextIndex + 1;
        return this.buildFallbackInterviewerResponse({
          message: this.composeBankTransitionMessage({
            feedbackMessage,
            nextQuestion,
            nextIndex,
          }),
          phase: 'questions',
          questionNumber: this.questionsAsked,
          questionType: nextQuestion.questionType || this.config.interviewTypes[0] || 'behavioral',
          actionType: 'next_question',
          nextAction: 'wait_for_answer',
        });
      }
    }

    this.questionsAsked = this.config.totalQuestions;
    return this.buildFallbackInterviewerResponse({
      message: `${feedbackMessage} That covers the planned questions. Do you have any questions for me about the role or company before we wrap up?`,
      phase: 'candidate_questions',
      questionNumber: this.questionsAsked,
      questionType: this.config.interviewTypes[0] || 'behavioral',
      actionType: 'next_question',
      nextAction: 'ask_candidate_questions',
    });
  }

  /**
   * Initialize the interview with a personalized introduction
   */
  async startInterview() {
    const systemPrompt = `You are ${this.config.interviewerName}, interviewing for ${this.config.jobRole} at ${this.config.company}.
Interview style: ${this.config.personality || 'professional and encouraging'}.
Welcome the candidate warmly and ask them to introduce themselves. Keep it brief (2-3 sentences).`;

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

    if (this.questionBank.length > 0) {
      const firstQuestion = this.getQuestionFromBank(0);
      const questionType = firstQuestion?.questionType || this.config.interviewTypes[0] || 'behavioral';
      const message = `Thanks for the introduction. ${this.buildQuestionPrompt(firstQuestion, 0)}`;

      this.contextMemory.candidateBackground = candidateIntroduction;
      this.currentPhase = 'questions';
      this.currentQuestionIndex = 0;
      this.questionsAsked = 1;
      this.resetQuestionAttemptState();

      this.conversationHistory.push({
        role: 'interviewer',
        content: message,
        timestamp: new Date().toISOString(),
        phase: 'questions',
        questionNumber: 1,
        questionType,
      });

      return {
        message,
        phase: 'questions',
        questionNumber: 1,
        totalQuestions: this.config.totalQuestions,
        questionType,
        nextAction: 'wait_for_answer',
      };
    }

    const systemPrompt = `You're interviewing for ${this.config.jobRole} at ${this.config.company}.
Candidate introduced themselves. Acknowledge briefly and ask a relevant interview question.
Interview types to prioritize: ${this.config.interviewTypes.join(', ')}.
Focus areas: ${this.config.skillFocus.join(', ') || 'general competency'}.

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
        max_tokens: 400,
        format: INTERVIEW_SCHEMAS.introduction,
      });

      const parsed = parseJSONResponse(response);
      
      // Update context memory
      this.contextMemory.candidateBackground = parsed.insights?.join(', ') || '';
      this.contextMemory.strengths = parsed.insights || [];
      const questionType = parsed?.type || this.config.interviewTypes[0] || 'behavioral';
      
      // Update phase
      this.currentPhase = 'questions';
      this.questionsAsked = 1;

      this.conversationHistory.push({
        role: 'interviewer',
        content: parsed.message,
        timestamp: new Date().toISOString(),
        phase: 'questions',
        questionNumber: 1,
        questionType,
      });

      return {
        message: parsed.message,
        phase: 'questions',
        questionNumber: 1,
        totalQuestions: this.config.totalQuestions,
        questionType,
        nextAction: 'wait_for_answer'
      };
    } catch (error) {
      console.error('Error processing introduction:', error);
      if (this.questionBank.length > 0) {
        const firstQuestion = this.getQuestionFromBank(0);
        if (firstQuestion) {
          this.currentQuestionIndex = 0;
          this.questionsAsked = 1;
          this.resetQuestionAttemptState();
          return this.buildFallbackInterviewerResponse({
            message: `Thanks for the introduction. ${this.buildQuestionPrompt(firstQuestion, 0)}`,
            phase: 'questions',
            questionNumber: 1,
            questionType: firstQuestion.questionType || this.config.interviewTypes[0] || 'behavioral',
            actionType: 'next_question',
            nextAction: 'wait_for_answer',
          });
        }
      }
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

    const repeatedAnswerCount = this.trackRepeatedAnswer(candidateAnswer);
    const currentQuestion = this.getQuestionFromBank(this.currentQuestionIndex);
    const currentQuestionText = currentQuestion?.question || '';
    const followUpEnabled = Boolean(this.config.followUpQuestions);
    const allowedActions = followUpEnabled
      ? 'next_question|follow_up|correction'
      : 'next_question|correction';
    const systemPrompt = `You're interviewing for ${this.config.jobRole}. Question ${this.questionsAsked}/${this.config.totalQuestions}.
Interview types: ${this.config.interviewTypes.join(', ')}.
Follow-up questions enabled: ${followUpEnabled ? 'yes' : 'no'}.
Current question: ${currentQuestionText || 'Use the most recent interviewer question from context'}.
Follow-up attempts already used for this question: ${this.followUpAttemptsForCurrentQuestion}/${this.maxFollowUpsPerQuestion}.
Candidate repeated-answer count on this question: ${repeatedAnswerCount}.

Recent exchange:
${recentContext}

Evaluate answer (1-10) and respond as interviewer.
Do not repeat essentially the same follow-up wording over and over. If detail is still missing after at most ${this.maxFollowUpsPerQuestion} follow-ups, move to next question.

JSON format:
{
  "score": 7,
  "action": "${allowedActions}",
  "questionType": "behavioral|technical|situational",
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
        temperature: 0.55,
        max_tokens: 400,
        format: INTERVIEW_SCHEMAS.answerEvaluation,
      });

      const parsed = parseJSONResponse(response);

      let action = parsed.action || 'next_question';
      if (!followUpEnabled && action === 'follow_up') {
        action = 'next_question';
      }
      if (this.repeatedAnswerCount >= REPEATED_ANSWER_FORCE_ADVANCE_THRESHOLD) {
        action = 'next_question';
      } else if (action !== 'next_question' && this.followUpAttemptsForCurrentQuestion >= this.maxFollowUpsPerQuestion) {
        action = 'next_question';
      }
      const parsedQuestionType = parsed?.questionType || this.config.interviewTypes[0] || 'behavioral';
      const rawScore = Number(parsed?.score);
      const resolvedScore = Number.isFinite(rawScore)
        ? Math.max(0, Math.min(rawScore, 10))
        : 5;

      // Update score
      this.candidateScore += resolvedScore;

      let message = String(parsed?.message || '').trim();
      let questionType = parsedQuestionType;
      let phase = 'questions';
      let nextAction = 'wait_for_answer';

      if (action === 'next_question') {
        this.resetQuestionAttemptState();
        if (this.questionBank.length > 0) {
          const nextIndex = this.currentQuestionIndex + 1;
          const nextQuestion = this.getQuestionFromBank(nextIndex);

          if (nextQuestion) {
            this.currentQuestionIndex = nextIndex;
            this.questionsAsked = nextIndex + 1;
            questionType = nextQuestion.questionType || parsedQuestionType;
            message = this.composeBankTransitionMessage({
              feedbackMessage: message,
              nextQuestion,
              nextIndex,
            });
          } else {
            this.questionsAsked = this.config.totalQuestions;
            phase = 'candidate_questions';
            nextAction = 'ask_candidate_questions';
            message = `${message || 'Thanks, that covers the planned questions.'} Do you have any questions for me about the role or company before we wrap up?`;
          }
        } else {
          this.questionsAsked += 1;
        }
      } else {
        this.followUpAttemptsForCurrentQuestion += 1;
        message = this.ensureNonRepetitiveMessage({
          message,
          action,
          currentQuestionText,
        });
      }

      if (!this.questionBank.length) {
        const shouldEndQuestions = this.questionsAsked >= this.config.totalQuestions;
        if (shouldEndQuestions) {
          phase = 'candidate_questions';
          nextAction = 'ask_candidate_questions';
        }
      }
      this.currentPhase = phase;

      this.conversationHistory.push({
        role: 'interviewer',
        content: message,
        timestamp: new Date().toISOString(),
        phase,
        questionNumber: this.questionsAsked,
        actionType: action,
        questionType,
        evaluation: { score: resolvedScore }
      });

      return {
        message,
        phase,
        questionNumber: this.questionsAsked,
        totalQuestions: this.config.totalQuestions,
        actionType: action,
        questionType,
        evaluation: { score: resolvedScore },
        nextAction
      };
    } catch (error) {
      console.error('Error processing answer:', error);
      return this.buildFallbackQuestionAdvance({
        feedbackMessage: 'I did not get a complete model response, so I am moving us to the next planned question.',
      });
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
      return this.buildFallbackInterviewerResponse({
        message: 'Thanks for the question. I do not have a richer generated answer right now, but the recruiter can clarify the remaining details after this interview. If you are ready, we can conclude the session.',
        phase: 'candidate_questions',
        questionNumber: this.questionsAsked,
        questionType: this.config.interviewTypes[0] || 'behavioral',
        actionType: 'fallback_answer',
        nextAction: 'wait_for_next_question_or_end',
      });
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
      this.currentPhase = 'completed';
      return {
        message: 'Thank you for your time today. The interview session has ended successfully.',
        phase: 'completed',
        nextAction: 'show_results',
        fallback: true,
      };
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
