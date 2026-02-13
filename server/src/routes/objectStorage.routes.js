import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { ObjectStorageController } from '../controllers/objectStorage.controller.js';

const router = express.Router();

router.get('/signed-url', authenticate, ObjectStorageController.getSignedDownloadUrl);
router.get('/download', ObjectStorageController.download);

export default router;

