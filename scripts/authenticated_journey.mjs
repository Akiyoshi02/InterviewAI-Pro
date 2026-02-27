#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.local') });

const OUTPUT_DIR = path.join(repoRoot, 'docs', '_runtime_outputs');
const SUMMARY_FILE = path.join(OUTPUT_DIR, 'gapclosure_AUTH_90_authenticated_journey_summary.txt');
const TRACE_FILE = path.join(OUTPUT_DIR, 'gapclosure_AUTH_91_authenticated_journey_requests_and_responses.txt');

const BASE_URL = (process.env.GAPCLOSURE_BASE_URL || process.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const TOKENS = {
  candidate: process.env.GAPCLOSURE_CANDIDATE_TOKEN || '',
  company: process.env.GAPCLOSURE_COMPANY_TOKEN || '',
  reviewer: process.env.GAPCLOSURE_REVIEWER_TOKEN || '',
};
const UIDS = {
  candidate: process.env.GAPCLOSURE_CANDIDATE_UID || '',
  company: process.env.GAPCLOSURE_COMPANY_UID || '',
  reviewer: process.env.GAPCLOSURE_REVIEWER_UID || '',
};

const traces = [];
const checks = [];

function redactToken(value) {
  if (!value || typeof value !== 'string') return '<REDACTED>';
  return `Bearer ${value.slice(0, 10)}...<REDACTED>`;
}

function stringifyBody(value) {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isSuccessStatus(status) {
  return Number(status) >= 200 && Number(status) < 300;
}

async function apiRequest(stepId, role, method, endpoint, { body, headers = {}, formData = null, note = '' } = {}) {
  const token = TOKENS[role];
  const requestHeaders = { ...headers };
  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  let payload = undefined;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const requestLog = [
    `STEP ${stepId}`,
    `ROLE: ${role}`,
    `REQUEST: ${method.toUpperCase()} ${BASE_URL}${endpoint}`,
    `NOTE: ${note || '-'}`,
    'REQUEST_HEADERS:',
    stringifyBody({
      ...requestHeaders,
      ...(requestHeaders.Authorization ? { Authorization: redactToken(token) } : {}),
    }),
    'REQUEST_BODY:',
    formData
      ? '[multipart/form-data omitted; binary payload redacted]'
      : stringifyBody(body ?? null),
  ].join('\n');

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: payload,
  });

  const responseText = await response.text();
  let parsed = null;
  try {
    parsed = responseText ? JSON.parse(responseText) : null;
  } catch {
    parsed = responseText;
  }

  const responseLog = [
    `RESPONSE_STATUS: ${response.status} ${response.statusText}`,
    'RESPONSE_BODY:',
    typeof parsed === 'string' ? parsed : stringifyBody(parsed),
    '-'.repeat(80),
  ].join('\n');

  traces.push(`${requestLog}\n${responseLog}`);
  return { status: response.status, data: parsed };
}

function check(step, condition, details) {
  checks.push({
    step,
    pass: Boolean(condition),
    details: details || '',
  });
}

function assertRequiredEnv() {
  const missing = [];
  if (!TOKENS.candidate) missing.push('GAPCLOSURE_CANDIDATE_TOKEN');
  if (!TOKENS.company) missing.push('GAPCLOSURE_COMPANY_TOKEN');
  if (!TOKENS.reviewer) missing.push('GAPCLOSURE_REVIEWER_TOKEN');
  if (!UIDS.candidate) missing.push('GAPCLOSURE_CANDIDATE_UID');
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

function buildSummary(interviewId) {
  const passed = checks.filter((item) => item.pass).length;
  const total = checks.length;
  const header = [
    `Authenticated Journey: ${passed === total ? 'PASS' : 'FAIL'}`,
    `Base URL: ${BASE_URL}`,
    `Interview ID: ${interviewId || 'UNKNOWN'}`,
    `Total checks: ${total}`,
    `Passed checks: ${passed}`,
    `Failed checks: ${total - passed}`,
    '',
    'Checks:',
  ];

  const lines = checks.map((item, index) => {
    const status = item.pass ? 'PASS' : 'FAIL';
    return `${index + 1}. [${status}] ${item.step} ${item.details ? `- ${item.details}` : ''}`;
  });

  return `${[...header, ...lines].join('\n')}\n`;
}

await fs.mkdir(OUTPUT_DIR, { recursive: true });
assertRequiredEnv();

let createdInterviewId = null;

const createPayload = {
  mode: 'HIRING',
  candidateId: UIDS.candidate,
  jobRole: 'Runtime Verification Engineer',
  experienceLevel: 'MID',
  industry: 'Technology',
  interviewTypes: ['BEHAVIORAL'],
  duration: 30,
  skillFocus: ['communication', 'problem solving'],
};

const created = await apiRequest('1', 'company', 'POST', '/api/interviews/create', {
  body: createPayload,
  note: 'Create hiring interview as company admin.',
});
createdInterviewId = created.data?.interview?.id || null;
check(
  'Create interview',
  isSuccessStatus(created.status) && Boolean(createdInterviewId),
  `status=${created.status}, interviewId=${createdInterviewId || 'N/A'}`,
);

if (!createdInterviewId) {
  const summary = buildSummary(createdInterviewId);
  await fs.writeFile(TRACE_FILE, `${traces.join('\n')}\n`, 'utf8');
  await fs.writeFile(SUMMARY_FILE, summary, 'utf8');
  console.error(summary);
  process.exit(1);
}

const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const scheduleRes = await apiRequest('2', 'company', 'POST', `/api/interviews/${createdInterviewId}/schedule`, {
  body: {
    scheduledFor,
    timezone: 'UTC',
    meetingLink: 'https://meet.example.com/gapclosure-runtime',
  },
  note: 'Schedule interview.',
});
check('Schedule interview', isSuccessStatus(scheduleRes.status), `status=${scheduleRes.status}`);

const rescheduledFor = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
const rescheduleRes = await apiRequest('3', 'company', 'PATCH', `/api/interviews/${createdInterviewId}/reschedule`, {
  body: {
    scheduledFor: rescheduledFor,
    timezone: 'UTC',
    meetingLink: 'https://meet.example.com/gapclosure-runtime-rescheduled',
  },
  note: 'Reschedule interview.',
});
check('Reschedule interview', isSuccessStatus(rescheduleRes.status), `status=${rescheduleRes.status}`);

const consentRes = await apiRequest('4', 'candidate', 'PATCH', `/api/interviews/${createdInterviewId}/recording-consent`, {
  body: {
    recordingConsentGivenAt: new Date().toISOString(),
    recordingConsentVersion: 'v1',
  },
  note: 'Record explicit candidate consent before interview start.',
});
check(
  'Record recording consent',
  isSuccessStatus(consentRes.status),
  `status=${consentRes.status}`,
);

const startRes = await apiRequest('5', 'candidate', 'POST', `/api/interviews/${createdInterviewId}/start`, {
  note: 'Start interview as candidate.',
});
check(
  'Start interview',
  isSuccessStatus(startRes.status),
  `status=${startRes.status}, questions=${startRes.data?.interview?.questions?.length || 0}`,
);

const firstQuestionId = startRes.data?.interview?.questions?.[0]?.id || null;
if (firstQuestionId) {
  const askedRes = await apiRequest('6', 'candidate', 'POST', `/api/interviews/${createdInterviewId}/question/asked`, {
    body: { questionId: firstQuestionId },
    note: 'Mark first question as asked.',
  });
  check('Mark question asked', isSuccessStatus(askedRes.status), `status=${askedRes.status}`);

  const answerRes = await apiRequest('7', 'candidate', 'POST', `/api/interviews/${createdInterviewId}/question/answer`, {
    body: {
      questionId: firstQuestionId,
      answer: 'I led a release rollback, coordinated stakeholders, and restored service in 20 minutes.',
      audioUrl: null,
    },
    note: 'Submit candidate answer.',
  });
  check('Submit answer', isSuccessStatus(answerRes.status), `status=${answerRes.status}`);
} else {
  check('First question available after start', false, 'No generated question returned by start endpoint.');
}

const endRes = await apiRequest('8', 'candidate', 'POST', `/api/interviews/${createdInterviewId}/end`, {
  note: 'End interview and verify evaluation payload is returned.',
});
check(
  'End interview',
  isSuccessStatus(endRes.status),
  `status=${endRes.status}, pendingEvaluation=${Boolean(endRes.data?.pendingEvaluation)}`,
);

const recordingBytes = new Uint8Array([
  0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x42, 0x82, 0x88, 0x6d, 0x61, 0x74, 0x72,
  0x6f, 0x73, 0x6b, 0x61, 0x00, 0x00, 0x00, 0x01,
]);
const recordingBlob = new Blob([recordingBytes], { type: 'video/webm' });
const formData = new FormData();
formData.append('recording', recordingBlob, 'session_dummy.webm');

const uploadRes = await apiRequest('9', 'company', 'POST', `/api/interviews/${createdInterviewId}/recording`, {
  formData,
  note: 'Upload durable recording artifact.',
});
check(
  'Upload recording',
  isSuccessStatus(uploadRes.status) && Boolean(uploadRes.data?.recordingUrl),
  `status=${uploadRes.status}, recordingUrlPresent=${Boolean(uploadRes.data?.recordingUrl)}`,
);

const recordingUrlRes = await apiRequest('10', 'reviewer', 'GET', `/api/interviews/${createdInterviewId}/recording-url`, {
  note: 'Reviewer fetches authorized recording URL.',
});
check(
  'Fetch recording URL (reviewer)',
  isSuccessStatus(recordingUrlRes.status) && Boolean(recordingUrlRes.data?.recordingUrl),
  `status=${recordingUrlRes.status}, recordingUrlPresent=${Boolean(recordingUrlRes.data?.recordingUrl)}`,
);

const evaluationRes = await apiRequest('11', 'reviewer', 'GET', `/api/interviews/${createdInterviewId}/evaluation`, {
  note: 'Reviewer fetches interview evaluation.',
});
check(
  'Fetch evaluation (reviewer)',
  isSuccessStatus(evaluationRes.status) && Boolean(evaluationRes.data?.evaluation),
  `status=${evaluationRes.status}, evaluationPresent=${Boolean(evaluationRes.data?.evaluation)}`,
);

const summary = buildSummary(createdInterviewId);
await fs.writeFile(TRACE_FILE, `${traces.join('\n')}\n`, 'utf8');
await fs.writeFile(SUMMARY_FILE, summary, 'utf8');

console.log(summary);
if (checks.some((item) => !item.pass)) {
  process.exit(1);
}
