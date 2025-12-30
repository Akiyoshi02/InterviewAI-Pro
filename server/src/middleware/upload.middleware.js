import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const uploadsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');
const profilePhotosDir = path.join(uploadsRoot, 'profile-photos');
const resumesDir = path.join(uploadsRoot, 'resumes');
const companyLogosDir = path.join(uploadsRoot, 'company-logos');
const companyProofsDir = path.join(uploadsRoot, 'company-verifications');

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

[uploadsRoot, profilePhotosDir, resumesDir, companyLogosDir, companyProofsDir].forEach(ensureDir);

const fileDestinationMap = {
  profilePhoto: profilePhotosDir,
  resumeFile: resumesDir,
  companyLogo: companyLogosDir,
  companyProof: companyProofsDir,
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
  file: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  resumeFile: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  companyProof: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
};

const errorMessages = {
  profilePhoto: 'Profile photo must be a JPG, PNG, or WEBP image.',
  companyLogo: 'Company logo must be a JPG, PNG, WEBP, or SVG image.',
  file: 'Image must be JPG, PNG, WEBP, or SVG.',
  resumeFile: 'Résumé must be a PDF or Word document.',
  companyProof: 'Verification document must be a PDF or Word document.',
};

const { MulterError } = multer;

const fileFilter = (req, file, cb) => {
  const allowed = allowedMimeTypes[file.fieldname];
  if (!allowed) {
    return cb(new MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  }

  if (!allowed.includes(file.mimetype)) {
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

export const uploadsPaths = {
  root: uploadsRoot,
  profilePhotosDir,
  resumesDir,
  companyLogosDir,
  companyProofsDir,
};

