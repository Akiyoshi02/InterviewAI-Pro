import { unlink } from 'fs/promises';
import { validateCandidateProfilePhoto, validateCompanyLogo } from '../services/imageModeration.service.js';
import { validateBusinessVerificationDocument, validateResumeDocument } from '../services/documentModeration.service.js';

const cleanupFile = async (file) => {
  if (!file?.path) return;
  try {
    await unlink(file.path);
  } catch (error) {
    // ignore cleanup errors
  }
};

const runModeration = (validator, options = {}) => async (req, res, next) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'File is required.' });
  }

  try {
    const context = typeof options.buildContext === 'function' ? options.buildContext(req) : undefined;
    await validator(file.path, file, context);
    await cleanupFile(file);
    return res.json({ success: true });
  } catch (error) {
    await cleanupFile(file);
    return res.status(400).json({
      success: false,
      error: error.message || 'Image failed moderation.',
    });
  }
};

export const moderateProfilePhoto = runModeration(validateCandidateProfilePhoto);
export const moderateCompanyLogo = runModeration(validateCompanyLogo);
export const moderateResumeDocument = runModeration(validateResumeDocument, {
  buildContext: (req) => ({
    expectedFullName: req.body?.expectedFullName,
    expectedEmail: req.body?.expectedEmail,
  }),
});
export const moderateCompanyProof = runModeration(validateBusinessVerificationDocument, {
  buildContext: (req) => ({
    expectedCompanyName: req.body?.expectedCompanyName,
    expectedCountry: req.body?.expectedCountry,
    expectedCountryCode: req.body?.expectedCountryCode,
  }),
});

