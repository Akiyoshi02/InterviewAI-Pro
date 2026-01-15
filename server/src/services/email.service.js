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

// Email templates
const TEMPLATES = {
  ORGANIZATION_APPROVED: {
    subject: 'Your Organization Has Been Approved! 🎉',
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
    getHtml: (data) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
      line-height: 1.6; 
      color: #1F2937; 
      background: linear-gradient(to bottom, #EFF6FF 0%, #FFFFFF 50%, #F3E8FF 100%);
      padding: 20px;
    }
    .email-wrapper { max-width: 600px; margin: 0 auto; }
    .container { 
      background: #FFFFFF; 
      border-radius: 24px; 
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }
    .header { 
      background: linear-gradient(135deg, #2563EB 0%, #7C3AED 100%); 
      color: white; 
      padding: 40px 30px; 
      text-align: center; 
    }
    .header h1 { 
      font-size: 28px; 
      font-weight: 700; 
      margin: 0;
      letter-spacing: -0.5px;
    }
    .content { 
      background: #FAFBFC; 
      padding: 40px 30px; 
    }
    .content p { 
      margin-bottom: 16px; 
      color: #1F2937;
      font-size: 16px;
    }
    .button { 
      display: inline-block; 
      background: linear-gradient(135deg, #2563EB 0%, #7C3AED 100%); 
      color: #FFFFFF !important; 
      padding: 14px 32px; 
      text-decoration: none; 
      border-radius: 12px; 
      margin: 24px 0; 
      font-weight: 600;
      font-size: 16px;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    }
    .button, .button * {
      color: #FFFFFF !important;
    }
    .button:hover { 
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
    }
    .features { 
      background: white; 
      padding: 24px; 
      border-radius: 16px; 
      margin: 24px 0;
      border: 1px solid #E5E7EB;
    }
    .features h3 {
      color: #1F2937;
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .feature-item { 
      padding: 12px 0; 
      border-bottom: 1px solid #F3F4F6; 
      color: #374151;
      font-size: 15px;
    }
    .feature-item:last-child { border-bottom: none; }
    .footer {
      text-align: center;
      padding: 24px 30px;
      background: #F9FAFB;
      color: #6B7280;
      font-size: 14px;
      border-top: 1px solid #E5E7EB;
    }
    .footer p { margin: 8px 0; }
    @media only screen and (max-width: 600px) {
      body { padding: 10px; }
      .header, .content { padding: 24px 20px; }
      .header h1 { font-size: 24px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="container">
      <div class="header">
        <h1>🎉 Organization Approved!</h1>
      </div>
      <div class="content">
        <p>Hi ${data.ownerName},</p>
        <p><strong>Great news!</strong> Your organization "<strong>${data.organizationName}</strong>" has been approved and is now ready to use InterviewAI Pro.</p>
        
        <div class="features">
          <h3>You can now:</h3>
          <div class="feature-item">✓ Create and publish job postings</div>
          <div class="feature-item">✓ Send interview invitations to candidates</div>
          <div class="feature-item">✓ Manage your team members</div>
          <div class="feature-item">✓ Access all platform features</div>
        </div>

        <div style="text-align: center;">
          <a href="${data.dashboardUrl}" class="button" style="color: #FFFFFF !important; text-decoration: none;">Go to Dashboard</a>
        </div>

        <p style="margin-top: 32px; color: #6B7280; font-size: 14px;">If you have any questions, feel free to reach out to our support team.</p>
      </div>
      <div class="footer">
        <p><strong>InterviewAI Pro</strong></p>
        <p>Best regards,<br>The InterviewAI Pro Team</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim(),
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
    getHtml: (data) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
      line-height: 1.6; 
      color: #1F2937; 
      background: linear-gradient(to bottom, #EFF6FF 0%, #FFFFFF 50%, #F3E8FF 100%);
      padding: 20px;
    }
    .email-wrapper { max-width: 600px; margin: 0 auto; }
    .container { 
      background: #FFFFFF; 
      border-radius: 24px; 
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }
    .header { 
      background: linear-gradient(135deg, #2563EB 0%, #7C3AED 100%); 
      color: white; 
      padding: 40px 30px; 
      text-align: center; 
    }
    .header h1 { 
      font-size: 28px; 
      font-weight: 700; 
      margin: 0;
      letter-spacing: -0.5px;
    }
    .content { 
      background: #FAFBFC; 
      padding: 40px 30px; 
    }
    .content p { 
      margin-bottom: 16px; 
      color: #1F2937;
      font-size: 16px;
    }
    .reason-box { 
      background: #FEF2F2; 
      border-left: 4px solid #EF4444; 
      padding: 20px; 
      margin: 24px 0;
      border-radius: 8px;
    }
    .reason-box strong {
      color: #991B1B;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: block;
      margin-bottom: 8px;
    }
    .reason-box p {
      color: #7F1D1D;
      margin: 0;
      line-height: 1.6;
    }
    .footer {
      text-align: center;
      padding: 24px 30px;
      background: #F9FAFB;
      color: #6B7280;
      font-size: 14px;
      border-top: 1px solid #E5E7EB;
    }
    .footer p { margin: 8px 0; }
    @media only screen and (max-width: 600px) {
      body { padding: 10px; }
      .header, .content { padding: 24px 20px; }
      .header h1 { font-size: 24px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="container">
      <div class="header">
        <h1>Organization Application Update</h1>
      </div>
      <div class="content">
        <p>Hi ${data.ownerName},</p>
        <p>Thank you for your interest in InterviewAI Pro.</p>
        <p>After reviewing your organization application for "<strong>${data.organizationName}</strong>", we're unable to approve it at this time.</p>
        
        <div class="reason-box">
          <strong>Reason:</strong>
          <p>${data.reason}</p>
        </div>

        <p style="color: #6B7280; font-size: 14px;">If you believe this was a mistake or would like to discuss this further, please contact our support team.</p>
      </div>
      <div class="footer">
        <p><strong>InterviewAI Pro</strong></p>
        <p>Best regards,<br>The InterviewAI Pro Team</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim(),
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
    getHtml: (data) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
      line-height: 1.6; 
      color: #1F2937; 
      background: linear-gradient(to bottom, #EFF6FF 0%, #FFFFFF 50%, #F3E8FF 100%);
      padding: 20px;
    }
    .email-wrapper { max-width: 600px; margin: 0 auto; }
    .container { 
      background: #FFFFFF; 
      border-radius: 24px; 
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }
    .header { 
      background: linear-gradient(135deg, #2563EB 0%, #7C3AED 100%); 
      color: white; 
      padding: 40px 30px; 
      text-align: center; 
    }
    .header h1 { 
      font-size: 28px; 
      font-weight: 700; 
      margin: 0;
      letter-spacing: -0.5px;
    }
    .content { 
      background: #FAFBFC; 
      padding: 40px 30px; 
    }
    .content p { 
      margin-bottom: 16px; 
      color: #1F2937;
      font-size: 16px;
    }
    .button { 
      display: inline-block; 
      background: linear-gradient(135deg, #2563EB 0%, #7C3AED 100%); 
      color: #FFFFFF !important; 
      padding: 14px 32px; 
      text-decoration: none; 
      border-radius: 12px; 
      margin: 24px 0; 
      font-weight: 600;
      font-size: 16px;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    }
    .button, .button * {
      color: #FFFFFF !important;
    }
    .button:hover { 
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
    }
    .details { 
      background: white; 
      padding: 24px; 
      border-radius: 16px; 
      margin: 24px 0;
      border: 1px solid #E5E7EB;
    }
    .detail-item { 
      padding: 12px 0; 
      border-bottom: 1px solid #F3F4F6; 
      color: #374151;
      font-size: 15px;
    }
    .detail-item:last-child { border-bottom: none; }
    .detail-item strong {
      color: #1F2937;
      font-weight: 600;
      display: inline-block;
      min-width: 140px;
    }
    .footer {
      text-align: center;
      padding: 24px 30px;
      background: #F9FAFB;
      color: #6B7280;
      font-size: 14px;
      border-top: 1px solid #E5E7EB;
    }
    .footer p { margin: 8px 0; }
    @media only screen and (max-width: 600px) {
      body { padding: 10px; }
      .header, .content { padding: 24px 20px; }
      .header h1 { font-size: 24px; }
      .detail-item strong { min-width: 100px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="container">
      <div class="header">
        <h1>🎯 Interview Invitation</h1>
      </div>
      <div class="content">
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

        <p style="margin-top: 32px; color: #6B7280; font-size: 14px;">Good luck with your interview!</p>
      </div>
      <div class="footer">
        <p><strong>InterviewAI Pro</strong></p>
        <p>Best regards,<br>The InterviewAI Pro Team</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim(),
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
    getHtml: (data) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
      line-height: 1.6; 
      color: #1F2937; 
      background: linear-gradient(to bottom, #EFF6FF 0%, #FFFFFF 50%, #F3E8FF 100%);
      padding: 20px;
    }
    .email-wrapper { max-width: 600px; margin: 0 auto; }
    .container { 
      background: #FFFFFF; 
      border-radius: 24px; 
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }
    .header { 
      background: linear-gradient(135deg, #2563EB 0%, #7C3AED 100%); 
      color: white; 
      padding: 40px 30px; 
      text-align: center; 
    }
    .header h1 { 
      font-size: 28px; 
      font-weight: 700; 
      margin: 0;
      letter-spacing: -0.5px;
    }
    .content { 
      background: #FAFBFC; 
      padding: 40px 30px; 
    }
    .content p { 
      margin-bottom: 16px; 
      color: #1F2937;
      font-size: 16px;
    }
    .button { 
      display: inline-block; 
      background: linear-gradient(135deg, #2563EB 0%, #7C3AED 100%); 
      color: #FFFFFF !important; 
      padding: 14px 32px; 
      text-decoration: none; 
      border-radius: 12px; 
      margin: 24px 0; 
      font-weight: 600;
      font-size: 16px;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    }
    .button, .button * {
      color: #FFFFFF !important;
    }
    .button:hover { 
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
    }
    .details { 
      background: white; 
      padding: 24px; 
      border-radius: 16px; 
      margin: 24px 0;
      border: 1px solid #E5E7EB;
    }
    .details p {
      padding: 8px 0;
      color: #374151;
      font-size: 15px;
    }
    .details strong {
      color: #1F2937;
      font-weight: 600;
      display: inline-block;
      min-width: 100px;
    }
    .footer {
      text-align: center;
      padding: 24px 30px;
      background: #F9FAFB;
      color: #6B7280;
      font-size: 14px;
      border-top: 1px solid #E5E7EB;
    }
    .footer p { margin: 8px 0; }
    @media only screen and (max-width: 600px) {
      body { padding: 10px; }
      .header, .content { padding: 24px 20px; }
      .header h1 { font-size: 24px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="container">
      <div class="header">
        <h1>✅ Application Received</h1>
      </div>
      <div class="content">
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
      </div>
      <div class="footer">
        <p><strong>${data.companyName}</strong></p>
        <p>Best regards,<br>${data.companyName}</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim(),
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
    getHtml: (data) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
      line-height: 1.6; 
      color: #1F2937; 
      background: linear-gradient(to bottom, #EFF6FF 0%, #FFFFFF 50%, #F3E8FF 100%);
      padding: 20px;
    }
    .email-wrapper { max-width: 600px; margin: 0 auto; }
    .container { 
      background: #FFFFFF; 
      border-radius: 24px; 
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }
    .header { 
      background: linear-gradient(135deg, #2563EB 0%, #7C3AED 100%); 
      color: white; 
      padding: 40px 30px; 
      text-align: center; 
    }
    .header h1 { 
      font-size: 28px; 
      font-weight: 700; 
      margin: 0;
      letter-spacing: -0.5px;
    }
    .content { 
      background: #FAFBFC; 
      padding: 40px 30px; 
    }
    .content p { 
      margin-bottom: 16px; 
      color: #1F2937;
      font-size: 16px;
    }
    .status-box { 
      background: white; 
      padding: 32px 24px; 
      border-radius: 16px; 
      margin: 24px 0;
      text-align: center;
      border: 2px solid #E5E7EB;
    }
    .status-box p {
      color: #6B7280;
      font-size: 14px;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status { 
      font-size: 28px; 
      font-weight: 700; 
      background: linear-gradient(135deg, #2563EB 0%, #7C3AED 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .button { 
      display: inline-block; 
      background: linear-gradient(135deg, #2563EB 0%, #7C3AED 100%); 
      color: #FFFFFF !important; 
      padding: 14px 32px; 
      text-decoration: none; 
      border-radius: 12px; 
      margin: 24px 0; 
      font-weight: 600;
      font-size: 16px;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    }
    .button, .button * {
      color: #FFFFFF !important;
    }
    .button:hover { 
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
    }
    .message-box {
      background: #EFF6FF;
      padding: 20px;
      border-radius: 12px;
      margin: 24px 0;
      border-left: 4px solid #2563EB;
      color: #1E40AF;
      font-size: 15px;
      line-height: 1.6;
    }
    .footer {
      text-align: center;
      padding: 24px 30px;
      background: #F9FAFB;
      color: #6B7280;
      font-size: 14px;
      border-top: 1px solid #E5E7EB;
    }
    .footer p { margin: 8px 0; }
    @media only screen and (max-width: 600px) {
      body { padding: 10px; }
      .header, .content { padding: 24px 20px; }
      .header h1 { font-size: 24px; }
      .status { font-size: 24px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="container">
      <div class="header">
        <h1>Application Status Update</h1>
      </div>
      <div class="content">
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
      </div>
      <div class="footer">
        <p><strong>${data.companyName}</strong></p>
        <p>Best regards,<br>${data.companyName}</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim(),
  },
};

/**
 * Send email using the configured provider
 */
async function sendEmail({ to, subject, text, html }) {
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
        return await sendWithSendGrid({ to, subject, text, html });
      
      case 'ses':
        return await sendWithSES({ to, subject, text, html });
      
      case 'smtp':
        return await sendWithSMTP({ to, subject, text, html });
      
      case 'console':
      default:
        // Log to console in development
        logger.info('═══════════════════════════════════════════════════════════');
        logger.info('📧 EMAIL (Console Mode - Development Only)');
        logger.info('═══════════════════════════════════════════════════════════');
        logger.info(`To: ${to}`);
        logger.info(`From: ${FROM_NAME} <${FROM_EMAIL}>`);
        logger.info(`Subject: ${subject}`);
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
async function sendWithSendGrid({ to, subject, text, html }) {
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
async function sendWithSMTP({ to, subject, text, html }) {
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

  return await sendEmail({
    to: data.email || data.to,
    subject,
    text,
    html,
  });
}

/**
 * Email notification helpers
 */
export const emailNotifications = {
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

    const subject = `You've been invited to join ${organizationName} 🎉`;
    
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

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
      line-height: 1.6; 
      color: #1F2937; 
      background: linear-gradient(to bottom, #EFF6FF 0%, #FFFFFF 50%, #F3E8FF 100%);
      padding: 20px;
    }
    .email-wrapper { max-width: 600px; margin: 0 auto; }
    .container { 
      background: #FFFFFF; 
      border-radius: 24px; 
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }
    .header { 
      background: linear-gradient(135deg, #2563EB 0%, #7C3AED 100%); 
      color: white; 
      padding: 40px 30px; 
      text-align: center; 
    }
    .header h1 { 
      font-size: 28px; 
      font-weight: 700; 
      margin: 0;
      letter-spacing: -0.5px;
    }
    .content { 
      background: #FAFBFC; 
      padding: 40px 30px; 
    }
    .content p { 
      margin: 16px 0; 
      font-size: 16px; 
      line-height: 1.7;
    }
    .button { 
      display: inline-block; 
      padding: 14px 28px; 
      margin: 20px 0; 
      background: linear-gradient(135deg, #2563EB 0%, #7C3AED 100%); 
      color: white !important; 
      text-decoration: none; 
      border-radius: 12px;
      font-weight: 600;
      font-size: 16px;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
      transition: transform 0.2s;
    }
    .button:hover { 
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
    }
    .role-badge {
      display: inline-block;
      padding: 8px 16px;
      margin: 16px 0;
      background: linear-gradient(135deg, #10B981 0%, #14B8A6 100%);
      color: white;
      border-radius: 20px;
      font-weight: 600;
      font-size: 14px;
    }
    .details { 
      background: white; 
      padding: 20px; 
      border-radius: 12px; 
      margin: 24px 0;
      border: 1px solid #E5E7EB;
    }
    .details p { 
      margin: 8px 0; 
      font-size: 14px;
    }
    .footer { 
      padding: 24px 30px;
      background: #F9FAFB;
      color: #6B7280;
      font-size: 14px;
      border-top: 1px solid #E5E7EB;
    }
    .footer p { margin: 8px 0; }
    @media only screen and (max-width: 600px) {
      body { padding: 10px; }
      .header, .content { padding: 24px 20px; }
      .header h1 { font-size: 24px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="container">
      <div class="header">
        <h1>🎉 You're Invited!</h1>
      </div>
      <div class="content">
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

        <p style="font-size: 14px; color: #6B7280; margin-top: 24px;">
          This invitation link is unique to you and will expire in ${expiresInDays} days. If you have any questions, please contact ${organizationName} directly.
        </p>
      </div>
      <div class="footer">
        <p><strong>InterviewAI Pro</strong></p>
        <p>This email was sent because ${organizationName} invited you to join their team.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

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

