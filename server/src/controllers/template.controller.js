import { activityLogStore } from '../services/firebaseData.service.js';
import logger from '../utils/logger.js';
import admin from '../config/firebase.js';
import {
  getStructuredInterviewCatalog,
  normalizeStructuredQuestionSet,
} from '../services/structuredInterview.service.js';

const getTemplatesCollection = () => admin.firestore().collection('interviewTemplates');

const resolveStructuredQuestionSet = (value, fallbackMode = 'HIRING') => {
  if (value == null) return null;
  const normalized = normalizeStructuredQuestionSet(value, { fallbackMode });
  if (!normalized) return null;
  return {
    enabled: normalized.enabled !== false,
    mode: normalized.mode,
    jobFamilies: Array.isArray(normalized.jobFamilies) ? normalized.jobFamilies : [],
    experienceLevels: Array.isArray(normalized.experienceLevels) ? normalized.experienceLevels : [],
    interviewTypes: Array.isArray(normalized.interviewTypes) ? normalized.interviewTypes : [],
    coreQuestionIds: Array.isArray(normalized.coreQuestionIds) ? normalized.coreQuestionIds : [],
    randomPoolIds: Array.isArray(normalized.randomPoolIds) ? normalized.randomPoolIds : [],
  };
};

const sanitizeTemplate = (template) => {
  if (!template) return null;
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    organizationId: template.organizationId,
    jobRole: template.jobRole,
    experienceLevel: template.experienceLevel,
    industry: template.industry,
    interviewTypes: template.interviewTypes || [],
    duration: template.duration,
    skillFocus: template.skillFocus || [],
    questions: template.questions || [],
    structuredQuestionSet: template.structuredQuestionSet || null,
    config: template.config || {},
    isPublic: template.isPublic || false,
    usageCount: template.usageCount || 0,
    createdBy: template.createdBy,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
};

export class TemplateController {
  /**
   * Create a new interview template
   */
  static async createTemplate(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const userId = req.user.id;
      const {
        name,
        description,
        jobRole,
        experienceLevel,
        industry,
        interviewTypes,
        duration,
        skillFocus,
        questions,
        config,
        structuredQuestionSet,
        isPublic,
      } = req.body;

      if (!name || !jobRole) {
        return res.status(400).json({ error: 'Template name and job role are required' });
      }
      const safeConfig = config && typeof config === 'object' ? config : {};
      const normalizedStructuredQuestionSet = resolveStructuredQuestionSet(
        structuredQuestionSet ?? safeConfig.structuredQuestionSet ?? null,
        'HIRING',
      );

      const templateRef = getTemplatesCollection().doc();
      const template = {
        id: templateRef.id,
        name,
        description: description || '',
        organizationId,
        jobRole,
        experienceLevel: experienceLevel || 'MID',
        industry: industry || null,
        interviewTypes: interviewTypes || [],
        duration: duration || 30,
        skillFocus: skillFocus || [],
        questions: questions || [],
        structuredQuestionSet: normalizedStructuredQuestionSet,
        config: {
          ...safeConfig,
          ...(normalizedStructuredQuestionSet ? { structuredQuestionSet: normalizedStructuredQuestionSet } : {}),
        },
        isPublic: isPublic || false,
        usageCount: 0,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await templateRef.set(template);

      // Log activity
      await activityLogStore.record({
        organizationId,
        actorId: userId,
        actorRole: req.user.organizationContext?.membership?.role,
        action: 'TEMPLATE_CREATED',
        targetType: 'TEMPLATE',
        targetId: template.id,
        metadata: {
          templateName: name,
          jobRole,
        },
      });

      logger.info(`Template created: ${template.id} by ${userId}`);

      res.status(201).json({
        success: true,
        template: sanitizeTemplate(template),
      });
    } catch (error) {
      logger.error('Create template error:', error);
      next(error);
    }
  }

  /**
   * List templates for organization
   */
  static async listTemplates(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;

      const snapshot = await getTemplatesCollection()
        .where('organizationId', '==', organizationId)
        .orderBy('createdAt', 'desc')
        .get();

      const templates = snapshot.docs.map((doc) => sanitizeTemplate(doc.data()));

      res.json({
        success: true,
        templates,
      });
    } catch (error) {
      logger.error('List templates error:', error);
      next(error);
    }
  }

  /**
   * Structured interview catalog for template editors.
   * Includes question library metadata and this organization's structured templates.
   */
  static async getStructuredCatalog(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id;
      const snapshot = organizationId
        ? await getTemplatesCollection().where('organizationId', '==', organizationId).limit(500).get()
        : { docs: [] };
      const organizationTemplates = (snapshot.docs || []).map((doc) => doc.data());
      const catalog = getStructuredInterviewCatalog({
        templateOverrides: organizationTemplates,
        includeQuestions: true,
      });

      return res.json({
        success: true,
        catalog,
      });
    } catch (error) {
      logger.error('Get structured template catalog error:', error);
      return next(error);
    }
  }

  /**
   * Get a single template
   */
  static async getTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organizationContext?.organization?.id;

      const doc = await getTemplatesCollection().doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const template = doc.data();

      // Check access
      if (template.organizationId !== organizationId && !template.isPublic) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json({
        success: true,
        template: sanitizeTemplate(template),
      });
    } catch (error) {
      logger.error('Get template error:', error);
      next(error);
    }
  }

  /**
   * Update a template
   */
  static async updateTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organizationContext?.organization?.id;
      const userId = req.user.id;
      const updates = req.body && typeof req.body === 'object' ? { ...req.body } : {};

      const doc = await getTemplatesCollection().doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const template = doc.data();

      // Check access
      if (template.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const incomingConfig = updates.config && typeof updates.config === 'object' ? updates.config : null;
      const hasStructuredQuestionSetUpdate =
        Object.prototype.hasOwnProperty.call(updates, 'structuredQuestionSet')
        || Boolean(
          incomingConfig
          && Object.prototype.hasOwnProperty.call(incomingConfig, 'structuredQuestionSet'),
        );

      const nextStructuredQuestionSet = hasStructuredQuestionSetUpdate
        ? resolveStructuredQuestionSet(
          updates.structuredQuestionSet ?? incomingConfig?.structuredQuestionSet ?? null,
          template?.mode || 'HIRING',
        )
        : (template.structuredQuestionSet || null);

      const existingConfig = template.config && typeof template.config === 'object' ? template.config : {};
      const mergedConfig = incomingConfig
        ? { ...existingConfig, ...incomingConfig }
        : { ...existingConfig };

      if (hasStructuredQuestionSetUpdate) {
        if (nextStructuredQuestionSet) {
          mergedConfig.structuredQuestionSet = nextStructuredQuestionSet;
        } else {
          delete mergedConfig.structuredQuestionSet;
        }
      }

      delete updates.config;
      delete updates.structuredQuestionSet;

      const updatedTemplate = {
        ...template,
        ...updates,
        config: mergedConfig,
        structuredQuestionSet: nextStructuredQuestionSet,
        id: template.id, // Ensure ID doesn't change
        organizationId: template.organizationId, // Ensure org doesn't change
        usageCount: template.usageCount, // Don't allow manual updates
        createdBy: template.createdBy, // Don't allow changes
        createdAt: template.createdAt, // Don't allow changes
        updatedAt: new Date().toISOString(),
      };

      await getTemplatesCollection().doc(id).set(updatedTemplate);

      // Log activity
      await activityLogStore.record({
        organizationId,
        actorId: userId,
        actorRole: req.user.organizationContext?.membership?.role,
        action: 'TEMPLATE_UPDATED',
        targetType: 'TEMPLATE',
        targetId: id,
        metadata: {
          templateName: updatedTemplate.name,
        },
      });

      logger.info(`Template updated: ${id} by ${userId}`);

      res.json({
        success: true,
        template: sanitizeTemplate(updatedTemplate),
      });
    } catch (error) {
      logger.error('Update template error:', error);
      next(error);
    }
  }

  /**
   * Delete a template
   */
  static async deleteTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organizationContext?.organization?.id;
      const userId = req.user.id;

      const doc = await getTemplatesCollection().doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const template = doc.data();

      // Check access
      if (template.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await getTemplatesCollection().doc(id).delete();

      // Log activity
      await activityLogStore.record({
        organizationId,
        actorId: userId,
        actorRole: req.user.organizationContext?.membership?.role,
        action: 'TEMPLATE_DELETED',
        targetType: 'TEMPLATE',
        targetId: id,
        metadata: {
          templateName: template.name,
        },
      });

      logger.info(`Template deleted: ${id} by ${userId}`);

      res.json({
        success: true,
        message: 'Template deleted successfully',
      });
    } catch (error) {
      logger.error('Delete template error:', error);
      next(error);
    }
  }

  /**
   * Duplicate a template
   */
  static async duplicateTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organizationContext?.organization?.id;
      const userId = req.user.id;

      const doc = await getTemplatesCollection().doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const sourceTemplate = doc.data();

      // Check access
      if (sourceTemplate.organizationId !== organizationId && !sourceTemplate.isPublic) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const newTemplateRef = getTemplatesCollection().doc();
      const newTemplate = {
        ...sourceTemplate,
        id: newTemplateRef.id,
        name: `${sourceTemplate.name} (Copy)`,
        organizationId,
        isPublic: false,
        usageCount: 0,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await newTemplateRef.set(newTemplate);

      logger.info(`Template duplicated: ${id} -> ${newTemplate.id} by ${userId}`);

      res.status(201).json({
        success: true,
        template: sanitizeTemplate(newTemplate),
      });
    } catch (error) {
      logger.error('Duplicate template error:', error);
      next(error);
    }
  }

  /**
   * Increment usage count when template is used
   */
  static async recordUsage(templateId) {
    try {
      const ref = getTemplatesCollection().doc(templateId);
      await ref.update({
        usageCount: admin.firestore.FieldValue.increment(1),
        lastUsedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Record template usage error:', error);
      // Don't throw, this is not critical
    }
  }

  /**
   * List public templates (for discovery)
   */
  static async listPublicTemplates(req, res, next) {
    try {
      const snapshot = await getTemplatesCollection()
        .where('isPublic', '==', true)
        .orderBy('usageCount', 'desc')
        .limit(50)
        .get();

      const templates = snapshot.docs.map((doc) => sanitizeTemplate(doc.data()));

      res.json({
        success: true,
        templates,
      });
    } catch (error) {
      logger.error('List public templates error:', error);
      next(error);
    }
  }
}

