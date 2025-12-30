import express from 'express';
import { registrationUpload } from '../middleware/upload.middleware.js';
import {
  moderateCompanyLogo,
  moderateCompanyProof,
  moderateProfilePhoto,
  moderateResumeDocument,
} from '../controllers/upload.controller.js';

const router = express.Router();

router.post(
  '/moderate/profile-photo',
  registrationUpload.single('file'),
  moderateProfilePhoto
);

router.post(
  '/moderate/company-logo',
  registrationUpload.single('file'),
  moderateCompanyLogo
);

router.post(
  '/moderate/resume',
  registrationUpload.single('resumeFile'),
  moderateResumeDocument
);

router.post(
  '/moderate/company-proof',
  registrationUpload.single('companyProof'),
  moderateCompanyProof
);

export default router;

