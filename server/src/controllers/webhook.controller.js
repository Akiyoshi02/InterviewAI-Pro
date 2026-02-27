/**
 * Webhook Infrastructure
 *
 * Allows companies to register HTTP endpoints to receive real-time events
 * when things happen in the platform (e.g. new application, interview completed).
 *
 * Each company can register up to 5 webhook endpoints.
 * Events are delivered with HMAC-SHA256 signatures for verification.
 *
 * Supported events:
 *  - application.created
 *  - application.status_changed
 *  - interview.completed
 *  - interview.scheduled
 *  - candidate.hired
 */

import crypto from 'crypto';
import { firestore as db } from '../config/firebase.js';
import logger from '../utils/logger.js';

const WEBHOOK_EVENTS = [
  'application.created',
  'application.status_changed',
  'interview.completed',
  'interview.scheduled',
  'candidate.hired',
];

const MAX_WEBHOOKS_PER_ORG = 5;

function getOrganizationIdFromRequest(req) {
  return req.user.organizationContext?.organization?.id || req.user.profile?.primaryOrganizationId || null;
}

function generateSecret() {
  return `whsec_${crypto.randomBytes(24).toString('hex')}`;
}

function generateWebhookId() {
  return `wh_${crypto.randomBytes(12).toString('hex')}`;
}

function signPayload(secret, payload) {
  const timestamp = Date.now();
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signedContent = `${timestamp}.${body}`;
  const signature = crypto.createHmac('sha256', secret).update(signedContent).digest('hex');
  return { signature: `t=${timestamp},v1=${signature}`, timestamp };
}

/**
 * Deliver a webhook event to all registered endpoints for an organization.
 * Called internally from controllers when events occur.
 */
export async function deliverWebhookEvent(organizationId, eventType, eventData) {
  if (!organizationId) return;

  try {
    const snap = await db.collection('webhooks')
      .where('organizationId', '==', organizationId)
      .where('active', '==', true)
      .get();

    if (snap.empty) return;

    const payload = {
      id: `evt_${crypto.randomBytes(12).toString('hex')}`,
      type: eventType,
      created: Math.floor(Date.now() / 1000),
      data: eventData,
    };

    const deliveries = snap.docs.map(async (doc) => {
      const webhook = doc.data();
      if (!webhook.events.includes(eventType) && !webhook.events.includes('*')) return;

      const { signature, timestamp } = signPayload(webhook.secret, payload);
      const deliveryRef = await db.collection('webhook_deliveries').add({
        webhookId: doc.id,
        organizationId,
        eventType,
        status: 'pending',
        payload,
        createdAt: new Date().toISOString(),
      });

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Timestamp': String(timestamp),
            'X-Webhook-Event': eventType,
            'X-Webhook-ID': doc.id,
            'User-Agent': 'InterviewerApp/1.0',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        await deliveryRef.update({
          status: response.ok ? 'delivered' : 'failed',
          responseStatus: response.status,
          deliveredAt: new Date().toISOString(),
        });

        // Update webhook last delivery info
        await doc.ref.update({
          lastDelivery: { success: response.ok, statusCode: response.status, at: new Date().toISOString() },
        });
      } catch (deliveryErr) {
        await deliveryRef.update({
          status: 'failed',
          error: deliveryErr.message,
          failedAt: new Date().toISOString(),
        });
      }
    });

    await Promise.allSettled(deliveries);
  } catch (err) {
    logger.error('Webhook delivery error:', err);
  }
}

export class WebhookController {
  /**
   * GET /api/webhooks – list webhooks for current organization
   */
  static async list(req, res, next) {
    try {
      const organizationId = getOrganizationIdFromRequest(req);
      if (!organizationId) {
        return res.status(403).json({ success: false, error: 'Organization context required.' });
      }

      const snap = await db.collection('webhooks')
        .where('organizationId', '==', organizationId)
        .get();

      const webhooks = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          url: data.url,
          events: data.events,
          active: data.active,
          description: data.description,
          createdAt: data.createdAt,
          lastDelivery: data.lastDelivery || null,
          // Never expose secret in list
        };
      });

      res.json({ success: true, webhooks, supportedEvents: WEBHOOK_EVENTS });
    } catch (error) {
      logger.error('List webhooks error:', error);
      next(error);
    }
  }

  /**
   * POST /api/webhooks – register a new webhook
   */
  static async create(req, res, next) {
    try {
      const organizationId = getOrganizationIdFromRequest(req);
      if (!organizationId) {
        return res.status(403).json({ success: false, error: 'Organization context required.' });
      }

      const { url, events, description } = req.body;

      // Validate events
      const invalidEvents = events.filter((e) => !WEBHOOK_EVENTS.includes(e) && e !== '*');
      if (invalidEvents.length > 0) {
        return res.status(400).json({ success: false, error: `Unsupported event types: ${invalidEvents.join(', ')}` });
      }

      // Validate URL
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      } catch {
        return res.status(400).json({ success: false, error: 'Invalid URL. Must be a valid HTTP(S) URL.' });
      }

      // Enforce per-org limit
      const existing = await db.collection('webhooks')
        .where('organizationId', '==', organizationId)
        .get();

      if (existing.size >= MAX_WEBHOOKS_PER_ORG) {
        return res.status(400).json({ success: false, error: `Maximum ${MAX_WEBHOOKS_PER_ORG} webhooks allowed per organization.` });
      }

      const secret = generateSecret();
      const webhookId = generateWebhookId();

      await db.collection('webhooks').doc(webhookId).set({
        organizationId,
        url,
        events: events || ['*'],
        description: description || '',
        secret,
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: req.user.id,
        lastDelivery: null,
      });

      logger.info(`Webhook ${webhookId} registered for org ${organizationId}`);

      res.status(201).json({
        success: true,
        webhook: { id: webhookId, url, events, description, active: true },
        secret,
        note: 'Store this secret securely. It will not be shown again.',
      });
    } catch (error) {
      logger.error('Create webhook error:', error);
      next(error);
    }
  }

  /**
   * PUT /api/webhooks/:id – update a webhook
   */
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const organizationId = getOrganizationIdFromRequest(req);

      const snap = await db.collection('webhooks').doc(id).get();
      if (!snap.exists || snap.data().organizationId !== organizationId) {
        return res.status(404).json({ success: false, error: 'Webhook not found.' });
      }

      const { url, events, description, active } = req.body;
      const updates = { updatedAt: new Date().toISOString() };

      if (url !== undefined) {
        try {
          const parsed = new URL(url);
          if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
          updates.url = url;
        } catch {
          return res.status(400).json({ success: false, error: 'Invalid URL.' });
        }
      }
      if (events !== undefined) updates.events = events;
      if (description !== undefined) updates.description = description;
      if (active !== undefined) updates.active = Boolean(active);

      await snap.ref.update(updates);
      res.json({ success: true, message: 'Webhook updated.' });
    } catch (error) {
      logger.error('Update webhook error:', error);
      next(error);
    }
  }

  /**
   * DELETE /api/webhooks/:id – remove a webhook
   */
  static async remove(req, res, next) {
    try {
      const { id } = req.params;
      const organizationId = getOrganizationIdFromRequest(req);

      const snap = await db.collection('webhooks').doc(id).get();
      if (!snap.exists || snap.data().organizationId !== organizationId) {
        return res.status(404).json({ success: false, error: 'Webhook not found.' });
      }

      await snap.ref.delete();
      res.json({ success: true, message: 'Webhook removed.' });
    } catch (error) {
      logger.error('Remove webhook error:', error);
      next(error);
    }
  }

  /**
   * POST /api/webhooks/:id/test – send a test ping to a webhook
   */
  static async test(req, res, next) {
    try {
      const { id } = req.params;
      const organizationId = getOrganizationIdFromRequest(req);

      const snap = await db.collection('webhooks').doc(id).get();
      if (!snap.exists || snap.data().organizationId !== organizationId) {
        return res.status(404).json({ success: false, error: 'Webhook not found.' });
      }

      const webhook = snap.data();
      const testPayload = {
        id: `evt_test_${crypto.randomBytes(8).toString('hex')}`,
        type: 'test.ping',
        created: Math.floor(Date.now() / 1000),
        data: { message: 'This is a test event from InterviewAI Pro.' },
      };

      const { signature, timestamp } = signPayload(webhook.secret, testPayload);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Timestamp': String(timestamp),
            'X-Webhook-Event': 'test.ping',
            'X-Webhook-ID': id,
            'User-Agent': 'InterviewerApp/1.0',
          },
          body: JSON.stringify(testPayload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        res.json({
          success: true,
          responseStatus: response.status,
          ok: response.ok,
          message: response.ok ? 'Test ping delivered successfully.' : `Endpoint responded with status ${response.status}.`,
        });
      } catch (fetchErr) {
        res.json({ success: false, error: `Delivery failed: ${fetchErr.message}` });
      }
    } catch (error) {
      logger.error('Test webhook error:', error);
      next(error);
    }
  }

  /**
   * GET /api/webhooks/:id/deliveries – recent delivery history
   */
  static async deliveries(req, res, next) {
    try {
      const { id } = req.params;
      const organizationId = getOrganizationIdFromRequest(req);

      const webhookSnap = await db.collection('webhooks').doc(id).get();
      if (!webhookSnap.exists || webhookSnap.data().organizationId !== organizationId) {
        return res.status(404).json({ success: false, error: 'Webhook not found.' });
      }

      const deliveriesSnap = await db.collection('webhook_deliveries')
        .where('webhookId', '==', id)
        .limit(50)
        .get();

      const deliveries = deliveriesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        payload: undefined, // omit full payload from list
      }));

      res.json({ success: true, deliveries });
    } catch (error) {
      logger.error('Webhook deliveries error:', error);
      next(error);
    }
  }
}


