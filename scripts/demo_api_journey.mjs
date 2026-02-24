#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.local') });

const OUTPUT_DIR = path.join(repoRoot, 'docs', '_runtime_outputs');

const BASE_URL = (process.env.DEMO_BASE_URL || process.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const TOKENS = {
  candidate: process.env.DEMO_CANDIDATE_TOKEN || '',
  company: process.env.DEMO_COMPANY_TOKEN || '',
  reviewer: process.env.DEMO_REVIEWER_TOKEN || '',
};
const UIDS = {
  candidate: process.env.DEMO_CANDIDATE_UID || '',
  company: process.env.DEMO_COMPANY_UID || '',
  reviewer: process.env.DEMO_REVIEWER_UID || '',
};

const redactedAuthHeader = (token) => `Bearer ${String(token || '').slice(0, 10)}...<REDACTED>`;
const stringify = (value) => {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};
const isSuccess = (status) => Number(status) >= 200 && Number(status) < 300;

const resolveSampleRecordingFile = async () => {
  const configured = process.env.DEMO_SAMPLE_RECORDING_PATH;
  const candidatePaths = [
    configured,
    path.join(repoRoot, 'docs', '_demo_assets', 'sample.webm'),
  ].filter(Boolean);

  for (const candidatePath of candidatePaths) {
    try {
      const buffer = await fs.readFile(candidatePath);
      if (buffer.length > 0) {
        return {
          buffer,
          filename: path.basename(candidatePath),
        };
      }
    } catch {
      // Continue.
    }
  }

  return {
    buffer: Buffer.from([
      0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x42, 0x82, 0x88, 0x6d, 0x61, 0x74, 0x72,
      0x6f, 0x73, 0x6b, 0x61, 0x00, 0x00, 0x00, 0x01,
    ]),
    filename: 'sample.webm',
  };
};

const assertRequiredEnv = () => {
  const missing = [];
  if (!TOKENS.candidate) missing.push('DEMO_CANDIDATE_TOKEN');
  if (!TOKENS.company) missing.push('DEMO_COMPANY_TOKEN');
  if (!TOKENS.reviewer) missing.push('DEMO_REVIEWER_TOKEN');
  if (!UIDS.candidate) missing.push('DEMO_CANDIDATE_UID');
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
};

export async function runDemoJourney({
  outputBaseName = 'demo_api_journey',
  persistOutputs = true,
  quiet = false,
} = {}) {
  assertRequiredEnv();
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const traces = [];
  const checks = [];
  let interviewId = null;
  let finalInterviewPayload = null;

  const check = (name, pass, details = '') => {
    checks.push({ name, pass: Boolean(pass), details });
  };

  const apiRequest = async (step, role, method, endpoint, { body, formData, auth = true, note = '' } = {}) => {
    const headers = {};
    const token = TOKENS[role];
    if (auth && token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let payload = undefined;
    if (formData) {
      payload = formData;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: payload,
    });
    const rawText = await response.text();
    let parsed = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsed = rawText;
    }

    traces.push([
      `STEP ${step} (${role})`,
      `${method.toUpperCase()} ${BASE_URL}${endpoint}`,
      `NOTE: ${note || '-'}`,
      `STATUS: ${response.status} ${response.statusText}`,
      'REQUEST_HEADERS:',
      stringify({
        ...headers,
        ...(headers.Authorization ? { Authorization: redactedAuthHeader(token) } : {}),
      }),
      'REQUEST_BODY:',
      formData ? '[multipart/form-data payload omitted]' : stringify(body ?? null),
      'RESPONSE_BODY:',
      stringify(parsed),
      '-'.repeat(80),
    ].join('\n'));

    return { status: response.status, data: parsed };
  };

  const aiHealth = await apiRequest('0', 'company', 'GET', '/api/ai/health', {
    auth: false,
    note: 'AI health probe before journey.',
  });
  check(
    'AI health endpoint reachable',
    isSuccess(aiHealth.status),
    `status=${aiHealth.status}`,
  );
  check(
    'Ollama reachable for live scoring',
    Boolean(aiHealth.data?.ollamaReachable),
    `ollamaReachable=${Boolean(aiHealth.data?.ollamaReachable)}, modelReady=${Boolean(aiHealth.data?.modelReady)}`,
  );

  const createInterview = await apiRequest('1', 'company', 'POST', '/api/interviews/create', {
    body: {
      mode: 'HIRING',
      candidateId: UIDS.candidate,
      jobRole: 'Demo Runtime Engineer',
      experienceLevel: 'MID',
      industry: 'Technology',
      interviewTypes: ['BEHAVIORAL'],
      duration: 30,
      skillFocus: ['communication', 'problem solving'],
    },
    note: 'Create hiring interview as company.',
  });
  interviewId = createInterview.data?.interview?.id || null;
  check(
    'Create interview',
    isSuccess(createInterview.status) && Boolean(interviewId),
    `status=${createInterview.status}, interviewId=${interviewId || 'N/A'}`,
  );

  if (!interviewId) {
    const summary = {
      pass: false,
      interviewId: null,
      checks,
      traces,
      outputFiles: {},
    };
    if (persistOutputs) {
      const summaryPath = path.join(OUTPUT_DIR, `${outputBaseName}_summary.txt`);
      const tracePath = path.join(OUTPUT_DIR, `${outputBaseName}_requests_and_responses.txt`);
      await fs.writeFile(summaryPath, buildSummaryText(BASE_URL, interviewId, checks), 'utf8');
      await fs.writeFile(tracePath, `${traces.join('\n')}\n`, 'utf8');
      summary.outputFiles = { summaryPath, tracePath };
    }
    return summary;
  }

  const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const schedule = await apiRequest('2', 'company', 'POST', `/api/interviews/${interviewId}/schedule`, {
    body: {
      scheduledFor,
      timezone: 'UTC',
      meetingLink: 'https://meet.example.com/demo-live',
    },
    note: 'Schedule interview.',
  });
  check('Schedule interview', isSuccess(schedule.status), `status=${schedule.status}`);

  const rescheduledFor = new Date(Date.now() + 90 * 60 * 1000).toISOString();
  const reschedule = await apiRequest('3', 'company', 'PATCH', `/api/interviews/${interviewId}/reschedule`, {
    body: {
      scheduledFor: rescheduledFor,
      timezone: 'UTC',
      meetingLink: 'https://meet.example.com/demo-live-rescheduled',
    },
    note: 'Reschedule interview.',
  });
  check('Reschedule interview', isSuccess(reschedule.status), `status=${reschedule.status}`);

  const start = await apiRequest('4', 'candidate', 'POST', `/api/interviews/${interviewId}/start`, {
    note: 'Candidate starts interview.',
  });
  check('Start interview', isSuccess(start.status), `status=${start.status}`);

  const firstQuestionId = start.data?.interview?.questions?.[0]?.id || null;
  if (firstQuestionId) {
    const markAsked = await apiRequest('5', 'candidate', 'POST', `/api/interviews/${interviewId}/question/asked`, {
      body: { questionId: firstQuestionId },
      note: 'Mark first question asked.',
    });
    check('Mark first question asked', isSuccess(markAsked.status), `status=${markAsked.status}`);

    const answer = await apiRequest('6', 'candidate', 'POST', `/api/interviews/${interviewId}/question/answer`, {
      body: {
        questionId: firstQuestionId,
        answer: 'I handled a production incident, coordinated cross-functional teams, and restored service quickly with a documented postmortem.',
      },
      note: 'Submit first answer.',
    });
    check('Submit first answer', isSuccess(answer.status), `status=${answer.status}`);
  } else {
    check('First question generated', false, 'No question returned from start endpoint');
  }

  const end = await apiRequest('7', 'candidate', 'POST', `/api/interviews/${interviewId}/end`, {
    note: 'Candidate ends interview.',
  });
  check('End interview', isSuccess(end.status), `status=${end.status}`);
  finalInterviewPayload = end.data?.interview || null;

  if (end.data?.pendingEvaluation || end.data?.llmUnavailable) {
    const runEvaluation = await apiRequest('7b', 'reviewer', 'POST', `/api/interviews/${interviewId}/run-evaluation`, {
      note: 'Manual run-evaluation recovery path when endInterview falls back to pending.',
    });
    check(
      'Manual run-evaluation endpoint',
      isSuccess(runEvaluation.status),
      `status=${runEvaluation.status}, pendingEvaluation=${Boolean(runEvaluation.data?.pendingEvaluation)}`,
    );
    finalInterviewPayload = runEvaluation.data?.interview || finalInterviewPayload;
  }

  const evaluationCompleted = Boolean(
    finalInterviewPayload
      && finalInterviewPayload.pendingEvaluation !== true
      && finalInterviewPayload.overallScore != null
      && finalInterviewPayload.readinessLevel,
  );
  check(
    'Evaluation completed with score/readiness',
    evaluationCompleted,
    `overallScore=${finalInterviewPayload?.overallScore ?? 'null'}, readiness=${finalInterviewPayload?.readinessLevel ?? 'null'}, pending=${Boolean(finalInterviewPayload?.pendingEvaluation)}`,
  );

  const sample = await resolveSampleRecordingFile();
  const formData = new FormData();
  formData.append('recording', new File([sample.buffer], sample.filename, { type: 'video/webm' }));
  const uploadRecording = await apiRequest('8', 'company', 'POST', `/api/interviews/${interviewId}/recording`, {
    formData,
    note: `Upload recording file (${sample.filename}).`,
  });
  check(
    'Upload recording',
    isSuccess(uploadRecording.status) && Boolean(uploadRecording.data?.recordingUrl),
    `status=${uploadRecording.status}, recordingUrlPresent=${Boolean(uploadRecording.data?.recordingUrl)}`,
  );

  const recordingUrl = await apiRequest('9', 'reviewer', 'GET', `/api/interviews/${interviewId}/recording-url`, {
    note: 'Reviewer fetches signed recording URL.',
  });
  check(
    'Fetch recording URL',
    isSuccess(recordingUrl.status) && Boolean(recordingUrl.data?.recordingUrl),
    `status=${recordingUrl.status}, recordingUrlPresent=${Boolean(recordingUrl.data?.recordingUrl)}`,
  );

  const evaluation = await apiRequest('10', 'reviewer', 'GET', `/api/interviews/${interviewId}/evaluation`, {
    note: 'Reviewer fetches evaluation payload.',
  });
  check(
    'Fetch evaluation payload',
    isSuccess(evaluation.status) && Boolean(evaluation.data?.evaluation),
    `status=${evaluation.status}, evaluationPresent=${Boolean(evaluation.data?.evaluation)}`,
  );

  const pass = checks.every((item) => item.pass);
  const outputFiles = {};
  if (persistOutputs) {
    const summaryPath = path.join(OUTPUT_DIR, `${outputBaseName}_summary.txt`);
    const tracePath = path.join(OUTPUT_DIR, `${outputBaseName}_requests_and_responses.txt`);
    await fs.writeFile(summaryPath, buildSummaryText(BASE_URL, interviewId, checks), 'utf8');
    await fs.writeFile(tracePath, `${traces.join('\n')}\n`, 'utf8');
    outputFiles.summaryPath = summaryPath;
    outputFiles.tracePath = tracePath;
  }

  if (!quiet) {
    console.log(buildSummaryText(BASE_URL, interviewId, checks));
  }

  return {
    pass,
    interviewId,
    checks,
    traces,
    outputFiles,
    finalInterviewPayload,
  };
}

const buildSummaryText = (baseUrl, interviewId, checks) => {
  const passed = checks.filter((item) => item.pass).length;
  const lines = [
    `Demo API journey: ${passed === checks.length ? 'PASS' : 'FAIL'}`,
    `Base URL: ${baseUrl}`,
    `Interview ID: ${interviewId || 'UNKNOWN'}`,
    `Checks passed: ${passed}/${checks.length}`,
    '',
    'Check Results:',
    ...checks.map((item, index) => `${index + 1}. [${item.pass ? 'PASS' : 'FAIL'}] ${item.name}${item.details ? ` - ${item.details}` : ''}`),
    '',
  ];
  return lines.join('\n');
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runDemoJourney();
    if (!result.pass) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  }
}
