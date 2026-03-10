import admin, { deleteFirebaseUser, realtimeDb } from '../config/firebase.js';
import {
  organizationMemberStore,
  organizationStore,
  publishAdminRealtimeUpdate,
  publishOrganizationRealtimeUpdate,
  userStore,
  teamInvitationStore,
  emailVerificationStore,
  platformAuditLogStore,
} from '../services/firebaseData.service.js';
import logger from '../utils/logger.js';
import { unlink } from 'fs/promises';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { validateCandidateProfilePhoto, validateCompanyCover, validateCompanyLogo } from '../services/imageModeration.service.js';
import { validateBusinessVerificationDocument, validateResumeDocument } from '../services/documentModeration.service.js';
import { emailService } from '../services/email.service.js';
import { ReferralController } from './referral.controller.js';

const DEFAULT_RECRUITER_WORKING_DAYS = Object.freeze([1, 2, 3, 4, 5]);
const DEFAULT_RECRUITER_AVAILABILITY = Object.freeze({
  timezone: 'UTC',
  workingDays: DEFAULT_RECRUITER_WORKING_DAYS,
  businessHoursStart: '09:00',
  businessHoursEnd: '17:00',
  maxInterviewsPerDay: 8,
});

const parseIntegerWithinRange = (value, fallback, minimum, maximum = Number.POSITIVE_INFINITY) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
};

const normalizeWorkingDays = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    return [...DEFAULT_RECRUITER_WORKING_DAYS];
  }
  const normalized = value
    .map((day) => Number.parseInt(day, 10))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  if (normalized.length === 0) {
    return [...DEFAULT_RECRUITER_WORKING_DAYS];
  }
  return [...new Set(normalized)].sort((a, b) => a - b);
};

const normalizeTimeValue = (value, fallback) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : fallback;
};

const normalizeTimezone = (value, fallback = 'UTC') => {
  const timezone = typeof value === 'string' ? value.trim() : '';
  if (!timezone) return fallback;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return timezone;
  } catch {
    return fallback;
  }
};

const normalizeRecruiterInterviewAvailability = (value = null, fallbackTimezone = 'UTC') => {
  const source = value && typeof value === 'object' ? value : {};
  return {
    timezone: normalizeTimezone(
      source.timezone,
      normalizeTimezone(fallbackTimezone, DEFAULT_RECRUITER_AVAILABILITY.timezone),
    ),
    workingDays: normalizeWorkingDays(source.workingDays),
    businessHoursStart: normalizeTimeValue(
      source.businessHoursStart,
      DEFAULT_RECRUITER_AVAILABILITY.businessHoursStart,
    ),
    businessHoursEnd: normalizeTimeValue(
      source.businessHoursEnd,
      DEFAULT_RECRUITER_AVAILABILITY.businessHoursEnd,
    ),
    maxInterviewsPerDay: parseIntegerWithinRange(
      source.maxInterviewsPerDay,
      DEFAULT_RECRUITER_AVAILABILITY.maxInterviewsPerDay,
      1,
      40,
    ),
  };
};

const sanitizeUser = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    accountType: user.accountType,
    fullName: user.fullName || null,
    experienceLevel: user.experienceLevel || null,
    skills: user.skills || [],
    companyName: user.companyName || null,
    companyType: user.companyType || null,
    companySize: user.companySize || null,
    industry: user.industry || null,
    gender: user.gender || null,
    targetRole: user.targetRole || null,
    careerGoals: user.careerGoals || null,
    location: user.location || null,
    preferredLanguage: user.preferredLanguage || null,
    jobTitle: user.jobTitle || null,
    department: user.department || null,
    hiringVolume: user.hiringVolume || null,
    companyWebsite: user.companyWebsite || null,
    companyLocation: user.companyLocation || null,
    phoneNumber: user.phoneNumber || null,
    timezone: user.timezone || null,
    interviewAvailability: user.interviewAvailability || null,
    // Candidate education fields
    highestQualification: user.highestQualification || null,
    fieldOfStudy: user.fieldOfStudy || null,
    institutionName: user.institutionName || null,
    graduationYear: user.graduationYear || null,
    // Candidate professional links
    linkedinUrl: user.linkedinUrl || null,
    githubUrl: user.githubUrl || null,
    portfolioUrl: user.portfolioUrl || null,
    // Candidate job preferences
    certifications: user.certifications || [],
    availability: user.availability || null,
    preferredWorkType: user.preferredWorkType || null,
    preferredEmploymentType: user.preferredEmploymentType || null,
    expectedSalary: user.expectedSalary || null,
    // Company additional fields
    businessRegistrationNumber: user.businessRegistrationNumber || null,
    companyEmail: user.companyEmail || null,
    establishedYear: user.establishedYear || null,
    companyLinkedinUrl: user.companyLinkedinUrl || null,
    profilePhotoUrl: user.profilePhotoUrl || null,
    resumeUrl: user.resumeUrl || null,
    resumeOriginalName: user.resumeOriginalName || null,
    companyLogoUrl: user.companyLogoUrl || null,
    companyCoverUrl: user.companyCoverUrl || null,
    companyVerificationUrl: user.companyVerificationUrl || null,
    companyVerificationOriginalName: user.companyVerificationOriginalName || null,
    primaryOrganizationId: user.primaryOrganizationId || null,
    organizationRoles: user.organizationRoles || [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

const sanitizeOrganization = (organization) => {
  if (!organization) return null;
  return {
    id: organization.id,
    name: organization.name,
    displayName: organization.displayName,
    tagline: organization.tagline || null,
    industry: organization.industry,
    companyType: organization.companyType || null,
    companySize: organization.companySize,
    website: organization.website || null,
    location: organization.location || null,
    headquartersLocation: organization.headquartersLocation || null,
    contactEmail: organization.contactEmail || null,
    contactPhone: organization.contactPhone || null,
    careersPageUrl: organization.careersPageUrl || null,
    linkedinUrl: organization.linkedinUrl || null,
    address: organization.address || null,
    description: organization.description || null,
    profile: organization.profile || {},
    status: organization.status || 'PENDING', // Include status for approval workflow
    approvedAt: organization.approvedAt || null,
    rejectedReason: organization.rejectedReason || null,
    rejectedReasonCode: organization.rejectedReasonCode || null,
    rejectedReasonTags: Array.isArray(organization.rejectedReasonTags) ? organization.rejectedReasonTags : [],
    rejectedReasonTagOther: organization.rejectedReasonTagOther || null,
    rejectedAt: organization.rejectedAt || null,
    reReviewRequestedAt: organization.reReviewRequestedAt || null,
    reReviewRequestNote: organization.reReviewRequestNote || null,
    reReviewRequestCount: Number.isFinite(organization.reReviewRequestCount) ? organization.reReviewRequestCount : 0,
    suspensionReason: organization.suspensionReason || null,
    suspendedAt: organization.suspendedAt || null,
    branding: organization.branding || { theme: 'default' },
    settings: organization.settings || {},
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  };
};

const sanitizeMembership = (membership) => {
  if (!membership) return null;
  return {
    role: membership.role,
    status: membership.status,
    permissions: membership.permissions || [],
    organizationId: membership.organizationId,
    userId: membership.userId,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
  };
};

const buildUserResponse = (user, organization = null, membership = null) => ({
  ...sanitizeUser(user),
  practiceStats: user.profile?.practiceStats ?? null,
  organizationContext:
    organization && membership
      ? {
          organization: sanitizeOrganization(organization),
          membership: sanitizeMembership(membership),
        }
      : null,
});

const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const RESUME_MAX_BYTES = 10 * 1024 * 1024;
const COMPANY_LOGO_MAX_BYTES = 5 * 1024 * 1024;
const COMPANY_COVER_MAX_BYTES = 8 * 1024 * 1024;
const COMPANY_PROOF_MAX_BYTES = 15 * 1024 * 1024;
const PROFILE_PHOTO_BASE_PATH = '/uploads/profile-photos';
const RESUME_BASE_PATH = '/uploads/resumes';
const COMPANY_LOGO_BASE_PATH = '/uploads/company-logos';
const COMPANY_COVER_BASE_PATH = '/uploads/company-covers';
const COMPANY_PROOF_BASE_PATH = '/uploads/company-verifications';

const EMAIL_VERIFICATION_CODE_LENGTH = 8;
const EMAIL_VERIFICATION_EXPIRY_MINUTES = 10;
const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
const EMAIL_VERIFICATION_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_MAX_PER_HOUR = 5;
const EMAIL_VERIFICATION_MAX_ATTEMPTS = 5;

const toMillisSafe = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Get verification code secret for HMAC signing
 * SECURITY: In production, this should always be a strong, unique secret
 * The default value is only for development - it will log a warning
 */
const getVerificationSecret = () => {
  const secret = process.env.EMAIL_VERIFICATION_CODE_SECRET || process.env.JWT_SECRET;
  
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('EMAIL_VERIFICATION_CODE_SECRET or JWT_SECRET must be set in production');
    }
    // Only use default in development, and log a warning
    logger.warn('⚠️  Using default verification secret - this is insecure for production!');
    return 'dev-only-verification-secret-change-in-production';
  }
  
  return secret;
};

const hashVerificationCode = (code) =>
  createHmac('sha256', getVerificationSecret()).update(code).digest('hex');

const generateVerificationCode = () =>
  randomInt(0, 10 ** EMAIL_VERIFICATION_CODE_LENGTH)
    .toString()
    .padStart(EMAIL_VERIFICATION_CODE_LENGTH, '0');

const safeHashEquals = (a, b) => {
  if (!a || !b) return false;
  const bufferA = Buffer.from(a, 'hex');
  const bufferB = Buffer.from(b, 'hex');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
};

const buildUploadUrl = (basePath, filename) => (filename ? `${basePath}/${filename}` : null);

const cleanupUploadedFiles = async (filePaths = []) => {
  const uniquePaths = Array.from(new Set(filePaths.filter(Boolean)));
  await Promise.all(
    uniquePaths.map(async (filePath) => {
      if (!filePath) return;
      try {
        await unlink(filePath);
      } catch (cleanupError) {
        logger.warn('Failed to clean up uploaded file', {
          filePath,
          error: cleanupError.message,
        });
      }
    })
  );
};

const normalizeListField = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item)))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => (typeof item === 'string' ? item.trim() : String(item)))
            .filter(Boolean);
        }
      } catch (parseError) {
        // Fall through to simple parsing.
      }
    }
    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [trimmed];
  }

  if (value === undefined || value === null) return [];
  return [String(value)];
};

export class AuthController {
  static async register(req, res, next) {
    const profilePhoto = req.files?.profilePhoto?.[0] || null;
    const resumeFile = req.files?.resumeFile?.[0] || null;
    const companyLogo = req.files?.companyLogo?.[0] || null;
    const companyProof = req.files?.companyProof?.[0] || null;
    const uploadedPaths = [];
    if (profilePhoto?.path) uploadedPaths.push(profilePhoto.path);
    if (resumeFile?.path) uploadedPaths.push(resumeFile.path);
    if (companyLogo?.path) uploadedPaths.push(companyLogo.path);
    if (companyProof?.path) uploadedPaths.push(companyProof.path);
    let userCreated = false;
    let businessVerificationResult = null;
    let resumeValidationResult = null;

    try {
      const {
        accountType,
        fullName,
        experienceLevel,
        companyName,
        companyType,
        industry,
        companySize,
        skills,
        companyLocation,
        gender,
        targetRole,
        careerGoals,
        location,
        preferredLanguage,
        jobTitle,
        department,
        hiringVolume,
        companyWebsite,
        phoneNumber,
        companyAddress,
        companyDescription,
        facebookUrl,
        companyLinkedinUrl,
        teamInvitationToken,
        // Candidate education fields
        highestQualification,
        fieldOfStudy,
        institutionName,
        graduationYear,
        // Candidate professional links
        linkedinUrl,
        githubUrl,
        portfolioUrl,
        // Candidate job preferences
        certifications,
        availability,
        preferredWorkType,
        preferredEmploymentType,
        expectedSalary,
        // Company fields
        businessRegistrationNumber,
        companyEmail,
        establishedYear,
        refCode,
      } = req.body;

      const normalizedSkills = normalizeListField(skills);
      const normalizedCertifications = normalizeListField(certifications);
      const firebaseUid = req.user.uid;
      const email = (req.user.email || '').toLowerCase();

      // Require email verification for self-registration flows,
      // but allow trusted team-invitation flows to proceed without it.
      let emailVerified = Boolean(req.user.emailVerified);
      const isTeamInvitationFlow = Boolean(teamInvitationToken);

      if (!isTeamInvitationFlow) {
        if (!emailVerified) {
          try {
            const userRecord = await admin.auth().getUser(firebaseUid);
            emailVerified = Boolean(userRecord.emailVerified);
          } catch (verificationError) {
            logger.warn('Unable to confirm Firebase email verification', {
              uid: firebaseUid,
              error: verificationError.message,
            });
          }
        }

        if (!emailVerified) {
          return res.status(403).json({
            success: false,
            error: 'Please verify your email address before completing registration.',
            code: 'EMAIL_NOT_VERIFIED',
          });
        }
      }
      let accountTypeEnum = (accountType || '').toUpperCase() === 'COMPANY' ? 'COMPANY' : 'CANDIDATE';

      let invitedOrganizationId = null;
      let invitedRole = null;
      let teamInvitation = null;

      // If registering via team invitation, validate and override account type & organization
      if (teamInvitationToken) {
        teamInvitation = await teamInvitationStore.getByToken(teamInvitationToken);

        if (!teamInvitation || !teamInvitationStore.isValid(teamInvitation)) {
          const error = new Error('Invalid or expired team invitation.');
          error.status = 400;
          throw error;
        }

        if (teamInvitation.email.toLowerCase() !== email) {
          const error = new Error('Email does not match the team invitation.');
          error.status = 400;
          throw error;
        }

        accountTypeEnum = 'COMPANY';
        invitedOrganizationId = teamInvitation.organizationId;
        invitedRole = teamInvitation.role;
      }

      if (accountTypeEnum === 'CANDIDATE') {
        if (!profilePhoto) {
          const error = new Error('Profile picture is required.');
          error.status = 400;
          throw error;
        }
        if (!resumeFile) {
          const error = new Error('CV or résumé is required.');
          error.status = 400;
          throw error;
        }
        if (profilePhoto.size > PROFILE_PHOTO_MAX_BYTES) {
          const error = new Error('Profile picture must be 5 MB or less.');
          error.status = 400;
          throw error;
        }
        if (resumeFile.size > RESUME_MAX_BYTES) {
          const error = new Error('CV must be 10 MB or less.');
          error.status = 400;
          throw error;
        }

        await validateCandidateProfilePhoto(profilePhoto.path);
        resumeValidationResult = await validateResumeDocument(
          resumeFile.path,
          resumeFile,
          {
            expectedFullName: fullName,
            expectedEmail: req.body?.email || email,
          }
        );

        if (resumeValidationResult?.hash) {
          const duplicateResumes = await userStore.findByResumeHash(resumeValidationResult.hash);
          if (duplicateResumes.length) {
            const existingCandidate = duplicateResumes[0]?.fullName || 'another candidate';
            const error = new Error(`This résumé is already linked to ${existingCandidate}. Please upload a unique document.`);
            error.status = 400;
            throw error;
          }
        }
      }

      if (accountTypeEnum === 'COMPANY' && teamInvitationToken) {
        if (!profilePhoto) {
          const error = new Error('Profile picture is required.');
          error.status = 400;
          throw error;
        }
        if (profilePhoto.size > PROFILE_PHOTO_MAX_BYTES) {
          const error = new Error('Profile picture must be 5 MB or less.');
          error.status = 400;
          throw error;
        }

        await validateCandidateProfilePhoto(profilePhoto.path);
      }

      if (accountTypeEnum === 'COMPANY' && !teamInvitationToken) {
        const missingCompanyFields = [];
        if (!companyName?.trim()) missingCompanyFields.push('company name');
        if (!companyType?.trim()) missingCompanyFields.push('company type');
        if (!companySize?.trim()) missingCompanyFields.push('company size');
        if (!industry?.trim()) missingCompanyFields.push('industry');
        if (!jobTitle?.trim()) missingCompanyFields.push('job title');
        if (!department?.trim()) missingCompanyFields.push('department');
        if (!hiringVolume?.trim()) missingCompanyFields.push('monthly hiring volume');
        if (!companyLocation?.trim()) missingCompanyFields.push('company location');
        if (!businessRegistrationNumber?.trim()) missingCompanyFields.push('business registration number');
        if (!companyEmail?.trim()) missingCompanyFields.push('official company email');

        if (missingCompanyFields.length) {
          const error = new Error(
            `Missing required company fields: ${missingCompanyFields.join(', ')}.`,
          );
          error.status = 400;
          throw error;
        }

        if (!companyLogo) {
          const error = new Error('Company logo is required.');
          error.status = 400;
          throw error;
        }
        if (!companyProof) {
          const error = new Error('Company verification document is required.');
          error.status = 400;
          throw error;
        }
        if (companyLogo.size > COMPANY_LOGO_MAX_BYTES) {
          const error = new Error('Company logo must be 5 MB or less.');
          error.status = 400;
          throw error;
        }
        if (companyProof.size > COMPANY_PROOF_MAX_BYTES) {
          const error = new Error('Verification document must be 15 MB or less.');
          error.status = 400;
          throw error;
        }

        await validateCompanyLogo(companyLogo.path);
        businessVerificationResult = await validateBusinessVerificationDocument(
          companyProof.path,
          companyProof,
          {
            expectedCompanyName: companyName,
            expectedCountry: companyLocation,
          }
        );

        if (businessVerificationResult?.hash) {
          const duplicateDocs = await userStore.findByVerificationHash(businessVerificationResult.hash);
          if (duplicateDocs.length) {
            const existingCompany = duplicateDocs[0]?.companyName || 'another organization';
            const error = new Error(
              `This verification document is already linked to ${existingCompany}. Please upload a unique certificate.`,
            );
            error.status = 400;
            throw error;
          }
        }
      }

      // Prevent duplicate registrations by UID
      const existingUserByUid = await userStore.getByUid(firebaseUid);
      if (existingUserByUid) {
        return res.status(409).json({
          error: 'User already registered',
          user: sanitizeUser(existingUserByUid),
        });
      }

      // Prevent duplicate registrations by email
      const existingUserByEmail = await userStore.getByEmail(email);
      if (existingUserByEmail) {
        return res.status(409).json({
          error: 'User already registered',
          user: sanitizeUser(existingUserByEmail),
        });
      }

      let primaryOrganizationId = null;
      let organizationRoles = [];
      let organization = null;
      let membership = null;

      if (accountTypeEnum === 'COMPANY' && teamInvitationToken && invitedOrganizationId && invitedRole) {
        // Joining an existing organization via team invitation
        primaryOrganizationId = invitedOrganizationId;
        organizationRoles = [{ organizationId: invitedOrganizationId, role: invitedRole }];

        membership = await organizationMemberStore.addMember({
          organizationId: invitedOrganizationId,
          userId: firebaseUid,
          role: invitedRole,
        });
      } else if (accountTypeEnum === 'COMPANY') {
        // Build logo URL before creating organization
        const logoUrl = companyLogo ? buildUploadUrl(COMPANY_LOGO_BASE_PATH, companyLogo.filename) : null;
        
        organization = await organizationStore.create({
          ownerId: firebaseUid,
          name: companyName || `${fullName || 'New'} Organization`,
          displayName: companyName || `${fullName || 'New'} Organization`,
          tagline: null,
          industry: industry || null,
          companySize: companySize || null,
          companyType: companyType || null,
          location: companyLocation || null,
          headquartersLocation: companyLocation || null,
          contactEmail: companyEmail || null,
          logo: logoUrl,
          website: companyWebsite || null,
          address: companyAddress || null,
          description: companyDescription || null,
          facebookUrl: facebookUrl || null,
          linkedinUrl: companyLinkedinUrl || null,
          profile: {
            tagline: null,
            website: companyWebsite || null,
            location: companyLocation || null,
            about: companyDescription || null,
            socialLinks: {
              linkedin: companyLinkedinUrl || null,
            },
          },
        });

        membership = await organizationMemberStore.addMember({
          organizationId: organization.id,
          userId: firebaseUid,
          role: 'ADMIN',
        });

        primaryOrganizationId = organization.id;
        organizationRoles = [{ organizationId: organization.id, role: 'ADMIN' }];

        // Set organization approval status in Realtime Database for real-time updates
        if (organization.id && organization.status) {
          try {
            await realtimeDb.ref(`organizationApprovalStatus/${organization.id}`).set({
              status: organization.status,
              organizationId: organization.id,
              organizationName: organization.name || organization.displayName,
              ownerId: firebaseUid,
              ownerEmail: email,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            await publishAdminRealtimeUpdate('organization-status-updated', {
              organizationId: organization.id,
              status: organization.status,
              source: 'company-registration',
              ownerId: firebaseUid,
              ownerEmail: email,
            });
            logger.info(`Set organization approval status in Realtime DB: ${organization.id} - ${organization.status}`);
          } catch (rtdbError) {
            logger.error('Failed to set organization approval status in Realtime DB:', rtdbError);
            // Don't fail registration if RTDB write fails
          }
        }
      }

      const user = await userStore.create(firebaseUid, {
        email,
        accountType: accountTypeEnum,
        fullName,
        experienceLevel: accountTypeEnum === 'CANDIDATE' ? experienceLevel || null : null,
        skills: accountTypeEnum === 'CANDIDATE' ? normalizedSkills : [],
        companyName: accountTypeEnum === 'COMPANY' ? companyName || null : null,
        companyType: accountTypeEnum === 'COMPANY' ? companyType || null : null,
        companySize: accountTypeEnum === 'COMPANY' ? companySize || null : null,
        industry: industry || null,
        gender: accountTypeEnum === 'CANDIDATE' ? gender || null : null,
        targetRole: accountTypeEnum === 'CANDIDATE' ? targetRole || null : null,
        careerGoals: accountTypeEnum === 'CANDIDATE' ? careerGoals || null : null,
        location: accountTypeEnum === 'CANDIDATE' ? location || null : null,
        preferredLanguage: accountTypeEnum === 'CANDIDATE' ? preferredLanguage || null : null,
        // Candidate phone number (for interview notifications)
        phoneNumber: phoneNumber || null,
        // Candidate education fields
        highestQualification: accountTypeEnum === 'CANDIDATE' ? highestQualification || null : null,
        fieldOfStudy: accountTypeEnum === 'CANDIDATE' ? fieldOfStudy || null : null,
        institutionName: accountTypeEnum === 'CANDIDATE' ? institutionName || null : null,
        graduationYear: accountTypeEnum === 'CANDIDATE' ? graduationYear || null : null,
        // Candidate professional links
        linkedinUrl: accountTypeEnum === 'CANDIDATE' ? linkedinUrl || null : null,
        githubUrl: accountTypeEnum === 'CANDIDATE' ? githubUrl || null : null,
        portfolioUrl: accountTypeEnum === 'CANDIDATE' ? portfolioUrl || null : null,
        // Candidate job preferences
        certifications: accountTypeEnum === 'CANDIDATE' ? normalizedCertifications : [],
        availability: accountTypeEnum === 'CANDIDATE' ? availability || null : null,
        preferredWorkType: accountTypeEnum === 'CANDIDATE' ? preferredWorkType || null : null,
        preferredEmploymentType: accountTypeEnum === 'CANDIDATE' ? preferredEmploymentType || null : null,
        expectedSalary: accountTypeEnum === 'CANDIDATE' ? expectedSalary || null : null,
        // Company fields
        jobTitle: accountTypeEnum === 'COMPANY' ? jobTitle || null : null,
        department: accountTypeEnum === 'COMPANY' ? department || null : null,
        hiringVolume: accountTypeEnum === 'COMPANY' ? hiringVolume || null : null,
        companyWebsite: accountTypeEnum === 'COMPANY' ? companyWebsite || null : null,
        companyLocation: accountTypeEnum === 'COMPANY' ? companyLocation || null : null,
        businessRegistrationNumber: accountTypeEnum === 'COMPANY' ? businessRegistrationNumber || null : null,
        companyEmail: accountTypeEnum === 'COMPANY' ? companyEmail || null : null,
        establishedYear: accountTypeEnum === 'COMPANY' ? establishedYear || null : null,
        companyLinkedinUrl: accountTypeEnum === 'COMPANY' ? companyLinkedinUrl || null : null,
        primaryOrganizationId,
        organizationRoles,
        profilePhotoUrl:
          accountTypeEnum === 'CANDIDATE' || (accountTypeEnum === 'COMPANY' && teamInvitationToken)
            ? buildUploadUrl(PROFILE_PHOTO_BASE_PATH, profilePhoto?.filename)
            : null,
        resumeUrl:
          accountTypeEnum === 'CANDIDATE' ? buildUploadUrl(RESUME_BASE_PATH, resumeFile?.filename) : null,
        resumeOriginalName: accountTypeEnum === 'CANDIDATE' ? resumeFile?.originalname || null : null,
        resumeHash:
          accountTypeEnum === 'CANDIDATE'
            ? resumeValidationResult?.hash || null
            : null,
        resumeInsights:
          accountTypeEnum === 'CANDIDATE'
            ? resumeValidationResult?.analysis || null
            : null,
        companyLogoUrl:
          accountTypeEnum === 'COMPANY'
            ? buildUploadUrl(COMPANY_LOGO_BASE_PATH, companyLogo?.filename)
            : null,
        companyCoverUrl: null,
        companyVerificationUrl:
          accountTypeEnum === 'COMPANY'
            ? buildUploadUrl(COMPANY_PROOF_BASE_PATH, companyProof?.filename)
            : null,
        companyVerificationOriginalName:
          accountTypeEnum === 'COMPANY' ? companyProof?.originalname || null : null,
        companyVerificationHash:
          accountTypeEnum === 'COMPANY'
            ? businessVerificationResult?.hash || null
            : null,
        companyVerificationInsights:
          accountTypeEnum === 'COMPANY'
            ? businessVerificationResult?.analysis || null
            : null,
      });
      userCreated = true;

      // If this was a team invitation registration, mark invitation as accepted
      if (teamInvitationToken && teamInvitation) {
        await teamInvitationStore.markAccepted(teamInvitation.id, firebaseUid);
        await publishOrganizationRealtimeUpdate(teamInvitation.organizationId, 'team-invitation-accepted', {
          invitationId: teamInvitation.id,
          userId: firebaseUid,
          email,
          role: invitedRole || teamInvitation.role || null,
        });
      }

      const normalizedRefCode = String(refCode || '').trim();
      if (normalizedRefCode) {
        try {
          await ReferralController.attributeReferralInternal({
            refCode: normalizedRefCode,
            newUserId: firebaseUid,
            newUserEmail: email,
          });
        } catch (referralError) {
          // Non-fatal: registration should still succeed.
          logger.warn('Referral attribution failed during registration:', referralError);
        }
      }

      res.status(201).json({
        success: true,
        user: buildUserResponse(user, organization, membership),
      });
    } catch (error) {
      if (!userCreated) {
        await cleanupUploadedFiles(uploadedPaths);
      }
      logger.error('Register error:', error);
      next(error);
    }
  }

  static async getMe(req, res, next) {
    try {
      const user = await userStore.getByUid(req.user.uid);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      let organization = null;
      let membership = null;

      if (user.primaryOrganizationId) {
        organization = await organizationStore.getById(user.primaryOrganizationId);
        membership = await organizationMemberStore.getMember(user.primaryOrganizationId, user.id);
      }

      res.json({ success: true, user: buildUserResponse(user, organization, membership) });
    } catch (error) {
      logger.error('Get me error:', error);
      next(error);
    }
  }

  static async updateMe(req, res, next) {
    try {
      const firebaseUid = req.user.uid;
      const currentUser = req.user?.profile || await userStore.getByUid(firebaseUid);
      if (!currentUser) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const accountType = String(currentUser.accountType || '').toUpperCase();
      const commonAllowedFields = [
        'fullName',
        'industry',
        'phoneNumber',
        'timezone',
      ];

      const candidateOnlyAllowedFields = [
        'fullName',
        'experienceLevel',
        'skills',
        'gender',
        'targetRole',
        'careerGoals',
        'location',
        'preferredLanguage',
        'highestQualification',
        'fieldOfStudy',
        'institutionName',
        'graduationYear',
        'linkedinUrl',
        'githubUrl',
        'portfolioUrl',
        'certifications',
        'availability',
        'preferredWorkType',
        'preferredEmploymentType',
        'expectedSalary',
      ];

      const companyOnlyAllowedFields = [
        'companyName',
        'companyType',
        'companySize',
        'jobTitle',
        'department',
        'hiringVolume',
        'companyWebsite',
        'companyLocation',
        'businessRegistrationNumber',
        'companyEmail',
        'establishedYear',
        'companyLinkedinUrl',
        'interviewAvailability',
      ];

      const roleScopedAllowedFields = accountType === 'COMPANY'
        ? companyOnlyAllowedFields
        : accountType === 'CANDIDATE'
          ? candidateOnlyAllowedFields
          : [];
      const allowedFields = new Set([...commonAllowedFields, ...roleScopedAllowedFields]);
      const providedFields = Object.keys(req.body || {}).filter((field) => req.body[field] !== undefined);
      const disallowedFields = providedFields.filter((field) => !allowedFields.has(field));

      if (disallowedFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Some profile fields are not editable for this account type.',
          code: 'PROFILE_FIELDS_NOT_ALLOWED',
          disallowedFields,
        });
      }

      const data = {};
      [...allowedFields].forEach((field) => {
        if (req.body[field] !== undefined) {
          data[field] = req.body[field];
        }
      });

      if (data.skills !== undefined) {
        if (Array.isArray(data.skills)) {
          data.skills = data.skills.map(String);
        } else if (typeof data.skills === 'string') {
          data.skills = data.skills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        } else {
          data.skills = [String(data.skills)];
        }
      }

      if (Object.keys(data).length === 0) {
        return res.json({ success: true, user: sanitizeUser(currentUser) });
      }

      if (data.interviewAvailability !== undefined) {
        if (accountType !== 'COMPANY') {
          return res.status(400).json({
            success: false,
            error: 'Interview availability can only be updated for company accounts.',
            code: 'INTERVIEW_AVAILABILITY_NOT_ALLOWED',
          });
        }

        data.interviewAvailability = normalizeRecruiterInterviewAvailability(
          data.interviewAvailability,
          data.timezone || currentUser.timezone || 'UTC',
        );
      }

      const updated = await userStore.update(firebaseUid, data);

      let organization = null;
      let membership = null;

      if (updated.primaryOrganizationId) {
        organization = await organizationStore.getById(updated.primaryOrganizationId);
        membership = await organizationMemberStore.getMember(updated.primaryOrganizationId, updated.id);
      }

      res.json({ success: true, user: buildUserResponse(updated, organization, membership) });
    } catch (error) {
      logger.error('Update me error:', error);
      next(error);
    }
  }

  static async requestOrganizationReReview(req, res, next) {
    try {
      const note = (req.body.note || '').trim();
      const user = req.user?.profile || null;

      if (!user?.id || !user?.primaryOrganizationId) {
        return res.status(400).json({
          success: false,
          error: 'No organization is linked to this account.',
          code: 'NO_ORGANIZATION',
        });
      }

      const organization = await organizationStore.getById(user.primaryOrganizationId);
      if (!organization) {
        return res.status(404).json({
          success: false,
          error: 'Organization not found.',
        });
      }

      if (organization.ownerId !== user.id) {
        return res.status(403).json({
          success: false,
          error: 'Only the organization owner can request a re-review.',
          code: 'OWNER_ONLY',
        });
      }

      if (organization.status === 'PENDING') {
        return res.json({
          success: true,
          message: 'Your organization is already pending review.',
          organization: sanitizeOrganization(organization),
        });
      }

      if (organization.status !== 'REJECTED') {
        return res.status(409).json({
          success: false,
          error: `Re-review can only be requested for rejected organizations. Current status: ${organization.status}.`,
          code: 'INVALID_ORG_STATUS',
        });
      }

      const updatedOrganization = await organizationStore.requestReReview(organization.id, {
        requestedBy: user.id,
        note,
      });

      await platformAuditLogStore.record({
        actorId: user.id,
        actorType: user.accountType || 'COMPANY',
        action: 'ORG_REREVIEW_REQUESTED',
        targetType: 'ORGANIZATION',
        targetId: organization.id,
        metadata: {
          organizationName: organization.name || organization.displayName || null,
          previousStatus: organization.status,
          previousRejectedReason: organization.rejectedReason || null,
          previousRejectedReasonCode: organization.rejectedReasonCode || null,
          note,
        },
      });

      await publishAdminRealtimeUpdate('organization-status-updated', {
        organizationId: organization.id,
        status: updatedOrganization.status || 'PENDING',
        source: 'organization-re-review-request',
        requestedBy: user.id,
      });

      return res.json({
        success: true,
        message: 'Re-review request submitted. Your organization is now back in the review queue.',
        organization: sanitizeOrganization(updatedOrganization),
      });
    } catch (error) {
      logger.error('Request organization re-review error:', error);
      next(error);
    }
  }

  static async updateProfilePhoto(req, res, next) {
    const profilePhoto = req.file;
    const uploadedPaths = [];
    if (profilePhoto?.path) uploadedPaths.push(profilePhoto.path);

    try {
      if (!profilePhoto) {
        const error = new Error('Profile photo is required.');
        error.status = 400;
        throw error;
      }
      if (profilePhoto.size > PROFILE_PHOTO_MAX_BYTES) {
        const error = new Error('Profile photo must be 5 MB or less.');
        error.status = 400;
        throw error;
      }

      await validateCandidateProfilePhoto(profilePhoto.path);

      const updated = await userStore.update(req.user.uid, {
        profilePhotoUrl: buildUploadUrl(PROFILE_PHOTO_BASE_PATH, profilePhoto.filename),
      });

      const organization = req.user.organizationContext?.organization || null;
      const membership = req.user.organizationContext?.membership || null;

      res.json({ success: true, user: buildUserResponse(updated, organization, membership) });
    } catch (error) {
      await cleanupUploadedFiles(uploadedPaths);
      logger.error('Update profile photo error:', error);
      next(error);
    }
  }

  static async updateCompanyLogo(req, res, next) {
    const companyLogo = req.file;
    const uploadedPaths = [];
    if (companyLogo?.path) uploadedPaths.push(companyLogo.path);

    try {
      if (!companyLogo) {
        const error = new Error('Company logo is required.');
        error.status = 400;
        throw error;
      }
      if (companyLogo.size > COMPANY_LOGO_MAX_BYTES) {
        const error = new Error('Company logo must be 5 MB or less.');
        error.status = 400;
        throw error;
      }

      await validateCompanyLogo(companyLogo.path);
      const logoUrl = buildUploadUrl(COMPANY_LOGO_BASE_PATH, companyLogo.filename);

      const updated = await userStore.update(req.user.uid, {
        companyLogoUrl: logoUrl,
      });

      // Also update organization logo if user has a primary organization
      if (req.user.primaryOrganizationId) {
        await organizationStore.updateLogo(req.user.primaryOrganizationId, logoUrl);
        await publishOrganizationRealtimeUpdate(req.user.primaryOrganizationId, 'organization-updated', {
          organizationId: req.user.primaryOrganizationId,
          logoUpdated: true,
        });
      }

      const organization = req.user.organizationContext?.organization || null;
      const membership = req.user.organizationContext?.membership || null;

      res.json({ success: true, user: buildUserResponse(updated, organization, membership) });
    } catch (error) {
      await cleanupUploadedFiles(uploadedPaths);
      logger.error('Update company logo error:', error);
      next(error);
    }
  }

  static async updateCompanyCover(req, res, next) {
    const companyCover = req.file;
    const uploadedPaths = [];
    if (companyCover?.path) uploadedPaths.push(companyCover.path);

    try {
      if (!companyCover) {
        const error = new Error('Company cover image is required.');
        error.status = 400;
        throw error;
      }
      if (companyCover.size > COMPANY_COVER_MAX_BYTES) {
        const error = new Error('Company cover image must be 8 MB or less.');
        error.status = 400;
        throw error;
      }

      await validateCompanyCover(companyCover.path);
      const coverUrl = buildUploadUrl(COMPANY_COVER_BASE_PATH, companyCover.filename);

      const organizationId = req.user.primaryOrganizationId || req.user.organizationContext?.organization?.id;
      if (!organizationId) {
        const error = new Error('Organization context required to update cover image.');
        error.status = 403;
        throw error;
      }

      await organizationStore.updateProfileCover(organizationId, coverUrl);

      const updated = await userStore.update(req.user.uid, {
        companyCoverUrl: coverUrl,
      });

      await publishOrganizationRealtimeUpdate(organizationId, 'organization-updated', {
        organizationId,
        coverUpdated: true,
      });

      const organization = req.user.organizationContext?.organization || null;
      const membership = req.user.organizationContext?.membership || null;

      res.json({
        success: true,
        coverUrl,
        user: buildUserResponse(updated, organization, membership),
      });
    } catch (error) {
      await cleanupUploadedFiles(uploadedPaths);
      logger.error('Update company cover error:', error);
      next(error);
    }
  }

  static async updateCompanyVerificationDocument(req, res, next) {
    const companyProof = req.file;
    const uploadedPaths = [];
    if (companyProof?.path) uploadedPaths.push(companyProof.path);

    try {
      if (!companyProof) {
        const error = new Error('Company verification document is required.');
        error.status = 400;
        throw error;
      }
      if (companyProof.size > COMPANY_PROOF_MAX_BYTES) {
        const error = new Error('Verification document must be 15 MB or less.');
        error.status = 400;
        throw error;
      }

      const user = await userStore.getByUid(req.user.uid);
      const businessVerificationResult = await validateBusinessVerificationDocument(
        companyProof.path,
        companyProof,
        {
          expectedCompanyName: user?.companyName,
          expectedCountry: user?.companyLocation,
        }
      );

      const verificationUrl = buildUploadUrl(COMPANY_PROOF_BASE_PATH, companyProof.filename);

      const updated = await userStore.update(req.user.uid, {
        companyVerificationUrl: verificationUrl,
        companyVerificationOriginalName: companyProof.originalname || null,
        companyVerificationHash: businessVerificationResult?.hash || null,
        companyVerificationInsights: businessVerificationResult?.analysis || null,
      });

      const organization = req.user.organizationContext?.organization || null;
      const membership = req.user.organizationContext?.membership || null;

      res.json({ success: true, user: buildUserResponse(updated, organization, membership) });
    } catch (error) {
      await cleanupUploadedFiles(uploadedPaths);
      logger.error('Update company verification document error:', error);
      next(error);
    }
  }

  static async updateResume(req, res, next) {
    const resumeFile = req.file;
    const uploadedPaths = [];
    if (resumeFile?.path) uploadedPaths.push(resumeFile.path);

    try {
      if (!resumeFile) {
        const error = new Error('Resume file is required.');
        error.status = 400;
        throw error;
      }
      if (resumeFile.size > RESUME_MAX_BYTES) {
        const error = new Error('Resume must be 10 MB or less.');
        error.status = 400;
        throw error;
      }

      // Validate resume document
      const user = await userStore.getByUid(req.user.uid);
      const resumeValidationResult = await validateResumeDocument(
        resumeFile.path,
        resumeFile,
        {
          expectedFullName: user?.fullName,
          expectedEmail: user?.email || req.user.email,
        }
      );

      const resumeUrl = buildUploadUrl(RESUME_BASE_PATH, resumeFile.filename);

      const updated = await userStore.update(req.user.uid, {
        resumeUrl,
        resumeOriginalName: resumeFile.originalname || null,
        resumeHash: resumeValidationResult?.hash || null,
        resumeInsights: resumeValidationResult?.analysis || null,
      });

      const organization = req.user.organizationContext?.organization || null;
      const membership = req.user.organizationContext?.membership || null;

      res.json({ success: true, user: buildUserResponse(updated, organization, membership) });
    } catch (error) {
      await cleanupUploadedFiles(uploadedPaths);
      logger.error('Update resume error:', error);
      next(error);
    }
  }

  static async parseResume(req, res, next) {
    const resumeFile = req.file;
    try {
      const user = await userStore.getByUid(req.user.uid);
      const persistedAccountType = (user?.accountType || '').toString().toUpperCase();
      const hintedAccountType = (req.body?.accountType || req.user?.metadata?.accountType || '')
        .toString()
        .toUpperCase();

      if (persistedAccountType && persistedAccountType !== 'CANDIDATE') {
        return res.status(403).json({ success: false, error: 'Candidate access required.' });
      }

      if (!persistedAccountType && hintedAccountType !== 'CANDIDATE') {
        return res.status(403).json({ success: false, error: 'Candidate access required.' });
      }

      let resumeText = '';

      if (resumeFile) {
        // Parse uploaded file
        const ext = (resumeFile.originalname || '').split('.').pop().toLowerCase();
        if (ext === 'pdf') {
          const { PDFParse } = await import('pdf-parse');
          const fs = await import('fs/promises');
          const buffer = await fs.readFile(resumeFile.path);
          const parser = new PDFParse({ data: buffer });
          const data = await parser.getText();
          resumeText = data?.text || '';
          await parser.destroy();
        } else if (ext === 'docx' || ext === 'doc') {
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ path: resumeFile.path });
          resumeText = result.value || '';
        } else {
          const fs = await import('fs/promises');
          resumeText = await fs.readFile(resumeFile.path, 'utf-8');
        }
        // Cleanup temp file
        try { await import('fs/promises').then((fs) => fs.unlink(resumeFile.path)); } catch {}
      } else if (user?.resumeUrl) {
        return res.status(400).json({ success: false, error: 'Please upload a resume file to parse.' });
      } else {
        return res.status(400).json({ success: false, error: 'No resume file provided.' });
      }

      if (!resumeText || resumeText.trim().length < 50) {
        return res.status(422).json({ success: false, error: 'Could not extract text from the resume. Please try a different file.' });
      }

      const normalizeText = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');
      const normalizeUrl = (value) => {
        const raw = normalizeText(value);
        if (!raw) return null;
        const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        try {
          const parsed = new URL(withScheme);
          return parsed.href.replace(/\/+$/, '');
        } catch {
          return null;
        }
      };
      const toNumberOrNull = (value) => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value !== 'string') return null;
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
      };
      const toStringArray = (value, limit = 25) => {
        const rawList = Array.isArray(value)
          ? value
          : typeof value === 'string'
            ? value.split(/[,\n|/\u2022·]/)
            : [];
        const seen = new Set();
        const normalized = [];
        rawList.forEach((item) => {
          const cleaned = normalizeText(item);
          if (!cleaned || cleaned.length > 120) return;
          const key = cleaned.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          normalized.push(cleaned);
        });
        return normalized.slice(0, limit);
      };
      const hasValue = (value) => {
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'number') return Number.isFinite(value);
        if (value === null || value === undefined) return false;
        return String(value).trim().length > 0;
      };
      const compareScalar = (first, second) => {
        const firstNormalized = normalizeText(first).toLowerCase();
        const secondNormalized = normalizeText(second).toLowerCase();
        if (!firstNormalized || !secondNormalized) return false;
        if (firstNormalized === secondNormalized) return true;
        return firstNormalized.includes(secondNormalized) || secondNormalized.includes(firstNormalized);
      };
      const compareArray = (first, second) => {
        const firstNormalized = toStringArray(first, 50).map((item) => item.toLowerCase());
        const secondNormalized = toStringArray(second, 50).map((item) => item.toLowerCase());
        if (firstNormalized.length === 0 || secondNormalized.length === 0) return false;
        const secondSet = new Set(secondNormalized);
        const shared = firstNormalized.filter((item) => secondSet.has(item)).length;
        const union = new Set([...firstNormalized, ...secondNormalized]).size;
        if (union === 0) return false;
        return (shared / union) >= 0.6;
      };
      const compareValues = (first, second) => {
        if (!hasValue(first) || !hasValue(second)) return false;
        if (Array.isArray(first) || Array.isArray(second)) return compareArray(first, second);
        if (typeof first === 'number' || typeof second === 'number') {
          return Number(first) === Number(second);
        }
        return compareScalar(first, second);
      };
      const deterministicFields = new Set([
        'email',
        'phone',
        'linkedinUrl',
        'githubUrl',
        'portfolioUrl',
        'graduationYear',
      ]);
      const semiDeterministicFields = new Set([
        'skills',
        'certifications',
        'yearsOfExperience',
        'institutionName',
        'fieldOfStudy',
      ]);
      const confidenceFromSource = (field, source, agreed) => {
        if (agreed) {
          if (deterministicFields.has(field)) return 0.98;
          if (semiDeterministicFields.has(field)) return 0.94;
          return 0.9;
        }
        if (source === 'heuristic') {
          if (deterministicFields.has(field)) return 0.9;
          if (semiDeterministicFields.has(field)) return 0.8;
          return 0.74;
        }
        if (source === 'llm') {
          if (deterministicFields.has(field)) return 0.76;
          if (semiDeterministicFields.has(field)) return 0.7;
          return 0.66;
        }
        return 0;
      };
      const resolveField = (field, llmValue, heuristicValue) => {
        const llmHas = hasValue(llmValue);
        const heuristicHas = hasValue(heuristicValue);
        if (!llmHas && !heuristicHas) {
          return { value: null, source: 'none', confidence: 0 };
        }

        const agreed = llmHas && heuristicHas && compareValues(llmValue, heuristicValue);
        if (agreed) {
          const value = deterministicFields.has(field) ? heuristicValue : llmValue;
          return { value, source: 'agreement', confidence: confidenceFromSource(field, 'agreement', true) };
        }

        if (heuristicHas && llmHas) {
          const source = deterministicFields.has(field) || semiDeterministicFields.has(field) ? 'heuristic' : 'llm';
          const value = source === 'heuristic' ? heuristicValue : llmValue;
          return { value, source, confidence: confidenceFromSource(field, source, false) };
        }

        if (heuristicHas) {
          return { value: heuristicValue, source: 'heuristic', confidence: confidenceFromSource(field, 'heuristic', false) };
        }

        return { value: llmValue, source: 'llm', confidence: confidenceFromSource(field, 'llm', false) };
      };

      const extractHeuristicProfile = (textValue) => {
        const cleanText = textValue.replace(/\s+/g, ' ').trim();
        const lines = textValue
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        const emailMatch = textValue.match(/[\w.+%-]+@[\w.-]+\.[a-z]{2,}/i);
        const phoneMatch = textValue.match(/(?:\+?\d[\d\s().-]{8,}\d)/);

        const rawUrlMatches = textValue.match(/(?:https?:\/\/|www\.)[^\s<>()]+/gi) || [];
        const urls = Array.from(new Set(
          rawUrlMatches
            .map((url) => url.replace(/[),.;]+$/, ''))
            .map((url) => normalizeUrl(url))
            .filter(Boolean),
        ));
        const linkedinUrl = urls.find((url) => /linkedin\.com/i.test(url)) || null;
        const githubUrl = urls.find((url) => /github\.com/i.test(url)) || null;
        const portfolioUrl = urls.find((url) => !/linkedin\.com|github\.com/i.test(url)) || null;

        const nameFromPrefix = cleanText.match(
          /^([A-Za-z][A-Za-z .'-]{2,80}?)(?=\s+(?:Email|Phone|Location|Target Role|Experience|Professional Summary|Summary|Skills|Education)\b)/i
        )?.[1];
        const nameFromLine = lines.find(
          (line, index) => index < 6
            && !line.includes('@')
            && !line.includes(':')
            && /^[A-Za-z][A-Za-z .'-]{2,80}$/.test(line)
            && line.split(/\s+/).length >= 2,
        );

        const roleFromLabel = textValue.match(
          /(?:Target Role|Desired Role|Current Role|Role|Position)\s*[:\-]\s*([^\n\r]+?)(?=\s+(?:Experience|Professional Summary|Summary|Skills|Education|Location|$))/i
        )?.[1]?.trim();
        const knownRole = [
          'Software Engineer',
          'Frontend Engineer',
          'Frontend Developer',
          'Backend Engineer',
          'Backend Developer',
          'Full Stack Engineer',
          'Full Stack Developer',
          'DevOps Engineer',
          'QA Engineer',
          'Data Analyst',
          'Data Scientist',
        ].find((role) => new RegExp(`\b${role}\b`, 'i').test(textValue)) || null;

        const yearsMatch = textValue.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/i);
        const yearsOfExperience = yearsMatch ? Number.parseFloat(yearsMatch[1]) : null;

        const normalizeExperienceLevel = (value) => {
          const normalized = (value || '').toString().toLowerCase().trim();
          if (!normalized) return null;
          if (/(entry|junior|intern|graduate|fresher)/.test(normalized)) return 'entry';
          if (/mid/.test(normalized)) return 'mid';
          if (/(senior|sr)/.test(normalized)) return 'senior';
          if (/(lead|principal|staff)/.test(normalized)) return 'lead';
          if (/(executive|director|head|vp|c-level)/.test(normalized)) return 'executive';
          return null;
        };
        const inferExperienceLevel = (years) => {
          if (typeof years !== 'number' || Number.isNaN(years)) return null;
          if (years <= 2) return 'entry';
          if (years <= 5) return 'mid';
          if (years <= 10) return 'senior';
          if (years <= 15) return 'lead';
          return 'executive';
        };
        const experienceLabel = textValue.match(
          /(?:Experience Level|Seniority)\s*[:\-]\s*([^\n\r]+)/i
        )?.[1];
        const experienceLevel = normalizeExperienceLevel(experienceLabel) || inferExperienceLevel(yearsOfExperience);

        const location = textValue.match(
          /(?:Location|Address|Based in)\s*[:\-]\s*([^\n\r]+?)(?=\s+(?:Target Role|Experience|Professional Summary|Summary|Skills|Education|$))/i
        )?.[1]?.trim() || null;

        const education = textValue.match(
          /(?:Education|Qualification|Degree)\s*[:\-]\s*([^\n\r]+?)(?=\s+(?:Experience|Professional Summary|Summary|Skills|Location|$))/i
        )?.[1]?.trim() || null;
        const fieldOfStudy = textValue.match(
          /(?:Field of Study|Major|Specialization)\s*[:\-]\s*([^\n\r]+)/i
        )?.[1]?.trim() || null;

        const summary = textValue.match(
          /(?:Professional Summary|Summary|Profile)\s*[:\-]\s*([^\n\r]+?)(?=\s+(?:Skills|Experience|Education|Location|$))/i
        )?.[1]?.trim() || null;

        const skillsFromLabel = textValue.match(
          /(?:Skills?|Technologies|Technical Skills?|Tools?)\s*[:\-]\s*([^\n\r]+?)(?=\s+(?:Experience|Professional Summary|Summary|Education|Location|$))/i
        )?.[1];
        const skills = toStringArray(skillsFromLabel, 20);

        const certificationLabel = textValue.match(
          /(?:Certifications?|Certificates?|Licenses?)\s*[:\-]\s*([^\n\r]+)/i
        )?.[1];
        const certificationLines = lines
          .filter((line) => /(certified|certification|certificate|scrum master|pmp|aws|azure|gcp|kubernetes|ccna|istqb)/i.test(line))
          .slice(0, 8);
        const certifications = toStringArray([...(certificationLabel ? [certificationLabel] : []), ...certificationLines], 20);

        const institutionByLabel = textValue.match(
          /(?:Institution|University|College|School)\s*[:\-]\s*([^\n\r]+)/i
        )?.[1]?.trim();
        const institutionByLine = lines.find((line) => /(university|institute|college|school|academy|campus|polytechnic)/i.test(line));
        const institutionName = institutionByLabel || institutionByLine || null;

        const currentYear = new Date().getFullYear();
        const graduationByLabel = textValue.match(
          /(?:Graduation|Graduated|Completion|Pass(?:ed)? Out)\s*(?:Year|Date)?\s*[:\-]?\s*((?:19|20)\d{2})/i
        )?.[1];
        const yearCandidates = (textValue.match(/\b(?:19|20)\d{2}\b/g) || [])
          .map((year) => Number.parseInt(year, 10))
          .filter((year) => year >= 1970 && year <= currentYear + 6);
        const graduationYear = graduationByLabel || (yearCandidates.length > 0 ? Math.max(...yearCandidates).toString() : null);

        let industry = null;
        if (/(technology|software|information technology|computer science|developer|engineering)/i.test(textValue)) {
          industry = 'Technology & Software';
        }

        return {
          fullName: nameFromPrefix?.trim() || nameFromLine || null,
          email: emailMatch?.[0] || null,
          phone: phoneMatch?.[0]?.trim() || null,
          location,
          targetRole: roleFromLabel || knownRole,
          experienceLevel,
          yearsOfExperience: Number.isFinite(yearsOfExperience) ? yearsOfExperience : null,
          skills: skills.length > 0 ? skills : [],
          certifications,
          linkedinUrl,
          githubUrl,
          portfolioUrl,
          industry,
          education,
          fieldOfStudy,
          institutionName,
          graduationYear,
          summary,
        };
      };

      // Use LLM to extract structured profile data, then enrich missing values with deterministic heuristics.
      const { LLMService } = await import('../services/llm.service.js');
      const prompt = `Extract structured profile information from this resume text. Return ONLY valid JSON with these fields (use null/[] if unknown, do not invent values):
{
  "fullName": "string or null",
  "email": "string or null",
  "phone": "string or null",
  "location": "string or null",
  "targetRole": "most recent or desired job title (string or null)",
  "experienceLevel": "one of: entry, junior, mid, senior, lead, executive (string or null)",
  "yearsOfExperience": "number or null",
  "skills": ["array", "of", "skills"],
  "certifications": ["array", "of", "certifications"],
  "linkedinUrl": "full LinkedIn profile URL or null",
  "githubUrl": "full GitHub profile URL or null",
  "portfolioUrl": "full portfolio/personal website URL or null",
  "industry": "primary industry (string or null)",
  "education": "highest degree or qualification (string or null)",
  "fieldOfStudy": "field/major (string or null)",
  "institutionName": "institution/university/college name (string or null)",
  "graduationYear": "4-digit year string or null",
  "summary": "brief professional summary in 1-2 sentences (string or null)"
}

Resume text:
${resumeText.substring(0, 12000)}`;

      const heuristicExtracted = extractHeuristicProfile(resumeText);
      let extracted = {};

      try {
        const llmResult = await LLMService.generateWithFallback({
          systemPrompt: 'You are a resume parser. Extract structured profile data from resume text with high precision and no fabrication.',
          userMessage: prompt,
          llmOptions: { model: process.env.OLLAMA_MODEL || 'qwen3:8b', temperature: 0.1, maxTokens: 1200 },
        });
        const jsonMatch = (llmResult || '').match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            extracted = parsed;
          }
        }
      } catch {
        extracted = {};
      }

      const llmExtracted = {
        fullName: extracted.fullName,
        email: extracted.email,
        phone: extracted.phone,
        location: extracted.location,
        targetRole: extracted.targetRole,
        experienceLevel: extracted.experienceLevel,
        yearsOfExperience: toNumberOrNull(extracted.yearsOfExperience),
        skills: toStringArray(extracted.skills, 25),
        certifications: toStringArray(extracted.certifications, 20),
        linkedinUrl: normalizeUrl(extracted.linkedinUrl),
        githubUrl: normalizeUrl(extracted.githubUrl),
        portfolioUrl: normalizeUrl(extracted.portfolioUrl),
        industry: extracted.industry,
        education: extracted.education,
        fieldOfStudy: extracted.fieldOfStudy,
        institutionName: extracted.institutionName,
        graduationYear: extracted.graduationYear,
        summary: extracted.summary,
      };
      const deterministicExtracted = {
        fullName: heuristicExtracted.fullName,
        email: heuristicExtracted.email,
        phone: heuristicExtracted.phone,
        location: heuristicExtracted.location,
        targetRole: heuristicExtracted.targetRole,
        experienceLevel: heuristicExtracted.experienceLevel,
        yearsOfExperience: toNumberOrNull(heuristicExtracted.yearsOfExperience),
        skills: toStringArray(heuristicExtracted.skills, 25),
        certifications: toStringArray(heuristicExtracted.certifications, 20),
        linkedinUrl: normalizeUrl(heuristicExtracted.linkedinUrl),
        githubUrl: normalizeUrl(heuristicExtracted.githubUrl),
        portfolioUrl: normalizeUrl(heuristicExtracted.portfolioUrl),
        industry: heuristicExtracted.industry,
        education: heuristicExtracted.education,
        fieldOfStudy: heuristicExtracted.fieldOfStudy,
        institutionName: heuristicExtracted.institutionName,
        graduationYear: heuristicExtracted.graduationYear,
        summary: heuristicExtracted.summary,
      };

      const resolvedFields = {
        fullName: resolveField('fullName', llmExtracted.fullName, deterministicExtracted.fullName),
        email: resolveField('email', llmExtracted.email, deterministicExtracted.email),
        phone: resolveField('phone', llmExtracted.phone, deterministicExtracted.phone),
        location: resolveField('location', llmExtracted.location, deterministicExtracted.location),
        targetRole: resolveField('targetRole', llmExtracted.targetRole, deterministicExtracted.targetRole),
        experienceLevel: resolveField('experienceLevel', llmExtracted.experienceLevel, deterministicExtracted.experienceLevel),
        yearsOfExperience: resolveField('yearsOfExperience', llmExtracted.yearsOfExperience, deterministicExtracted.yearsOfExperience),
        skills: resolveField('skills', llmExtracted.skills, deterministicExtracted.skills),
        certifications: resolveField('certifications', llmExtracted.certifications, deterministicExtracted.certifications),
        linkedinUrl: resolveField('linkedinUrl', llmExtracted.linkedinUrl, deterministicExtracted.linkedinUrl),
        githubUrl: resolveField('githubUrl', llmExtracted.githubUrl, deterministicExtracted.githubUrl),
        portfolioUrl: resolveField('portfolioUrl', llmExtracted.portfolioUrl, deterministicExtracted.portfolioUrl),
        industry: resolveField('industry', llmExtracted.industry, deterministicExtracted.industry),
        education: resolveField('education', llmExtracted.education, deterministicExtracted.education),
        fieldOfStudy: resolveField('fieldOfStudy', llmExtracted.fieldOfStudy, deterministicExtracted.fieldOfStudy),
        institutionName: resolveField('institutionName', llmExtracted.institutionName, deterministicExtracted.institutionName),
        graduationYear: resolveField('graduationYear', llmExtracted.graduationYear, deterministicExtracted.graduationYear),
        summary: resolveField('summary', llmExtracted.summary, deterministicExtracted.summary),
      };

      extracted = {};
      const confidence = {};
      const sources = {};
      Object.entries(resolvedFields).forEach(([field, payload]) => {
        if (!hasValue(payload?.value)) return;
        extracted[field] = payload.value;
        confidence[field] = payload.confidence;
        sources[field] = payload.source;
      });

      res.json({
        success: true,
        extracted,
        confidence,
        sources,
        resumeTextLength: resumeText.length,
      });
    } catch (error) {
      if (resumeFile?.path) {
        try { await unlink(resumeFile.path); } catch {}
      }
      logger.error('Parse resume error:', error);
      next(error);
    }
  }

  static async startEmailVerification(req, res, next) {
    try {
      const requestedEmail = (req.body.email || req.user.email || '').trim().toLowerCase();
      const tokenEmail = (req.user.email || '').trim().toLowerCase();

      if (!requestedEmail) {
        return res.status(400).json({ success: false, error: 'Email is required.' });
      }

      if (tokenEmail && requestedEmail !== tokenEmail) {
        return res.status(400).json({
          success: false,
          error: 'Email does not match the signed-in account.',
        });
      }

      const userRecord = await admin.auth().getUser(req.user.uid);
      const firebaseEmail = (userRecord?.email || '').toLowerCase();

      if (firebaseEmail && firebaseEmail !== requestedEmail) {
        return res.status(400).json({
          success: false,
          error: 'Email does not match the Firebase account.',
        });
      }

      if (userRecord?.emailVerified) {
        return res.json({
          success: true,
          verified: true,
          message: 'Email is already verified.',
        });
      }

      const existing = await emailVerificationStore.getByUid(req.user.uid);
      const nowMs = Date.now();
      const lastSentMs = toMillisSafe(existing?.lastSentAt);

      if (lastSentMs && nowMs - lastSentMs < EMAIL_VERIFICATION_RESEND_COOLDOWN_MS) {
        const waitSeconds = Math.ceil(
          (EMAIL_VERIFICATION_RESEND_COOLDOWN_MS - (nowMs - lastSentMs)) / 1000
        );
        return res.status(429).json({
          success: false,
          error: `Please wait ${waitSeconds} seconds before requesting another verification email.`,
        });
      }

      let sendCount = existing?.sendCount || 0;
      let windowStartedAt = existing?.windowStartedAt || new Date(nowMs).toISOString();
      const windowStartMs = toMillisSafe(windowStartedAt);

      if (!windowStartMs || nowMs - windowStartMs >= EMAIL_VERIFICATION_WINDOW_MS) {
        sendCount = 0;
        windowStartedAt = new Date(nowMs).toISOString();
      }

      if (sendCount >= EMAIL_VERIFICATION_MAX_PER_HOUR) {
        return res.status(429).json({
          success: false,
          error: 'You have reached the maximum number of verification emails. Please wait an hour and try again.',
        });
      }

      const verificationCode = generateVerificationCode();

      await emailService.sendEmailVerification({
        email: requestedEmail,
        fullName: req.body.fullName || userRecord?.displayName || req.user.metadata?.fullName || null,
        verificationCode,
        expiresInMinutes: EMAIL_VERIFICATION_EXPIRY_MINUTES,
      });

      await emailVerificationStore.upsert(req.user.uid, {
        email: requestedEmail,
        codeHash: hashVerificationCode(verificationCode),
        codeLastFour: verificationCode.slice(-4),
        expiresAt: new Date(nowMs + EMAIL_VERIFICATION_EXPIRY_MINUTES * 60 * 1000).toISOString(),
        lastSentAt: new Date(nowMs).toISOString(),
        sendCount: sendCount + 1,
        windowStartedAt,
        attempts: 0,
        usedAt: null,
      });

      return res.json({
        success: true,
        verified: false,
        email: requestedEmail,
        expiresInMinutes: EMAIL_VERIFICATION_EXPIRY_MINUTES,
        message: `Verification code sent to ${requestedEmail}.`,
      });
    } catch (error) {
      logger.error('Start email verification error:', error);
      next(error);
    }
  }

  static async verifyEmailCode(req, res, next) {
    try {
      const code = (req.body.code || '').trim();

      if (!code) {
        return res.status(400).json({ success: false, error: 'Verification code is required.' });
      }

      if (!/^\d{8}$/.test(code)) {
        return res.status(400).json({
          success: false,
          error: 'Verification code must be 8 digits.',
        });
      }

      const userRecord = await admin.auth().getUser(req.user.uid);
      const firebaseEmail = (userRecord?.email || req.user.email || '').toLowerCase();

      if (!firebaseEmail) {
        return res.status(400).json({
          success: false,
          error: 'Email is missing from the Firebase account.',
        });
      }

      if (userRecord?.emailVerified) {
        await emailVerificationStore.delete(req.user.uid);
        return res.json({
          success: true,
          verified: true,
          message: 'Email is already verified.',
        });
      }

      const record = await emailVerificationStore.getByUid(req.user.uid);

      if (!record || !record.codeHash) {
        return res.status(400).json({
          success: false,
          error: 'No active verification request found. Please request a new code.',
        });
      }

      if (record.email && record.email.toLowerCase() !== firebaseEmail) {
        return res.status(400).json({
          success: false,
          error: 'Email mismatch. Please request a new verification code.',
        });
      }

      const expiresAtMs = toMillisSafe(record.expiresAt);
      if (expiresAtMs && Date.now() > expiresAtMs) {
        return res.status(400).json({
          success: false,
          error: 'Verification code has expired. Please request a new code.',
        });
      }

      const attempts = record.attempts || 0;
      if (attempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS) {
        return res.status(429).json({
          success: false,
          error: 'Too many incorrect attempts. Please request a new verification code.',
        });
      }

      const candidateHash = hashVerificationCode(code);
      if (!safeHashEquals(candidateHash, record.codeHash)) {
        await emailVerificationStore.upsert(req.user.uid, {
          attempts: attempts + 1,
          lastAttemptAt: now(),
        });
        return res.status(400).json({
          success: false,
          error: 'Invalid verification code. Please try again.',
        });
      }

      await admin.auth().updateUser(req.user.uid, { emailVerified: true });
      await emailVerificationStore.delete(req.user.uid);

      return res.json({
        success: true,
        verified: true,
        message: 'Email verified successfully.',
      });
    } catch (error) {
      logger.error('Verify email code error:', error);
      next(error);
    }
  }

  static async deleteUnregisteredAuthUser(req, res, next) {
    try {
      const { userId } = req.body;

      if (!userId) {
        logger.warn('deleteUnregisteredAuthUser: userId is missing in request');
        return res.status(400).json({ error: 'userId is required' });
      }

      if (!req.user?.uid) {
        return res.status(401).json({ error: 'User not authenticated', success: false });
      }

      if (req.user.uid !== userId) {
        logger.warn('deleteUnregisteredAuthUser: uid mismatch', {
          requestedUserId: userId,
          callerUid: req.user.uid,
        });
        return res.status(403).json({
          error: 'Forbidden',
          success: false,
        });
      }

      logger.info(`Attempting to delete unregistered auth user: ${userId}`);

      const user = await userStore.getByUid(userId);
      if (user) {
        logger.warn(`Cannot delete auth user ${userId} - user exists in database with ID: ${user.id}`);
        return res.status(400).json({
          error: 'User is registered in the system',
          userId,
          success: false,
        });
      }

      logger.info(`User ${userId} not found in database, proceeding with Firebase auth deletion`);

      const deleted = await deleteFirebaseUser(userId);

      if (!deleted) {
        logger.error(`Failed to delete Firebase auth user ${userId}`);
        return res.status(500).json({
          error: 'Failed to delete auth user',
          details: 'Could not delete user from Firebase',
          success: false,
        });
      }

      logger.info(`Successfully deleted unregistered Firebase auth user: ${userId}`);
      res.json({
        success: true,
        message: 'Unregistered auth user deleted successfully',
        userId,
      });
    } catch (error) {
      logger.error('Delete unregistered auth user error:', error);
      next(error);
    }
  }

  static async checkEmailAvailability(req, res, next) {
    try {
      const email = (req.body.email || '').trim().toLowerCase();

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required',
        });
      }

      const existingUser = await userStore.getByEmail(email);

      res.json({
        success: true,
        exists: Boolean(existingUser),
        accountType: existingUser?.accountType || null,
      });
    } catch (error) {
      logger.error('Check email availability error:', error);
      next(error);
    }
  }
}
