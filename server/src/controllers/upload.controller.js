import { unlink } from 'fs/promises';
import { validateCandidateProfilePhoto, validateCompanyLogo } from '../services/imageModeration.service.js';

const cleanupFile = async (file) => {
  if (!file?.path) return;
  try {
    await unlink(file.path);
  } catch (error) {
    // ignore cleanup errors
  }
};

const runModeration = (validator) => async (req, res, next) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'File is required.' });
  }

  try {
    await validator(file.path);
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

