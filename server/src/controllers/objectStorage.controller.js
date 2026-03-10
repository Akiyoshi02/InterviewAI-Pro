import fs from 'fs/promises';
import { interviewStore, jobStore } from '../services/firebaseData.service.js';
import { isReviewerAssignedToInterview } from '../utils/reviewerAccess.util.js';
import {
  createSignedDownloadPath,
  normalizeUploadsPublicPath,
  resolveUploadsAbsolutePath,
  toSafeTtlSeconds,
  verifySignedDownloadQuery,
} from '../services/localObjectStorage.service.js';

const toAbsoluteApiUrl = (req, relativePath) => {
  const origin = `${req.protocol}://${req.get('host')}`;
  return `${origin}${relativePath}`;
};

export class ObjectStorageController {
  static pathMatchesAny(normalizedPath, candidates = []) {
    const normalizedCandidates = (candidates || [])
      .map((value) => normalizeUploadsPublicPath(value))
      .filter(Boolean);
    return normalizedCandidates.includes(normalizedPath);
  }

  static async isOrganizationJobMediaPath(normalizedPath, organizationId) {
    if (!normalizedPath || !organizationId) return false;

    const jobs = await jobStore.listByOrganization(organizationId, { includeDeleted: true });
    return (jobs || []).some((job) => {
      const advertImageUrls = Array.isArray(job?.advertImageUrls) ? job.advertImageUrls : [];
      return [
        job?.advertImageUrl || null,
        job?.advertVideoUrl || null,
        ...advertImageUrls,
      ].map((value) => normalizeUploadsPublicPath(value)).includes(normalizedPath);
    });
  }

  /**
   * CRITICAL FIX: Validate file ownership before generating signed URL
   * This prevents users from accessing files they don't own
   */
  static async validateFileOwnership(normalizedPath, user) {
    // Parse file path to extract ownership information
    // File path patterns:
    // - /uploads/profile-photos/*
    // - /uploads/resumes/*
    // - /uploads/company-logos/*
    // - /uploads/company-covers/*
    // - /uploads/company-verifications/*
    // - /uploads/job-advert-images/*
    // - /uploads/job-advert-videos/*
    // - /uploads/jobs/{organizationId}/{jobId}/* (legacy)
    // - /uploads/interviews/{interviewId}/*

    const pathParts = normalizedPath.split('/').filter(Boolean);
    if (pathParts.length < 3) {
      return { valid: false, error: 'Invalid file path structure' };
    }

    const [, category, identifier] = pathParts;

    // System admin can access any file.
    if (user.accountType === 'SYSTEM_ADMIN') {
      return { valid: true };
    }

    // Validate candidate files (profile photos, resumes)
    if (category === 'profile-photos' || category === 'resumes') {
      if (user.accountType !== 'CANDIDATE') {
        return { valid: false, error: 'Only candidates can access this file type' };
      }
      const ownCandidatePaths = [
        user.profile?.profilePhotoUrl,
        user.profile?.resumeUrl,
      ];
      if (!this.pathMatchesAny(normalizedPath, ownCandidatePaths)) {
        return { valid: false, error: 'You can only access your own files' };
      }
      return { valid: true };
    }

    // Validate company files (logos, covers, verifications)
    if (category === 'company-logos' || category === 'company-covers' || category === 'company-verifications') {
      if (user.accountType !== 'COMPANY') {
        return { valid: false, error: 'Only company accounts can access this file type' };
      }
      const userOrgId = user.organizationContext?.organization?.id;
      if (!userOrgId) {
        return { valid: false, error: 'Organization context not found' };
      }

      const ownCompanyPaths = [
        user.profile?.companyLogoUrl,
        user.profile?.companyCoverUrl,
        user.profile?.companyVerificationUrl,
        user.organizationContext?.organization?.logo,
        user.organizationContext?.organization?.profile?.coverUrl,
        user.organizationContext?.organization?.coverUrl,
      ];
      if (!this.pathMatchesAny(normalizedPath, ownCompanyPaths)) {
        return { valid: false, error: 'You can only access your organization files' };
      }
      return { valid: true };
    }

    // Validate legacy nested job files
    if (category === 'jobs') {
      if (user.accountType !== 'COMPANY') {
        return { valid: false, error: 'Only company accounts can access job files' };
      }
      const userOrgId = user.organizationContext?.organization?.id;
      if (!userOrgId) {
        return { valid: false, error: 'Organization context not found' };
      }
      if (identifier !== userOrgId) {
        return { valid: false, error: 'You can only access your organization\'s job files' };
      }
      return { valid: true };
    }

    // Validate job advert media files.
    if (category === 'job-advert-images' || category === 'job-advert-videos') {
      if (user.accountType !== 'COMPANY') {
        return { valid: false, error: 'Only company accounts can access job media files' };
      }
      const userOrgId = user.organizationContext?.organization?.id;
      if (!userOrgId) {
        return { valid: false, error: 'Organization context not found' };
      }

      const isOwnedMedia = await this.isOrganizationJobMediaPath(normalizedPath, userOrgId);
      if (!isOwnedMedia) {
        return { valid: false, error: 'You can only access job media from your organization' };
      }
      return { valid: true };
    }

    // Validate interview recordings
    if (category === 'interviews') {
      const interview = await interviewStore.getById(identifier);
      if (!interview) {
        return { valid: false, error: 'Interview not found for recording access' };
      }

      if (user.accountType === 'CANDIDATE') {
        if (interview.candidateId !== user.id) {
          return { valid: false, error: 'You can only access recordings from your own interviews' };
        }
        return { valid: true };
      }

      if (user.accountType === 'COMPANY') {
        const userOrgId = user.organizationContext?.organization?.id;
        if (!userOrgId) {
          return { valid: false, error: 'Organization context not found' };
        }

        if (interview.organizationId !== userOrgId) {
          return { valid: false, error: 'You can only access recordings from your organization' };
        }

        const organizationRole = String(user.organizationContext?.membership?.role || '').toUpperCase();
        if (organizationRole === 'REVIEWER' && !isReviewerAssignedToInterview(interview, user.id)) {
          return { valid: false, error: 'You are not assigned to this interview recording' };
        }

        return { valid: true };
      }

      return { valid: false, error: 'Only interview participants can access this recording' };
    }

    // Unknown file category - deny by default
    return { valid: false, error: 'Unknown file category' };
  }

  static async getSignedDownloadUrl(req, res, next) {
    try {
      const normalizedPath = normalizeUploadsPublicPath(req.query.path);
      if (!normalizedPath) {
        return res.status(400).json({
          error: 'A valid uploads path is required.',
        });
      }

      const absolutePath = resolveUploadsAbsolutePath(normalizedPath);
      if (!absolutePath) {
        return res.status(400).json({
          error: 'Invalid uploads path.',
        });
      }

      // CRITICAL FIX: Validate file ownership
      const ownershipCheck = await this.validateFileOwnership(normalizedPath, req.user);
      if (!ownershipCheck.valid) {
        return res.status(403).json({
          error: ownershipCheck.error || 'Access denied',
          code: 'FILE_ACCESS_DENIED',
        });
      }

      try {
        await fs.access(absolutePath);
      } catch {
        return res.status(404).json({
          error: 'File not found.',
        });
      }

      const expiresInSeconds = toSafeTtlSeconds(req.query.expiresInSeconds);
      const signedRelativeUrl = createSignedDownloadPath({
        publicPath: normalizedPath,
        expiresInSeconds,
      });
      if (!signedRelativeUrl) {
        return res.status(400).json({
          error: 'Unable to sign this uploads path.',
        });
      }

      return res.json({
        success: true,
        path: normalizedPath,
        expiresInSeconds,
        relativeDownloadUrl: signedRelativeUrl,
        downloadUrl: toAbsoluteApiUrl(req, signedRelativeUrl),
      });
    } catch (error) {
      return next(error);
    }
  }

  static async download(req, res, next) {
    try {
      const verification = verifySignedDownloadQuery({
        publicPath: req.query.path,
        expiresAt: req.query.expiresAt,
        signature: req.query.signature,
      });

      if (!verification.valid) {
        if (verification.code === 'EXPIRED') {
          return res.status(410).json({
            error: 'Signed file URL has expired.',
            code: verification.code,
          });
        }
        return res.status(403).json({
          error: 'Invalid signed file URL.',
          code: verification.code,
        });
      }

      const absolutePath = resolveUploadsAbsolutePath(verification.path);
      if (!absolutePath) {
        return res.status(400).json({
          error: 'Invalid uploads path.',
        });
      }

      try {
        await fs.access(absolutePath);
      } catch {
        return res.status(404).json({
          error: 'File not found.',
        });
      }

      const maxAge = Math.max(0, verification.expiresAt - Math.floor(Date.now() / 1000));
      res.setHeader('Cache-Control', `private, max-age=${maxAge}`);
      return res.sendFile(absolutePath);
    } catch (error) {
      return next(error);
    }
  }
}

