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
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'demo_seed_redacted.txt');
const LOCAL_ENV_FILE = path.join(repoRoot, '.env.local');

const BASE_URL = (process.env.DEMO_BASE_URL || process.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '';

const FIXTURES = {
  candidate: {
    uid: 'demo-candidate-runtime',
    email: 'demo.candidate.runtime@interviewaipro.local',
    displayName: 'Demo Candidate Runtime',
    accountType: 'CANDIDATE',
  },
  company: {
    uid: 'demo-company-runtime',
    email: 'demo.company.runtime@interviewaipro.local',
    displayName: 'Demo Company Runtime',
    accountType: 'COMPANY',
  },
  reviewer: {
    uid: 'demo-reviewer-runtime',
    email: 'demo.reviewer.runtime@interviewaipro.local',
    displayName: 'Demo Reviewer Runtime',
    accountType: 'COMPANY',
  },
};

const ORG_NAME = 'Demo Runtime Verification Org';
const ORG_ID = 'demo-runtime-org';
const DEMO_USER_PASSWORD = process.env.DEMO_USER_PASSWORD || 'DemoRuntime#2026';

const maskToken = (token) => {
  if (!token || typeof token !== 'string') return '<REDACTED>';
  return `${token.slice(0, 10)}...<REDACTED>`;
};

const setEnvValue = (lines, key, value) => {
  const prefix = `${key}=`;
  const next = `${key}=${value}`;
  const index = lines.findIndex((line) => line.startsWith(prefix));
  if (index >= 0) {
    lines[index] = next;
  } else {
    lines.push(next);
  }
};

const upsertEnvFile = async (filePath, values) => {
  let current = '';
  try {
    current = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const lines = current
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0 && !line.trim().startsWith('#'));

  Object.entries(values).forEach(([key, value]) => {
    setEnvValue(lines, key, value);
  });

  await fs.writeFile(filePath, `${lines.join('\n')}\n`, 'utf8');
};

const ensureAuthUser = async ({ uid, email, displayName }) => {
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
      password: DEMO_USER_PASSWORD,
    });
  } else {
    userRecord = await admin.auth().updateUser(userRecord.uid, {
      email,
      displayName,
      emailVerified: true,
      disabled: false,
      password: DEMO_USER_PASSWORD,
    });
  }

  return userRecord.uid;
};

const upsertOrganization = async (companyUid) => {
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
      approvedBy: 'demo-seed-script',
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
};

const upsertUser = async (uid, payload) => {
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
};

const upsertMembership = async ({ organizationId, userId, role }) => {
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
};

const exchangeCustomToken = async (customToken) => {
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
};

const mintIdToken = async (uid) => {
  const customToken = await admin.auth().createCustomToken(uid);
  return exchangeCustomToken(customToken);
};

if (!FIREBASE_API_KEY) {
  throw new Error('Missing VITE_FIREBASE_API_KEY/FIREBASE_API_KEY for token exchange.');
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
  DEMO_BASE_URL: BASE_URL,
  DEMO_ORGANIZATION_ID: organizationId,
  DEMO_CANDIDATE_UID: candidateUid,
  DEMO_COMPANY_UID: companyUid,
  DEMO_REVIEWER_UID: reviewerUid,
  DEMO_CANDIDATE_TOKEN: candidateToken,
  DEMO_COMPANY_TOKEN: companyToken,
  DEMO_REVIEWER_TOKEN: reviewerToken,
});

const output = [
  'Demo token seeding completed.',
  `Base URL: ${BASE_URL}`,
  `Organization ID: ${organizationId}`,
  `Candidate UID: ${candidateUid}`,
  `Company UID: ${companyUid}`,
  `Reviewer UID: ${reviewerUid}`,
  `Candidate token: ${maskToken(candidateToken)}`,
  `Company token: ${maskToken(companyToken)}`,
  `Reviewer token: ${maskToken(reviewerToken)}`,
  `Secrets written to (local/untracked): ${path.relative(repoRoot, LOCAL_ENV_FILE)}`,
];

await fs.writeFile(OUTPUT_FILE, `${output.join('\n')}\n`, 'utf8');
console.log(output.join('\n'));

try {
  await admin.app().delete();
} catch {
  // Best effort cleanup.
}
