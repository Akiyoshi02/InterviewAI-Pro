import crypto from 'crypto';
import path from 'path';
import { uploadsPaths } from '../middleware/upload.middleware.js';

const DEFAULT_TTL_SECONDS = 300;
const MAX_TTL_SECONDS = 3600;

const getSigningSecret = () => {
  const secret = process.env.LOCAL_STORAGE_SIGNING_SECRET
    || process.env.JWT_SECRET
    || process.env.FIREBASE_PROJECT_ID
    || 'local-dev-signing-secret';
  return String(secret);
};

export const normalizeUploadsPublicPath = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalizedSlashes = trimmed.replaceAll('\\', '/');
  if (normalizedSlashes.includes('..')) return null;

  if (normalizedSlashes.startsWith('/uploads/')) {
    return normalizedSlashes;
  }
  if (normalizedSlashes.startsWith('uploads/')) {
    return `/${normalizedSlashes}`;
  }

  const knownUploadPrefixes = [
    'profile-photos/',
    'resumes/',
    'company-logos/',
    'company-verifications/',
    'job-advert-images/',
    'job-advert-videos/',
  ];
  const lower = normalizedSlashes.toLowerCase();
  const hasKnownPrefix = knownUploadPrefixes.some((prefix) => lower.startsWith(prefix));
  if (!hasKnownPrefix) return null;

  return `/uploads/${normalizedSlashes}`;
};

export const resolveUploadsAbsolutePath = (publicPath) => {
  const normalizedPath = normalizeUploadsPublicPath(publicPath);
  if (!normalizedPath) return null;

  const uploadsRoot = path.resolve(uploadsPaths.root);
  const relativePath = normalizedPath.replace(/^\/uploads\//, '');
  const absolutePath = path.resolve(uploadsRoot, relativePath);

  if (absolutePath === uploadsRoot) return null;
  if (!absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) return null;
  return absolutePath;
};

export const toSafeTtlSeconds = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_TTL_SECONDS;
  return Math.min(parsed, MAX_TTL_SECONDS);
};

const buildSignature = ({ path: signedPath, expiresAt }) => {
  const payload = `${signedPath}:${expiresAt}`;
  return crypto
    .createHmac('sha256', getSigningSecret())
    .update(payload)
    .digest('hex');
};

const safeTimingEqual = (a, b) => {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
};

export const createSignedDownloadPath = ({ publicPath, expiresInSeconds = DEFAULT_TTL_SECONDS }) => {
  const normalizedPath = normalizeUploadsPublicPath(publicPath);
  if (!normalizedPath) return null;

  const ttlSeconds = toSafeTtlSeconds(expiresInSeconds);
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = buildSignature({
    path: normalizedPath,
    expiresAt,
  });
  const query = new URLSearchParams({
    path: normalizedPath,
    expiresAt: String(expiresAt),
    signature,
  });
  return `/api/object-storage/download?${query.toString()}`;
};

export const verifySignedDownloadQuery = ({
  publicPath,
  expiresAt,
  signature,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
}) => {
  const normalizedPath = normalizeUploadsPublicPath(publicPath);
  if (!normalizedPath) return { valid: false, code: 'INVALID_PATH' };

  const parsedExpiresAt = Number.parseInt(expiresAt, 10);
  if (!Number.isInteger(parsedExpiresAt)) {
    return { valid: false, code: 'INVALID_EXPIRY' };
  }
  if (parsedExpiresAt < nowEpochSeconds) {
    return { valid: false, code: 'EXPIRED' };
  }

  const expectedSignature = buildSignature({
    path: normalizedPath,
    expiresAt: parsedExpiresAt,
  });
  if (!safeTimingEqual(expectedSignature, String(signature || ''))) {
    return { valid: false, code: 'INVALID_SIGNATURE' };
  }

  return {
    valid: true,
    code: null,
    path: normalizedPath,
    expiresAt: parsedExpiresAt,
  };
};

