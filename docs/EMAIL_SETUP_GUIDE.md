# Email Service Setup Guide

This guide explains how to configure free email services for InterviewAI Pro. The system supports multiple email providers, and you can choose the one that best fits your needs.

## 📧 Available Email Providers

### 1. **SendGrid** (Recommended - Easiest Setup)
- **Free Tier**: 100 emails/day forever
- **Best For**: Production use, reliable delivery
- **Setup Time**: ~5 minutes

### 2. **Gmail SMTP** (Free)
- **Free Tier**: Unlimited (with rate limits ~500/day)
- **Best For**: Development, small-scale production
- **Setup Time**: ~10 minutes

### 3. **Outlook SMTP** (Free)
- **Free Tier**: Unlimited (with rate limits)
- **Best For**: Development, small-scale production
- **Setup Time**: ~10 minutes

---

## 🚀 Option 1: SendGrid Setup (Recommended)

SendGrid is the easiest and most reliable option for production use.

### Step 1: Create SendGrid Account
1. Go to [https://sendgrid.com](https://sendgrid.com)
2. Click **"Start for Free"**
3. Sign up with your email address
4. Verify your email address

### Step 2: Create API Key
1. Log in to your SendGrid dashboard
2. Go to **Settings** → **API Keys**
3. Click **"Create API Key"**
4. Name it: `InterviewAI Pro`
5. Select **"Full Access"** or **"Restricted Access"** with Mail Send permissions
6. Click **"Create & View"**
7. **Copy the API key immediately** (you won't be able to see it again!)

### Step 3: Configure Environment Variables
Add to your `server/.env` file:

```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.your-api-key-here
FROM_EMAIL=your-verified-email@example.com
FROM_NAME=InterviewAI Pro
```

### Step 4: Verify Sender Email (Optional but Recommended)
1. In SendGrid dashboard, go to **Settings** → **Sender Authentication**
2. Click **"Verify a Single Sender"**
3. Fill in your email details
4. Check your email and click the verification link

### Step 5: Test
Restart your server and test by rejecting/approving an organization. Check the server logs for email sending confirmation.

---

## 📮 Option 2: Gmail SMTP Setup

Gmail SMTP is free and works well for development and small-scale production.

### Step 1: Enable 2-Factor Authentication
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** if not already enabled

### Step 2: Generate App Password
1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select **"Mail"** and **"Other (Custom name)"**
3. Enter: `InterviewAI Pro`
4. Click **"Generate"**
5. **Copy the 16-character password** (you'll need this)

### Step 3: Configure Environment Variables
Add to your `server/.env` file:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
FROM_EMAIL=your-email@gmail.com
FROM_NAME=InterviewAI Pro
```

### Step 4: Test
Restart your server and test by rejecting/approving an organization.

**Note**: Gmail has rate limits (~500 emails/day). For higher volume, use SendGrid.

---

## 📬 Option 3: Outlook SMTP Setup

Outlook SMTP is another free option similar to Gmail.

### Step 1: Configure Environment Variables
Add to your `server/.env` file:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-outlook-password
FROM_EMAIL=your-email@outlook.com
FROM_NAME=InterviewAI Pro
```

### Step 2: Test
Restart your server and test by rejecting/approving an organization.

---

## 🔧 Configuration Reference

### Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `EMAIL_PROVIDER` | Email provider to use | Yes | `sendgrid`, `smtp`, or `console` |
| `FROM_EMAIL` | Sender email address | Yes | `noreply@interviewai.pro` |
| `FROM_NAME` | Sender display name | Yes | `InterviewAI Pro` |
| `SENDGRID_API_KEY` | SendGrid API key | If using SendGrid | `SG.xxxxx` |
| `SMTP_HOST` | SMTP server hostname | If using SMTP | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | If using SMTP | `587` |
| `SMTP_SECURE` | Use TLS/SSL | If using SMTP | `false` (for port 587) |
| `SMTP_USER` | SMTP username | If using SMTP | `your-email@gmail.com` |
| `SMTP_PASS` | SMTP password | If using SMTP | `your-app-password` |

### Provider Comparison

| Provider | Free Tier | Setup Difficulty | Best For |
|----------|-----------|------------------|----------|
| **SendGrid** | 100/day forever | ⭐ Easy | Production |
| **Gmail SMTP** | ~500/day | ⭐⭐ Medium | Development/Small scale |
| **Outlook SMTP** | Unlimited* | ⭐⭐ Medium | Development/Small scale |
| **Console** | N/A | ⭐⭐⭐ Very Easy | Development only |

*Outlook has rate limits but they're not publicly documented

---

## 🧪 Testing Email Configuration

### Method 1: Test via Organization Rejection
1. Start your server
2. Log in as system admin
3. Go to Pending Approvals
4. Reject an organization with a reason
5. Check server logs for email sending confirmation
6. Check the organization owner's email inbox

### Method 2: Check Server Logs
When emails are sent, you'll see logs like:
```
INFO: Sending email to user@example.com: Organization Application Update
INFO: Email sent via SendGrid to user@example.com: 202
```

### Method 3: Console Mode (Development)
If `EMAIL_PROVIDER=console`, emails will be logged to the console instead of being sent. This is useful for development.

---

## ❓ Troubleshooting

### SendGrid Issues

**Error: "SENDGRID_API_KEY is not configured"**
- Make sure you've added `SENDGRID_API_KEY` to your `.env` file
- Restart your server after adding the key

**Error: "The from address does not match a verified Sender Identity"**
- Verify your sender email in SendGrid dashboard
- Go to Settings → Sender Authentication → Verify a Single Sender

**Emails not being delivered**
- Check SendGrid Activity Feed in dashboard
- Verify your API key has "Mail Send" permissions
- Check spam folder

### SMTP Issues

**Error: "Invalid login"**
- For Gmail: Make sure you're using an App Password, not your regular password
- For Outlook: Make sure your password is correct
- Check that 2FA is enabled (for Gmail)

**Error: "Connection timeout"**
- Check your firewall/network settings
- Verify SMTP_HOST and SMTP_PORT are correct
- Try SMTP_PORT=465 with SMTP_SECURE=true

**Error: "Rate limit exceeded"**
- Gmail limits to ~500 emails/day
- Switch to SendGrid for higher volume
- Wait 24 hours for rate limit to reset

### General Issues

**Emails not sending at all**
- Check `EMAIL_PROVIDER` is set correctly
- Verify all required environment variables are set
- Check server logs for error messages
- Make sure you've restarted the server after changing `.env`

**Emails going to spam**
- Verify your sender email domain (SendGrid)
- Use a professional FROM_EMAIL address
- Include proper email templates (already implemented)

---

## 📚 Additional Resources

- [SendGrid Documentation](https://docs.sendgrid.com/)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
- [Nodemailer Documentation](https://nodemailer.com/about/)
- [SMTP Server List](https://www.arclab.com/en/kb/email/list-of-smtp-and-pop3-servers-mailserver-list.html)

---

## 🎯 Quick Start (SendGrid - Recommended)

1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Create API key in Settings → API Keys
3. Add to `server/.env`:
   ```env
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=SG.your-key-here
   FROM_EMAIL=your-email@example.com
   FROM_NAME=InterviewAI Pro
   ```
4. Run `npm install` in the `server` directory
5. Restart your server
6. Done! 🎉

---

## 💡 Tips

- **For Development**: Use `EMAIL_PROVIDER=console` to see emails in logs without sending
- **For Production**: Use SendGrid for reliability and better deliverability
- **For Testing**: Use Gmail SMTP with a test account
- **Rate Limits**: Be aware of daily limits, especially with Gmail
- **Security**: Never commit `.env` files with real API keys to git

---

## ✅ Verification Checklist

- [ ] Email provider configured in `.env`
- [ ] All required environment variables set
- [ ] Dependencies installed (`npm install`)
- [ ] Server restarted after configuration
- [ ] Test email sent successfully
- [ ] Email received in inbox (not spam)
- [ ] Server logs show successful email sending

---

**Need Help?** Check the server logs for detailed error messages, or refer to the troubleshooting section above.

