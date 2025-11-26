/**
 * FREE Local LLM Client (Frontend)
 * Uses Ollama running on localhost - completely free, no API costs
 * 
 * Ollama provides OpenAI-compatible API endpoint
 * Default URL: http://localhost:11434
 */

const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'llama3.1:8b';

/**
 * Call Ollama API
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
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.message.content;
  } catch (error) {
    console.error('Ollama API call failed:', error);
    throw new Error(`LLM service unavailable. Make sure Ollama is running: ${error.message}`);
  }
}

/**
 * Parse JSON response (handles markdown code blocks)
 */
function parseJSONResponse(text) {
  try {
    // Remove markdown code blocks if present
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Failed to parse JSON response:', text);
    throw new Error('Invalid response format from LLM');
  }
}

/**
 * Check if Ollama is running
 */
export async function checkOllamaHealth() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) {
      return { 
        healthy: false, 
        error: 'Ollama service not responding',
        url: OLLAMA_BASE_URL 
      };
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
      help: 'Install Ollama from https://ollama.ai and run: ollama pull llama3.1:8b',
      url: OLLAMA_BASE_URL
    };
  }
}

export { callOllama, parseJSONResponse, OLLAMA_BASE_URL, DEFAULT_MODEL };
