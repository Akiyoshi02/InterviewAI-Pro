import admin, { deleteFirebaseUser } from '../config/firebase.js';
import { organizationMemberStore, organizationStore, userStore, teamInvitationStore, emailVerificationStore } from '../services/firebaseData.service.js';
import logger from '../utils/logger.js';
import { unlink } from 'fs/promises';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { validateCandidateProfilePhoto, validateCompanyLogo } from '../services/imageModeration.service.js';
import { validateBusinessVerificationDocument, validateResumeDocument } from '../services/documentModeration.service.js';
import { emailService } from '../services/email.service.js';

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
    industry: organization.industry,
    companySize: organization.companySize,
    status: organization.status || 'PENDING', // Include status for approval workflow
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
const COMPANY_PROOF_MAX_BYTES = 15 * 1024 * 1024;
const PROFILE_PHOTO_BASE_PATH = '/uploads/profile-photos';
const RESUME_BASE_PATH = '/uploads/resumes';
const COMPANY_LOGO_BASE_PATH = '/uploads/company-logos';
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
      } = req.body;

      const normalizedSkills = normalizeListField(skills);
      const normalizedCertifications = normalizeListField(certifications);
      const firebaseUid = req.user.uid;
      const email = (req.user.email || '').toLowerCase();
      let emailVerified = Boolean(req.user.emailVerified);
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

      if (accountTypeEnum === 'COMPANY' && !teamInvitationToken) {
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

        // TESTING: Relaxed duplicate document detection
        // if (businessVerificationResult?.hash) {
        //   const duplicateDocs = await userStore.findByVerificationHash(businessVerificationResult.hash);
        //   if (duplicateDocs.length) {
        //     const existingCompany = duplicateDocs[0]?.companyName || 'another organization';
        //     const error = new Error(`This verification document is already linked to ${existingCompany}. Please upload a unique certificate.`);
        //     error.status = 400;
        //     throw error;
        //   }
        // }
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
          industry: industry || null,
          companySize: companySize || null,
          companyType: companyType || null,
          logo: logoUrl,
          website: companyWebsite || null,
          address: companyAddress || null,
          description: companyDescription || null,
          facebookUrl: facebookUrl || null,
          linkedinUrl: companyLinkedinUrl || null,
        });

        membership = await organizationMemberStore.addMember({
          organizationId: organization.id,
          userId: firebaseUid,
          role: 'ADMIN',
        });

        primaryOrganizationId = organization.id;
        organizationRoles = [{ organizationId: organization.id, role: 'ADMIN' }];
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
          accountTypeEnum === 'CANDIDATE'
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
      const allowedFields = [
        'fullName',
        'experienceLevel',
        'skills',
        'companyName',
        'companyType',
        'companySize',
        'industry',
        'gender',
        'targetRole',
        'careerGoals',
        'location',
        'preferredLanguage',
        'jobTitle',
        'department',
        'hiringVolume',
        'companyWebsite',
        'companyLocation',
        'phoneNumber',
        // Candidate education fields
        'highestQualification',
        'fieldOfStudy',
        'institutionName',
        'graduationYear',
        // Candidate professional links
        'linkedinUrl',
        'githubUrl',
        'portfolioUrl',
        // Candidate job preferences
        'certifications',
        'availability',
        'preferredWorkType',
        'preferredEmploymentType',
        'expectedSalary',
        // Company additional fields
        'businessRegistrationNumber',
        'companyEmail',
        'establishedYear',
        'companyLinkedinUrl',
      ];

      const data = {};
      allowedFields.forEach((field) => {
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
        const current = await userStore.getByUid(firebaseUid);
        return res.json({ success: true, user: sanitizeUser(current) });
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
