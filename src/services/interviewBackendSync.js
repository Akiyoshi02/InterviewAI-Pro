/**
 * Interview Backend Sync Service
 * 
 * Bridges the AI Interviewer frontend flow with the backend database
 * Handles syncing questions, answers, and evaluations with the backend
 */

import { apiClient } from './apiClient.js';

export class InterviewBackendSync {
  constructor(interviewId) {
    this.interviewId = interviewId;
    this.questions = [];
    this.currentQuestionIndex = -1;
    this.initialized = false;
  }

  /**
   * Load interview from backend and initialize
   */
  async initialize() {
    try {
      const response = await apiClient.interviews.getById(this.interviewId);
      
      if (!response.success || !response.interview) {
        throw new Error('Failed to load interview');
      }

      this.interview = response.interview;
      this.questions = response.interview.questions || [];
      this.initialized = true;

      return {
        interview: this.interview,
        questions: this.questions,
      };
    } catch (error) {
      console.error('Failed to initialize interview sync:', error);
      throw error;
    }
  }

  /**
   * Get current question being asked
   */
  getCurrentQuestion() {
    if (this.currentQuestionIndex >= 0 && this.currentQuestionIndex < this.questions.length) {
      return this.questions[this.currentQuestionIndex];
    }
    return null;
  }

  /**
   * Get next question to ask
   */
  getNextQuestion() {
    const nextIndex = this.currentQuestionIndex + 1;
    if (nextIndex < this.questions.length) {
      return {
        question: this.questions[nextIndex],
        index: nextIndex,
      };
    }
    return null;
  }

  /**
   * Mark a question as asked (update askedAt timestamp)
   */
  async markQuestionAsked(questionId) {
    try {
      await apiClient.interviews.markQuestionAsked(this.interviewId, questionId);
      
      // Update local state
      const questionIndex = this.questions.findIndex(q => q.id === questionId);
      if (questionIndex >= 0) {
        this.questions[questionIndex].askedAt = new Date();
        this.currentQuestionIndex = questionIndex;
      }
      
      return true;
    } catch (error) {
      console.error('Failed to mark question as asked:', error);
      return false;
    }
  }

  /**
   * Submit answer for a question
   * Returns the evaluation result
   */
  async submitAnswer(questionId, answer, audioUrl = null) {
    try {
      const response = await apiClient.interviews.submitAnswer(
        this.interviewId,
        questionId,
        answer,
        audioUrl
      );

      if (!response.success) {
        throw new Error('Failed to submit answer');
      }

      // Update local question with answer and evaluation
      const questionIndex = this.questions.findIndex(q => q.id === questionId);
      if (questionIndex >= 0) {
        this.questions[questionIndex] = {
          ...this.questions[questionIndex],
          ...response.question,
        };
      }

      return {
        question: response.question,
        evaluation: response.evaluation,
      };
    } catch (error) {
      console.error('Failed to submit answer:', error);
      throw error;
    }
  }

  /**
   * Start the interview on backend (if not already started)
   */
  async startInterview() {
    try {
      // Check if interview is already started
      if (this.interview?.status === 'IN_PROGRESS') {
        return {
          success: true,
          interview: this.interview,
          questions: this.questions,
        };
      }

      const response = await apiClient.interviews.start(this.interviewId);
      
      if (!response.success) {
        throw new Error('Failed to start interview');
      }

      this.interview = response.interview;
      this.questions = response.interview.questions || [];
      
      return {
        success: true,
        interview: this.interview,
        questions: this.questions,
      };
    } catch (error) {
      console.error('Failed to start interview:', error);
      throw error;
    }
  }

  /**
   * End the interview on backend
   */
  async endInterview() {
    try {
      const response = await apiClient.interviews.end(this.interviewId);
      
      if (!response.success) {
        throw new Error('Failed to end interview');
      }

      this.interview = response.interview;
      return response;
    } catch (error) {
      console.error('Failed to end interview:', error);
      throw error;
    }
  }

  /**
   * Get interview evaluation
   */
  async getEvaluation() {
    try {
      const response = await apiClient.interviews.getEvaluation(this.interviewId);
      
      if (!response.success) {
        throw new Error('Failed to get evaluation');
      }

      return response.evaluation;
    } catch (error) {
      console.error('Failed to get evaluation:', error);
      throw error;
    }
  }

  /**
   * Get all questions
   */
  getQuestions() {
    return this.questions;
  }

  /**
   * Get interview data
   */
  getInterview() {
    return this.interview;
  }

  /**
   * Check if initialized
   */
  isInitialized() {
    return this.initialized;
  }
}

export default InterviewBackendSync;

