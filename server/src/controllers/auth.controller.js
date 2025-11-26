import { deleteFirebaseUser } from '../config/firebase.js';
import { userStore } from '../services/firebaseData.service.js';
import logger from '../utils/logger.js';

const sanitizeUser = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    accountType: user.accountType,
    fullName: user.fullName || null,
    experienceLevel: user.experienceLevel || null,
    skills: user.skills || [],
    companyName: user.companyName || null,
    companySize: user.companySize || null,
    industry: user.industry || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export class AuthController {
  static async register(req, res, next) {
    try {
      const { accountType, fullName, experienceLevel, companyName, industry, companySize, skills } = req.body;
      const firebaseUid = req.user.uid;
      const email = (req.user.email || '').toLowerCase();

      // Prevent duplicate registrations by UID
      const existingUserByUid = await userStore.getByUid(firebaseUid);
      if (existingUserByUid) {
        return res.status(409).json({
          error: 'User already registered',
          user: sanitizeUser(existingUserByUid),
        });
      }

      // Prevent duplicate registrations by email
      const existingUserByEmail = await userStore.getByEmail(email);
      if (existingUserByEmail) {
        return res.status(409).json({
          error: 'User already registered',
          user: sanitizeUser(existingUserByEmail),
        });
      }

      const accountTypeEnum = (accountType || '').toUpperCase() === 'COMPANY' ? 'COMPANY' : 'CANDIDATE';

      const user = await userStore.create(firebaseUid, {
        email,
        accountType: accountTypeEnum,
        fullName,
        experienceLevel: accountTypeEnum === 'CANDIDATE' ? experienceLevel || null : null,
        skills: accountTypeEnum === 'CANDIDATE' ? (skills || []) : [],
        companyName: accountTypeEnum === 'COMPANY' ? companyName || null : null,
        companySize: accountTypeEnum === 'COMPANY' ? companySize || null : null,
        industry: accountTypeEnum === 'COMPANY' ? industry || null : null,
      });

      res.status(201).json({
        success: true,
        user: sanitizeUser(user),
      });
    } catch (error) {
      logger.error('Register error:', error);
      next(error);
    }
  }

  static async getMe(req, res, next) {
    try {
      const user = await userStore.getByUid(req.user.uid);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ success: true, user: sanitizeUser(user) });
    } catch (error) {
      logger.error('Get me error:', error);
      next(error);
    }
  }

  static async updateMe(req, res, next) {
    try {
      const firebaseUid = req.user.uid;
      const allowedFields = ['fullName', 'experienceLevel', 'skills', 'companyName', 'companySize', 'industry'];

      const data = {};
      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          data[field] = req.body[field];
        }
      });

      if (data.skills !== undefined) {
        if (Array.isArray(data.skills)) {
          data.skills = data.skills.map(String);
        } else if (typeof data.skills === 'string') {
          data.skills = data.skills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        } else {
          data.skills = [String(data.skills)];
        }
      }

      if (Object.keys(data).length === 0) {
        const current = await userStore.getByUid(firebaseUid);
        return res.json({ success: true, user: sanitizeUser(current) });
      }

      const updated = await userStore.update(firebaseUid, data);
      res.json({ success: true, user: sanitizeUser(updated) });
    } catch (error) {
      logger.error('Update me error:', error);
      next(error);
    }
  }

  static async deleteUnregisteredAuthUser(req, res, next) {
    try {
      const { userId } = req.body;

      if (!userId) {
        logger.warn('deleteUnregisteredAuthUser: userId is missing in request');
        return res.status(400).json({ error: 'userId is required' });
      }

      logger.info(`Attempting to delete unregistered auth user: ${userId}`);

      const user = await userStore.getByUid(userId);
      if (user) {
        logger.warn(`Cannot delete auth user ${userId} - user exists in database with ID: ${user.id}`);
        return res.status(400).json({
          error: 'User is registered in the system',
          userId,
          success: false,
        });
      }

      logger.info(`User ${userId} not found in database, proceeding with Firebase auth deletion`);

      const deleted = await deleteFirebaseUser(userId);

      if (!deleted) {
        logger.error(`Failed to delete Firebase auth user ${userId}`);
        return res.status(500).json({
          error: 'Failed to delete auth user',
          details: 'Could not delete user from Firebase',
          success: false,
        });
      }

      logger.info(`Successfully deleted unregistered Firebase auth user: ${userId}`);
      res.json({
        success: true,
        message: 'Unregistered auth user deleted successfully',
        userId,
      });
    } catch (error) {
      logger.error('Delete unregistered auth user error:', error);
      next(error);
    }
  }
}
