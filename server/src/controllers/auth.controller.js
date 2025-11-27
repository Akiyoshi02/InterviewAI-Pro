import { deleteFirebaseUser } from '../config/firebase.js';
import { organizationMemberStore, organizationStore, userStore } from '../services/firebaseData.service.js';
import logger from '../utils/logger.js';
import { unlink } from 'fs/promises';
import { validateCandidateProfilePhoto, validateCompanyLogo } from '../services/imageModeration.service.js';

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
    companySize: user.companySize || null,
    industry: user.industry || null,
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

    try {
      const { accountType, fullName, experienceLevel, companyName, industry, companySize, skills } = req.body;
      const firebaseUid = req.user.uid;
      const email = (req.user.email || '').toLowerCase();

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
        await validateCompanyLogo(companyLogo.path);
      }

      if (accountTypeEnum === 'COMPANY') {
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

      const accountTypeEnum = (accountType || '').toUpperCase() === 'COMPANY' ? 'COMPANY' : 'CANDIDATE';

      let primaryOrganizationId = null;
      let organizationRoles = [];
      let organization = null;
      let membership = null;

      if (accountTypeEnum === 'COMPANY') {
        organization = await organizationStore.create({
          ownerId: firebaseUid,
          name: companyName || `${fullName || 'New'} Organization`,
          displayName: companyName || `${fullName || 'New'} Organization`,
          industry: industry || null,
          companySize: companySize || null,
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
        skills: accountTypeEnum === 'CANDIDATE' ? (skills || []) : [],
        companyName: accountTypeEnum === 'COMPANY' ? companyName || null : null,
        companySize: accountTypeEnum === 'COMPANY' ? companySize || null : null,
        industry: accountTypeEnum === 'COMPANY' ? industry || null : null,
        primaryOrganizationId,
        organizationRoles,
        profilePhotoUrl:
          accountTypeEnum === 'CANDIDATE'
            ? buildUploadUrl(PROFILE_PHOTO_BASE_PATH, profilePhoto?.filename)
            : null,
        resumeUrl:
          accountTypeEnum === 'CANDIDATE' ? buildUploadUrl(RESUME_BASE_PATH, resumeFile?.filename) : null,
        resumeOriginalName: accountTypeEnum === 'CANDIDATE' ? resumeFile?.originalname || null : null,
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
      });
      userCreated = true;

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
      const allowedFields = ['fullName', 'experienceLevel', 'skills', 'companyName', 'companySize', 'industry'];

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

  static async deleteUnregisteredAuthUser(req, res, next) {
    try {
      const { userId } = req.body;

      if (!userId) {
        logger.warn('deleteUnregisteredAuthUser: userId is missing in request');
        return res.status(400).json({ error: 'userId is required' });
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
