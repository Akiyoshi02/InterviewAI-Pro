import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import LoadingIndicator from '../../../components/ui/LoadingIndicator';
import apiClient from '../../../services/apiClient';
import { DEFAULT_MODEL } from '../../../services/llmClient';

const StatusBadge = ({ active }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
    active
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
      : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400'
  }`}>
    <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
    {active ? 'Available' : 'Not Created'}
  </span>
);

const ActivationBadge = ({ activationReady }) => {
  if (activationReady) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
        <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
        Active (preferred at runtime)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Inactive (quality gate not met)
    </span>
  );
};

const ModelFineTuningPanel = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fineTuning, setFineTuning] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [error, setError] = useState(null);
  const [fineTuneResult, setFineTuneResult] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [ggufPath, setGgufPath] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.admin.getFineTuneStatus();
      if (result.success) {
        setStatus(result);
      }
    } catch (err) {
      setError(err.message || 'Failed to load fine-tuning status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleFineTune = async () => {
    try {
      setFineTuning(true);
      setFineTuneResult(null);
      setError(null);
      const result = await apiClient.admin.triggerFineTune();
      setFineTuneResult(result);
      await loadStatus();
    } catch (err) {
      setError(err.message || 'Fine-tuning failed');
    } finally {
      setFineTuning(false);
    }
  };

  const handleEvaluate = async () => {
    try {
      setEvaluating(true);
      setEvaluationResult(null);
      const result = await apiClient.admin.evaluateFineTunedModel();
      if (result.success) {
        setEvaluationResult(result.evaluation);
      }
    } catch (err) {
      setError(err.message || 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      setExportSuccess(false);
      setError(null);
      const blob = await apiClient.admin.exportTrainingData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `interviewai_training_${Date.now()}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err) {
      setError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleImportGGUF = async () => {
    if (!ggufPath.trim()) return;
    try {
      setImporting(true);
      setImportResult(null);
      setError(null);
      const result = await apiClient.admin.importTrainedGGUF(ggufPath.trim());
      setImportResult(result);
      if (result.success) {
        setGgufPath('');
        await loadStatus();
      }
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingIndicator size={24} tone="primary" />
        <span className="ml-3 text-sm text-gray-600 dark:text-slate-400">Loading fine-tuning status...</span>
      </div>
    );
  }

  const threshold = status?.minActivationThreshold ?? 5;
  const available = status?.availableTrainingPairs ?? 0;
  const lastUsed = status?.lastRunExamplesUsed ?? 0;
  const progressPct = Math.min(100, Math.round((available / threshold) * 100));
  const activeModel = status?.activationReady
    ? (status?.fineTunedModelName || 'interviewai model')
    : (status?.baseModel || DEFAULT_MODEL);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Quality Gate Banner */}
      <div className={`rounded-xl border px-4 py-4 ${
        status?.activationReady
          ? 'border-purple-200 dark:border-purple-700/50 bg-purple-50 dark:bg-purple-900/20'
          : 'border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className={`text-sm font-semibold ${status?.activationReady ? 'text-purple-800 dark:text-purple-200' : 'text-amber-800 dark:text-amber-200'}`}>
              {status?.activationReady
                ? `Fine-tuned model is active — ${status?.fineTunedModelName} is preferred at runtime`
                : `Quality gate not met — base model (${status?.baseModel || DEFAULT_MODEL}) is used at runtime`}
            </p>
            <p className={`text-xs mt-1 ${status?.activationReady ? 'text-purple-700 dark:text-purple-300' : 'text-amber-700 dark:text-amber-300'}`}>
              {status?.activationReady
                ? `Trained on ${lastUsed} high-quality Q&A pairs — above the minimum of ${threshold} required for reliable activation.`
                : `The fine-tuned model requires at least ${threshold} high-quality Q&A pairs (scored ≥${status?.minQualityScore ?? 6}/10) before it is trusted at runtime. Currently: ${lastUsed} pairs used in last run.`}
            </p>
          </div>
          <div className="shrink-0">
            {status?.modelExists
              ? <ActivationBadge activationReady={status?.activationReady} />
              : <StatusBadge active={false} />}
          </div>
        </div>

        {/* Progress bar toward activation threshold */}
        {!status?.activationReady && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-amber-700 dark:text-amber-300 mb-1">
              <span>Progress to activation</span>
              <span>{available} / {threshold} pairs</span>
            </div>
            <div className="w-full h-2 bg-amber-200 dark:bg-amber-900/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 dark:bg-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Conduct {Math.max(0, threshold - available)} more high-quality interview{threshold - available !== 1 ? 's' : ''} or upload datasets to unlock fine-tuned model activation.
            </p>
          </div>
        )}
      </div>

      {/* Current Active Model at Runtime */}
      <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4">
        <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2">Currently Used at Runtime</p>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shrink-0">
            <Icon name="Brain" className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-base font-bold text-gray-900 dark:text-slate-100">{activeModel}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {status?.activationReady
                ? 'Fine-tuned variant — calibrated on your real interview data'
                : 'Base model — full thinking mode + structured output active'}
            </p>
          </div>
        </div>
      </div>

      {/* Model Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400">Base Model</p>
          <p className="text-lg font-bold text-gray-900 dark:text-slate-100 mt-1">{status?.baseModel || DEFAULT_MODEL}</p>
          <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">Always available as fallback</p>
        </div>
        <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400">Fine-Tuned Model</p>
          <p className="text-sm font-bold text-gray-900 dark:text-slate-100 mt-1 break-all">{status?.fineTunedModelName || '-'}</p>
          <div className="mt-2 flex flex-col gap-1.5">
            <StatusBadge active={status?.modelExists} />
          </div>
        </div>
        <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400">Available Pairs</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 mt-1">{available}</p>
          <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">Min score: {status?.minQualityScore ?? 6}/10 · Max: {status?.maxExamples ?? 15}</p>
        </div>
        <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4">
          <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400">Activation Gate</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 mt-1">{threshold}</p>
          <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">pairs required to activate</p>
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4">
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">In-Context Calibration</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Embeds high-quality Q&amp;A examples into the model&apos;s system prompt. Fast (seconds), no weight changes.
            Use LoRA Fine-Tuning below for true weight updates.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleFineTune}
            disabled={fineTuning || available === 0}
            iconName={fineTuning ? undefined : 'Zap'}
            iconPosition="left"
          >
            {fineTuning ? (
              <span className="flex items-center gap-2">
                <LoadingIndicator size={14} tone="white" /> Calibrating...
              </span>
            ) : 'Calibrate Model (In-Context)'}
          </Button>
          <Button
            onClick={handleEvaluate}
            disabled={evaluating || !status?.modelExists}
            variant="outline"
            iconName="BarChart3"
            iconPosition="left"
          >
            {evaluating ? (
              <span className="flex items-center gap-2">
                <LoadingIndicator size={14} tone="primary" /> Evaluating...
              </span>
            ) : 'Compare Models'}
          </Button>
          <Button onClick={loadStatus} variant="outline" iconName="RefreshCw" iconPosition="left">
            Refresh
          </Button>
        </div>
        {available === 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
            No high-quality training pairs yet. Complete interviews or upload datasets to begin collecting data.
          </p>
        )}
        {available > 0 && available < threshold && (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
            You can calibrate now to create the model, but it won&apos;t be preferred at runtime until {threshold} pairs are available. Activation happens automatically once the gate is met.
          </p>
        )}
      </div>

      {/* LoRA Fine-Tuning Pipeline */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-700/50 bg-blue-50 dark:bg-blue-900/20 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
            <Icon name="FlaskConical" className="w-4 h-4" />
            True LoRA Fine-Tuning (Weight Updates)
          </h3>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
            This is how large AI companies actually train models. The "Calibrate Model" button above only changes the system prompt — the model weights stay identical.
            LoRA fine-tuning actually updates qwen3:8b&apos;s weights using your collected data, producing a genuinely calibrated model.
            Runs offline on your GPU (~30–90 min on RTX 4070).
          </p>
        </div>

        {/* Step 1: Export */}
        <div className="rounded-lg bg-white/70 dark:bg-slate-800/60 p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">
            Step 1 — Export training data
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Downloads a <code className="font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded">.jsonl</code> file formatted for <code className="font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded">scripts/fine_tune_lora.py</code>.
          </p>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleExport}
              disabled={exporting || available === 0}
              variant="outline"
              iconName={exporting ? undefined : 'Download'}
              iconPosition="left"
            >
              {exporting ? (
                <span className="flex items-center gap-2">
                  <LoadingIndicator size={14} tone="primary" /> Exporting...
                </span>
              ) : exportSuccess ? 'Downloaded!' : 'Export Training Data (.jsonl)'}
            </Button>
            {available === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">No data to export yet.</p>
            )}
          </div>
        </div>

        {/* Step 2: Run script */}
        <div className="rounded-lg bg-white/70 dark:bg-slate-800/60 p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">
            Step 2 — Run fine-tuning on your machine
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Install Unsloth once, then run the script. The script handles everything: LoRA adapters, training, GGUF export.
          </p>
          <div className="rounded bg-gray-900 dark:bg-slate-950 p-2 text-xs font-mono text-green-400 space-y-1 overflow-x-auto">
            <p className="text-gray-400"># Install once (GPU machine with CUDA)</p>
            <p>pip install &quot;unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git&quot;</p>
            <p>pip install --no-deps trl peft accelerate bitsandbytes datasets</p>
            <p className="text-gray-400 mt-1"># Run fine-tuning (~30–90 min on RTX 4070)</p>
            <p>python scripts/fine_tune_lora.py --jsonl interviewai_training_XXXX.jsonl</p>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Output: <code className="font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded">output/interviewai-qwen3-8b/interviewai-qwen3-8b-Q4_K_M.gguf</code>
          </p>
        </div>

        {/* Step 3: Register GGUF */}
        <div className="rounded-lg bg-white/70 dark:bg-slate-800/60 p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">
            Step 3 — Register trained model with Ollama
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Paste the absolute path to the <code className="font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded">.gguf</code> file the script produced.
            The server will register it as <code className="font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded">interviewai-qwen3-8b</code> and it will be used for all evaluations immediately.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={ggufPath}
              onChange={(e) => setGgufPath(e.target.value)}
              placeholder="/absolute/path/to/interviewai-qwen3-8b-Q4_K_M.gguf"
              className="flex-1 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button
              onClick={handleImportGGUF}
              disabled={importing || !ggufPath.trim()}
              iconName={importing ? undefined : 'Upload'}
              iconPosition="left"
            >
              {importing ? (
                <span className="flex items-center gap-2">
                  <LoadingIndicator size={14} tone="white" /> Registering...
                </span>
              ) : 'Register'}
            </Button>
          </div>
          {importResult && (
            <p className={`text-xs ${importResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {importResult.success ? importResult.message : importResult.error}
            </p>
          )}
        </div>
      </div>

      {/* Fine-Tune Result */}
      {fineTuneResult && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          fineTuneResult.success
            ? 'border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300'
            : 'border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300'
        }`}>
          <p className="font-medium">{fineTuneResult.success ? 'Fine-tuning completed!' : 'Fine-tuning failed'}</p>
          {fineTuneResult.success && (
            <div className="mt-1 space-y-0.5 text-xs">
              <p>Model: <span className="font-medium">{fineTuneResult.modelName}</span></p>
              <p>Examples used: <span className="font-medium">{fineTuneResult.examplesUsed}</span> from {fineTuneResult.datasetsUsed} dataset{fineTuneResult.datasetsUsed !== 1 ? 's' : ''}</p>
              <p>
                Quality gate:{' '}
                <span className={`font-medium ${fineTuneResult.activationReady ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {fineTuneResult.activationReady
                    ? `Met — model is now preferred at runtime`
                    : `Not yet met (${fineTuneResult.examplesUsed}/${fineTuneResult.minActivationThreshold} pairs used). Base model still used at runtime.`}
                </span>
              </p>
            </div>
          )}
          {fineTuneResult.error && <p className="text-xs mt-1">{fineTuneResult.error}</p>}
        </div>
      )}

      {/* Evaluation Results */}
      {evaluationResult && (
        <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-1">
            Side-by-Side Model Comparison
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
            Both models evaluated on the same test prompt. Use this to verify calibration quality.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg bg-gray-50 dark:bg-slate-900/50 p-3">
              <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2">
                Base Model — {evaluationResult.baseModel?.model || 'base'}
              </p>
              <pre className="text-xs text-gray-700 dark:text-slate-300 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                {evaluationResult.baseModel?.response || evaluationResult.baseModel?.error || 'N/A'}
              </pre>
            </div>
            <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 p-3">
              <p className="text-xs uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-2">
                Fine-Tuned — {evaluationResult.fineTunedModel?.model || 'interviewai model'}
              </p>
              <pre className="text-xs text-gray-700 dark:text-slate-300 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                {evaluationResult.fineTunedModel?.response || evaluationResult.fineTunedModel?.error || 'N/A'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Recent Fine-Tune Runs */}
      {status?.recentRuns?.length > 0 && (
        <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">Recent Fine-Tune Runs</h3>
          <div className="space-y-2">
            {status.recentRuns.map((run) => (
              <div key={run.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-slate-900/50 text-sm">
                <div>
                  <p className="font-medium text-gray-900 dark:text-slate-100">{run.modelName}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {run.examplesUsed} examples · {run.datasetsUsed} datasets
                    {run.activationReady === true && (
                      <span className="ml-2 text-purple-600 dark:text-purple-400 font-medium">· gate met</span>
                    )}
                    {run.activationReady === false && (
                      <span className="ml-2 text-amber-600 dark:text-amber-400">· gate not met</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    run.status === 'completed'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                  }`}>
                    {run.status}
                  </span>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    {new Date(run.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelFineTuningPanel;
