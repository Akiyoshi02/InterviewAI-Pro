import logger from '../utils/logger.js';
import { emailService } from '../services/email.service.js';

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatHtmlMessage = (value) => escapeHtml(value).replace(/\r?\n/g, '<br />');

export class ContactController {
  static async submit(req, res, next) {
    try {
      const { name, email, subject, message } = req.body;
      const contactName = (name || '').trim();
      const contactEmail = (email || '').trim().toLowerCase();
      const contactSubject = (subject || '').trim();
      const contactMessage = (message || '').trim();
      const contactInbox = process.env.CONTACT_INBOX_EMAIL || process.env.FROM_EMAIL;

      if (!contactInbox) {
        return res.status(500).json({ error: 'Contact inbox is not configured.' });
      }

      const submittedAtText = new Date().toISOString();
      const safeMessageHtml = formatHtmlMessage(contactMessage);
      const safeNameHtml = escapeHtml(contactName);
      const safeEmailHtml = escapeHtml(contactEmail);
      const safeSubjectHtml = escapeHtml(contactSubject);
      await emailService.sendTemplatedEmail('CONTACT_RECEIVED', {
        to: contactInbox,
        name: contactName,
        email: contactEmail,
        subject: contactSubject,
        message: contactMessage,
        submittedAtText,
        safeName: safeNameHtml,
        safeEmail: safeEmailHtml,
        safeSubject: safeSubjectHtml,
        safeMessageHtml,
        replyTo: contactEmail,
      });
      await emailService.sendTemplatedEmail('CONTACT_CONFIRMATION', {
        email: contactEmail,
        name: contactName,
        subject: contactSubject,
        message: contactMessage,
        safeName: safeNameHtml,
        safeSubject: safeSubjectHtml,
        safeMessageHtml,
        replyTo: contactInbox,
      });

      return res.status(200).json({
        success: true,
        message: 'Message sent successfully. A confirmation email has been sent to you.',
      });
    } catch (error) {
      logger.error('Contact form submission error:', error);
      next(error);
    }
  }
}
