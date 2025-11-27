import express from 'express';
import { registrationUpload } from '../middleware/upload.middleware.js';
import { moderateCompanyLogo, moderateProfilePhoto } from '../controllers/upload.controller.js';

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

export default router;

