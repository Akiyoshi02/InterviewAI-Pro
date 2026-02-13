import { describe, expect, it } from '@jest/globals';
import {
  createSignedDownloadPath,
  normalizeUploadsPublicPath,
  resolveUploadsAbsolutePath,
  verifySignedDownloadQuery,
} from '../localObjectStorage.service.js';

const extractQuery = (signedPath) => {
  const queryString = String(signedPath || '').split('?')[1] || '';
  return new URLSearchParams(queryString);
};

describe('localObjectStorage.service', () => {
  it('normalizes upload public paths safely', () => {
    expect(normalizeUploadsPublicPath('/uploads/resumes/cv.pdf')).toBe('/uploads/resumes/cv.pdf');
    expect(normalizeUploadsPublicPath('uploads/resumes/cv.pdf')).toBe('/uploads/resumes/cv.pdf');
    expect(normalizeUploadsPublicPath('resumes/cv.pdf')).toBe('/uploads/resumes/cv.pdf');
    expect(normalizeUploadsPublicPath('../secret.txt')).toBeNull();
  });

  it('rejects path traversal when resolving absolute paths', () => {
    expect(resolveUploadsAbsolutePath('/uploads/resumes/cv.pdf')).toContain('uploads');
    expect(resolveUploadsAbsolutePath('/uploads/../.env')).toBeNull();
  });

  it('creates and verifies signed download paths', () => {
    process.env.LOCAL_STORAGE_SIGNING_SECRET = 'test-secret';
    const signedPath = createSignedDownloadPath({
      publicPath: '/uploads/resumes/candidate.pdf',
      expiresInSeconds: 300,
    });
    expect(signedPath).toContain('/api/object-storage/download?');

    const params = extractQuery(signedPath);
    const expiresAt = Number.parseInt(params.get('expiresAt'), 10);
    const verification = verifySignedDownloadQuery({
      publicPath: params.get('path'),
      expiresAt,
      signature: params.get('signature'),
      nowEpochSeconds: expiresAt - 10,
    });

    expect(verification.valid).toBe(true);
    expect(verification.path).toBe('/uploads/resumes/candidate.pdf');
  });

  it('invalidates expired or tampered signatures', () => {
    process.env.LOCAL_STORAGE_SIGNING_SECRET = 'test-secret';
    const signedPath = createSignedDownloadPath({
      publicPath: '/uploads/resumes/candidate.pdf',
      expiresInSeconds: 60,
    });
    const params = extractQuery(signedPath);
    const expiresAt = Number.parseInt(params.get('expiresAt'), 10);

    const expired = verifySignedDownloadQuery({
      publicPath: params.get('path'),
      expiresAt,
      signature: params.get('signature'),
      nowEpochSeconds: expiresAt + 1,
    });
    expect(expired.valid).toBe(false);
    expect(expired.code).toBe('EXPIRED');

    const tampered = verifySignedDownloadQuery({
      publicPath: params.get('path'),
      expiresAt,
      signature: 'tampered-signature',
      nowEpochSeconds: expiresAt - 1,
    });
    expect(tampered.valid).toBe(false);
    expect(tampered.code).toBe('INVALID_SIGNATURE');
  });
});

