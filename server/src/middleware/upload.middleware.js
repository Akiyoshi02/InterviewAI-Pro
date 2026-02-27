import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const uploadsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');
const profilePhotosDir = path.join(uploadsRoot, 'profile-photos');
const resumesDir = path.join(uploadsRoot, 'resumes');
const companyLogosDir = path.join(uploadsRoot, 'company-logos');
const companyCoversDir = path.join(uploadsRoot, 'company-covers');
const companyProofsDir = path.join(uploadsRoot, 'company-verifications');
const jobAdvertImagesDir = path.join(uploadsRoot, 'job-advert-images');
const jobAdvertVideosDir = path.join(uploadsRoot, 'job-advert-videos');
const interviewRecordingsDir = path.join(uploadsRoot, 'interviews');

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

[
  uploadsRoot,
  profilePhotosDir,
  resumesDir,
  companyLogosDir,
  companyCoversDir,
  companyProofsDir,
  jobAdvertImagesDir,
  jobAdvertVideosDir,
  interviewRecordingsDir,
].forEach(ensureDir);

const fileDestinationMap = {
  profilePhoto: profilePhotosDir,
  resumeFile: resumesDir,
  companyLogo: companyLogosDir,
  companyCover: companyCoversDir,
  companyProof: companyProofsDir,
  jobAdvertImage: jobAdvertImagesDir,
  jobAdvertVideo: jobAdvertVideosDir,
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destination = fileDestinationMap[file.fieldname] || uploadsRoot;
    cb(null, destination);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const uniqueName = `${Date.now()}-${randomUUID()}${extension}`;
    cb(null, uniqueName);
  },
});

const allowedMimeTypes = {
  profilePhoto: ['image/jpeg', 'image/png', 'image/webp'],
  companyLogo: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  companyCover: ['image/jpeg', 'image/png', 'image/webp'],
  file: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  jobAdvertImage: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  jobAdvertVideo: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/ogg'],
  resumeFile: [
    'application/pdf',
    'application/msword',
    'application/vnd.ms-word',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  companyProof: [
    'application/pdf',
    'application/msword',
    'application/vnd.ms-word',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
};

const allowedExtensions = {
  profilePhoto: ['.jpg', '.jpeg', '.png', '.webp'],
  companyLogo: ['.jpg', '.jpeg', '.png', '.webp', '.svg'],
  companyCover: ['.jpg', '.jpeg', '.png', '.webp'],
  file: ['.jpg', '.jpeg', '.png', '.webp', '.svg'],
  jobAdvertImage: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  jobAdvertVideo: ['.mp4', '.webm', '.mov', '.mkv', '.ogg'],
  resumeFile: ['.pdf', '.doc', '.docx'],
  companyProof: ['.pdf', '.doc', '.docx'],
};

const errorMessages = {
  profilePhoto: 'Profile photo must be a JPG, PNG, or WEBP image.',
  companyLogo: 'Company logo must be a JPG, PNG, WEBP, or SVG image.',
  companyCover: 'Company cover image must be a JPG, PNG, or WEBP image.',
  file: 'Image must be JPG, PNG, WEBP, or SVG.',
  jobAdvertImage: 'Job advert image must be JPG, PNG, WEBP, or GIF.',
  jobAdvertVideo: 'Job advert video must be MP4, WEBM, MOV, MKV, or OGG.',
  resumeFile: 'Résumé must be a PDF or Word document.',
  companyProof: 'Verification document must be a PDF or Word document.',
};

const { MulterError } = multer;
const extensionFallbackFields = new Set(['resumeFile', 'companyProof']);

const fileFilter = (req, file, cb) => {
  const allowed = allowedMimeTypes[file.fieldname];
  const extensions = allowedExtensions[file.fieldname] || [];
  const extension = path.extname(file.originalname || '').toLowerCase();

  if (!allowed) {
    return cb(new MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  }

  const mimeAccepted = allowed.includes(file.mimetype);
  const extensionAccepted = extensions.includes(extension);
  const allowByExtension = extensionFallbackFields.has(file.fieldname) && extensionAccepted;

  if (!mimeAccepted && !allowByExtension) {
    const error = new MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
    error.message = errorMessages[file.fieldname] || 'Unsupported file type.';
    return cb(error);
  }

  cb(null, true);
};

export const registrationUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // Max 15 MB for larger verification docs
    files: 4,
  },
});

export const jobAdvertUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // Max 50 MB for short advert videos
    files: 1,
  },
});

const sanitizePathSegment = (value) => String(value || '')
  .replace(/[^a-zA-Z0-9_-]/g, '')
  .slice(0, 120);

const recordingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const interviewId = sanitizePathSegment(req.params?.id) || 'unknown-interview';
    const recordingDir = path.join(interviewRecordingsDir, interviewId, 'recordings');
    ensureDir(recordingDir);
    cb(null, recordingDir);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase() || '.webm';
    const uniqueName = `session_${Date.now()}-${randomUUID()}${extension}`;
    cb(null, uniqueName);
  },
});

const recordingFileFilter = (req, file, cb) => {
  const allowed = [
    'video/webm',
    'video/mp4',
    'video/quicktime',
    'video/x-matroska',
    'video/ogg',
    'audio/webm',
    'audio/ogg',
    'audio/mpeg',
    'audio/wav',
  ];

  if (!allowed.includes(file.mimetype)) {
    const error = new MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
    error.message = 'Recording must be a supported audio/video format (WEBM, MP4, MOV, MKV, OGG, MP3, WAV).';
    return cb(error);
  }

  return cb(null, true);
};

const RECORDING_MAX_MB = Math.max(10, Number.parseInt(process.env.RECORDING_MAX_MB || '200', 10) || 200);

export const interviewRecordingUpload = multer({
  storage: recordingStorage,
  fileFilter: recordingFileFilter,
  limits: {
    fileSize: RECORDING_MAX_MB * 1024 * 1024,
    files: 1,
  },
});

export const uploadsPaths = {
  root: uploadsRoot,
  profilePhotosDir,
  resumesDir,
  companyLogosDir,
  companyCoversDir,
  companyProofsDir,
  jobAdvertImagesDir,
  jobAdvertVideosDir,
  interviewRecordingsDir,
};

