import {
  organizationStore,
  organizationMemberStore,
  publishAdminRealtimeUpdate,
  userStore,
  systemSettingsStore,
  platformAuditLogStore,
  interviewStore,
  jobStore,
  reviewStore,
} from '../services/firebaseData.service.js';
import { emailNotifications } from '../services/email.service.js';
import { queueEmailJob } from '../services/backgroundJobQueue.service.js';
import { PLANS } from '../services/billing.service.js';
import { clearFeatureFlagCache } from '../middleware/featureFlags.middleware.js';
import logger from '../utils/logger.js';
import admin, { firestore, realtimeDb } from '../config/firebase.js';
import {
  classifyScore,
  buildConfusionMatrix,
  calculateMetrics,
  calculateAccuracy,
  LABELS as CLASS_LABELS,
} from '../utils/classificationMetrics.util.js';
import { calibrateFromCollectedData } from '../services/mediapipeCalibration.service.js';

const ensureRealtimeAdmin = async ({ uid, email, fullName }) => {
  if (!realtimeDb || !uid) return;
  try {
    await realtimeDb.ref(`admins/${uid}`).set({
      uid,
      email: email || null,
      fullName: fullName || null,
      updatedAt: admin.database.ServerValue.TIMESTAMP,
    });
  } catch (error) {
    logger.error('Failed to register system admin in realtime database:', error);
  }
};

const normalizeUserAccountStatus = (status) => {
  const normalized = (status || 'ACTIVE').toString().trim().toUpperCase();
  return normalized === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
};

const SYSTEM_RETENTION_DEFAULTS = Object.freeze({
  interviewDataDays: 365,
  activityLogDays: 90,
});

const SYSTEM_RETENTION_LIMITS = Object.freeze({
  interviewDataDays: Object.freeze({ min: 30, max: 3650 }),
  activityLogDays: Object.freeze({ min: 7, max: 3650 }),
});

const normalizeRetentionDays = (value, fallback, { min, max }) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(Math.min(max, Math.max(min, parsed)));
};

const getRetentionPolicy = (settings) => ({
  interviewDataDays: normalizeRetentionDays(
    settings?.dataRetention?.interviewDataDays,
    SYSTEM_RETENTION_DEFAULTS.interviewDataDays,
    SYSTEM_RETENTION_LIMITS.interviewDataDays,
  ),
  activityLogDays: normalizeRetentionDays(
    settings?.dataRetention?.activityLogDays,
    SYSTEM_RETENTION_DEFAULTS.activityLogDays,
    SYSTEM_RETENTION_LIMITS.activityLogDays,
  ),
});

const getCutoffIsoFromDays = (days) => {
  const ms = Number(days) * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms).toISOString();
};

const splitIntoChunks = (items = [], chunkSize = 450) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

const queryCollectionBeforeDate = async ({
  collection,
  dateField,
  cutoffIso,
  limit,
  additionalWhere = null,
}) => {
  try {
    let query = collection.where(dateField, '<=', cutoffIso);
    if (additionalWhere?.field) {
      query = query.where(additionalWhere.field, '==', additionalWhere.value);
    }
    query = query.orderBy(dateField, 'asc').limit(limit);
    const snapshot = await query.get();
    return snapshot.docs;
  } catch (error) {
    if (!error || !String(error?.message || '').toLowerCase().includes('index')) {
      throw error;
    }
    logger.warn(`Index unavailable for ${collection.id} retention query; using in-memory fallback.`);
    const snapshot = await collection.get();
    const filtered = snapshot.docs
      .filter((doc) => {
        const data = doc.data() || {};
        const dateValue = data[dateField];
        if (!dateValue || dateValue > cutoffIso) return false;
        if (additionalWhere?.field) {
          return data[additionalWhere.field] === additionalWhere.value;
        }
        return true;
      })
      .sort((a, b) => {
        const aValue = (a.data() || {})[dateField] || '';
        const bValue = (b.data() || {})[dateField] || '';
        return String(aValue).localeCompare(String(bValue));
      });
    return filtered.slice(0, limit);
  }
};

const countCollectionBeforeDate = async ({
  collection,
  dateField,
  cutoffIso,
  additionalWhere = null,
}) => {
  try {
    let query = collection.where(dateField, '<=', cutoffIso);
    if (additionalWhere?.field) {
      query = query.where(additionalWhere.field, '==', additionalWhere.value);
    }
    const aggregate = await query.count().get();
    const countValue = aggregate?.data()?.count;
    if (Number.isFinite(countValue)) {
      return countValue;
    }
  } catch (error) {
    logger.warn(`Count query failed for ${collection.id}; using fallback count.`, error?.message || error);
  }

  const docs = await queryCollectionBeforeDate({
    collection,
    dateField,
    cutoffIso,
    limit: 20000,
    additionalWhere,
  });
  return docs.length;
};

const redactInterviewForRetention = async ({
  interviewRef,
  interviewData,
  retentionDays,
}) => {
  const questionsSnapshot = await interviewRef.collection('questions').get();
  const poseDataSnapshot = await interviewRef.collection('poseData').limit(500).get();

  const redactionPayload = {
    transcript: null,
    evaluation: null,
    retentionPurgedAt: new Date().toISOString(),
    retentionPolicyDays: retentionDays,
    updatedAt: new Date().toISOString(),
  };

  const questionUpdateDocs = questionsSnapshot.docs.map((doc) => ({
    ref: doc.ref,
    payload: {
      answer: null,
      answerAudioUrl: null,
      feedback: null,
      strengths: [],
      weaknesses: [],
      updatedAt: new Date().toISOString(),
    },
  }));

  const writeChunks = splitIntoChunks(questionUpdateDocs, 420);
  for (const chunk of writeChunks) {
    const batch = firestore.batch();
    chunk.forEach((entry) => {
      batch.set(entry.ref, entry.payload, { merge: true });
    });
    await batch.commit();
  }

  const interviewBatch = firestore.batch();
  interviewBatch.set(interviewRef, redactionPayload, { merge: true });
  poseDataSnapshot.docs.forEach((doc) => {
    interviewBatch.delete(doc.ref);
  });
  await interviewBatch.commit();

  return {
    interviewId: interviewData.id || interviewRef.id,
    redactedQuestions: questionsSnapshot.size,
    deletedPoseDataPoints: poseDataSnapshot.size,
  };
};

const deleteDocsByRef = async (docs = []) => {
  let deleted = 0;
  const chunks = splitIntoChunks(docs, 420);
  for (const chunk of chunks) {
    const batch = firestore.batch();
    chunk.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
};

const ensureBootstrapAuthorized = async (req) => {
  const hasSystemAdmin = await userStore.hasAccountType('SYSTEM_ADMIN');
  if (!hasSystemAdmin) {
    return { hasSystemAdmin: false };
  }

  if (req.user?.accountType === 'SYSTEM_ADMIN') {
    return { hasSystemAdmin: true };
  }

  const error = new Error(
    'System admin authentication is required because a system admin already exists.',
  );
  error.status = 403;
  error.statusCode = 403;
  error.code = 'SYSTEM_ADMIN_AUTH_REQUIRED';
  throw error;
};

const sanitizeOrganization = (org) => {
  if (!org) return null;
  return {
    id: org.id,
    name: org.name,
    displayName: org.displayName,
    ownerId: org.ownerId,
    industry: org.industry,
    companySize: org.companySize,
    status: org.status,
    approvedBy: org.approvedBy,
    approvedAt: org.approvedAt,
    rejectedReason: org.rejectedReason,
    rejectedReasonCode: org.rejectedReasonCode || null,
    rejectedReasonTags: Array.isArray(org.rejectedReasonTags) ? org.rejectedReasonTags : [],
    rejectedReasonTagOther: org.rejectedReasonTagOther || null,
    rejectedAt: org.rejectedAt || null,
    rejectedBy: org.rejectedBy || null,
    reReviewRequestedAt: org.reReviewRequestedAt || null,
    reReviewRequestedBy: org.reReviewRequestedBy || null,
    reReviewRequestNote: org.reReviewRequestNote || null,
    reReviewRequestCount: Number.isFinite(org.reReviewRequestCount) ? org.reReviewRequestCount : 0,
    suspensionReason: org.suspensionReason,
    branding: org.branding,
    settings: org.settings,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
};

const sanitizeUser = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    accountType: user.accountType,
    accountStatus: normalizeUserAccountStatus(user.accountStatus),
    fullName: user.fullName,
    companyName: user.companyName,
    primaryOrganizationId: user.primaryOrganizationId,
    suspendedAt: user.suspendedAt || null,
    suspendedBy: user.suspendedBy || null,
    suspensionReason: user.suspensionReason || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'aol.com',
  'protonmail.com',
  'mail.com',
  'zoho.com',
]);

const normalizeHostname = (value) => {
  if (!value || typeof value !== 'string') return null;
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0]
    .split('#')[0]
    .replace(/\.$/, '') || null;
};

const extractHostnameFromWebsite = (website) => {
  if (!website || typeof website !== 'string') return null;
  try {
    const withProtocol = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    const hostname = new URL(withProtocol).hostname;
    return normalizeHostname(hostname);
  } catch {
    return normalizeHostname(website);
  }
};

const extractDomainFromEmail = (email) => {
  if (!email || typeof email !== 'string') return null;
  const parts = email.toLowerCase().trim().split('@');
  if (parts.length !== 2 || !parts[1]) return null;
  return normalizeHostname(parts[1]);
};

const normalizeRejectionCode = (value) =>
  (value || 'OTHER').toString().trim().toUpperCase() || 'OTHER';

const normalizeRejectionTags = (tags = [], reasonCode = 'OTHER') => {
  const normalized = Array.isArray(tags)
    ? Array.from(
        new Set(
          tags
            .map((tag) => (tag || '').toString().trim().toUpperCase())
            .filter(Boolean),
        ),
      )
    : [];

  const primaryCode = normalizeRejectionCode(reasonCode);
  if (primaryCode !== 'OTHER' && !normalized.includes(primaryCode)) {
    normalized.unshift(primaryCode);
  }

  return normalized.slice(0, 8);
};

const normalizeVerificationInsights = (insights) => {
  if (!insights) return null;
  if (typeof insights === 'object' && !Array.isArray(insights)) {
    return insights;
  }
  if (typeof insights === 'string') {
    try {
      const parsed = JSON.parse(insights);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return { raw: insights };
    }
    return { raw: insights };
  }
  return { raw: String(insights) };
};

const normalizeRegistrationNumber = (value) => {
  if (!value) return '';
  return String(value).replace(/[^a-z0-9]/gi, '').toLowerCase();
};

const toIsoDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const yearsSince = (isoDate) => {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  const nowDate = new Date();
  const diffMs = nowDate.getTime() - date.getTime();
  return diffMs / (1000 * 60 * 60 * 24 * 365.25);
};

const normalizeCheckStatus = (status) => {
  if (status === 'pass' || status === 'warn' || status === 'fail' || status === 'info') {
    return status;
  }
  return 'info';
};

const buildVerificationPayload = (organization, owner) => {
  const insights = normalizeVerificationInsights(owner?.companyVerificationInsights);
  const website = organization?.website || owner?.companyWebsite || null;
  const websiteDomain = extractHostnameFromWebsite(website);
  const companyEmail = owner?.companyEmail || null;
  const companyEmailDomain = extractDomainFromEmail(companyEmail);
  const ownerEmail = owner?.email || null;
  const ownerEmailDomain = extractDomainFromEmail(ownerEmail);
  const registrationNumber = owner?.businessRegistrationNumber || null;
  const normalizedRegistrationNumber = normalizeRegistrationNumber(registrationNumber);

  const registrationMentions = Array.isArray(insights?.registrationNumbers)
    ? insights.registrationNumbers
    : [];
  const authorityMentions = Array.isArray(insights?.authorityMentions) ? insights.authorityMentions : [];
  const addressMentions = Array.isArray(insights?.addressMentions) ? insights.addressMentions : [];
  const normalizedExtractedRegistrationNumbers = registrationMentions
    .map((item) => normalizeRegistrationNumber(item?.number || item))
    .filter(Boolean);

  const registrationMentionMatched = normalizedRegistrationNumber
    ? normalizedExtractedRegistrationNumbers.some((extracted) => extracted === normalizedRegistrationNumber)
    : false;
  const registrationMentionPartial = !registrationMentionMatched && normalizedRegistrationNumber
    ? normalizedExtractedRegistrationNumbers.some(
      (extracted) =>
        extracted.length >= 6
        && (
          extracted.includes(normalizedRegistrationNumber)
          || normalizedRegistrationNumber.includes(extracted)
        ),
    )
    : false;

  const checks = [];

  const requiredFields = [
    ['Organization name', organization?.displayName || organization?.name],
    ['Owner full name', owner?.fullName],
    ['Owner email', owner?.email],
    ['Company contact email', companyEmail],
    ['Company location', owner?.companyLocation || organization?.address],
    ['Business registration number', registrationNumber],
    ['Verification document', owner?.companyVerificationUrl],
  ];

  const missingRequired = requiredFields.filter(([, value]) => !value).map(([label]) => label);
  checks.push({
    id: 'identity-completeness',
    label: 'Identity details complete',
    status:
      missingRequired.length === 0 ? 'pass'
        : missingRequired.length <= 2 ? 'warn'
          : 'fail',
    details:
      missingRequired.length === 0
        ? 'All core identity and registration fields are present.'
        : `Missing: ${missingRequired.join(', ')}`,
  });

  if (!companyEmail) {
    checks.push({
      id: 'company-email',
      label: 'Company contact email',
      status: 'fail',
      details: 'No dedicated company contact email was provided.',
    });
  } else if (!companyEmailDomain) {
    checks.push({
      id: 'company-email',
      label: 'Company contact email',
      status: 'warn',
      details: `Company email "${companyEmail}" is not in a valid format.`,
    });
  } else if (FREE_EMAIL_DOMAINS.has(companyEmailDomain)) {
    checks.push({
      id: 'company-email',
      label: 'Company contact email',
      status: 'warn',
      details: `Company email uses a public provider (${companyEmailDomain}) instead of a business domain.`,
      evidence: { companyEmailDomain },
    });
  } else {
    checks.push({
      id: 'company-email',
      label: 'Company contact email',
      status: 'pass',
      details: `Company email domain (${companyEmailDomain}) looks business-owned.`,
      evidence: { companyEmailDomain },
    });
  }

  if (!websiteDomain || !companyEmailDomain) {
    checks.push({
      id: 'domain-alignment',
      label: 'Email and website domain alignment',
      status: 'warn',
      details: 'Provide both website and company email to validate domain ownership.',
      evidence: { websiteDomain, companyEmailDomain },
    });
  } else if (websiteDomain === companyEmailDomain) {
    checks.push({
      id: 'domain-alignment',
      label: 'Email and website domain alignment',
      status: 'pass',
      details: 'Website and company email share the same domain.',
      evidence: { websiteDomain, companyEmailDomain },
    });
  } else {
    checks.push({
      id: 'domain-alignment',
      label: 'Email and website domain alignment',
      status: 'fail',
      details: `Website domain (${websiteDomain}) does not match company email domain (${companyEmailDomain}).`,
      evidence: { websiteDomain, companyEmailDomain },
    });
  }

  if (!registrationNumber) {
    checks.push({
      id: 'registration-number',
      label: 'Business registration number',
      status: 'fail',
      details: 'No business registration number was provided.',
    });
  } else if (insights && registrationMentionMatched) {
    checks.push({
      id: 'registration-number',
      label: 'Business registration number',
      status: 'pass',
      details: 'Provided registration number appears in uploaded proof document.',
    });
  } else if (insights && registrationMentionPartial) {
    checks.push({
      id: 'registration-number',
      label: 'Business registration number',
      status: 'warn',
      details: 'Document includes a similar registration number, but exact value was not matched.',
      evidence: { extractedRegistrationCount: registrationMentions.length },
    });
  } else if (insights && registrationMentions.length > 0) {
    checks.push({
      id: 'registration-number',
      label: 'Business registration number',
      status: 'warn',
      details: 'Document includes registration numbers, but exact provided value was not matched.',
      evidence: { extractedRegistrationCount: registrationMentions.length },
    });
  } else if (insights) {
    checks.push({
      id: 'registration-number',
      label: 'Business registration number',
      status: 'warn',
      details: 'Document analysis did not extract a registration number to cross-check.',
    });
  } else {
    checks.push({
      id: 'registration-number',
      label: 'Business registration number',
      status: 'info',
      details: 'Registration number was provided, but document analysis is unavailable for comparison.',
    });
  }

  if (!owner?.companyVerificationUrl) {
    checks.push({
      id: 'verification-document',
      label: 'Verification document quality',
      status: 'fail',
      details: 'No verification document is attached.',
    });
  } else if (!insights) {
    checks.push({
      id: 'verification-document',
      label: 'Verification document quality',
      status: 'warn',
      details: 'Verification document exists, but extracted insights are unavailable.',
    });
  } else if (insights.countryMatchStatus === 'mismatch') {
    checks.push({
      id: 'verification-document',
      label: 'Verification document quality',
      status: 'fail',
      details: 'Detected document jurisdiction does not match provided company location.',
      evidence: {
        expectedCountry: insights.expectedCountry || null,
        detectedCountries: insights.detectedCountries || [],
      },
    });
  } else if (authorityMentions.length > 0 && (registrationMentions.length > 0 || addressMentions.length > 0)) {
    checks.push({
      id: 'verification-document',
      label: 'Verification document quality',
      status: 'pass',
      details: 'Document includes authority, registration, and/or address signals typically found in official records.',
      evidence: {
        authorityMentions: authorityMentions.length,
        registrationMentions: registrationMentions.length,
        addressMentions: addressMentions.length,
      },
    });
  } else {
    checks.push({
      id: 'verification-document',
      label: 'Verification document quality',
      status: 'warn',
      details: 'Document is attached but has weak official signals. Manual review is recommended.',
      evidence: {
        authorityMentions: authorityMentions.length,
        registrationMentions: registrationMentions.length,
      },
    });
  }

  const companyNameScore = typeof insights?.companyNameScore === 'number' ? insights.companyNameScore : null;
  if (companyNameScore == null) {
    checks.push({
      id: 'company-name-match',
      label: 'Company name found in document',
      status: insights ? 'warn' : 'info',
      details: insights
        ? 'Document analysis could not confidently score company name matching.'
        : 'Company name matching skipped because insights are unavailable.',
    });
  } else if (companyNameScore >= 0.6) {
    checks.push({
      id: 'company-name-match',
      label: 'Company name found in document',
      status: 'pass',
      details: `Company name match score is ${(companyNameScore * 100).toFixed(0)}%.`,
    });
  } else if (companyNameScore >= 0.35) {
    checks.push({
      id: 'company-name-match',
      label: 'Company name found in document',
      status: 'warn',
      details: `Company name match score is ${(companyNameScore * 100).toFixed(0)}%, verify manually.`,
    });
  } else {
    checks.push({
      id: 'company-name-match',
      label: 'Company name found in document',
      status: 'fail',
      details: `Company name match score is ${(companyNameScore * 100).toFixed(0)}%, likely mismatch.`,
    });
  }

  const recentDocumentDate = toIsoDate(insights?.mostRecentDate);
  if (!insights) {
    checks.push({
      id: 'document-recency',
      label: 'Document recency',
      status: 'info',
      details: 'Recency not scored because document insights are unavailable.',
    });
  } else if (!recentDocumentDate) {
    checks.push({
      id: 'document-recency',
      label: 'Document recency',
      status: 'warn',
      details: 'Document date could not be extracted. Consider requesting a clearer copy.',
    });
  } else {
    const ageYears = yearsSince(recentDocumentDate);
    if (ageYears != null && ageYears <= 3) {
      checks.push({
        id: 'document-recency',
        label: 'Document recency',
        status: 'pass',
        details: 'Document appears recent (within approximately 3 years).',
        evidence: { mostRecentDate: recentDocumentDate },
      });
    } else {
      checks.push({
        id: 'document-recency',
        label: 'Document recency',
        status: 'warn',
        details: 'Document appears older than 3 years. Confirm the company is currently active.',
        evidence: { mostRecentDate: recentDocumentDate },
      });
    }
  }

  const footprintSignals = [
    Boolean(website),
    Boolean(organization?.linkedinUrl || owner?.companyLinkedinUrl),
    Boolean(organization?.address || owner?.companyLocation),
  ];
  const footprintCount = footprintSignals.filter(Boolean).length;
  checks.push({
    id: 'public-footprint',
    label: 'Public footprint',
    status: footprintCount >= 2 ? 'pass' : 'warn',
    details:
      footprintCount >= 2
        ? 'Website plus at least one additional public signal is available.'
        : footprintCount === 1
          ? 'Only one public signal is available. Collect more evidence if needed.'
          : 'No public website, social profile, or address signal is available.',
  });

  const summary = checks.reduce(
    (acc, check) => {
      const status = normalizeCheckStatus(check.status);
      acc[status] += 1;
      acc.total += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0, info: 0, total: 0 },
  );

  const riskFlags = [];
  if (summary.fail > 0) {
    riskFlags.push('At least one critical verification check failed.');
  }
  if (missingRequired.length > 0) {
    riskFlags.push(`Missing core fields: ${missingRequired.join(', ')}.`);
  }
  if (companyEmailDomain && FREE_EMAIL_DOMAINS.has(companyEmailDomain)) {
    riskFlags.push('Company contact uses a public email provider.');
  }
  if (websiteDomain && companyEmailDomain && websiteDomain !== companyEmailDomain) {
    riskFlags.push('Company website and email domain mismatch.');
  }
  if (insights?.countryMatchStatus === 'mismatch') {
    riskFlags.push('Document country does not match provided company location.');
  }
  if (!owner?.companyVerificationUrl) {
    riskFlags.push('No verification document attached.');
  }

  let recommendationLevel = 'ready';
  let recommendationLabel = 'Ready for approval';
  let recommendationReason = 'All critical identity checks passed with limited risk.';

  if (summary.fail > 0) {
    recommendationLevel = 'high_risk';
    recommendationLabel = 'High risk - require clarification';
    recommendationReason = 'One or more critical checks failed. Request additional evidence before approval.';
  } else if (summary.warn >= 3 || summary.info >= 2) {
    recommendationLevel = 'caution';
    recommendationLabel = 'Needs manual review';
    recommendationReason = 'No critical failures, but multiple warnings require manual verification.';
  }

  return {
    summary,
    recommendation: {
      level: recommendationLevel,
      label: recommendationLabel,
      reason: recommendationReason,
    },
    checks: checks.map((check) => ({
      ...check,
      status: normalizeCheckStatus(check.status),
    })),
    riskFlags,
    domainSignals: {
      websiteDomain,
      companyEmailDomain,
      ownerEmailDomain,
      ownerEmailIsPublic: ownerEmailDomain ? FREE_EMAIL_DOMAINS.has(ownerEmailDomain) : null,
    },
    organizationProfile: {
      legalName: organization?.name || null,
      displayName: organization?.displayName || null,
      industry: organization?.industry || owner?.industry || null,
      companySize: organization?.companySize || owner?.companySize || null,
      companyType: owner?.companyType || null,
      hiringVolume: owner?.hiringVolume || null,
      website: website || null,
      location: owner?.companyLocation || null,
      address: organization?.address || owner?.companyLocation || null,
      description: organization?.description || null,
      establishedYear: owner?.establishedYear || null,
      registrationNumber: registrationNumber || null,
      socialLinks: {
        linkedin: organization?.linkedinUrl || owner?.companyLinkedinUrl || null,
        facebook: organization?.facebookUrl || null,
        youtube: organization?.youtubeUrl || null,
      },
    },
    ownerProfile: owner
      ? {
        id: owner.id,
        fullName: owner.fullName || null,
        email: owner.email || null,
        phoneNumber: owner.phoneNumber || null,
        jobTitle: owner.jobTitle || null,
        department: owner.department || null,
        companyEmail: owner.companyEmail || null,
        companyLocation: owner.companyLocation || null,
        hiringVolume: owner.hiringVolume || null,
        accountCreatedAt: owner.createdAt || null,
      }
      : null,
    evidence: {
      companyLogoUrl: organization?.logo || owner?.companyLogoUrl || null,
      verificationDocumentUrl: owner?.companyVerificationUrl || null,
      verificationDocumentName: owner?.companyVerificationOriginalName || null,
      verificationDocumentHash: owner?.companyVerificationHash || null,
      verificationInsights: insights,
    },
  };
};

export class AdminController {
  /**
   * Bootstrap initial system admin account (creates Firebase user + Firestore profile)
   * This should be called manually or via a secure admin script
   * Only use this for the first admin setup
   */
  static async bootstrapAdmin(req, res, next) {
    try {
      const { email, password, fullName } = req.body;
      await ensureBootstrapAuthorized(req);

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Note: We allow creating multiple system admins for flexibility
      // The first admin can promote others later

      // Create Firebase Auth user
      let firebaseUser;
      try {
        firebaseUser = await admin.auth().createUser({
          email,
          password,
          displayName: fullName || 'System Administrator',
          emailVerified: true, // Auto-verify admin email
        });
      } catch (error) {
        if (error.code === 'auth/email-already-exists') {
          // User exists in Firebase, try to get their UID
          const existingUser = await admin.auth().getUserByEmail(email);
          firebaseUser = existingUser;
          logger.info(`Firebase user already exists for ${email}, using existing UID`);
        } else {
          throw error;
        }
      }

      const uid = firebaseUser.uid;

      // Check if user already exists in Firestore
      let user = await userStore.getByUid(uid);

      if (user) {
        if (user.accountType === 'SYSTEM_ADMIN') {
          await ensureRealtimeAdmin({
            uid,
            email: user.email || email,
            fullName: user.fullName || fullName,
          });
          return res.json({
            success: true,
            message: 'System admin already exists',
            user: sanitizeUser(user),
          });
        }

        // Update existing user to system admin
        user = await userStore.update(uid, {
          accountType: 'SYSTEM_ADMIN',
        });
      } else {
        // Create new system admin user in Firestore
        user = await userStore.create(uid, {
          email,
          accountType: 'SYSTEM_ADMIN',
          fullName: fullName || 'System Administrator',
        });
      }

      await ensureRealtimeAdmin({
        uid,
        email,
        fullName: user?.fullName || fullName,
      });

      // Initialize system settings if not exist
      await systemSettingsStore.initialize(uid);

      // Log the action
      await platformAuditLogStore.record({
        actorId: uid,
        actorType: 'SYSTEM_ADMIN',
        action: 'ADMIN_BOOTSTRAPPED',
        targetType: 'USER',
        targetId: uid,
        metadata: { email },
      });

      logger.info(`System admin bootstrapped: ${email} (${uid})`);

      res.status(201).json({
        success: true,
        message: 'System admin created successfully',
        user: sanitizeUser(user),
        credentials: {
          email,
          uid,
          note: 'You can now log in with this email and password',
        },
      });
    } catch (error) {
      logger.error('Bootstrap admin error:', error);
      next(error);
    }
  }

  /**
   * Seed initial system admin account (one-time operation)
   * This should be called manually or via a secure admin script
   * Requires user to already exist in Firebase Auth
   */
  static async seedAdmin(req, res, next) {
    try {
      const { email, uid } = req.body;
      const normalizedEmail = (email || '').toString().trim().toLowerCase();

      if (!normalizedEmail || !uid) {
        return res.status(400).json({ error: 'Email and UID are required' });
      }

      // Check if user already exists
      let user = await userStore.getByUid(uid);

      if (user) {
        if (user.accountType === 'SYSTEM_ADMIN') {
          await ensureRealtimeAdmin({
            uid: user.id || uid,
            email: user.email || normalizedEmail,
            fullName: user.fullName || req.body.fullName,
          });
          return res.json({
            success: true,
            message: 'System admin already exists',
            user: sanitizeUser(user),
          });
        }
      } else {
        // Safe idempotent retry path: if the email already belongs to a system admin,
        // treat this request as already satisfied even if the caller supplied a stale UID.
        const existingByEmail = await userStore.getByEmail(normalizedEmail);
        if (existingByEmail?.accountType === 'SYSTEM_ADMIN') {
          await ensureRealtimeAdmin({
            uid: existingByEmail.id,
            email: existingByEmail.email || normalizedEmail,
            fullName: existingByEmail.fullName || req.body.fullName,
          });
          return res.json({
            success: true,
            message: existingByEmail.id === uid
              ? 'System admin already exists'
              : 'System admin already exists for this email',
            user: sanitizeUser(existingByEmail),
            ...(existingByEmail.id !== uid
              ? {
                requestedUid: uid,
                resolvedUid: existingByEmail.id,
              }
              : {}),
          });
        }
      }

      // If a system admin already exists, only authenticated system admins can
      // promote additional users. The idempotent "already exists" success path
      // above remains available for safe retries.
      await ensureBootstrapAuthorized(req);

      if (user) {
        // Update existing user to system admin
        user = await userStore.update(uid, {
          accountType: 'SYSTEM_ADMIN',
        });
      } else {
        // Create new system admin user
        user = await userStore.create(uid, {
          email: normalizedEmail,
          accountType: 'SYSTEM_ADMIN',
          fullName: req.body.fullName || 'System Administrator',
        });
      }

      await ensureRealtimeAdmin({
        uid: user?.id || uid,
        email: user?.email || normalizedEmail,
        fullName: user?.fullName || req.body.fullName,
      });

      // Initialize system settings if not exist
      await systemSettingsStore.initialize(uid);

      // Log the action
      await platformAuditLogStore.record({
        actorId: uid,
        actorType: 'SYSTEM_ADMIN',
        action: 'ADMIN_SEEDED',
        targetType: 'USER',
        targetId: uid,
        metadata: { email: normalizedEmail },
      });

      logger.info(`System admin seeded: ${normalizedEmail}`);

      res.status(201).json({
        success: true,
        message: 'System admin created successfully',
        user: sanitizeUser(user),
      });
    } catch (error) {
      logger.error('Seed admin error:', error);
      next(error);
    }
  }

  /**
   * List all organizations with optional status filter
   */
  static async listOrganizations(req, res, next) {
    try {
      const { status, limit = 100, offset = 0 } = req.query;

      let organizations;
      if (status) {
        organizations = await organizationStore.listByStatus(status, parseInt(limit));
      } else {
        organizations = await organizationStore.listAll(parseInt(limit), parseInt(offset));
      }

      // Enrich with owner information
      const ownerIds = organizations.map((org) => org.ownerId).filter(Boolean);
      const owners = await userStore.getSummaries(ownerIds);

      const enriched = organizations.map((org) => ({
        ...sanitizeOrganization(org),
        owner: owners.get(org.ownerId) || null,
      }));

      res.json({
        success: true,
        organizations: enriched,
        total: enriched.length,
      });
    } catch (error) {
      logger.error('List organizations error:', error);
      next(error);
    }
  }

  /**
   * Get pending organizations (awaiting approval)
   */
  static async listPendingOrganizations(req, res, next) {
    try {
      const { limit = 50 } = req.query;

      const organizations = await organizationStore.listByStatus('PENDING', parseInt(limit));

      // Enrich with owner information
      const ownerIds = organizations.map((org) => org.ownerId).filter(Boolean);
      const owners = await userStore.getSummaries(ownerIds);

      // Get member counts
      const enriched = await Promise.all(
        organizations.map(async (org) => {
          const members = await organizationMemberStore.listByOrganization(org.id);
          return {
            ...sanitizeOrganization(org),
            owner: owners.get(org.ownerId) || null,
            memberCount: members.length,
          };
        }),
      );

      res.json({
        success: true,
        organizations: enriched,
        total: enriched.length,
      });
    } catch (error) {
      logger.error('List pending organizations error:', error);
      next(error);
    }
  }

  /**
   * Get organization details
   */
  static async getOrganization(req, res, next) {
    try {
      const { id } = req.params;

      const organization = await organizationStore.getById(id);
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const owner = organization.ownerId ? await userStore.getByUid(organization.ownerId) : null;
      const verification = buildVerificationPayload(organization, owner);

      // Get members
      const members = await organizationMemberStore.listByOrganization(id);
      const userIds = members.map((m) => m.userId);
      const users = await userStore.getSummaries(userIds);

      // Get stats
      const jobs = await jobStore.listByOrganization(id);
      const interviews = await interviewStore.listByOrganization(id);

      res.json({
        success: true,
        organization: sanitizeOrganization(organization),
        owner: owner
          ? {
            id: owner.id,
            email: owner.email || null,
            fullName: owner.fullName || null,
            accountType: owner.accountType || null,
            companyName: owner.companyName || null,
            profilePhotoUrl: owner.profilePhotoUrl || owner.photoURL || null,
          }
          : null,
        verification,
        members: members.map((m) => ({
          ...m,
          user: users.get(m.userId) || null,
        })),
        stats: {
          memberCount: members.length,
          jobCount: jobs.length,
          interviewCount: interviews.length,
        },
      });
    } catch (error) {
      logger.error('Get organization error:', error);
      next(error);
    }
  }

  /**
   * Approve organization
   */
  static async approveOrganization(req, res, next) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;

      const organization = await organizationStore.getById(id);
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      if (organization.status === 'APPROVED') {
        return res.json({
          success: true,
          message: 'Organization is already approved',
          organization: sanitizeOrganization(organization),
        });
      }

      const approved = await organizationStore.approve(id, adminId);

      // Log the action
      await platformAuditLogStore.record({
        actorId: adminId,
        actorType: 'SYSTEM_ADMIN',
        action: 'ORG_APPROVED',
        targetType: 'ORGANIZATION',
        targetId: id,
        metadata: {
          organizationName: organization.name,
          ownerId: organization.ownerId,
        },
      });

      // Send approval email in background.
      const owner = await userStore.getByUid(organization.ownerId).catch(() => null);
      if (owner?.email) {
        queueEmailJob({
          type: 'ORG_APPROVED_EMAIL',
          payload: {
            organizationId: approved.id,
            ownerId: owner.id,
            recipient: owner.email,
          },
          handler: async () => {
            await emailNotifications.sendOrganizationApproved(approved, owner);
            logger.info(`Approval email sent to ${owner.email}`);
          },
        });
      }

      logger.info(`Organization approved: ${id} by admin ${adminId}`);

      await publishAdminRealtimeUpdate('organization-status-updated', {
        organizationId: id,
        status: approved?.status || 'APPROVED',
      });

      res.json({
        success: true,
        message: 'Organization approved successfully',
        organization: sanitizeOrganization(approved),
      });
    } catch (error) {
      logger.error('Approve organization error:', error);
      next(error);
    }
  }

  /**
   * Reject organization
   */
  static async rejectOrganization(req, res, next) {
    try {
      const { id } = req.params;
      const { reason, reasonCode, reasonTags, reasonTagOther } = req.body;
      const adminId = req.user.id;

      const organization = await organizationStore.getById(id);
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      if (organization.status === 'REJECTED') {
        return res.json({
          success: true,
          message: 'Organization is already rejected',
          organization: sanitizeOrganization(organization),
        });
      }

      if (organization.status !== 'PENDING') {
        return res.status(409).json({
          success: false,
          error: `Only pending organizations can be rejected. Current status: ${organization.status}.`,
          code: 'INVALID_ORG_STATUS',
        });
      }

      const normalizedReasonCode = normalizeRejectionCode(reasonCode);
      const normalizedReasonTags = normalizeRejectionTags(reasonTags, normalizedReasonCode);
      const normalizedReasonTagOther = normalizedReasonTags.includes('OTHER') && reasonTagOther
        ? String(reasonTagOther).trim()
        : null;
      const rejected = await organizationStore.reject(id, {
        reason,
        rejectedBy: adminId,
        reasonCode: normalizedReasonCode,
        reasonTags: normalizedReasonTags,
        reasonTagOther: normalizedReasonTagOther,
      });

      // Log the action
      await platformAuditLogStore.record({
        actorId: adminId,
        actorType: 'SYSTEM_ADMIN',
        action: 'ORG_REJECTED',
        targetType: 'ORGANIZATION',
        targetId: id,
        metadata: {
          organizationName: organization.name,
          ownerId: organization.ownerId,
          reason,
          reasonCode: normalizedReasonCode,
          reasonTags: normalizedReasonTags,
          reasonTagOther: normalizedReasonTagOther,
        },
      });

      // Send rejection email in background.
      const owner = await userStore.getByUid(organization.ownerId).catch(() => null);
      if (!owner) {
        logger.warn(`Owner not found for organization ${id}, ownerId: ${organization.ownerId}`);
      } else if (!owner.email) {
        logger.warn(`Owner ${organization.ownerId} does not have an email address`);
      } else {
        queueEmailJob({
          type: 'ORG_REJECTED_EMAIL',
          payload: {
            organizationId: rejected.id,
            ownerId: owner.id,
            recipient: owner.email,
          },
          handler: async () => {
            logger.info(`Attempting to send rejection email to ${owner.email} for organization ${organization.name}`);
            await emailNotifications.sendOrganizationRejected(rejected, owner, reason);
            logger.info(`Rejection email sent successfully to ${owner.email}`);
          },
        });
      }

      logger.info(`Organization rejected: ${id} by admin ${adminId}, reason: ${reason}`);

      await publishAdminRealtimeUpdate('organization-status-updated', {
        organizationId: id,
        status: rejected?.status || 'REJECTED',
      });

      res.json({
        success: true,
        message: 'Organization rejected',
        organization: sanitizeOrganization(rejected),
      });
    } catch (error) {
      logger.error('Reject organization error:', error);
      next(error);
    }
  }

  /**
   * Suspend organization
   */
  static async suspendOrganization(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user.id;

      const organization = await organizationStore.getById(id);
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      if (organization.status === 'SUSPENDED') {
        return res.json({
          success: true,
          message: 'Organization is already suspended',
          organization: sanitizeOrganization(organization),
        });
      }

      if (organization.status !== 'APPROVED') {
        return res.status(409).json({
          success: false,
          error: `Only approved organizations can be suspended. Current status: ${organization.status}.`,
          code: 'INVALID_ORG_STATUS',
        });
      }

      const suspended = await organizationStore.suspend(id, reason, adminId);

      // Log the action
      await platformAuditLogStore.record({
        actorId: adminId,
        actorType: 'SYSTEM_ADMIN',
        action: 'ORG_SUSPENDED',
        targetType: 'ORGANIZATION',
        targetId: id,
        metadata: {
          organizationName: organization.name,
          ownerId: organization.ownerId,
          reason,
        },
      });

      // Send suspension email in background.
      const owner = await userStore.getByUid(organization.ownerId).catch(() => null);
      if (!owner) {
        logger.warn(`Owner not found for organization ${id}, ownerId: ${organization.ownerId}`);
      } else if (!owner.email) {
        logger.warn(`Owner ${organization.ownerId} does not have an email address`);
      } else {
        queueEmailJob({
          type: 'ORG_SUSPENDED_EMAIL',
          payload: {
            organizationId: suspended.id,
            ownerId: owner.id,
            recipient: owner.email,
          },
          handler: async () => {
            await emailNotifications.sendOrganizationSuspended(suspended, owner, reason);
            logger.info(`Suspension email sent successfully to ${owner.email}`);
          },
        });
      }

      logger.info(`Organization suspended: ${id} by admin ${adminId}, reason: ${reason}`);

      await publishAdminRealtimeUpdate('organization-status-updated', {
        organizationId: id,
        status: suspended?.status || 'SUSPENDED',
      });

      res.json({
        success: true,
        message: 'Organization suspended',
        organization: sanitizeOrganization(suspended),
      });
    } catch (error) {
      logger.error('Suspend organization error:', error);
      next(error);
    }
  }

  /**
   * Reactivate suspended organization
   */
  static async activateOrganization(req, res, next) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;

      const organization = await organizationStore.getById(id);
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      if (organization.status === 'APPROVED') {
        return res.json({
          success: true,
          message: 'Organization is already active',
          organization: sanitizeOrganization(organization),
        });
      }

      if (organization.status !== 'SUSPENDED') {
        return res.status(409).json({
          success: false,
          error: `Only suspended organizations can be activated. Current status: ${organization.status}.`,
          code: 'INVALID_ORG_STATUS',
        });
      }

      const activated = await organizationStore.activate(id);

      // Log the action
      await platformAuditLogStore.record({
        actorId: adminId,
        actorType: 'SYSTEM_ADMIN',
        action: 'ORG_ACTIVATED',
        targetType: 'ORGANIZATION',
        targetId: id,
        metadata: {
          organizationName: organization.name,
          ownerId: organization.ownerId,
        },
      });

      // Send reactivation email in background.
      const owner = await userStore.getByUid(organization.ownerId).catch(() => null);
      if (!owner) {
        logger.warn(`Owner not found for organization ${id}, ownerId: ${organization.ownerId}`);
      } else if (!owner.email) {
        logger.warn(`Owner ${organization.ownerId} does not have an email address`);
      } else {
        queueEmailJob({
          type: 'ORG_REACTIVATED_EMAIL',
          payload: {
            organizationId: activated.id,
            ownerId: owner.id,
            recipient: owner.email,
          },
          handler: async () => {
            await emailNotifications.sendOrganizationReactivated(activated, owner);
            logger.info(`Reactivation email sent successfully to ${owner.email}`);
          },
        });
      }

      logger.info(`Organization activated: ${id} by admin ${adminId}`);

      await publishAdminRealtimeUpdate('organization-status-updated', {
        organizationId: id,
        status: activated?.status || 'APPROVED',
      });

      res.json({
        success: true,
        message: 'Organization activated',
        organization: sanitizeOrganization(activated),
      });
    } catch (error) {
      logger.error('Activate organization error:', error);
      next(error);
    }
  }

  /**
   * Get public config (safe for unauthenticated clients, e.g. interview page).
   * Used for "configurable multimodal within limits of defensible feedback" (2.7.3).
   */
  static async getPublicConfig(req, res, next) {
    try {
      const settings = await systemSettingsStore.get();
      res.json({
        success: true,
        nonverbalFeedbackEnabled: settings?.nonverbalFeedbackEnabled !== false,
        featureFlags: settings?.featureFlags || null,
      });
    } catch (error) {
      logger.error('Get public config error:', error);
      res.json({
        success: true,
        nonverbalFeedbackEnabled: true,
        featureFlags: null,
      });
    }
  }

  /**
   * Get system settings
   */
  static async getMaintenanceStatus(req, res, next) {
    try {
      const settings = await systemSettingsStore.get();
      res.json({
        success: true,
        maintenanceMode: settings?.maintenanceMode || false,
      });
    } catch (error) {
      logger.error('Get maintenance status error:', error);
      // On error, return false (no maintenance mode)
      res.json({
        success: true,
        maintenanceMode: false,
      });
    }
  }

  static async getSettings(req, res, next) {
    try {
      const settings = await systemSettingsStore.get();
      res.json({
        success: true,
        settings,
      });
    } catch (error) {
      logger.error('Get settings error:', error);
      next(error);
    }
  }

  /**
   * Update system settings
   */
  static async updateSettings(req, res, next) {
    try {
      const adminId = req.user.id;
      const updates = req.body;

      const settings = await systemSettingsStore.update(updates, adminId);
      clearFeatureFlagCache();

      // Log the action
      await platformAuditLogStore.record({
        actorId: adminId,
        actorType: 'SYSTEM_ADMIN',
        action: 'SETTINGS_UPDATED',
        targetType: 'SETTINGS',
        targetId: 'global',
        metadata: { updates },
      });

      logger.info(`System settings updated by admin ${adminId}`);

      await publishAdminRealtimeUpdate('system-settings-updated', {
        maintenanceMode: settings?.maintenanceMode || false,
        nonverbalFeedbackEnabled: settings?.nonverbalFeedbackEnabled !== false,
      });

      res.json({
        success: true,
        settings,
      });
    } catch (error) {
      logger.error('Update settings error:', error);
      next(error);
    }
  }

  /**
   * Get platform audit logs
   */
  static async getAuditLogs(req, res, next) {
    try {
      const { limit = 100, offset = 0, cursor = null } = req.query;
      const parsedLimit = Number.parseInt(limit, 10);
      const parsedOffset = Number.parseInt(offset, 10);
      const normalizedCursor = typeof cursor === 'string' ? cursor.trim() : null;

      const page = normalizedCursor
        ? await platformAuditLogStore.listPage({
          limit: parsedLimit,
          cursor: normalizedCursor,
        })
        : await platformAuditLogStore.listPageFromOffset({
          limit: parsedLimit,
          offset: parsedOffset,
        });
      const logs = page.items;

      // Enrich with actor information
      const actorIds = logs.map((log) => log.actorId).filter(Boolean);
      const actors = await userStore.getSummaries(actorIds);

      const enriched = logs.map((log) => ({
        ...log,
        actor: actors.get(log.actorId) || null,
      }));

      res.json({
        success: true,
        logs: enriched,
        total: enriched.length,
        hasMore: page.hasMore,
        nextCursor: page.nextCursor,
      });
    } catch (error) {
      logger.error('Get audit logs error:', error);
      next(error);
    }
  }

  /**
   * Get platform statistics
   */
  static async getStats(req, res, next) {
    try {
      const [allOrgs, usersSnapshot, subscriptionsSnapshot] = await Promise.all([
        organizationStore.listAll(1000, 0),
        firestore.collection('users').get(),
        firestore.collection('subscriptions').get(),
      ]);
      const pendingOrgs = allOrgs.filter((o) => o.status === 'PENDING');
      const approvedOrgs = allOrgs.filter((o) => o.status === 'APPROVED');
      const rejectedOrgs = allOrgs.filter((o) => o.status === 'REJECTED');
      const suspendedOrgs = allOrgs.filter((o) => o.status === 'SUSPENDED');

      const users = usersSnapshot.docs.map((doc) => doc.data() || {});
      const usersByType = users.reduce(
        (acc, user) => {
          const type = (user.accountType || 'UNKNOWN').toString().toUpperCase();
          if (type === 'CANDIDATE') acc.candidates += 1;
          else if (type === 'COMPANY') acc.companyUsers += 1;
          else if (type === 'SYSTEM_ADMIN') acc.systemAdmins += 1;
          else acc.other += 1;
          return acc;
        },
        {
          candidates: 0,
          companyUsers: 0,
          systemAdmins: 0,
          other: 0,
        },
      );
      const suspendedUsers = users.filter(
        (user) => normalizeUserAccountStatus(user.accountStatus) === 'SUSPENDED',
      ).length;

      const subscriptions = subscriptionsSnapshot.docs.map((doc) => doc.data() || {});
      const activeSubscriptions = subscriptions.filter(
        (subscription) => (subscription.status || '').toString().toLowerCase() === 'active',
      ).length;
      
      // Get recent activity
      const recentLogsPage = await platformAuditLogStore.listPage({ limit: 10 });
      const recentLogs = recentLogsPage.items;
      
      // Enrich with actor information
      const actorIds = recentLogs.map((log) => log.actorId).filter(Boolean);
      const actors = actorIds.length > 0 ? await userStore.getSummaries(actorIds) : new Map();
      
      const enrichedLogs = recentLogs.map((log) => ({
        ...log,
        actor: actors.get(log.actorId) || null,
        timestamp: log.createdAt, // Add timestamp alias for compatibility
      }));

      res.json({
        success: true,
        stats: {
          organizations: {
            total: allOrgs.length,
            pending: pendingOrgs.length,
            approved: approvedOrgs.length,
            rejected: rejectedOrgs.length,
            suspended: suspendedOrgs.length,
          },
          users: {
            total: users.length,
            suspended: suspendedUsers,
            ...usersByType,
          },
          billing: {
            totalSubscriptions: subscriptions.length,
            activeSubscriptions,
          },
          recentActivity: enrichedLogs,
        },
      });
    } catch (error) {
      logger.error('Get stats error:', error);
      next(error);
    }
  }

  /**
   * Get fairness and calibration metrics (FR10).
   * Aggregates score distribution and AI vs SME calibration from recent interviews and reviews.
   */
  static async getFairnessCalibration(req, res, next) {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 500, 1000);
      const [interviews, reviews] = await Promise.all([
        interviewStore.listRecent(limit),
        reviewStore.listRecent(limit),
      ]);

      const completed = interviews.filter((i) => i.status === 'COMPLETED');
      const withScore = completed.filter((i) => i.overallScore != null && !Number.isNaN(Number(i.overallScore)));

      const scoreBuckets = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 };
      withScore.forEach((i) => {
        const s = Number(i.overallScore);
        if (s <= 20) scoreBuckets['0-20'] += 1;
        else if (s <= 40) scoreBuckets['21-40'] += 1;
        else if (s <= 60) scoreBuckets['41-60'] += 1;
        else if (s <= 80) scoreBuckets['61-80'] += 1;
        else scoreBuckets['81-100'] += 1;
      });

      const withFinalScore = completed.filter((i) => i.finalOverallScore != null || i.overallScore != null);
      const finalScoreBuckets = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 };
      withFinalScore.forEach((i) => {
        const s = Number(i.finalOverallScore ?? i.overallScore);
        if (s <= 20) finalScoreBuckets['0-20'] += 1;
        else if (s <= 40) finalScoreBuckets['21-40'] += 1;
        else if (s <= 60) finalScoreBuckets['41-60'] += 1;
        else if (s <= 80) finalScoreBuckets['61-80'] += 1;
        else finalScoreBuckets['81-100'] += 1;
      });

      const calibrationPairs = reviews.filter(
        (r) =>
          r.aiOverallScoreAtReview != null &&
          !Number.isNaN(Number(r.aiOverallScoreAtReview)) &&
          r.smeOverallScore != null &&
          !Number.isNaN(Number(r.smeOverallScore))
      );
      const overrideCount = reviews.filter((r) => r.overrideOverall === true).length;
      const meanAbsDiff =
        calibrationPairs.length > 0
          ? calibrationPairs.reduce((sum, r) => sum + Math.abs(Number(r.aiOverallScoreAtReview) - Number(r.smeOverallScore)), 0) /
            calibrationPairs.length
          : null;
      const agreementWithin10 =
        calibrationPairs.length > 0
          ? calibrationPairs.filter((r) => Math.abs(Number(r.aiOverallScoreAtReview) - Number(r.smeOverallScore)) <= 10).length
          : 0;

      // Inter-rater reliability: ICC(2,1) for AI vs SME (continuous scores, two-way random single measure)
      let icc = null;
      if (calibrationPairs.length >= 2) {
        const n = calibrationPairs.length;
        const aiScores = calibrationPairs.map((r) => Number(r.aiOverallScoreAtReview));
        const smeScores = calibrationPairs.map((r) => Number(r.smeOverallScore));
        const grandMean = (aiScores.reduce((a, b) => a + b, 0) + smeScores.reduce((a, b) => a + b, 0)) / (2 * n);
        const subjectMeans = aiScores.map((ai, i) => (ai + smeScores[i]) / 2);
        const ssSubjects = 2 * subjectMeans.reduce((sum, m) => sum + (m - grandMean) ** 2, 0);
        const ssTotal =
          aiScores.reduce((sum, x) => sum + (x - grandMean) ** 2, 0) +
          smeScores.reduce((sum, x) => sum + (x - grandMean) ** 2, 0);
        const ssError = ssTotal - ssSubjects;
        const msSubjects = ssSubjects / (n - 1);
        const msError = ssError / n;
        const rawIcc = (msSubjects - msError) / (msSubjects + msError);
        icc = Number.isFinite(rawIcc) ? Math.round(Math.max(0, Math.min(1, rawIcc)) * 1000) / 1000 : null;
      }

      res.json({
        success: true,
        fairness: {
          completedInterviews: completed.length,
          withScore: withScore.length,
          scoreDistribution: scoreBuckets,
          finalScoreDistribution: finalScoreBuckets,
          smeOverrideCount: completed.filter((i) => i.finalScoreSource === 'SME').length,
        },
        calibration: {
          reviewsWithBothScores: calibrationPairs.length,
          meanAbsoluteDifference: meanAbsDiff != null ? Math.round(meanAbsDiff * 10) / 10 : null,
          agreementWithin10Points: agreementWithin10,
          agreementWithin10Percent:
            calibrationPairs.length > 0
              ? Math.round((agreementWithin10 / calibrationPairs.length) * 100)
              : null,
          interRaterReliabilityIcc: icc,
          overrideCount,
          totalReviews: reviews.length,
        },
        sampleSize: { interviews: interviews.length, reviews: reviews.length },
      });
    } catch (error) {
      logger.error('Get fairness calibration error:', error);
      next(error);
    }
  }

  static async registerLiveChatAdmin(req, res, next) {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      await ensureRealtimeAdmin({
        uid: adminUser.id,
        email: adminUser.email,
        fullName: adminUser.fullName,
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('Register live chat admin error:', error);
      next(error);
    }
  }

  /**
   * List all users (with filters)
   */
  static async listUsers(req, res, next) {
    try {
      const {
        accountType = null,
        status = null,
        q = '',
        limit = 100,
        offset = 0,
      } = req.query;

      const parsedLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 100, 500));
      const parsedOffset = Math.max(0, Number.parseInt(offset, 10) || 0);

      const page = await userStore.list({
        accountType,
        accountStatus: status,
        query: q,
        limit: parsedLimit,
        offset: parsedOffset,
      });

      const organizationIds = Array.from(
        new Set(page.users.map((user) => user.primaryOrganizationId).filter(Boolean)),
      );
      const organizations = await Promise.all(
        organizationIds.map(async (id) => organizationStore.getById(id)),
      );
      const organizationsById = new Map(
        organizations.filter(Boolean).map((org) => [org.id, org]),
      );

      const users = page.users.map((user) => ({
        ...sanitizeUser(user),
        organization: user.primaryOrganizationId
          ? (() => {
              const organization = organizationsById.get(user.primaryOrganizationId);
              return organization
                ? {
                    id: organization.id,
                    name: organization.displayName || organization.name || null,
                    status: organization.status || null,
                  }
                : null;
            })()
          : null,
      }));

      res.json({
        success: true,
        users,
        total: page.total,
        limit: parsedLimit,
        offset: parsedOffset,
        hasMore: parsedOffset + users.length < page.total,
      });
    } catch (error) {
      logger.error('List users error:', error);
      next(error);
    }
  }

  static async updateUserStatus(req, res, next) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;
      const status = normalizeUserAccountStatus(req.body?.status);
      const reason = req.body?.reason ? String(req.body.reason).trim() : null;

      const targetUser = await userStore.getByUid(id);
      if (!targetUser) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      if (id === adminId && status === 'SUSPENDED') {
        return res.status(409).json({
          success: false,
          error: 'You cannot suspend your own account.',
          code: 'SELF_SUSPEND_FORBIDDEN',
        });
      }

      if ((targetUser.accountType || '').toUpperCase() === 'SYSTEM_ADMIN' && status === 'SUSPENDED') {
        return res.status(409).json({
          success: false,
          error: 'System admin accounts cannot be suspended from this panel.',
          code: 'SYSTEM_ADMIN_SUSPEND_FORBIDDEN',
        });
      }

      const currentStatus = normalizeUserAccountStatus(targetUser.accountStatus);
      if (currentStatus === status) {
        return res.json({
          success: true,
          message: `User is already ${status}`,
          user: sanitizeUser(targetUser),
        });
      }

      const updates = status === 'SUSPENDED'
        ? {
            accountStatus: 'SUSPENDED',
            suspendedAt: new Date().toISOString(),
            suspendedBy: adminId,
            suspensionReason: reason || null,
          }
        : {
            accountStatus: 'ACTIVE',
            suspendedAt: null,
            suspendedBy: null,
            suspensionReason: null,
          };

      const updatedUser = await userStore.update(id, updates);
      try {
        await admin.auth().updateUser(id, {
          disabled: status === 'SUSPENDED',
        });
      } catch (firebaseError) {
        logger.error(`Failed to update Firebase auth status for user ${id}:`, firebaseError);
      }

      const action = status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_ACTIVATED';
      await platformAuditLogStore.record({
        actorId: adminId,
        actorType: 'SYSTEM_ADMIN',
        action,
        targetType: 'USER',
        targetId: id,
        metadata: {
          targetAccountType: updatedUser.accountType || null,
          reason: reason || null,
          previousStatus: currentStatus,
          nextStatus: status,
        },
      });

      await publishAdminRealtimeUpdate('user-status-updated', {
        userId: id,
        status,
      });

      return res.json({
        success: true,
        message: status === 'SUSPENDED' ? 'User suspended successfully' : 'User activated successfully',
        user: sanitizeUser(updatedUser),
      });
    } catch (error) {
      logger.error('Update user status error:', error);
      next(error);
    }
  }

  static async promoteToSystemAdmin(req, res, next) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;

      const targetUser = await userStore.getByUid(id);
      if (!targetUser) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      if ((targetUser.accountType || '').toUpperCase() === 'SYSTEM_ADMIN') {
        await ensureRealtimeAdmin({
          uid: targetUser.id,
          email: targetUser.email,
          fullName: targetUser.fullName,
        });
        return res.json({
          success: true,
          message: 'User is already a system admin',
          user: sanitizeUser(targetUser),
        });
      }

      const promotedUser = await userStore.update(id, {
        accountType: 'SYSTEM_ADMIN',
        accountStatus: 'ACTIVE',
        suspendedAt: null,
        suspendedBy: null,
        suspensionReason: null,
      });

      await ensureRealtimeAdmin({
        uid: promotedUser.id,
        email: promotedUser.email,
        fullName: promotedUser.fullName,
      });

      await platformAuditLogStore.record({
        actorId: adminId,
        actorType: 'SYSTEM_ADMIN',
        action: 'USER_PROMOTED_SYSTEM_ADMIN',
        targetType: 'USER',
        targetId: id,
        metadata: {
          previousAccountType: targetUser.accountType || null,
          nextAccountType: 'SYSTEM_ADMIN',
          email: promotedUser.email || null,
        },
      });

      await publishAdminRealtimeUpdate('user-status-updated', {
        userId: id,
        status: 'ACTIVE',
        accountType: 'SYSTEM_ADMIN',
      });

      return res.json({
        success: true,
        message: 'User promoted to system admin',
        user: sanitizeUser(promotedUser),
      });
    } catch (error) {
      logger.error('Promote system admin error:', error);
      next(error);
    }
  }

  static async getBillingOverview(req, res, next) {
    try {
      const [subscriptionsSnapshot, billingEventsSnapshot] = await Promise.all([
        firestore.collection('subscriptions').get(),
        firestore.collection('billingEvents')
          .orderBy('timestamp', 'desc')
          .limit(25)
          .get()
          .catch(async (error) => {
            logger.warn('Billing events index unavailable; using unsorted fallback.', error?.message || error);
            const fallback = await firestore.collection('billingEvents').limit(25).get();
            return fallback;
          }),
      ]);

      const subscriptions = subscriptionsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const billingEvents = billingEventsSnapshot.docs
        .map((doc) => doc.data() || {})
        .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

      const planCounts = subscriptions.reduce((acc, subscription) => {
        const key = (subscription.planId || 'unknown').toString().toLowerCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const statusCounts = subscriptions.reduce((acc, subscription) => {
        const key = (subscription.status || 'unknown').toString().toLowerCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const planPriceMap = Object.values(PLANS).reduce((acc, plan) => {
        acc[plan.id] = Number(plan.price) || 0;
        return acc;
      }, {});
      const estimatedMrr = subscriptions.reduce((sum, subscription) => {
        const status = (subscription.status || '').toString().toLowerCase();
        if (status !== 'active') return sum;
        return sum + (planPriceMap[(subscription.planId || '').toString().toLowerCase()] || 0);
      }, 0);

      return res.json({
        success: true,
        billing: {
          totalSubscriptions: subscriptions.length,
          statusCounts,
          planCounts,
          estimatedMrr,
          recentEvents: billingEvents.slice(0, 20),
        },
      });
    } catch (error) {
      logger.error('Get billing overview error:', error);
      next(error);
    }
  }

  static async getNewsletterStats(req, res, next) {
    try {
      const newsletterRef = firestore.collection('newsletterSubscriptions');
      const [activeSnapshot, totalSnapshot, recentSnapshot] = await Promise.all([
        newsletterRef.where('status', '==', 'active').get(),
        newsletterRef.get(),
        newsletterRef
          .orderBy('subscribedAt', 'desc')
          .limit(20)
          .get()
          .catch(async (error) => {
            logger.warn('Newsletter subscribedAt index unavailable; using unsorted fallback.', error?.message || error);
            return newsletterRef.limit(20).get();
          }),
      ]);

      const recent = recentSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => new Date(b.subscribedAt || 0).getTime() - new Date(a.subscribedAt || 0).getTime());

      return res.json({
        success: true,
        newsletter: {
          active: activeSnapshot.size,
          total: totalSnapshot.size,
          unsubscribed: totalSnapshot.size - activeSnapshot.size,
          recent,
        },
      });
    } catch (error) {
      logger.error('Get newsletter stats error:', error);
      next(error);
    }
  }

  static async getDataRetentionSummary(req, res, next) {
    try {
      const settings = await systemSettingsStore.get();
      const retentionPolicy = getRetentionPolicy(settings);
      const interviewCutoffIso = getCutoffIsoFromDays(retentionPolicy.interviewDataDays);
      const activityCutoffIso = getCutoffIsoFromDays(retentionPolicy.activityLogDays);

      const [eligibleInterviews, eligiblePlatformAuditLogs, eligibleActivityLogs] = await Promise.all([
        countCollectionBeforeDate({
          collection: firestore.collection('interviews'),
          dateField: 'endedAt',
          cutoffIso: interviewCutoffIso,
          additionalWhere: { field: 'status', value: 'COMPLETED' },
        }),
        countCollectionBeforeDate({
          collection: firestore.collection('platformAuditLogs'),
          dateField: 'createdAt',
          cutoffIso: activityCutoffIso,
        }),
        countCollectionBeforeDate({
          collection: firestore.collection('activityLogs'),
          dateField: 'createdAt',
          cutoffIso: activityCutoffIso,
        }),
      ]);

      return res.json({
        success: true,
        retention: {
          policy: retentionPolicy,
          cutoff: {
            interviews: interviewCutoffIso,
            activityLogs: activityCutoffIso,
          },
          pending: {
            interviews: eligibleInterviews,
            platformAuditLogs: eligiblePlatformAuditLogs,
            activityLogs: eligibleActivityLogs,
          },
        },
      });
    } catch (error) {
      logger.error('Get data retention summary error:', error);
      next(error);
    }
  }

  /**
   * Get classification metrics: confusion matrix, precision, recall, F1
   * comparing AI score classifications vs SME score classifications.
   */
  static async getClassificationMetrics(req, res, next) {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
      const reviews = await reviewStore.listRecent(limit);

      const calibrationPairs = reviews.filter(
        (r) =>
          r.aiOverallScoreAtReview != null &&
          !Number.isNaN(Number(r.aiOverallScoreAtReview)) &&
          r.smeOverallScore != null &&
          !Number.isNaN(Number(r.smeOverallScore)),
      );

      if (calibrationPairs.length === 0) {
        return res.json({
          success: true,
          confusionMatrix: null,
          metrics: null,
          accuracy: null,
          sampleSize: 0,
          message: 'No reviews with both AI and SME scores found.',
        });
      }

      const predictions = calibrationPairs.map((r) => classifyScore(Number(r.aiOverallScoreAtReview)));
      const actuals = calibrationPairs.map((r) => classifyScore(Number(r.smeOverallScore)));

      const confusionMatrix = buildConfusionMatrix(predictions, actuals, CLASS_LABELS);
      const metrics = calculateMetrics(confusionMatrix.matrix, CLASS_LABELS);
      const accuracy = calculateAccuracy(confusionMatrix.matrix);

      res.json({
        success: true,
        confusionMatrix,
        metrics,
        accuracy,
        sampleSize: calibrationPairs.length,
        labels: CLASS_LABELS,
      });
    } catch (error) {
      logger.error('Get classification metrics error:', error);
      next(error);
    }
  }

  /**
   * Get MediaPipe calibration: compare static thresholds with data-driven values.
   */
  static async getMediaPipeCalibration(req, res, next) {
    try {
      const result = await calibrateFromCollectedData();
      res.json({ success: result.success !== false, ...result });
    } catch (error) {
      logger.error('Get MediaPipe calibration error:', error);
      next(error);
    }
  }

  static async runDataRetentionCleanup(req, res, next) {
    try {
      const adminId = req.user.id;
      const dryRun = req.body?.dryRun === true || req.body?.dryRun === 'true';
      const requestedMax = Number.parseInt(req.body?.maxDocuments, 10);
      const maxDocuments = Number.isInteger(requestedMax)
        ? Math.min(Math.max(requestedMax, 1), 1000)
        : 250;

      const settings = await systemSettingsStore.get();
      const retentionPolicy = getRetentionPolicy(settings);
      const interviewCutoffIso = getCutoffIsoFromDays(retentionPolicy.interviewDataDays);
      const activityCutoffIso = getCutoffIsoFromDays(retentionPolicy.activityLogDays);

      const interviewDocsRaw = await queryCollectionBeforeDate({
        collection: firestore.collection('interviews'),
        dateField: 'endedAt',
        cutoffIso: interviewCutoffIso,
        limit: maxDocuments,
        additionalWhere: { field: 'status', value: 'COMPLETED' },
      });
      const interviewDocs = interviewDocsRaw
        .filter((doc) => !(doc.data() || {}).retentionPurgedAt)
        .slice(0, maxDocuments);

      const platformAuditDocs = await queryCollectionBeforeDate({
        collection: firestore.collection('platformAuditLogs'),
        dateField: 'createdAt',
        cutoffIso: activityCutoffIso,
        limit: maxDocuments,
      });

      const activityLogDocs = await queryCollectionBeforeDate({
        collection: firestore.collection('activityLogs'),
        dateField: 'createdAt',
        cutoffIso: activityCutoffIso,
        limit: maxDocuments,
      });

      const summary = {
        dryRun,
        maxDocuments,
        policy: retentionPolicy,
        cutoff: {
          interviews: interviewCutoffIso,
          activityLogs: activityCutoffIso,
        },
        candidates: {
          interviews: interviewDocs.length,
          platformAuditLogs: platformAuditDocs.length,
          activityLogs: activityLogDocs.length,
        },
        processed: {
          interviews: 0,
          redactedQuestions: 0,
          deletedPoseDataPoints: 0,
          platformAuditLogs: 0,
          activityLogs: 0,
        },
        failedInterviews: [],
        hasMore: {
          interviews: interviewDocsRaw.length >= maxDocuments,
          platformAuditLogs: platformAuditDocs.length >= maxDocuments,
          activityLogs: activityLogDocs.length >= maxDocuments,
        },
      };

      if (!dryRun) {
        for (const doc of interviewDocs) {
          const interviewData = { id: doc.id, ...(doc.data() || {}) };
          try {
            const redaction = await redactInterviewForRetention({
              interviewRef: doc.ref,
              interviewData,
              retentionDays: retentionPolicy.interviewDataDays,
            });
            summary.processed.interviews += 1;
            summary.processed.redactedQuestions += redaction.redactedQuestions;
            summary.processed.deletedPoseDataPoints += redaction.deletedPoseDataPoints;
          } catch (retentionError) {
            summary.failedInterviews.push({
              interviewId: interviewData.id,
              error: retentionError?.message || 'Unknown error',
            });
          }
        }

        summary.processed.platformAuditLogs = await deleteDocsByRef(platformAuditDocs);
        summary.processed.activityLogs = await deleteDocsByRef(activityLogDocs);

        await platformAuditLogStore.record({
          actorId: adminId,
          actorType: 'SYSTEM_ADMIN',
          action: 'DATA_RETENTION_CLEANUP_RUN',
          targetType: 'SETTINGS',
          targetId: 'global',
          metadata: {
            maxDocuments,
            policy: retentionPolicy,
            processed: summary.processed,
            failedInterviews: summary.failedInterviews.length,
          },
        });

        await publishAdminRealtimeUpdate('data-retention-cleanup-run', {
          adminId,
          processed: summary.processed,
          failedInterviews: summary.failedInterviews.length,
        });
      }

      return res.json({
        success: true,
        retention: summary,
      });
    } catch (error) {
      logger.error('Run data retention cleanup error:', error);
      next(error);
    }
  }
}

