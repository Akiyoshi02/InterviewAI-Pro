/**
 * Custom hook for FREE Local LLM functionality
 * Replaces useOpenAI hook - zero API costs
 */

import { useState, useCallback } from 'react';
import {
  generateInterviewQuestions,
  generateNextQuestion,
  analyzeAnswer,
  generateInterviewSummary,
  generateStudyPlan,
  generateCareerAssistantResponse,
  generateWebsiteAssistantResponse,
  generateChatReplySuggestions
} from '../services/llmServices.js';
import { checkOllamaHealth } from '../services/llmClient.js';

/**
 * Hook for local LLM operations
 */
export const useLLM = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLLMCall = useCallback(async (apiCall, ...args) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiCall(...args);
      return result;
    } catch (err) {
      const errorMessage = err?.message || 'An unexpected error occurred';
      setError(errorMessage);
      console.error('LLM API Error:', err);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const generateQuestions = useCallback(async (config) => {
    return handleLLMCall(generateInterviewQuestions, config);
  }, [handleLLMCall]);

  const getNextQuestion = useCallback(async (context) => {
    return handleLLMCall(generateNextQuestion, context);
  }, [handleLLMCall]);

  const evaluateAnswer = useCallback(async (analysisData) => {
    return handleLLMCall(analyzeAnswer, analysisData);
  }, [handleLLMCall]);

  const generateSummary = useCallback(async (sessionData) => {
    return handleLLMCall(generateInterviewSummary, sessionData);
  }, [handleLLMCall]);

  const createStudyPlan = useCallback(async (evaluationData) => {
    return handleLLMCall(generateStudyPlan, evaluationData);
  }, [handleLLMCall]);

  const getCareerAssistantResponse = useCallback(async (conversationPayload) => {
    return handleLLMCall(generateCareerAssistantResponse, conversationPayload);
  }, [handleLLMCall]);

  const getWebsiteAssistantResponse = useCallback(async (conversationPayload) => {
    return handleLLMCall(generateWebsiteAssistantResponse, conversationPayload);
  }, [handleLLMCall]);

  const getChatSuggestions = useCallback(async (conversationPayload) => {
    return handleLLMCall(generateChatReplySuggestions, conversationPayload);
  }, [handleLLMCall]);

  const checkHealth = useCallback(async () => {
    return handleLLMCall(checkOllamaHealth);
  }, [handleLLMCall]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    clearError,
    generateQuestions,
    getNextQuestion,
    evaluateAnswer,
    generateSummary,
    createStudyPlan,
    getCareerAssistantResponse,
    getWebsiteAssistantResponse,
    getChatSuggestions,
    checkHealth
  };
};

// Export as default for backward compatibility
export default useLLM;
