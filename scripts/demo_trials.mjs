#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { runDemoJourney } from './demo_api_journey.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.local') });

const OUTPUT_DIR = path.join(repoRoot, 'docs', '_runtime_outputs');
const SUMMARY_FILE = path.join(OUTPUT_DIR, 'demo_trials_summary.txt');
const DETAIL_FILE = path.join(OUTPUT_DIR, 'demo_trials_results.json');

const parseRuns = () => {
  const cliArgIndex = process.argv.findIndex((arg) => arg === '--runs');
  if (cliArgIndex >= 0 && process.argv[cliArgIndex + 1]) {
    const parsed = Number.parseInt(process.argv[cliArgIndex + 1], 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const envRuns = Number.parseInt(process.env.DEMO_TRIAL_RUNS || '30', 10);
  return Number.isFinite(envRuns) && envRuns > 0 ? envRuns : 30;
};

const parseDelayMs = () => {
  const cliArgIndex = process.argv.findIndex((arg) => arg === '--delay-ms');
  if (cliArgIndex >= 0 && process.argv[cliArgIndex + 1]) {
    const parsed = Number.parseInt(process.argv[cliArgIndex + 1], 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  const envDelay = Number.parseInt(process.env.DEMO_TRIAL_DELAY_MS || '500', 10);
  return Number.isFinite(envDelay) && envDelay >= 0 ? envDelay : 500;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const wilsonInterval = (successes, total, z = 1.96) => {
  if (!total) return { low: 0, high: 0 };
  const p = successes / total;
  const denom = 1 + ((z ** 2) / total);
  const center = (p + ((z ** 2) / (2 * total))) / denom;
  const margin = (z * Math.sqrt(((p * (1 - p)) / total) + ((z ** 2) / (4 * (total ** 2))))) / denom;
  return {
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
  };
};

export async function runDemoTrials({
  runs = parseRuns(),
  delayMs = parseDelayMs(),
} = {}) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const trialResults = [];
  const checkpointStats = new Map();
  let overallPasses = 0;

  for (let index = 0; index < runs; index += 1) {
    const trialNumber = index + 1;
    const result = await runDemoJourney({
      outputBaseName: `demo_api_journey_trial_${String(trialNumber).padStart(2, '0')}`,
      persistOutputs: false,
      quiet: true,
    });

    if (result.pass) overallPasses += 1;

    result.checks.forEach((checkpoint) => {
      const current = checkpointStats.get(checkpoint.name) || { pass: 0, total: 0 };
      current.total += 1;
      if (checkpoint.pass) current.pass += 1;
      checkpointStats.set(checkpoint.name, current);
    });

    trialResults.push({
      trial: trialNumber,
      pass: result.pass,
      interviewId: result.interviewId,
      checks: result.checks,
    });

    if (index < runs - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  const successRate = overallPasses / runs;
  const ci = wilsonInterval(overallPasses, runs);
  const checkpointSummary = [...checkpointStats.entries()].map(([name, stats]) => ({
    name,
    pass: stats.pass,
    total: stats.total,
    rate: stats.total ? stats.pass / stats.total : 0,
  }));

  const summaryLines = [
    'Demo Trials Summary',
    `Runs: ${runs}`,
    `Passes: ${overallPasses}`,
    `Failures: ${runs - overallPasses}`,
    `Success rate: ${(successRate * 100).toFixed(2)}%`,
    `Wilson 95% CI: [${(ci.low * 100).toFixed(2)}%, ${(ci.high * 100).toFixed(2)}%]`,
    '',
    'Checkpoint Pass Rates:',
    ...checkpointSummary.map((item) => (
      `- ${item.name}: ${item.pass}/${item.total} (${(item.rate * 100).toFixed(2)}%)`
    )),
    '',
  ];

  await fs.writeFile(SUMMARY_FILE, `${summaryLines.join('\n')}\n`, 'utf8');
  await fs.writeFile(DETAIL_FILE, JSON.stringify({
    generatedAt: new Date().toISOString(),
    runs,
    overallPasses,
    successRate,
    wilson95: ci,
    checkpointSummary,
    trialResults,
  }, null, 2), 'utf8');

  console.log(summaryLines.join('\n'));
  return {
    runs,
    overallPasses,
    successRate,
    wilson95: ci,
    checkpointSummary,
    trialResults,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runDemoTrials();
  } catch (error) {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  }
}
