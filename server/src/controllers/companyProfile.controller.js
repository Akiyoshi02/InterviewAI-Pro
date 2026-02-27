/**
 * Public Company Profile Pages
 *
 * GET /api/companies/:slug        - candidate-only company profile
 * GET /api/companies              - candidate-only searchable list of approved companies
 * GET /api/companies/me/profile   - company admin reads own profile for editor
 * PUT /api/companies/me/profile   - company admin updates own profile
 */

import { firestore as db } from '../config/firebase.js';
import logger from '../utils/logger.js';

const DEFAULT_INDUSTRY_LABEL = 'Technology & Software';
const ALLOWED_INDUSTRY_KEY = 'technology';
const WORK_MODEL_OPTIONS = new Set(['REMOTE', 'HYBRID', 'ONSITE', 'FLEXIBLE']);

function normalizeIndustry(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';

  if (
    normalized === 'technology' ||
    normalized === 'technology & software' ||
    normalized === 'tech' ||
    normalized === 'it' ||
    normalized === 'information technology' ||
    normalized.includes('software')
  ) {
    return ALLOWED_INDUSTRY_KEY;
  }

  return normalized;
}

function formatIndustryLabel(value) {
  if (normalizeIndustry(value) === ALLOWED_INDUSTRY_KEY) return DEFAULT_INDUSTRY_LABEL;

  // Research scope is fixed to a single industry across the whole project.
  return DEFAULT_INDUSTRY_LABEL;
}

function normalizeWorkModel(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return null;
  return WORK_MODEL_OPTIONS.has(normalized) ? normalized : null;
}

function normalizeText(value) {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  return cleaned || null;
}

function pickCandidateFacingValue(data, profileKey, topLevelKeys = []) {
  for (const key of topLevelKeys) {
    const topLevel = normalizeText(data?.[key]);
    if (topLevel) return topLevel;
  }

  return normalizeText(data?.profile?.[profileKey]);
}

function buildSocialLinks(data) {
  const profileLinks = (data?.profile?.socialLinks && typeof data.profile.socialLinks === 'object')
    ? data.profile.socialLinks
    : {};

  return {
    ...profileLinks,
    linkedin: normalizeText(profileLinks.linkedin) || normalizeText(data?.linkedinUrl) || null,
    twitter: normalizeText(profileLinks.twitter) || null,
    github: normalizeText(profileLinks.github) || null,
    facebook: normalizeText(profileLinks.facebook) || normalizeText(data?.facebookUrl) || null,
    youtube: normalizeText(profileLinks.youtube) || normalizeText(data?.youtubeUrl) || null,
  };
}

function isApprovedStatus(value) {
  return String(value || '').trim().toLowerCase() === 'approved';
}

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function ensureSlug(orgId, orgName) {
  const existing = await db.collection('organizations').doc(orgId).get();
  const currentSlug = existing.data()?.slug;
  if (currentSlug) return currentSlug;

  const base = slugify(orgName || orgId) || orgId;
  let slug = base;
  let attempt = 0;

  while (true) {
    const snap = await db.collection('organizations').where('slug', '==', slug).get();
    if (snap.empty || (snap.size === 1 && snap.docs[0].id === orgId)) break;
    attempt += 1;
    slug = `${base}-${attempt}`;
  }

  await db.collection('organizations').doc(orgId).update({ slug });
  return slug;
}

async function buildCompanyProfile(orgDoc) {
  const data = orgDoc.data();
  const website = pickCandidateFacingValue(data, 'website', ['website']);
  const location = pickCandidateFacingValue(data, 'location', ['location', 'headquartersLocation', 'address']);
  const tagline = pickCandidateFacingValue(data, 'tagline', ['tagline']);

  const jobsSnap = await db.collection('jobs')
    .where('organizationId', '==', orgDoc.id)
    .where('status', '==', 'OPEN')
    .get();

  return {
    id: orgDoc.id,
    slug: data.slug || orgDoc.id,
    name: data.name,
    displayName: data.displayName || data.name,
    industry: formatIndustryLabel(data.industry),
    companySize: data.companySize,
    website,
    location,
    tagline,
    about: normalizeText(data.profile?.about),
    mission: normalizeText(data.profile?.mission),
    culture: normalizeText(data.profile?.culture),
    benefits: data.profile?.benefits || [],
    techStack: data.profile?.techStack || [],
    socialLinks: buildSocialLinks(data),
    logoUrl: data.branding?.logoUrl || data.logo || null,
    coverUrl: data.profile?.coverUrl || null,
    coverColor: data.profile?.coverColor || '#3b82f6',
    profilePublic: data.profilePublic !== false,
    workModel: normalizeWorkModel(data.profile?.workModel),
    hiringProcess: data.profile?.hiringProcess || null,
    hiringTimeline: data.profile?.hiringTimeline || null,
    responseTime: data.profile?.responseTime || null,
    verified: isApprovedStatus(data.status),
    openJobsCount: jobsSnap.size,
    openJobs: jobsSnap.docs.map((jobDoc) => {
      const job = jobDoc.data();
      return {
        id: jobDoc.id,
        title: job.title,
        location: job.location,
        type: job.type,
        salary: job.salary,
        postedAt: job.createdAt,
      };
    }),
    memberSince: data.createdAt,
  };
}

export class CompanyProfileController {
  /**
   * GET /api/companies - list public company profiles
   */
  static async listCompanies(req, res, next) {
    try {
      const {
        search = '',
        industry = '',
        size = 20,
        page = 1,
      } = req.query;

      const requestedSize = Math.max(1, Math.min(Number.parseInt(size, 10) || 20, 100));
      const requestedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
      const normalizedSearch = String(search).trim().toLowerCase();
      const normalizedIndustry = normalizeIndustry(industry);

      // Project scope is Technology only.
      if (normalizedIndustry && normalizedIndustry !== ALLOWED_INDUSTRY_KEY) {
        return res.json({ success: true, companies: [], total: 0, page: requestedPage, size: requestedSize });
      }

      // Fetch orgs first, then normalize status/industry in memory.
      // This keeps search resilient when older rows use inconsistent status casing.
      const snap = await db.collection('organizations').get();

      let companies = snap.docs.map((doc) => {
        const data = doc.data();
        const website = pickCandidateFacingValue(data, 'website', ['website']);
        const location = pickCandidateFacingValue(data, 'location', ['location', 'headquartersLocation', 'address']);
        const tagline = pickCandidateFacingValue(data, 'tagline', ['tagline']);
        return {
          id: doc.id,
          slug: data.slug || doc.id,
          name: data.name,
          displayName: data.displayName || data.name,
          industry: formatIndustryLabel(data.industry),
          companySize: data.companySize,
          tagline,
          logoUrl: data.branding?.logoUrl || data.logo || null,
          coverUrl: data.profile?.coverUrl || null,
          coverColor: data.profile?.coverColor || '#3b82f6',
          location,
          website,
          workModel: normalizeWorkModel(data.profile?.workModel),
          _status: data.status,
          profilePublic: data.profilePublic !== false,
          openJobsCount: data.openJobsCount || 0,
        };
      });

      companies = companies
        .filter((company) => isApprovedStatus(company._status))
        .filter((company) => company.profilePublic !== false)
        .filter((company) => normalizeIndustry(company.industry) === ALLOWED_INDUSTRY_KEY)
        .filter((company) => {
          if (!normalizedSearch) return true;
          return (
            company.name?.toLowerCase().includes(normalizedSearch) ||
            company.displayName?.toLowerCase().includes(normalizedSearch) ||
            company.slug?.toLowerCase().includes(normalizedSearch) ||
            company.industry?.toLowerCase().includes(normalizedSearch)
          );
        })
        .sort((left, right) => {
          const leftName = left.displayName || left.name || '';
          const rightName = right.displayName || right.name || '';
          return leftName.localeCompare(rightName);
        });

      const total = companies.length;
      const start = (requestedPage - 1) * requestedSize;
      const pagedCompanies = companies
        .slice(start, start + requestedSize)
        .map(({ _status, ...company }) => company);

      // Keep card-level open role counts in sync with real OPEN jobs.
      const pagedCompanyIds = pagedCompanies.map((company) => company.id).filter(Boolean);
      if (pagedCompanyIds.length > 0) {
        const openJobsByCompanyId = new Map();
        const idBatches = chunk(pagedCompanyIds, 10);

        for (const ids of idBatches) {
          const jobsSnap = await db.collection('jobs')
            .where('status', '==', 'OPEN')
            .where('organizationId', 'in', ids)
            .get();

          jobsSnap.docs.forEach((jobDoc) => {
            const organizationId = jobDoc.data()?.organizationId;
            if (!organizationId) return;
            openJobsByCompanyId.set(
              organizationId,
              (openJobsByCompanyId.get(organizationId) || 0) + 1,
            );
          });
        }

        pagedCompanies.forEach((company) => {
          company.openJobsCount = openJobsByCompanyId.get(company.id) || 0;
        });
      }

      res.json({
        success: true,
        companies: pagedCompanies,
        total,
        page: requestedPage,
        size: requestedSize,
      });
    } catch (error) {
      logger.error('List companies error:', error);
      next(error);
    }
  }

  /**
   * GET /api/companies/:slug - public profile for a single company
   */
  static async getCompanyProfile(req, res, next) {
    try {
      const { slug } = req.params;

      const slugSnap = await db.collection('organizations').where('slug', '==', slug).limit(1).get();
      const orgDoc = slugSnap.empty ? await db.collection('organizations').doc(slug).get() : slugSnap.docs[0];

      if (!orgDoc || orgDoc.exists === false || typeof orgDoc.data !== 'function') {
        return res.status(404).json({ success: false, error: 'Company not found.' });
      }

      const data = orgDoc.data();
      if (!isApprovedStatus(data.status) || data.profilePublic === false) {
        return res.status(404).json({ success: false, error: 'Company not found.' });
      }

      const profile = await buildCompanyProfile(orgDoc);
      res.json({ success: true, company: profile });
    } catch (error) {
      logger.error('Get company profile error:', error);
      next(error);
    }
  }

  /**
   * GET /api/companies/me/profile - own company profile for dashboard editing
   */
  static async getMyProfile(req, res, next) {
    try {
      const organizationId =
        req.user.organizationContext?.organization?.id
        || req.user.profile?.primaryOrganizationId
        || null;
      if (!organizationId) {
        return res.status(403).json({ success: false, error: 'Organization context required.' });
      }

      const orgRef = db.collection('organizations').doc(organizationId);
      let orgDoc = await orgRef.get();
      if (!orgDoc.exists) {
        return res.status(404).json({ success: false, error: 'Company not found.' });
      }

      if (!orgDoc.data()?.slug) {
        await ensureSlug(organizationId, orgDoc.data()?.name);
        orgDoc = await orgRef.get();
      }

      const profile = await buildCompanyProfile(orgDoc);
      res.json({ success: true, company: profile });
    } catch (error) {
      logger.error('Get own company profile error:', error);
      next(error);
    }
  }

  /**
   * PUT /api/companies/me/profile - update own public profile (company admin)
   */
  static async updateMyProfile(req, res, next) {
    try {
      const organizationId =
        req.user.organizationContext?.organization?.id
        || req.user.profile?.primaryOrganizationId
        || null;
      if (!organizationId) {
        return res.status(403).json({ success: false, error: 'Organization context required.' });
      }

      const hasOwn = (key) => Object.prototype.hasOwnProperty.call(req.body, key);

      const updates = {
        updatedAt: new Date().toISOString(),
      };

      if (hasOwn('tagline')) {
        const tagline = normalizeText(req.body.tagline);
        updates['profile.tagline'] = tagline;
        updates.tagline = tagline;
      }
      if (hasOwn('about')) updates['profile.about'] = normalizeText(req.body.about);
      if (hasOwn('mission')) updates['profile.mission'] = normalizeText(req.body.mission);
      if (hasOwn('culture')) updates['profile.culture'] = normalizeText(req.body.culture);
      if (hasOwn('website')) {
        const website = normalizeText(req.body.website);
        updates['profile.website'] = website;
        updates.website = website;
      }
      if (hasOwn('location')) {
        const location = normalizeText(req.body.location);
        updates['profile.location'] = location;
        updates.location = location;
      }
      if (hasOwn('coverUrl')) updates['profile.coverUrl'] = normalizeText(req.body.coverUrl);
      if (hasOwn('coverColor')) updates['profile.coverColor'] = normalizeText(req.body.coverColor) || '#3b82f6';
      if (hasOwn('workModel')) updates['profile.workModel'] = normalizeWorkModel(req.body.workModel);
      if (hasOwn('hiringProcess')) updates['profile.hiringProcess'] = normalizeText(req.body.hiringProcess);
      if (hasOwn('hiringTimeline')) updates['profile.hiringTimeline'] = normalizeText(req.body.hiringTimeline);
      if (hasOwn('responseTime')) updates['profile.responseTime'] = normalizeText(req.body.responseTime);

      if (hasOwn('benefits')) {
        updates['profile.benefits'] = Array.isArray(req.body.benefits)
          ? req.body.benefits.filter(Boolean)
          : [];
      }

      if (hasOwn('techStack')) {
        updates['profile.techStack'] = Array.isArray(req.body.techStack)
          ? req.body.techStack.filter(Boolean)
          : [];
      }

      if (hasOwn('socialLinks')) {
        updates['profile.socialLinks'] =
          req.body.socialLinks && typeof req.body.socialLinks === 'object'
            ? req.body.socialLinks
            : {};
      }

      if (hasOwn('profilePublic')) {
        updates.profilePublic = req.body.profilePublic !== false;
      }

      await db.collection('organizations').doc(organizationId).update(updates);

      const orgSnap = await db.collection('organizations').doc(organizationId).get();
      const slug = await ensureSlug(organizationId, orgSnap.data()?.name);
      const latestOrgDoc = await db.collection('organizations').doc(organizationId).get();
      const company = await buildCompanyProfile(latestOrgDoc);

      logger.info(`Company profile updated for org ${organizationId}`);
      res.json({ success: true, message: 'Profile updated.', slug, company });
    } catch (error) {
      logger.error('Update company profile error:', error);
      next(error);
    }
  }
}
