/**
 * FREE Local LLM Client (Frontend)
 * Uses Ollama running on localhost - completely free, no API costs
 * 
 * Ollama provides OpenAI-compatible API endpoint
 * Default URL: http://localhost:11434
 */

const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'qwen3:8b';
const DEFAULT_FALLBACK_MODEL = import.meta.env.VITE_OLLAMA_FALLBACK_MODEL || 'qwen2.5:7b-instruct';
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

/**
 * Strip Qwen3 thinking blocks from model output.
 * Safety net in case think:false doesn't fully suppress reasoning traces.
 */
const stripThinkingTags = (text) => text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

/**
 * Call Ollama API.
 * Uses think:false to disable Qwen3 internal chain-of-thought.
 */
async function callOllama(messages, options = {}) {
  const modelAttempts = [];
  const pushUnique = (modelName) => {
    if (typeof modelName === 'string' && modelName.trim() && !modelAttempts.includes(modelName.trim())) {
      modelAttempts.push(modelName.trim());
    }
  };

  pushUnique(options.model || DEFAULT_MODEL);
  pushUnique(DEFAULT_FALLBACK_MODEL);

  let lastError = null;
  for (let i = 0; i < modelAttempts.length; i += 1) {
    const modelName = modelAttempts[i];
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          stream: false,
          think: options.think ?? false,
          ...(options.format ? { format: options.format } : {}),
          options: buildGenerationOptions(options),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('Ollama API returned empty content');
      }
      return stripThinkingTags(content);
    } catch (error) {
      lastError = error;
      const nextModel = modelAttempts[i + 1] || null;
      if (nextModel) {
        console.warn(`Primary model "${modelName}" failed. Retrying with fallback "${nextModel}".`, error);
        continue;
      }
    }
  }

  console.error('Ollama API call failed:', lastError);
  throw new Error(`LLM service unavailable. Make sure Ollama is running: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Parse JSON response (handles markdown code blocks and Qwen3 thinking tags)
 */
function parseJSONResponse(text) {
  try {
    const noThink = text.replace(/<think>[\s\S]*?<\/think>/g, '');
    const cleaned = noThink.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
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
      help: 'Install Ollama from https://ollama.ai and run: ollama pull qwen3:8b && ollama pull qwen2.5:7b-instruct',
      url: OLLAMA_BASE_URL
    };
  }
}

export { callOllama, parseJSONResponse, OLLAMA_BASE_URL, DEFAULT_MODEL };
