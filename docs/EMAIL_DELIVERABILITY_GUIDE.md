# Email Deliverability Guide

## Why Your Emails Are Going to Spam

Emails sent via SendGrid are landing in spam because of **authentication issues**. The main problem is using a Gmail address (`akiyoshiyapa@gmail.com`) as the sender with SendGrid.

### The Problem

When you send emails "from" a Gmail address through SendGrid:
1. **SPF fails**: Gmail's SPF record doesn't authorize SendGrid to send on its behalf
2. **DKIM fails**: Gmail's DKIM keys don't match SendGrid's signing
3. **Looks like spoofing**: Email providers see this as a phishing attempt

This is the **#1 reason** your emails go to spam.

---

## Solutions (Choose One)

### Option 1: Use a Custom Domain (Recommended)

This is the best solution for long-term deliverability.

1. **Get a domain** (e.g., `interviewai-pro.com`)
2. **Set up domain authentication in SendGrid**:
   - Go to SendGrid Dashboard → Settings → Sender Authentication
   - Click "Authenticate Your Domain"
   - Follow the DNS setup instructions
   - This adds SPF, DKIM, and DMARC records

3. **Update your `.env`**:
   ```env
   FROM_EMAIL=noreply@interviewai-pro.com
   FROM_NAME=InterviewAI Pro
   ```

4. **Benefits**:
   - Emails pass SPF, DKIM, DMARC checks
   - Better inbox placement
   - Professional appearance
   - Build sender reputation

### Option 2: Single Sender Verification (Quick Fix)

If you don't have a custom domain yet:

1. **Verify your sender in SendGrid**:
   - Go to SendGrid Dashboard → Settings → Sender Authentication
   - Click "Verify a Single Sender"
   - Add your Gmail address
   - Complete the verification email

2. **Limitations**:
   - Still has authentication issues
   - Lower deliverability than domain authentication
   - May still go to spam for some recipients

### Option 3: Use Gmail SMTP Directly

Send through Gmail's own SMTP servers (bypasses SendGrid):

1. **Enable 2-Factor Authentication** on your Google account

2. **Create an App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Generate a password for "Mail"

3. **Update your `.env`**:
   ```env
   EMAIL_PROVIDER=smtp
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=akiyoshiyapa@gmail.com
   SMTP_PASS=your-app-password
   FROM_EMAIL=akiyoshiyapa@gmail.com
   FROM_NAME=InterviewAI Pro
   ```

4. **Benefits**:
   - Proper Gmail authentication
   - Better deliverability for Gmail addresses
   - Free

5. **Limitations**:
   - Daily sending limits (~500/day for personal accounts)
   - May be flagged if sending bulk emails

---

## Code Improvements Already Made

The email service has been updated with:

1. **✅ Plain text versions** - All emails now have both HTML and plain text
2. **✅ Disabled tracking** - Click/open tracking disabled (can trigger spam filters)
3. **✅ Email categories** - Better tracking and filtering
4. **✅ Proper headers** - List-Unsubscribe, X-Priority, Precedence headers
5. **✅ Lightweight logo** - Replaced large image with CSS-based logo
6. **✅ Warnings** - Logs warning when using free email domains

---

## Quick Test: Switch to Gmail SMTP

To quickly test if the authentication is the issue, switch to Gmail SMTP:

1. Update `server/.env`:
   ```env
   EMAIL_PROVIDER=smtp
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=akiyoshiyapa@gmail.com
   SMTP_PASS=<your-gmail-app-password>
   ```

2. Restart the server

3. Send a test email

If emails now go to inbox, the issue was SendGrid authentication.

---

## Long-term Recommendations

1. **Get a custom domain** ($10-15/year from Namecheap, Google Domains, etc.)
2. **Set up domain authentication** in SendGrid
3. **Warm up your sending reputation**:
   - Start with small volumes
   - Send to engaged recipients first
   - Monitor bounce rates and spam complaints
4. **Monitor deliverability**:
   - Check SendGrid's Email Activity Feed
   - Use tools like mail-tester.com to test

---

## Checking Your Email Score

Use these free tools to test your emails:

1. **Mail Tester**: https://www.mail-tester.com/
   - Send an email to their test address
   - Get a detailed spam score analysis

2. **SendGrid Email Activity**:
   - Dashboard → Activity → Email Activity
   - See delivery status and any issues

3. **Gmail Postmaster Tools**: https://postmaster.google.com/
   - Monitor your domain's reputation with Gmail

---

## Environment Variables Reference

```env
# Option 1: SendGrid with Custom Domain (Best)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-api-key
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=InterviewAI Pro

# Option 2: Gmail SMTP (Quick)
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=your-email@gmail.com
FROM_NAME=InterviewAI Pro

# Option 3: Development Only
EMAIL_PROVIDER=console
```
