import {
  organizationStore,
  organizationMemberStore,
  userStore,
  systemSettingsStore,
  platformAuditLogStore,
  interviewStore,
  jobStore,
  reviewStore,
} from '../services/firebaseData.service.js';
import { emailNotifications } from '../services/email.service.js';
import logger from '../utils/logger.js';
import admin, { realtimeDb } from '../config/firebase.js';

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
    fullName: user.fullName,
    companyName: user.companyName,
    primaryOrganizationId: user.primaryOrganizationId,
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

      if (!email || !uid) {
        return res.status(400).json({ error: 'Email and UID are required' });
      }

      // Check if user already exists
      let user = await userStore.getByUid(uid);

      if (user) {
        if (user.accountType === 'SYSTEM_ADMIN') {
          await ensureRealtimeAdmin({
            uid,
            email: user.email || email,
            fullName: user.fullName || req.body.fullName,
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
        // Create new system admin user
        user = await userStore.create(uid, {
          email,
          accountType: 'SYSTEM_ADMIN',
          fullName: req.body.fullName || 'System Administrator',
        });
      }

      await ensureRealtimeAdmin({
        uid,
        email,
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
        metadata: { email },
      });

      logger.info(`System admin seeded: ${email}`);

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

      // Send approval email to organization owner
      try {
        const owner = await userStore.getByUid(organization.ownerId);
        if (owner) {
          await emailNotifications.sendOrganizationApproved(approved, owner);
          logger.info(`Approval email sent to ${owner.email}`);
        }
      } catch (emailError) {
        logger.error('Failed to send approval email:', emailError);
        // Don't fail the request if email fails
      }

      logger.info(`Organization approved: ${id} by admin ${adminId}`);

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

      // Send rejection email to organization owner
      try {
        const owner = await userStore.getByUid(organization.ownerId);
        if (!owner) {
          logger.warn(`Owner not found for organization ${id}, ownerId: ${organization.ownerId}`);
        } else if (!owner.email) {
          logger.warn(`Owner ${organization.ownerId} does not have an email address`);
        } else {
          logger.info(`Attempting to send rejection email to ${owner.email} for organization ${organization.name}`);
          await emailNotifications.sendOrganizationRejected(rejected, owner, reason);
          logger.info(`Rejection email sent successfully to ${owner.email}`);
        }
      } catch (emailError) {
        logger.error('Failed to send rejection email:', {
          error: emailError.message,
          stack: emailError.stack,
          organizationId: id,
          ownerId: organization.ownerId,
        });
        // Don't fail the request if email fails
      }

      logger.info(`Organization rejected: ${id} by admin ${adminId}, reason: ${reason}`);

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

      // Send suspension email to organization owner
      try {
        const owner = await userStore.getByUid(organization.ownerId);
        if (!owner) {
          logger.warn(`Owner not found for organization ${id}, ownerId: ${organization.ownerId}`);
        } else if (!owner.email) {
          logger.warn(`Owner ${organization.ownerId} does not have an email address`);
        } else {
          await emailNotifications.sendOrganizationSuspended(suspended, owner, reason);
          logger.info(`Suspension email sent successfully to ${owner.email}`);
        }
      } catch (emailError) {
        logger.error('Failed to send suspension email:', {
          error: emailError.message,
          stack: emailError.stack,
          organizationId: id,
          ownerId: organization.ownerId,
        });
        // Do not fail suspension action if email fails
      }

      logger.info(`Organization suspended: ${id} by admin ${adminId}, reason: ${reason}`);

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

      // Send reactivation email to organization owner
      try {
        const owner = await userStore.getByUid(organization.ownerId);
        if (!owner) {
          logger.warn(`Owner not found for organization ${id}, ownerId: ${organization.ownerId}`);
        } else if (!owner.email) {
          logger.warn(`Owner ${organization.ownerId} does not have an email address`);
        } else {
          await emailNotifications.sendOrganizationReactivated(activated, owner);
          logger.info(`Reactivation email sent successfully to ${owner.email}`);
        }
      } catch (emailError) {
        logger.error('Failed to send reactivation email:', {
          error: emailError.message,
          stack: emailError.stack,
          organizationId: id,
          ownerId: organization.ownerId,
        });
        // Do not fail activation action if email fails
      }

      logger.info(`Organization activated: ${id} by admin ${adminId}`);

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
      });
    } catch (error) {
      logger.error('Get public config error:', error);
      res.json({ success: true, nonverbalFeedbackEnabled: true });
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
      const { limit = 100, offset = 0 } = req.query;

      const logs = await platformAuditLogStore.list(parseInt(limit), parseInt(offset));

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
      const allOrgs = await organizationStore.listAll(1000, 0);
      const pendingOrgs = allOrgs.filter((o) => o.status === 'PENDING');
      const approvedOrgs = allOrgs.filter((o) => o.status === 'APPROVED');
      const rejectedOrgs = allOrgs.filter((o) => o.status === 'REJECTED');
      const suspendedOrgs = allOrgs.filter((o) => o.status === 'SUSPENDED');

      // Get recent activity
      const recentLogs = await platformAuditLogStore.list(10, 0);
      
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
      const { accountType, limit = 100 } = req.query;

      // This is a basic implementation - in production, you'd want pagination
      // and more sophisticated filtering
      // For now, we'll return a limited subset
      
      res.json({
        success: true,
        users: [],
        message: 'User listing requires additional implementation for production use',
      });
    } catch (error) {
      logger.error('List users error:', error);
      next(error);
    }
  }
}

