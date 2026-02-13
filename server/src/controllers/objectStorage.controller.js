import fs from 'fs/promises';
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

