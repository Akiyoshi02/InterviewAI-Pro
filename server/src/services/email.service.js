import logger from '../utils/logger.js';
import sgMail from '@sendgrid/mail';
import nodemailer from 'nodemailer';

/**
 * Email Service
 * 
 * This service provides email functionality with support for multiple providers.
 * Configure your preferred provider in environment variables.
 * 
 * Supported providers:
 * - sendgrid: SendGrid API (Free: 100 emails/day)
 * - smtp: Generic SMTP (Nodemailer) - Works with Gmail, Outlook, etc.
 * - console: Console logging only (development)
 * 
 * Free Email Service Options:
 * 1. SendGrid: https://sendgrid.com (100 emails/day free forever)
 * 2. Gmail SMTP: Use your Gmail account with app password
 * 3. Outlook SMTP: Use your Outlook account
 */

const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'console';
const FROM_EMAIL = process.env.FROM_EMAIL || 'akiyoshiyapa@gmail.com';
const FROM_NAME = process.env.FROM_NAME || 'InterviewAI Pro';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Helper function to format dates safely
const formatEmailDate = (dateValue) => {
  if (!dateValue) return 'N/A';
  try {
    // Handle Firestore Timestamp objects
    if (dateValue && typeof dateValue === 'object' && dateValue.toDate) {
      return dateValue.toDate().toLocaleDateString();
    }
    // Handle ISO strings or timestamps
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(date.getTime())) {
      // If date is invalid, try parsing as timestamp
      const timestamp = typeof dateValue === 'number' ? dateValue : parseInt(dateValue);
      if (!isNaN(timestamp)) {
        return new Date(timestamp).toLocaleDateString();
      }
      return new Date().toLocaleDateString(); // Fallback to current date
    }
    return date.toLocaleDateString();
  } catch (error) {
    logger.error('Date formatting error in email:', error, dateValue);
    return new Date().toLocaleDateString(); // Fallback to current date
  }
};

// Initialize SendGrid if API key is provided
if (process.env.SENDGRID_API_KEY) {
  try {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    logger.info('✅ SendGrid API key initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize SendGrid API key:', error);
  }
} else if (process.env.EMAIL_PROVIDER === 'sendgrid') {
  logger.warn('⚠️  EMAIL_PROVIDER is set to sendgrid but SENDGRID_API_KEY is not configured');
}

const DEFAULT_FOOTER_HTML = `
  <p class="footer-brand"><strong>InterviewAI Pro</strong></p>
  <p class="footer-links">
    <a href="${FRONTEND_URL}/privacy">Privacy Notice</a>
    <span class="footer-sep">&bull;</span>
    <a href="${FRONTEND_URL}/help-center">Support</a>
    <span class="footer-sep">&bull;</span>
    <a href="${FRONTEND_URL}/terms">Terms of Service</a>
  </p>
  <p class="footer-note">This is a service notification email.</p>
`.trim();

const BASE_EMAIL_STYLES = `
  :root { color-scheme: light; supported-color-schemes: light; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 100% !important;
    margin: 0;
    padding: 24px 16px;
    background-color: #f3f5f9;
    background-image:
      linear-gradient(160deg, #f1f4f9 0%, #e9edf5 55%, #f6f7fb 100%);
    font-family: 'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #0f172a;
  }
  .preheader {
    display: none !important;
    visibility: hidden;
    opacity: 0;
    height: 0;
    width: 0;
    overflow: hidden;
  }
  .email-wrapper { max-width: 640px; margin: 0 auto; }
  .container {
    background: #ffffff;
    border-radius: 22px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
    box-shadow: 0 20px 45px rgba(15, 23, 42, 0.12);
    animation: fadeInUp 0.7s ease both;
  }
  .accent-bar {
    height: 5px;
    background: linear-gradient(90deg, #2563eb 0%, #7c3aed 55%, #2563eb 100%);
    background-size: 200% 100%;
    animation: shimmer 8s linear infinite;
  }
  .header {
    padding: 28px 32px 8px;
    text-align: center;
  }
  .logo-badge {
    width: 52px;
    height: 52px;
    margin: 0 auto 14px;
    border-radius: 999px;
    background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 16px;
    letter-spacing: 0.08em;
    box-shadow: 0 14px 22px rgba(37, 99, 235, 0.28);
    animation: popIn 0.7s ease both;
  }
  .header h1 {
    font-size: 22px;
    font-weight: 700;
    margin: 0;
    color: #0f172a;
    letter-spacing: -0.3px;
  }
  .subtitle {
    margin-top: 6px;
    font-size: 13px;
    color: #64748b;
  }
  .content {
    padding: 12px 36px 6px;
    text-align: left;
  }
  .content p {
    margin: 0 0 14px;
    color: #0f172a;
    font-size: 15px;
  }
  .content a { color: #2563eb; text-decoration: none; }
  .content a:hover { text-decoration: underline; }
  .note { color: #64748b; font-size: 13px; }
  .button {
    display: inline-block;
    background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
    color: #ffffff !important;
    padding: 12px 24px;
    border-radius: 10px;
    font-weight: 600;
    font-size: 15px;
    text-decoration: none;
    border: 1px solid #2563eb;
    box-shadow: 0 12px 22px rgba(37, 99, 235, 0.28);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .button:hover { transform: translateY(-1px); box-shadow: 0 16px 26px rgba(37, 99, 235, 0.3); }
  .features {
    background: #f8fafc;
    padding: 20px 22px;
    border-radius: 14px;
    margin: 18px 0 22px;
    border: 1px solid #e2e8f0;
  }
  .features h3 { color: #0f172a; font-size: 16px; font-weight: 600; margin-bottom: 10px; }
  .feature-item {
    padding: 8px 0;
    border-bottom: 1px solid #e2e8f0;
    color: #1f2937;
    font-size: 14px;
  }
  .feature-item:last-child { border-bottom: none; }
  .reason-box {
    background: #fef2f2;
    border-left: 4px solid #ef4444;
    padding: 18px;
    margin: 18px 0;
    border-radius: 10px;
  }
  .reason-box strong {
    color: #991b1b;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    display: block;
    margin-bottom: 8px;
  }
  .reason-box p { color: #7f1d1d; margin: 0; }
  .code-box {
    display: inline-block;
    font-size: 24px;
    letter-spacing: 6px;
    font-weight: 700;
    padding: 12px 16px;
    border-radius: 10px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    margin: 14px 0 18px;
  }
  .details {
    background: #f8fafc;
    padding: 18px 20px;
    border-radius: 14px;
    margin: 18px 0;
    border: 1px solid #e2e8f0;
  }
  .details p { margin: 8px 0; color: #1f2937; font-size: 14px; }
  .details strong { color: #0f172a; font-weight: 600; display: inline-block; min-width: 100px; }
  .detail-item {
    padding: 10px 0;
    border-bottom: 1px solid #e2e8f0;
    color: #1f2937;
    font-size: 14px;
  }
  .detail-item:last-child { border-bottom: none; }
  .detail-item strong { color: #0f172a; font-weight: 600; display: inline-block; min-width: 120px; }
  .status-box {
    background: #f8fafc;
    padding: 22px;
    border-radius: 14px;
    margin: 18px 0;
    text-align: center;
    border: 1px solid #e2e8f0;
  }
  .status-box p {
    color: #64748b;
    font-size: 12px;
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  .status { font-size: 22px; font-weight: 700; color: #2563eb; }
  .message-box {
    background: #eff6ff;
    padding: 18px;
    border-radius: 12px;
    margin: 18px 0;
    border: 1px solid #bfdbfe;
    color: #1e3a8a;
    font-size: 14px;
    line-height: 1.6;
  }
  .role-badge {
    display: inline-block;
    padding: 8px 14px;
    margin: 12px 0;
    background: #0f766e;
    color: #ffffff;
    border-radius: 999px;
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.04em;
  }
  .footer {
    text-align: center;
    padding: 16px 32px 24px;
    background: #f8fafc;
    color: #64748b;
    font-size: 12px;
    border-top: 1px solid #e2e8f0;
  }
  .footer p { margin: 6px 0; }
  .footer a { color: #475569; text-decoration: underline; }
  .footer-links { margin: 10px 0 6px; }
  .footer-sep { margin: 0 6px; color: #cbd5f5; }
  .footer-note { color: #94a3b8; font-size: 11px; }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    0% { background-position: 0% 50%; }
    100% { background-position: 200% 50%; }
  }
  @keyframes popIn {
    0% { opacity: 0; transform: scale(0.94); }
    100% { opacity: 1; transform: scale(1); }
  }
  @media only screen and (max-width: 600px) {
    body { padding: 12px 8px; }
    .header, .content { padding-left: 20px; padding-right: 20px; }
    .footer { padding-left: 20px; padding-right: 20px; }
    .header h1 { font-size: 20px; }
    .detail-item strong { min-width: 100px; }
    .code-box { font-size: 20px; letter-spacing: 4px; }
  }
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; }
  }
`.trim();

const renderEmailLayout = ({ title, bodyHtml, footerHtml = DEFAULT_FOOTER_HTML, extraCss = '' }) => {
  const styles = [BASE_EMAIL_STYLES, extraCss].filter(Boolean).join('\n');
  const content = (bodyHtml || '').trim();
  const footer = (footerHtml || DEFAULT_FOOTER_HTML).trim();
  const headerTitle = title || 'InterviewAI Pro';
  const preheaderText = `${headerTitle} | InterviewAI Pro`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
${styles}
  </style>
</head>
<body>
  <span class="preheader">${preheaderText}</span>
  <div class="email-wrapper">
    <div class="container">
      <div class="accent-bar"></div>
      <div class="header">
        <div class="logo-badge">IP</div>
        <h1>${headerTitle}</h1>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        ${footer}
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
};

// Email templates
const TEMPLATES = {
  ORGANIZATION_APPROVED: {
    subject: 'Your Organization Has Been Approved!',
    getText: (data) => `
Hi ${data.ownerName},

Great news! Your organization "${data.organizationName}" has been approved and is now ready to use InterviewAI Pro.

You can now:
- Create and publish job postings
- Send interview invitations to candidates
- Manage your team members
- Access all platform features

Get started: ${data.dashboardUrl}

If you have any questions, feel free to reach out to our support team.

Best regards,
The InterviewAI Pro Team
    `.trim(),
    getHtml: (data) => renderEmailLayout({
      title: 'Organization Approved!',
      bodyHtml: `
        <p>Hi ${data.ownerName},</p>
        <p><strong>Great news!</strong> Your organization "<strong>${data.organizationName}</strong>" has been approved and is now ready to use InterviewAI Pro.</p>

        <div class="features">
          <h3>You can now:</h3>
          <div class="feature-item">&bull; Create and publish job postings</div>
          <div class="feature-item">&bull; Send interview invitations to candidates</div>
          <div class="feature-item">&bull; Manage your team members</div>
          <div class="feature-item">&bull; Access all platform features</div>
        </div>

        <div style="text-align: center;">
          <a href="${data.dashboardUrl}" class="button" style="color: #FFFFFF !important; text-decoration: none;">Go to Dashboard</a>
        </div>

        <p class="note" style="margin-top: 32px;">If you have any questions, feel free to reach out to our support team.</p>
      `,
    }),
  },

  ORGANIZATION_REJECTED: {
    subject: 'Organization Application Update',
    getText: (data) => `
Hi ${data.ownerName},

Thank you for your interest in InterviewAI Pro.

After reviewing your organization application for "${data.organizationName}", we're unable to approve it at this time.

Reason: ${data.reason}

If you believe this was a mistake or would like to discuss this further, please contact our support team.

Best regards,
The InterviewAI Pro Team
    `.trim(),
    getHtml: (data) => renderEmailLayout({
      title: 'Organization Application Update',
      bodyHtml: `
        <p>Hi ${data.ownerName},</p>
        <p>Thank you for your interest in InterviewAI Pro.</p>
        <p>After reviewing your organization application for "<strong>${data.organizationName}</strong>", we're unable to approve it at this time.</p>

        <div class="reason-box">
          <strong>Reason:</strong>
          <p>${data.reason}</p>
        </div>

        <p class="note">If you believe this was a mistake or would like to discuss this further, please contact our support team.</p>
      `,
    }),
  },

  EMAIL_VERIFICATION: {
    subject: 'Verify your email to finish creating your InterviewAI Pro account',
    getText: (data) => `
Hi ${data.fullName || 'there'},

Use this 8-digit code to verify your email:
${data.verificationCode}

This code expires in ${data.expiresInMinutes} minutes.

If you did not request this, you can ignore this email.

The InterviewAI Pro Team
    `.trim(),
    getHtml: (data) => renderEmailLayout({
      title: 'Verify Your Email',
      bodyHtml: `
        <p>Hi ${data.fullName || 'there'},</p>
        <p>Use this 8-digit code to verify your email:</p>
        <div class="code-box">${data.verificationCode}</div>
        <p>This code expires in ${data.expiresInMinutes} minutes.</p>
        <p class="note">If you did not request this, you can ignore this email.</p>
      `,
    }),
  },

  INVITATION_RECEIVED: {
    subject: 'You\'ve Been Invited to an Interview!',
    getText: (data) => `
Hi there,

You've been invited to interview for the position of "${data.jobTitle}" at ${data.companyName}.

Interview Details:
- Position: ${data.jobTitle}
- Company: ${data.companyName}
- Interview Stage: ${data.stage}
- Duration: ${data.duration} minutes

Click here to accept: ${data.invitationUrl}

This invitation will expire on ${new Date(data.expiresAt).toLocaleDateString()}.

Good luck!
The InterviewAI Pro Team
    `.trim(),
    getHtml: (data) => renderEmailLayout({
      title: 'Interview Invitation',
      bodyHtml: `
        <p>Hi there,</p>
        <p>You've been invited to interview for the position of <strong>${data.jobTitle}</strong> at <strong>${data.companyName}</strong>.</p>

        <div class="details">
          <div class="detail-item"><strong>Position:</strong> ${data.jobTitle}</div>
          <div class="detail-item"><strong>Company:</strong> ${data.companyName}</div>
          <div class="detail-item"><strong>Interview Stage:</strong> ${data.stage}</div>
          <div class="detail-item"><strong>Duration:</strong> ${data.duration} minutes</div>
          <div class="detail-item"><strong>Expires:</strong> ${new Date(data.expiresAt).toLocaleDateString()}</div>
        </div>

        <div style="text-align: center;">
          <a href="${data.invitationUrl}" class="button" style="color: #FFFFFF !important; text-decoration: none;">Accept Invitation</a>
        </div>

        <p class="note" style="margin-top: 32px;">Good luck with your interview!</p>
      `,
    }),
  },

  APPLICATION_RECEIVED: {
    subject: 'Application Received for ${data.jobTitle}',
    getText: (data) => `
Hi ${data.candidateName},

Thank you for applying to the position of "${data.jobTitle}" at ${data.companyName}.

We've received your application and our team will review it shortly.

Application Details:
- Position: ${data.jobTitle}
- Submitted: ${formatEmailDate(data.submittedAt)}
- Status: Under Review

You can track your application status at: ${data.dashboardUrl}

Best regards,
${data.companyName}
    `.trim(),
    getHtml: (data) => renderEmailLayout({
      title: 'Application Received',
      bodyHtml: `
        <p>Hi ${data.candidateName},</p>
        <p>Thank you for applying to the position of <strong>${data.jobTitle}</strong> at <strong>${data.companyName}</strong>.</p>
        <p>We've received your application and our team will review it shortly.</p>

        <div class="details">
          <p><strong>Position:</strong> ${data.jobTitle}</p>
          <p><strong>Submitted:</strong> ${formatEmailDate(data.submittedAt)}</p>
          <p><strong>Status:</strong> Under Review</p>
        </div>

        <div style="text-align: center;">
          <a href="${data.dashboardUrl}" class="button" style="color: #FFFFFF !important; text-decoration: none;">Track Application</a>
        </div>
      `,
      footerHtml: `
        <p><strong>${data.companyName}</strong></p>
        <p>Best regards,<br>${data.companyName}</p>
      `,
    }),
  },

  APPLICATION_STATUS_UPDATED: {
    subject: 'Application Status Update - ${data.jobTitle}',
    getText: (data) => `
Hi ${data.candidateName},

Your application for "${data.jobTitle}" at ${data.companyName} has been updated.

Status: ${data.status}

${data.message || ''}

View details: ${data.dashboardUrl}

Best regards,
${data.companyName}
    `.trim(),
    getHtml: (data) => renderEmailLayout({
      title: 'Application Status Update',
      bodyHtml: `
        <p>Hi ${data.candidateName},</p>
        <p>Your application for <strong>${data.jobTitle}</strong> at <strong>${data.companyName}</strong> has been updated.</p>

        <div class="status-box">
          <p>Current Status</p>
          <div class="status">${data.status}</div>
        </div>

        ${data.message ? `<div class="message-box">${data.message}</div>` : ''}

        <div style="text-align: center;">
          <a href="${data.dashboardUrl}" class="button" style="color: #FFFFFF !important; text-decoration: none;">View Details</a>
        </div>
      `,
      footerHtml: `
        <p><strong>${data.companyName}</strong></p>
        <p>Best regards,<br>${data.companyName}</p>
      `,
    }),
  },

  NEWSLETTER_WELCOME: {
    subject: 'Welcome to InterviewAI Pro Newsletter!',
    getText: (data) => `
Hi there,

Thank you for subscribing to the InterviewAI Pro newsletter!

You'll now receive:
- Monthly updates on AI interviewing trends
- Hiring benchmarks and industry insights
- Feature releases and product updates
- Best practices for interviews and hiring

We're excited to have you on board!

If you ever want to unsubscribe, you can do so here: ${data.unsubscribeUrl}

Best regards,
The InterviewAI Pro Team
    `.trim(),
    getHtml: (data) => renderEmailLayout({
      title: 'Welcome to InterviewAI Pro!',
      bodyHtml: `
        <p>Hi there,</p>
        <p>Thank you for subscribing to the InterviewAI Pro newsletter! We're thrilled to have you join our community.</p>

        <div class="features">
          <h3>What to expect from us:</h3>
          <div class="feature-item">&bull; Monthly updates on AI interviewing trends</div>
          <div class="feature-item">&bull; Hiring benchmarks and industry insights</div>
          <div class="feature-item">&bull; Feature releases and product updates</div>
          <div class="feature-item">&bull; Best practices for interviews and hiring</div>
        </div>

        <p>We promise to keep our emails valuable and respect your inbox. You can unsubscribe anytime.</p>

        <p>Thanks for being part of our journey!</p>
        <p><strong>The InterviewAI Pro Team</strong></p>
      `,
      footerHtml: `
        <p>Copyright ${new Date().getFullYear()} InterviewAI Pro. Crafted in Sri Lanka.</p>
        <p><a href="${data.unsubscribeUrl}">Unsubscribe from this list</a></p>
      `,
    }),
  },

  CONTACT_RECEIVED: {
    subject: 'New contact message: ${data.subject}',
    getText: (data) => `
New contact form submission

Name: ${data.name}
Email: ${data.email}
Subject: ${data.subject}

Message:
${data.message}

Submitted: ${data.submittedAtText}
    `.trim(),
    getHtml: (data) => renderEmailLayout({
      title: 'New Contact Message',
      bodyHtml: `
        <p>New contact form submission.</p>
        <div class="details">
          <div class="detail-item"><strong>Name:</strong> ${data.safeName}</div>
          <div class="detail-item"><strong>Email:</strong> ${data.safeEmail}</div>
          <div class="detail-item"><strong>Subject:</strong> ${data.safeSubject}</div>
        </div>
        <div class="message-box">${data.safeMessageHtml}</div>
        <p class="note" style="margin: 12px 0 0;">Submitted: ${data.submittedAtText}</p>
      `,
    }),
  },

  CONTACT_CONFIRMATION: {
    subject: 'We received your message',
    getText: (data) => `
Hi ${data.name || 'there'},

Thanks for reaching out to InterviewAI Pro. We received your message and will get back to you within 24 hours.

Your message:
Subject: ${data.subject}

${data.message}

If you need to add more details, just reply to this email.
    `.trim(),
    getHtml: (data) => renderEmailLayout({
      title: 'We received your message',
      bodyHtml: `
        <p>Hi ${data.safeName || 'there'},</p>
        <p>Thanks for reaching out to InterviewAI Pro. We received your message and will get back to you within 24 hours.</p>
        <p><strong>Subject:</strong> ${data.safeSubject}</p>
        <div class="message-box">${data.safeMessageHtml}</div>
        <p class="note">If you need to add more details, just reply to this email.</p>
      `,
    }),
  },
};

/**
 * Send email using the configured provider
 */
async function sendEmail({ to, subject, text, html, replyTo }) {
  if (!to || !to.trim()) {
    throw new Error('Email recipient (to) is required');
  }
  if (!subject || !subject.trim()) {
    throw new Error('Email subject is required');
  }
  
  try {
    logger.info(`📧 Sending email to ${to}: ${subject}`);

    switch (EMAIL_PROVIDER) {
      case 'sendgrid':
        return await sendWithSendGrid({ to, subject, text, html, replyTo });
      
      case 'ses':
        return await sendWithSES({ to, subject, text, html, replyTo });
      
      case 'smtp':
        return await sendWithSMTP({ to, subject, text, html, replyTo });
      
      case 'console':
      default:
        // Log to console in development
        logger.info('═══════════════════════════════════════════════════════════');
        logger.info('📧 EMAIL (Console Mode - Development Only)');
        logger.info('═══════════════════════════════════════════════════════════');
        logger.info(`To: ${to}`);
        logger.info(`From: ${FROM_NAME} <${FROM_EMAIL}>`);
        logger.info(`Subject: ${subject}`);
        if (replyTo) {
          logger.info(`Reply-To: ${replyTo}`);
        }
        logger.info('───────────────────────────────────────────────────────────');
        logger.info('Text Content:');
        logger.info(text);
        logger.info('───────────────────────────────────────────────────────────');
        logger.info('HTML Content:');
        logger.info(html.substring(0, 200) + (html.length > 200 ? '...' : ''));
        logger.info('═══════════════════════════════════════════════════════════');
        return { success: true, messageId: 'console-' + Date.now() };
    }
  } catch (error) {
    logger.error('Failed to send email:', error);
    throw error;
  }
}

/**
 * SendGrid implementation
 * Free tier: 100 emails/day forever
 * Setup: https://sendgrid.com
 * 1. Sign up for free account
 * 2. Create API key in Settings > API Keys
 * 3. Set SENDGRID_API_KEY in .env
 */
async function sendWithSendGrid({ to, subject, text, html, replyTo }) {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error('SENDGRID_API_KEY is not configured. Please set it in your .env file.');
  }

  try {
    const msg = {
      to,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME,
      },
      subject,
      text,
      html,
    };
    if (replyTo) {
      msg.replyTo = replyTo;
    }

    logger.info(`📤 SendGrid: Preparing to send email from ${FROM_EMAIL} to ${to}`);
    const result = await sgMail.send(msg);
    
    const statusCode = result[0]?.statusCode;
    const messageId = result[0]?.headers['x-message-id'] || 'unknown';
    
    if (statusCode >= 200 && statusCode < 300) {
      logger.info(`✅ Email sent via SendGrid to ${to} - Status: ${statusCode}, Message ID: ${messageId}`);
      return { success: true, messageId, statusCode };
    } else {
      logger.warn(`⚠️  SendGrid returned non-2xx status: ${statusCode} for email to ${to}`);
      return { success: true, messageId, statusCode };
    }
  } catch (error) {
    logger.error('❌ SendGrid error:', {
      message: error.message,
      code: error.code,
      response: error.response ? {
        statusCode: error.response.statusCode,
        body: error.response.body,
        headers: error.response.headers,
      } : null,
    });
    
    // Provide more helpful error messages
    if (error.response) {
      const body = error.response.body;
      if (body && body.errors) {
        const errorMessages = body.errors.map(e => e.message).join(', ');
        throw new Error(`SendGrid error: ${errorMessages}`);
      }
      if (error.response.statusCode === 403) {
        throw new Error('SendGrid: Authentication failed. Please check your API key.');
      }
      if (error.response.statusCode === 400) {
        throw new Error(`SendGrid: Invalid request. ${body?.message || error.message}`);
      }
    }
    
    throw new Error(`Failed to send email via SendGrid: ${error.message}`);
  }
}

/**
 * AWS SES implementation
 */
async function sendWithSES({ to, subject, text, html }) {
  // TODO: Implement AWS SES
  // const AWS = require('aws-sdk');
  // const ses = new AWS.SES({ region: process.env.AWS_REGION });
  // const params = { ... };
  // return await ses.sendEmail(params).promise();
  
  logger.warn('AWS SES not implemented, falling back to console');
  return sendEmail({ to, subject, text, html });
}

/**
 * SMTP implementation (Nodemailer)
 * Supports Gmail, Outlook, and other SMTP servers
 * 
 * Gmail Setup:
 * 1. Enable 2-factor authentication on your Google account
 * 2. Generate App Password: https://myaccount.google.com/apppasswords
 * 3. Use: SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_USER=your-email@gmail.com, SMTP_PASS=your-app-password
 * 
 * Outlook Setup:
 * 1. Use: SMTP_HOST=smtp-mail.outlook.com, SMTP_PORT=587, SMTP_USER=your-email@outlook.com, SMTP_PASS=your-password
 */
async function sendWithSMTP({ to, subject, text, html, replyTo }) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpSecure = process.env.SMTP_SECURE === 'true';

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error('SMTP configuration incomplete. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in your .env file.');
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      // Gmail-specific settings
      ...(smtpHost.includes('gmail.com') && {
        service: 'gmail',
      }),
    });

    // Verify connection
    await transporter.verify();

    const mailOptions = {
      from: {
        name: FROM_NAME,
        address: FROM_EMAIL,
      },
      to,
      subject,
      text,
      html,
    };
    if (replyTo) {
      mailOptions.replyTo = replyTo;
    }

    const result = await transporter.sendMail(mailOptions);
    logger.info(`Email sent via SMTP to ${to}: ${result.messageId}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error('SMTP error:', error);
    throw new Error(`Failed to send email via SMTP: ${error.message}`);
  }
}

/**
 * Send templated email
 */
export async function sendTemplatedEmail(templateName, data) {
  const template = TEMPLATES[templateName];
  
  if (!template) {
    throw new Error(`Email template not found: ${templateName}`);
  }

  const subject = typeof template.subject === 'function' 
    ? template.subject(data)
    : template.subject.replace(/\$\{data\.(\w+)\}/g, (_, key) => data[key] || '');
  
  const text = template.getText(data);
  const html = template.getHtml(data);

  const recipient = data.to || data.email;

  return await sendEmail({
    to: recipient,
    subject,
    text,
    html,
    replyTo: data.replyTo,
  });
}

/**
 * Email notification helpers
 */
export const emailNotifications = {
  async sendEmailVerification({ email, fullName, verificationCode, expiresInMinutes = 10 }) {
    return await sendTemplatedEmail('EMAIL_VERIFICATION', {
      email,
      fullName: fullName || 'there',
      verificationCode,
      expiresInMinutes,
    });
  },

  async sendOrganizationApproved(organization, owner) {
    return await sendTemplatedEmail('ORGANIZATION_APPROVED', {
      email: owner.email,
      ownerName: owner.fullName || 'there',
      organizationName: organization.displayName || organization.name,
      dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/company-dashboard`,
    });
  },

  async sendOrganizationRejected(organization, owner, reason) {
    if (!owner || !owner.email) {
      throw new Error('Owner email is required to send rejection email');
    }
    if (!reason || !reason.trim()) {
      throw new Error('Rejection reason is required');
    }
    return await sendTemplatedEmail('ORGANIZATION_REJECTED', {
      email: owner.email,
      ownerName: owner.fullName || owner.email || 'there',
      organizationName: organization.displayName || organization.name || 'Your Organization',
      reason: reason.trim(),
    });
  },

  async sendInvitationReceived(invitation, job, company) {
    return await sendTemplatedEmail('INVITATION_RECEIVED', {
      email: invitation.email,
      jobTitle: job.title,
      companyName: company.displayName || company.name,
      stage: invitation.stage || 'Interview',
      duration: job.templateConfig?.duration || 30,
      expiresAt: invitation.expiresAt,
      invitationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite?token=${invitation.token}`,
    });
  },

  async sendApplicationReceived(application, candidate, job, company) {
    return await sendTemplatedEmail('APPLICATION_RECEIVED', {
      email: candidate.email,
      candidateName: candidate.fullName || 'there',
      jobTitle: job.title,
      companyName: company.displayName || company.name,
      submittedAt: application.submittedAt,
      dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/candidate-dashboard`,
    });
  },

  async sendApplicationStatusUpdated(application, candidate, job, company, message = '') {
    return await sendTemplatedEmail('APPLICATION_STATUS_UPDATED', {
      email: candidate.email,
      candidateName: candidate.fullName || 'there',
      jobTitle: job.title,
      companyName: company.displayName || company.name,
      status: application.status,
      message,
      dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/candidate-dashboard`,
    });
  },

  async sendTeamInvitation({ to, organizationName, role, inviteLink, expiresInDays = 7 }) {
    const roleDisplay = {
      ADMIN: 'Administrator',
      RECRUITER: 'Recruiter',
      REVIEWER: 'Reviewer',
    }[role] || role;

    const subject = `You've been invited to join ${organizationName}`;
    
    const text = `
Hi there,

You've been invited to join ${organizationName} as a ${roleDisplay}!

${organizationName} is using InterviewAI Pro to streamline their hiring process, and they'd like you to be part of their team.

Your Role: ${roleDisplay}

To accept this invitation and create your account:
${inviteLink}

This invitation will expire in ${expiresInDays} days.

Best regards,
The InterviewAI Pro Team
    `.trim();


    const html = renderEmailLayout({
      title: 'You\'re Invited!',
      bodyHtml: `
        <p>Hi there,</p>
        <p>You've been invited to join <strong>${organizationName}</strong> on InterviewAI Pro!</p>

        <div style="text-align: center;">
          <span class="role-badge">Your Role: ${roleDisplay}</span>
        </div>

        <p>${organizationName} is using InterviewAI Pro to streamline their hiring process, and they'd like you to be part of their team.</p>

        <div class="details">
          <p><strong>Organization:</strong> ${organizationName}</p>
          <p><strong>Your Role:</strong> ${roleDisplay}</p>
          <p><strong>Expires In:</strong> ${expiresInDays} days</p>
        </div>

        <div style="text-align: center;">
          <a href="${inviteLink}" class="button">Accept Invitation & Create Account</a>
        </div>

        <p class="note" style="margin-top: 24px;">
          This invitation link is unique to you and will expire in ${expiresInDays} days. If you have any questions, please contact ${organizationName} directly.
        </p>
      `,
      footerHtml: `
        <p><strong>InterviewAI Pro</strong></p>
        <p>This email was sent because ${organizationName} invited you to join their team.</p>
      `,
    });

    return await sendEmail({ to, subject, text, html });
  },
};

export default {
  sendEmail,
  sendTemplatedEmail,
  ...emailNotifications,
};

export const emailService = {
  sendEmail,
  sendTemplatedEmail,
  ...emailNotifications,
};

