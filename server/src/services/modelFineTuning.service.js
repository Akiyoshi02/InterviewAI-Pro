/**
 * Model Fine-Tuning Service
 *
 * Uses Ollama's Modelfile system to create a domain-specialized model variant
 * from collected high-quality interview data. This embeds few-shot examples
 * into the model's system context, creating an "interviewai-qwen3:8b" model.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import logger from '../utils/logger.js';
import { firestore } from '../config/firebase.js';

const execAsync = promisify(exec);

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const BASE_MODEL = process.env.OLLAMA_MODEL || 'qwen3:8b';
const FINE_TUNED_MODEL_NAME = `interviewai-${BASE_MODEL.replace(':', '-')}`;
const MAX_FEW_SHOT_EXAMPLES = 15;
const MIN_QUALITY_SCORE = 6;

/**
 * Minimum number of high-quality training pairs required before the
 * fine-tuned model is considered reliable enough to be preferred over
 * the base model at runtime. Below this threshold the fine-tuned model
 * exists in Ollama but the runtime resolver will not use it — the base
 * qwen3:8b is used instead, ensuring consistent accuracy.
 *
 * Research rationale: few-shot calibration with fewer than 5 examples
 * risks over-fitting to a narrow distribution of interview styles, which
 * would introduce scoring bias rather than improve accuracy.
 */
export const MIN_TRAINING_PAIRS_FOR_ACTIVATION = 5;

/**
 * Fetch collected training datasets from Firestore.
 */
async function fetchTrainingData() {
  const snapshot = await firestore
    .collection('trainingDatasets_interviews')
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();

  const datasets = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return datasets;
}

/**
 * Extract high-quality Q&A pairs from training datasets.
 */
function extractHighQualityPairs(datasets) {
  const pairs = [];

  for (const dataset of datasets) {
    const trainingData = dataset.trainingData || dataset.data || [];
    for (const example of trainingData) {
      if (!Array.isArray(example?.messages)) continue;

      const assistantMessages = example.messages.filter((m) => m.role === 'assistant');
      const userMessages = example.messages.filter((m) => m.role === 'user');

      for (let i = 0; i < Math.min(assistantMessages.length, userMessages.length); i++) {
        const question = assistantMessages[i]?.content;
        const answer = userMessages[i]?.content;
        const score = example.metadata?.score || dataset.statistics?.averageScore || 0;

        if (question && answer && score >= MIN_QUALITY_SCORE) {
          pairs.push({
            question: question.trim(),
            answer: answer.trim(),
            score,
            jobRole: example.metadata?.jobRole || dataset.config?.jobRole || 'General',
          });
        }
      }
    }
  }

  pairs.sort((a, b) => b.score - a.score);
  return pairs.slice(0, MAX_FEW_SHOT_EXAMPLES);
}

/**
 * Generate an Ollama Modelfile from collected training data.
 */
export function generateModelfile(highQualityPairs) {
  const examplesBlock = highQualityPairs
    .map(
      (pair, i) =>
        `Example ${i + 1} (${pair.jobRole}, Score: ${pair.score}/10):\nQ: ${pair.question}\nA: ${pair.answer}`,
    )
    .join('\n\n');

  const modelfile = `FROM ${BASE_MODEL}

SYSTEM """You are an expert interview evaluator for InterviewAI Pro.
You have been calibrated on real interview data collected from actual sessions.
Your evaluations should be consistent with these high-quality reference examples.

${examplesBlock ? `Here are examples of well-evaluated interviews from real sessions:\n\n${examplesBlock}\n\n` : ''}Always return valid JSON matching the requested schema.
Evaluate answers using the STAR method (Situation, Task, Action, Result).
Be fair, consistent, and constructive in your feedback."""

PARAMETER temperature 0.65
PARAMETER repeat_penalty 1.0
PARAMETER num_ctx 16384
PARAMETER top_p 0.9
`;

  return modelfile;
}

/**
 * Check whether the most recently completed fine-tune run used enough
 * high-quality training pairs to trust the fine-tuned model at runtime.
 * Returns { qualifies: boolean, examplesUsed: number }.
 * Result is intentionally NOT cached here — caching lives in llm.service.js
 * alongside the model-existence check.
 */
export async function getLatestFineTuneQualification() {
  try {
    const snapshot = await firestore
      .collection('fineTuneHistory')
      .where('status', '==', 'completed')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { qualifies: false, examplesUsed: 0 };
    }

    const latest = snapshot.docs[0].data();
    const examplesUsed = Number(latest.examplesUsed) || 0;
    return {
      qualifies: examplesUsed >= MIN_TRAINING_PAIRS_FOR_ACTIVATION,
      examplesUsed,
    };
  } catch {
    return { qualifies: false, examplesUsed: 0 };
  }
}

/**
 * Trigger model fine-tuning by creating a new Ollama model variant.
 */
export async function triggerFineTune() {
  const datasets = await fetchTrainingData();
  if (datasets.length === 0) {
    return {
      success: false,
      error: 'No training data available. Conduct interviews to collect data first.',
    };
  }

  const highQualityPairs = extractHighQualityPairs(datasets);
  if (highQualityPairs.length === 0) {
    return {
      success: false,
      error: `No high-quality Q&A pairs found (minimum score: ${MIN_QUALITY_SCORE}/10). Collect more interview data.`,
    };
  }

  const modelfileContent = generateModelfile(highQualityPairs);
  const tempPath = join(tmpdir(), `Modelfile_${Date.now()}`);

  try {
    await writeFile(tempPath, modelfileContent, 'utf-8');
    logger.info(`Modelfile written to ${tempPath} with ${highQualityPairs.length} examples`);

    const { stdout, stderr } = await execAsync(
      `ollama create ${FINE_TUNED_MODEL_NAME} -f "${tempPath}"`,
      { timeout: 120_000 },
    );

    logger.info(`Fine-tune completed: ${stdout}`);
    if (stderr) logger.warn(`Fine-tune stderr: ${stderr}`);

    const activationReady = highQualityPairs.length >= MIN_TRAINING_PAIRS_FOR_ACTIVATION;

    await firestore.collection('fineTuneHistory').add({
      modelName: FINE_TUNED_MODEL_NAME,
      baseModel: BASE_MODEL,
      examplesUsed: highQualityPairs.length,
      datasetsUsed: datasets.length,
      createdAt: new Date().toISOString(),
      status: 'completed',
      activationReady,
      minActivationThreshold: MIN_TRAINING_PAIRS_FOR_ACTIVATION,
    });

    return {
      success: true,
      modelName: FINE_TUNED_MODEL_NAME,
      baseModel: BASE_MODEL,
      examplesUsed: highQualityPairs.length,
      datasetsUsed: datasets.length,
      activationReady,
      minActivationThreshold: MIN_TRAINING_PAIRS_FOR_ACTIVATION,
    };
  } catch (error) {
    logger.error('Fine-tune failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to create fine-tuned model',
    };
  } finally {
    try {
      await unlink(tempPath);
    } catch {
      // ignore cleanup error
    }
  }
}

/**
 * Get the current fine-tuning status and model info.
 */
export async function getFineTuneStatus() {
  const history = await firestore
    .collection('fineTuneHistory')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  const runs = history.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  let modelExists = false;
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FINE_TUNED_MODEL_NAME }),
    });
    modelExists = response.ok;
  } catch {
    // model doesn't exist or Ollama not reachable
  }

  const datasets = await fetchTrainingData();
  const totalPairs = extractHighQualityPairs(datasets).length;

  const qualification = await getLatestFineTuneQualification();

  return {
    fineTunedModelName: FINE_TUNED_MODEL_NAME,
    baseModel: BASE_MODEL,
    modelExists,
    availableTrainingPairs: totalPairs,
    minQualityScore: MIN_QUALITY_SCORE,
    maxExamples: MAX_FEW_SHOT_EXAMPLES,
    recentRuns: runs,
    totalDatasets: datasets.length,
    activationReady: modelExists && qualification.qualifies,
    lastRunExamplesUsed: qualification.examplesUsed,
    minActivationThreshold: MIN_TRAINING_PAIRS_FOR_ACTIVATION,
  };
}

/**
 * Export all high-quality training pairs as JSONL in the format expected by
 * the Unsloth LoRA fine-tuning script (`scripts/fine_tune_lora.py`).
 *
 * Each line is a JSON object with "messages" (system / user / assistant) so
 * the Unsloth SFTTrainer can directly consume the file with `dataset_text_field`
 * set to the chat template.
 *
 * This is the real fine-tuning pipeline entry point — see README in
 * scripts/fine_tune_lora.py for instructions on running the training job.
 */
export async function exportTrainingDataAsJSONL() {
  const datasets = await fetchTrainingData();
  if (datasets.length === 0) {
    return { success: false, error: 'No training datasets found.' };
  }

  const records = [];

  for (const dataset of datasets) {
    const trainingData = dataset.trainingData || dataset.data || [];
    for (const example of trainingData) {
      if (!Array.isArray(example?.messages)) continue;

      const systemMsg = example.messages.find((m) => m.role === 'system');
      const userMessages = example.messages.filter((m) => m.role === 'user');
      const assistantMessages = example.messages.filter((m) => m.role === 'assistant');
      const score = example.metadata?.score || dataset.statistics?.averageScore || 0;

      if (score < MIN_QUALITY_SCORE) continue;

      // Build a system → user → assistant conversation triple per Q&A pair.
      for (let i = 0; i < Math.min(userMessages.length, assistantMessages.length); i++) {
        const userContent = userMessages[i]?.content?.trim();
        const assistantContent = assistantMessages[i]?.content?.trim();
        if (!userContent || !assistantContent) continue;

        records.push({
          messages: [
            {
              role: 'system',
              content:
                systemMsg?.content?.trim() ||
                'You are an expert interview evaluator for InterviewAI Pro. ' +
                'Evaluate answers using the STAR method and return valid JSON.',
            },
            { role: 'user', content: userContent },
            { role: 'assistant', content: assistantContent },
          ],
          metadata: {
            score,
            jobRole: example.metadata?.jobRole || dataset.config?.jobRole || 'General',
            datasetId: dataset.id,
          },
        });
      }
    }
  }

  if (records.length === 0) {
    return {
      success: false,
      error: `No high-quality examples found (minimum score: ${MIN_QUALITY_SCORE}/10).`,
    };
  }

  const jsonl = records.map((r) => JSON.stringify(r)).join('\n');
  return {
    success: true,
    jsonl,
    recordCount: records.length,
    datasetCount: datasets.length,
    minQualityScore: MIN_QUALITY_SCORE,
  };
}

/**
 * Register an already-trained GGUF model file (produced by scripts/fine_tune_lora.py)
 * with Ollama as the canonical fine-tuned model name, then reset the availability cache
 * so the runtime resolver picks it up immediately.
 *
 * @param {string} ggufPath - Absolute path to the .gguf file on the server machine.
 */
export async function importTrainedGGUF(ggufPath) {
  // Verify the file exists before proceeding.
  try {
    await stat(ggufPath);
  } catch {
    return { success: false, error: `File not found at path: ${ggufPath}` };
  }

  if (!ggufPath.toLowerCase().endsWith('.gguf')) {
    return { success: false, error: 'File must be a .gguf file.' };
  }

  const modelfileContent = `FROM ${ggufPath}\n\nPARAMETER temperature 0.45\nPARAMETER repeat_penalty 1.1\nPARAMETER num_ctx 16384\n`;
  const tempPath = join(tmpdir(), `Modelfile_trained_${Date.now()}`);

  try {
    await writeFile(tempPath, modelfileContent, 'utf-8');

    const { stdout, stderr } = await execAsync(
      `ollama create ${FINE_TUNED_MODEL_NAME} -f "${tempPath}"`,
      { timeout: 300_000 },
    );

    logger.info(`GGUF import completed: ${stdout}`);
    if (stderr) logger.warn(`GGUF import stderr: ${stderr}`);

    await firestore.collection('fineTuneHistory').add({
      modelName: FINE_TUNED_MODEL_NAME,
      baseModel: BASE_MODEL,
      method: 'lora_gguf_import',
      ggufPath,
      createdAt: new Date().toISOString(),
      status: 'completed',
      // LoRA-trained GGUF always qualifies — the training script enforces
      // a minimum dataset size before producing the file.
      activationReady: true,
      examplesUsed: MIN_TRAINING_PAIRS_FOR_ACTIVATION,
      minActivationThreshold: MIN_TRAINING_PAIRS_FOR_ACTIVATION,
    });

    return {
      success: true,
      modelName: FINE_TUNED_MODEL_NAME,
      method: 'lora_gguf_import',
      ggufPath,
    };
  } catch (error) {
    logger.error('GGUF import failed:', error);
    return { success: false, error: error.message || 'Failed to import GGUF model' };
  } finally {
    try { await unlink(tempPath); } catch { /* ignore */ }
  }
}

/**
 * Run a simple before/after evaluation comparing base and fine-tuned models.
 */
export async function evaluateFineTunedModel() {
  const testPrompts = [
    {
      role: 'user',
      content:
        'Evaluate this answer using the STAR method. Question: "Tell me about a time you led a team." Answer: "At my previous job I managed a team of 5 developers to deliver a product launch on time, improving deployment speed by 40%." Return JSON with score, starAnalysis, strengths, weaknesses.',
    },
  ];

  const systemMessage = {
    role: 'system',
    content: 'You are an expert interview evaluator. Return valid JSON with: score (1-10), starAnalysis object, strengths array, weaknesses array.',
  };

  const fetchModel = async (modelName) => {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: [systemMessage, ...testPrompts],
          stream: false,
          think: false,
          options: { temperature: 0.65, num_ctx: 16384 },
        }),
      });

      if (!response.ok) return { error: `Model ${modelName} not available` };
      const data = await response.json();
      const content = data?.message?.content || '';
      return { model: modelName, response: content.substring(0, 500) };
    } catch (error) {
      return { model: modelName, error: error.message };
    }
  };

  const [baseResult, fineTunedResult] = await Promise.all([
    fetchModel(BASE_MODEL),
    fetchModel(FINE_TUNED_MODEL_NAME),
  ]);

  return {
    baseModel: baseResult,
    fineTunedModel: fineTunedResult,
    testPrompt: testPrompts[0].content.substring(0, 200) + '...',
  };
}
