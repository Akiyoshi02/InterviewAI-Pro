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

const [{ default: admin }, { firestore }] = await Promise.all([
  import('../server/src/config/firebase.js'),
  import('../server/src/config/firebase.js'),
]);

const OUTPUT_DIR = path.join(repoRoot, 'docs', '_runtime_outputs');
const TOKEN_EVIDENCE_FILE = path.join(OUTPUT_DIR, 'gapclosure_AUTH_40_token_acquisition.txt');
const LOCAL_ENV_FILE = path.join(repoRoot, '.env.local');

const BASE_URL = process.env.GAPCLOSURE_BASE_URL || process.env.VITE_API_URL || 'http://localhost:3000';
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '';

const FIXTURES = {
  candidate: {
    uid: 'gapclosure-candidate-runtime',
    email: 'gapclosure.candidate.runtime@interviewaipro.local',
    displayName: 'Gapclosure Candidate Runtime',
    accountType: 'CANDIDATE',
  },
  company: {
    uid: 'gapclosure-company-runtime',
    email: 'gapclosure.company.runtime@interviewaipro.local',
    displayName: 'Gapclosure Company Runtime',
    accountType: 'COMPANY',
  },
  reviewer: {
    uid: 'gapclosure-reviewer-runtime',
    email: 'gapclosure.reviewer.runtime@interviewaipro.local',
    displayName: 'Gapclosure Reviewer Runtime',
    accountType: 'COMPANY',
  },
};

const ORG_NAME = 'Gapclosure Runtime Verification Org';
const ORG_ID = 'gapclosure-runtime-org';

function maskToken(token) {
  if (!token || typeof token !== 'string') return '<REDACTED>';
  const prefix = token.slice(0, 10);
  return `${prefix}...<REDACTED>`;
}

function appendUniqueLine(lines, key, value) {
  const prefix = `${key}=`;
  const index = lines.findIndex((line) => line.startsWith(prefix));
  const nextLine = `${key}=${value}`;
  if (index >= 0) {
    lines[index] = nextLine;
  } else {
    lines.push(nextLine);
  }
}

async function upsertEnvFile(filePath, variables) {
  let current = '';
  try {
    current = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const lines = current
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0 && !line.trim().startsWith('#'));

  Object.entries(variables).forEach(([key, value]) => {
    appendUniqueLine(lines, key, value);
  });

  const next = `${lines.join('\n')}\n`;
  await fs.writeFile(filePath, next, 'utf8');
}

async function ensureAuthUser({ uid, email, displayName }) {
  let userRecord = null;
  try {
    userRecord = await admin.auth().getUser(uid);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
  }

  if (!userRecord) {
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
    }
  }

  if (!userRecord) {
    userRecord = await admin.auth().createUser({
      uid,
      email,
      displayName,
      emailVerified: true,
      disabled: false,
      password: 'Gapclosure#Runtime2026',
    });
  } else {
    userRecord = await admin.auth().updateUser(userRecord.uid, {
      email,
      displayName,
      emailVerified: true,
      disabled: false,
    });
  }

  return userRecord.uid;
}

async function upsertOrganization(companyUid) {
  const nowIso = new Date().toISOString();
  const ref = firestore.collection('organizations').doc(ORG_ID);
  await ref.set(
    {
      id: ORG_ID,
      name: ORG_NAME,
      displayName: ORG_NAME,
      ownerId: companyUid,
      industry: 'Technology',
      companySize: '51-200',
      status: 'APPROVED',
      approvedBy: 'gapclosure-runtime-script',
      approvedAt: nowIso,
      branding: { theme: 'default' },
      settings: {
        retentionPolicyDays: 365,
        defaultRole: 'RECRUITER',
      },
      updatedAt: nowIso,
      createdAt: nowIso,
    },
    { merge: true },
  );
  return ORG_ID;
}

async function upsertUser(uid, payload) {
  const nowIso = new Date().toISOString();
  const ref = firestore.collection('users').doc(uid);
  await ref.set(
    {
      id: uid,
      authProvider: 'firebase',
      updatedAt: nowIso,
      createdAt: nowIso,
      ...payload,
    },
    { merge: true },
  );
}

async function upsertMembership({ organizationId, userId, role }) {
  const nowIso = new Date().toISOString();
  const id = `${organizationId}_${userId}`;
  const ref = firestore.collection('organizationMembers').doc(id);
  await ref.set(
    {
      id,
      organizationId,
      userId,
      role,
      status: 'ACTIVE',
      permissions: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    { merge: true },
  );
}

async function exchangeCustomToken(customToken) {
  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(FIREBASE_API_KEY)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: customToken,
      returnSecureToken: true,
    }),
  });

  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok || !data?.idToken) {
    throw new Error(`Custom token exchange failed (${response.status}): ${JSON.stringify(data)}`);
  }

  return data.idToken;
}

async function mintIdToken(uid) {
  const customToken = await admin.auth().createCustomToken(uid);
  return exchangeCustomToken(customToken);
}

if (!FIREBASE_API_KEY) {
  throw new Error('Missing VITE_FIREBASE_API_KEY (required to exchange Firebase custom tokens).');
}

await fs.mkdir(OUTPUT_DIR, { recursive: true });

const candidateUid = await ensureAuthUser(FIXTURES.candidate);
const companyUid = await ensureAuthUser(FIXTURES.company);
const reviewerUid = await ensureAuthUser(FIXTURES.reviewer);

const organizationId = await upsertOrganization(companyUid);

await Promise.all([
  upsertUser(candidateUid, {
    email: FIXTURES.candidate.email,
    accountType: 'CANDIDATE',
    fullName: FIXTURES.candidate.displayName,
    targetRole: 'Software Engineer',
    skills: ['communication', 'problem solving'],
    primaryOrganizationId: null,
    organizationRoles: [],
  }),
  upsertUser(companyUid, {
    email: FIXTURES.company.email,
    accountType: 'COMPANY',
    fullName: FIXTURES.company.displayName,
    companyName: ORG_NAME,
    jobTitle: 'Hiring Lead',
    department: 'Talent',
    primaryOrganizationId: organizationId,
    organizationRoles: [{ organizationId, role: 'ADMIN' }],
  }),
  upsertUser(reviewerUid, {
    email: FIXTURES.reviewer.email,
    accountType: 'COMPANY',
    fullName: FIXTURES.reviewer.displayName,
    companyName: ORG_NAME,
    jobTitle: 'Interview Reviewer',
    department: 'Talent',
    primaryOrganizationId: organizationId,
    organizationRoles: [{ organizationId, role: 'REVIEWER' }],
  }),
]);

await Promise.all([
  upsertMembership({
    organizationId,
    userId: companyUid,
    role: 'ADMIN',
  }),
  upsertMembership({
    organizationId,
    userId: reviewerUid,
    role: 'REVIEWER',
  }),
]);

const [candidateToken, companyToken, reviewerToken] = await Promise.all([
  mintIdToken(candidateUid),
  mintIdToken(companyUid),
  mintIdToken(reviewerUid),
]);

await upsertEnvFile(LOCAL_ENV_FILE, {
  GAPCLOSURE_BASE_URL: BASE_URL,
  GAPCLOSURE_CANDIDATE_UID: candidateUid,
  GAPCLOSURE_COMPANY_UID: companyUid,
  GAPCLOSURE_REVIEWER_UID: reviewerUid,
  GAPCLOSURE_ORGANIZATION_ID: organizationId,
  GAPCLOSURE_CANDIDATE_TOKEN: candidateToken,
  GAPCLOSURE_COMPANY_TOKEN: companyToken,
  GAPCLOSURE_REVIEWER_TOKEN: reviewerToken,
});

const lines = [
  'Token acquisition method: PROGRAMMATIC (Firebase Admin custom token exchange).',
  `Base URL: ${BASE_URL}`,
  `Organization ID: ${organizationId}`,
  `Candidate UID: ${candidateUid}`,
  `Company UID: ${companyUid}`,
  `Reviewer UID: ${reviewerUid}`,
  `Candidate token: ${maskToken(candidateToken)}`,
  `Company token: ${maskToken(companyToken)}`,
  `Reviewer token: ${maskToken(reviewerToken)}`,
  `Secrets storage file (untracked): ${path.relative(repoRoot, LOCAL_ENV_FILE)}`,
  'Token extraction from UI/devtools: NOT REQUIRED (programmatic path succeeded).',
];

await fs.writeFile(TOKEN_EVIDENCE_FILE, `${lines.join('\n')}\n`, 'utf8');

console.log(lines.join('\n'));
try {
  await admin.app().delete();
} catch {
  // Best-effort cleanup.
}
