/**
 * Interview Dataset Collection Service
 * 
 * Collects and manages interview conversation data for LLM training.
 * 
 * Features:
 * - Structured Q&A pair collection
 * - Metadata tagging (role, experience, industry, etc.)
 * - Quality scoring for data filtering
 * - Local storage with backend sync
 * - Export to JSONL format for fine-tuning
 * - Session management
 * 
 * Data Format for LLM Training:
 * Each conversation turn is stored as:
 * {
 *   "messages": [
 *     {"role": "system", "content": "..."},
 *     {"role": "user", "content": "..."},
 *     {"role": "assistant", "content": "..."}
 *   ]
 * }
 */

const STORAGE_KEY_DATASETS = 'llm_training_datasets';
const STORAGE_KEY_SESSIONS = 'llm_dataset_sessions';
const STORAGE_KEY_CURRENT = 'llm_current_session';

/**
 * Interview Dataset Collector Class
 */
export class InterviewDatasetCollector {
  constructor(config = {}) {
    this.config = {
      jobRole: config.jobRole || 'General',
      company: config.company || 'Unknown',
      experienceLevel: config.experienceLevel || 'Mid-level',
      industry: config.industry || 'Technology',
      interviewTypes: config.interviewTypes || ['behavioral'],
      personality: config.personality || 'professional-encouraging',
      interviewerId: config.interviewerId || 'ai_interviewer_v1',
      ...config,
    };
    
    this.sessionId = config.sessionId || `session_${Date.now()}`;
    this.interviewId = config.interviewId || null;
    this.startTime = Date.now();
    this.conversationTurns = [];
    this.questionAnswerPairs = [];
    this.metadata = {
      createdAt: new Date().toISOString(),
      platform: 'InterviewAI Pro',
      version: '1.0.0',
    };
  }

  /**
   * Get system prompt for this interview configuration
   */
  getSystemPrompt() {
    return `You are a professional interviewer conducting a ${this.config.interviewTypes.join(' and ')} interview for a ${this.config.jobRole} position at ${this.config.company} in the ${this.config.industry} industry. The candidate has ${this.config.experienceLevel} experience level. Your interviewing style is ${this.config.personality}. Conduct a thorough, fair, and professional interview, asking relevant questions and providing constructive feedback.`;
  }

  /**
   * Add an interviewer message (question)
   */
  addInterviewerMessage(content, metadata = {}) {
    const turn = {
      id: `turn_${Date.now()}_${this.conversationTurns.length}`,
      role: 'interviewer',
      content: content.trim(),
      timestamp: Date.now(),
      metadata: {
        questionNumber: metadata.questionNumber || null,
        questionType: metadata.questionType || 'general',
        difficulty: metadata.difficulty || 'medium',
        phase: metadata.phase || 'questions',
        ...metadata,
      },
    };
    
    this.conversationTurns.push(turn);
    this._saveToLocalStorage();
    
    return turn.id;
  }

  /**
   * Add a candidate message (answer)
   */
  addCandidateMessage(content, metadata = {}) {
    const turn = {
      id: `turn_${Date.now()}_${this.conversationTurns.length}`,
      role: 'candidate',
      content: content.trim(),
      timestamp: Date.now(),
      metadata: {
        answerDuration: metadata.answerDuration || null,
        transcriptionMethod: metadata.transcriptionMethod || 'manual', // 'whisper', 'browser_stt', 'manual'
        audioUrl: metadata.audioUrl || null,
        ...metadata,
      },
    };
    
    this.conversationTurns.push(turn);
    this._saveToLocalStorage();
    
    return turn.id;
  }

  /**
   * Record a complete Q&A pair with evaluation
   */
  recordQAPair(question, answer, evaluation = {}) {
    const qaPair = {
      id: `qa_${Date.now()}_${this.questionAnswerPairs.length}`,
      question: {
        text: question.text || question,
        type: question.type || 'general',
        difficulty: question.difficulty || 'medium',
        expectedPoints: question.expectedPoints || [],
      },
      answer: {
        text: answer.text || answer,
        duration: answer.duration || null,
        transcriptionMethod: answer.transcriptionMethod || 'manual',
      },
      evaluation: {
        score: evaluation.score || null,
        starAnalysis: evaluation.starAnalysis || null,
        strengths: evaluation.strengths || [],
        weaknesses: evaluation.weaknesses || [],
        feedback: evaluation.feedback || '',
        actionType: evaluation.actionType || 'next_question', // 'next_question', 'follow_up', 'correction'
      },
      timestamp: Date.now(),
      config: {
        jobRole: this.config.jobRole,
        experienceLevel: this.config.experienceLevel,
        industry: this.config.industry,
        interviewType: question.type || this.config.interviewTypes[0],
      },
    };
    
    this.questionAnswerPairs.push(qaPair);
    this._saveToLocalStorage();
    
    return qaPair;
  }

  /**
   * Convert conversation to training format (messages array)
   */
  toTrainingFormat() {
    const trainingExamples = [];
    
    // System message for context
    const systemMessage = {
      role: 'system',
      content: this.getSystemPrompt(),
    };
    
    // Convert conversation turns to messages
    const messages = [systemMessage];
    
    for (const turn of this.conversationTurns) {
      messages.push({
        role: turn.role === 'interviewer' ? 'assistant' : 'user',
        content: turn.content,
      });
    }
    
    // Create training example
    if (messages.length > 1) {
      trainingExamples.push({
        messages,
        metadata: {
          sessionId: this.sessionId,
          interviewId: this.interviewId,
          config: this.config,
          timestamp: new Date().toISOString(),
        },
      });
    }
    
    // Also create individual Q&A training examples
    for (const qa of this.questionAnswerPairs) {
      if ((qa.evaluation?.score ?? 0) >= 6) { // Only include good answers
        trainingExamples.push({
          messages: [
            systemMessage,
            { role: 'assistant', content: qa.question.text },
            { role: 'user', content: qa.answer.text },
          ],
          metadata: {
            type: 'qa_pair',
            questionType: qa.question?.type,
            score: qa.evaluation?.score ?? 0,
            jobRole: qa.config.jobRole,
            experienceLevel: qa.config.experienceLevel,
          },
        });
      }
    }
    
    return trainingExamples;
  }

  /**
   * Export to JSONL format (one JSON object per line)
   */
  toJSONL() {
    const trainingExamples = this.toTrainingFormat();
    return trainingExamples.map(example => JSON.stringify(example)).join('\n');
  }

  /**
   * Get session summary
   */
  getSummary() {
    const totalDuration = Date.now() - this.startTime;
    const avgScore = this.questionAnswerPairs.length > 0
      ? this.questionAnswerPairs.reduce((sum, qa) => sum + (qa.evaluation.score || 0), 0) / this.questionAnswerPairs.length
      : 0;
    
    return {
      sessionId: this.sessionId,
      interviewId: this.interviewId,
      config: this.config,
      statistics: {
        totalTurns: this.conversationTurns.length,
        totalQAPairs: this.questionAnswerPairs.length,
        durationMs: totalDuration,
        durationMinutes: Math.round(totalDuration / 60000),
        averageScore: Math.round(avgScore * 10) / 10,
        highQualityPairs: this.questionAnswerPairs.filter(qa => (qa.evaluation.score || 0) >= 7).length,
      },
      questionTypes: this._countByType(),
      createdAt: this.metadata.createdAt,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Count questions by type
   */
  _countByType() {
    const counts = {};
    for (const qa of this.questionAnswerPairs) {
      const type = qa.question.type || 'general';
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  }

  /**
   * Save current session to localStorage
   */
  _saveToLocalStorage() {
    try {
      const sessionData = {
        sessionId: this.sessionId,
        interviewId: this.interviewId,
        config: this.config,
        conversationTurns: this.conversationTurns,
        questionAnswerPairs: this.questionAnswerPairs,
        metadata: this.metadata,
        startTime: this.startTime,
        lastUpdated: Date.now(),
      };
      
      localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(sessionData));
      
      return true;
    } catch (error) {
      console.error('Failed to save dataset to localStorage:', error);
      return false;
    }
  }

  /**
   * Finalize and save session
   */
  finalizeSession() {
    const summary = this.getSummary();
    const trainingData = this.toTrainingFormat();
    
    const finalizedSession = {
      ...summary,
      trainingData,
      jsonl: this.toJSONL(),
    };
    
    // Save to sessions list
    try {
      const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY_SESSIONS) || '[]');
      sessions.push(finalizedSession);
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
      
      // Clear current session
      localStorage.removeItem(STORAGE_KEY_CURRENT);
    } catch (error) {
      console.error('Failed to finalize session:', error);
    }
    
    return finalizedSession;
  }

  /**
   * Load session from localStorage
   */
  static loadCurrentSession() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_CURRENT);
      if (!data) return null;
      
      const sessionData = JSON.parse(data);
      const collector = new InterviewDatasetCollector(sessionData.config);
      collector.sessionId = sessionData.sessionId;
      collector.interviewId = sessionData.interviewId;
      collector.conversationTurns = sessionData.conversationTurns || [];
      collector.questionAnswerPairs = sessionData.questionAnswerPairs || [];
      collector.metadata = sessionData.metadata;
      collector.startTime = sessionData.startTime;
      
      return collector;
    } catch (error) {
      console.error('Failed to load session:', error);
      return null;
    }
  }

  /**
   * Get all saved sessions
   */
  static getAllSessions() {
    try {
      const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY_SESSIONS) || '[]');
      return sessions;
    } catch (error) {
      console.error('Failed to get sessions:', error);
      return [];
    }
  }

  /**
   * Export all sessions as JSONL
   */
  static exportAllSessionsAsJSONL() {
    const sessions = InterviewDatasetCollector.getAllSessions();
    const allTrainingData = [];
    
    for (const session of sessions) {
      if (session.trainingData) {
        allTrainingData.push(...session.trainingData);
      }
    }
    
    return allTrainingData.map(example => JSON.stringify(example)).join('\n');
  }

  /**
   * Get dataset statistics
   */
  static getDatasetStatistics() {
    const sessions = InterviewDatasetCollector.getAllSessions();
    
    let totalQAPairs = 0;
    let totalHighQuality = 0;
    let totalTurns = 0;
    const roleDistribution = {};
    const typeDistribution = {};
    const experienceDistribution = {};
    
    for (const session of sessions) {
      totalQAPairs += session.statistics?.totalQAPairs || 0;
      totalHighQuality += session.statistics?.highQualityPairs || 0;
      totalTurns += session.statistics?.totalTurns || 0;
      
      const role = session.config?.jobRole || 'Unknown';
      roleDistribution[role] = (roleDistribution[role] || 0) + 1;
      
      const experience = session.config?.experienceLevel || 'Unknown';
      experienceDistribution[experience] = (experienceDistribution[experience] || 0) + 1;
      
      if (session.questionTypes) {
        for (const [type, count] of Object.entries(session.questionTypes)) {
          typeDistribution[type] = (typeDistribution[type] || 0) + count;
        }
      }
    }
    
    return {
      totalSessions: sessions.length,
      totalQAPairs,
      totalHighQualityPairs: totalHighQuality,
      totalConversationTurns: totalTurns,
      qualityRatio: totalQAPairs > 0 ? Math.round((totalHighQuality / totalQAPairs) * 100) : 0,
      distributions: {
        byRole: roleDistribution,
        byType: typeDistribution,
        byExperience: experienceDistribution,
      },
    };
  }

  /**
   * Clear all stored data
   */
  static clearAllData() {
    try {
      localStorage.removeItem(STORAGE_KEY_DATASETS);
      localStorage.removeItem(STORAGE_KEY_SESSIONS);
      localStorage.removeItem(STORAGE_KEY_CURRENT);
      return true;
    } catch (error) {
      console.error('Failed to clear data:', error);
      return false;
    }
  }

  /**
   * Delete a specific session
   */
  static deleteSession(sessionId) {
    try {
      const sessions = InterviewDatasetCollector.getAllSessions();
      const filtered = sessions.filter(s => s.sessionId !== sessionId);
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Failed to delete session:', error);
      return false;
    }
  }
}

/**
 * Utility function to download JSONL file
 */
export function downloadJSONL(content, filename = 'interview_training_data.jsonl') {
  const blob = new Blob([content], { type: 'application/jsonl' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Utility function to download JSON file
 */
export function downloadJSON(data, filename = 'interview_data.json') {
  const content = JSON.stringify(data, null, 2);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Create and export convenience functions
 */
export const createDatasetCollector = (config) => new InterviewDatasetCollector(config);
export const loadCurrentSession = () => InterviewDatasetCollector.loadCurrentSession();
export const getAllSessions = () => InterviewDatasetCollector.getAllSessions();
export const exportAllAsJSONL = () => InterviewDatasetCollector.exportAllSessionsAsJSONL();
export const getDatasetStats = () => InterviewDatasetCollector.getDatasetStatistics();
export const clearAllDatasets = () => InterviewDatasetCollector.clearAllData();

export default InterviewDatasetCollector;
