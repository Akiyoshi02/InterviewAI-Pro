import sightengine from 'sightengine';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

const { SIGHTENGINE_USER, SIGHTENGINE_SECRET } = process.env;
const SKIP_UPLOAD_MODERATION = process.env.SKIP_UPLOAD_MODERATION === 'true';

if (SKIP_UPLOAD_MODERATION) {
  logger.warn('Upload moderation disabled (SKIP_UPLOAD_MODERATION=true).');
}

if (!SKIP_UPLOAD_MODERATION && (!SIGHTENGINE_USER || !SIGHTENGINE_SECRET)) {
  logger.warn('Sightengine keys are missing. Image moderation is disabled.');
}

const moderationClient = !SKIP_UPLOAD_MODERATION && SIGHTENGINE_USER && SIGHTENGINE_SECRET
  ? sightengine(SIGHTENGINE_USER, SIGHTENGINE_SECRET)
  : null;

const ensureFileExists = (filePath) => {
  if (!filePath) throw new Error('No file provided for moderation.');
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) throw new Error('Uploaded file is not available for moderation.');
  return resolved;
};

const ensureSuccessfulResponse = (response) => {
  if (!response) return null;
  if (response.status && response.status !== 'success') {
    const message = response.error?.message || 'Moderation service rejected the image.';
    throw new Error(message);
  }
  return response;
};

const performModeration = async ({ filePath, models }) => {
  if (SKIP_UPLOAD_MODERATION) {
    return null;
  }

  if (!moderationClient) {
    logger.warn('Sightengine not configured. Skipping moderation.');
    return null;
  }

  const resolved = ensureFileExists(filePath);

  try {
    const rawResponse = await moderationClient
      .check(Array.isArray(models) ? models : String(models).split(',').map((m) => m.trim()).filter(Boolean))
      .set_file(resolved);
    return ensureSuccessfulResponse(rawResponse);
  } catch (error) {
    logger.error('Sightengine moderation failed:', error);
    throw new Error('We could not verify the image. Please upload a different one.');
  }
};

const checkForUnsafeContent = (moderationResult = {}) => {
  const { nudity = {}, weapon = {}, alcohol = {} } = moderationResult;

  const isExplicit = (nudity.sexual_activity >= 0.5)
    || (nudity.sexual_display >= 0.5)
    || (nudity.erotica >= 0.5)
    || (nudity.suggestive >= 0.8);

  const hasWeapon = (weapon.prob >= 0.6);
  const hasAlcohol = (alcohol.prob >= 0.7);
  if (isExplicit) return 'Image appears to contain explicit content.';
  if (hasWeapon) return 'Image appears to contain weapons.';
  if (hasAlcohol) return 'Image appears to include alcohol references.';

  return null;
};

const ensureSingleFace = (moderationResult = {}) => {
  const faces = moderationResult.faces || [];
  if (!faces.length) {
    return 'Profile photo must include a clear face.';
  }
  if (faces.length > 1) {
    return 'Profile photo must include only one person.';
  }
  return null;
};

const ensureNoFaces = (moderationResult = {}) => {
  const faces = moderationResult.faces || [];
  if (faces.length) {
    return 'Company logo should not contain faces.';
  }
  return null;
};

export const validateCandidateProfilePhoto = async (filePath) => {
  const result = await performModeration({
    filePath,
    models: ['nudity-2.0', 'weapon', 'alcohol', 'face-attributes'],
  });

  if (!result) return;

  const unsafeMessage = checkForUnsafeContent(result);
  if (unsafeMessage) {
    throw new Error(`${unsafeMessage} Please choose a professional headshot.`);
  }

  const faceMessage = ensureSingleFace(result);
  if (faceMessage) {
    throw new Error(faceMessage);
  }
};

export const validateCompanyLogo = async (filePath) => {
  const result = await performModeration({
    filePath,
    models: ['nudity-2.0', 'weapon', 'alcohol', 'face-attributes'],
  });

  if (!result) return;

  const unsafeMessage = checkForUnsafeContent(result);
  if (unsafeMessage) {
    throw new Error(`${unsafeMessage} Please upload an appropriate brand asset.`);
  }

  const faceMessage = ensureNoFaces(result);
  if (faceMessage) {
    throw new Error(faceMessage);
  }
};

