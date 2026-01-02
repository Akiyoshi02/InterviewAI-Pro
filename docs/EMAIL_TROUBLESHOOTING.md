# Email Troubleshooting Guide

## Issue: Emails Not Sending When Rejecting Organizations

### ✅ Fixes Applied

1. **Updated `.env` file** with SendGrid configuration:
   - `EMAIL_PROVIDER=sendgrid`
   - `SENDGRID_API_KEY` (configured)
   - `FROM_EMAIL` and `FROM_NAME` (configured)

2. **Enhanced Error Handling**:
   - Added validation for owner email existence
   - Added detailed logging for email sending process
   - Improved error messages for debugging

3. **Improved SendGrid Integration**:
   - Better error handling and logging
   - More detailed error messages from SendGrid API

### 🔍 Common Issues & Solutions

#### Issue 1: "The from address does not match a verified Sender Identity"

**Problem**: SendGrid requires you to verify your sender email address.

**Solution**:
1. Log in to [SendGrid Dashboard](https://app.sendgrid.com)
2. Go to **Settings** → **Sender Authentication**
3. Click **"Verify a Single Sender"**
4. Fill in your email details:
   - Email: `noreply@interviewai.pro` (or your FROM_EMAIL)
   - From Name: `InterviewAI Pro`
   - Company: Your company name
   - Address: Your address
   - City, State, Zip: Your location
   - Country: Your country
5. Click **"Create"**
6. Check your email inbox and click the verification link
7. Once verified, restart your server

#### Issue 2: "Authentication failed" or "403 Forbidden"

**Problem**: API key is invalid or doesn't have the right permissions.

**Solution**:
1. Go to SendGrid Dashboard → **Settings** → **API Keys**
2. Check if your API key exists and is active
3. If needed, create a new API key with **"Full Access"** or **"Restricted Access"** with **"Mail Send"** permission
4. Update `SENDGRID_API_KEY` in your `.env` file
5. Restart your server

#### Issue 3: "Owner email not found"

**Problem**: The organization owner doesn't have an email address in the database.

**Solution**:
- Check the server logs for: `Owner {ownerId} does not have an email address`
- This means the user record in Firestore doesn't have an `email` field
- This is a data issue - the user needs to have an email in their profile

#### Issue 4: Emails going to spam

**Problem**: SendGrid emails might go to spam if sender isn't verified.

**Solution**:
- Verify your sender email (see Issue 1)
- Consider setting up Domain Authentication in SendGrid for better deliverability
- Use a professional email address (not a free email like Gmail)

### 📋 Verification Checklist

Before testing, ensure:

- [ ] `.env` file has `EMAIL_PROVIDER=sendgrid`
- [ ] `.env` file has `SENDGRID_API_KEY` set correctly
- [ ] `.env` file has `FROM_EMAIL` set (and it's verified in SendGrid)
- [ ] `.env` file has `FROM_NAME` set
- [ ] Server has been restarted after updating `.env`
- [ ] SendGrid sender email is verified
- [ ] SendGrid API key has "Mail Send" permissions

### 🧪 Testing Steps

1. **Check Server Logs on Startup**:
   Look for:
   ```
   ✅ SendGrid API key initialized successfully
   ```

2. **Test Organization Rejection**:
   - Log in as system admin
   - Go to Pending Approvals
   - Reject an organization with a reason
   - Check server logs for:
     ```
     📧 Sending email to user@example.com: Organization Application Update
     ✅ Email sent via SendGrid to user@example.com - Status: 202
     ✅ Rejection email sent successfully to user@example.com
     ```

3. **Check SendGrid Activity**:
   - Go to SendGrid Dashboard → **Activity**
   - You should see the email in the activity feed
   - Check if it was delivered, bounced, or blocked

4. **Check Recipient's Email**:
   - Check inbox (and spam folder)
   - Email should arrive within a few seconds

### 🔍 Debugging

If emails still aren't sending, check:

1. **Server Logs**:
   ```bash
   # Look for these log messages:
   - "📧 Sending email to..."
   - "✅ Email sent via SendGrid..."
   - "❌ SendGrid error:"
   - "⚠️  EMAIL_PROVIDER is set to sendgrid but SENDGRID_API_KEY is not configured"
   ```

2. **SendGrid Dashboard**:
   - Check **Activity** feed for email attempts
   - Check **Suppressions** for blocked emails
   - Check **Settings** → **API Keys** for key status

3. **Environment Variables**:
   ```bash
   # In your server directory, check if variables are loaded:
   node -e "require('dotenv').config(); console.log(process.env.EMAIL_PROVIDER, process.env.SENDGRID_API_KEY ? 'API Key Set' : 'API Key Missing')"
   ```

### 📞 Still Having Issues?

1. **Check SendGrid Status**: [status.sendgrid.com](https://status.sendgrid.com)
2. **Review SendGrid Documentation**: [docs.sendgrid.com](https://docs.sendgrid.com)
3. **Check Server Logs**: Look for detailed error messages
4. **Verify API Key**: Create a new API key if needed
5. **Test with Console Mode**: Set `EMAIL_PROVIDER=console` to see email content in logs

### 🎯 Quick Fix Commands

```bash
# Restart server after .env changes
cd server
npm run dev

# Check if SendGrid is initialized (look for ✅ in logs)
# Should see: "✅ SendGrid API key initialized successfully"

# Test rejection and watch logs
# Should see: "📧 Sending email to..." and "✅ Email sent via SendGrid..."
```

---

**Note**: After making any changes to `.env`, you **must restart your server** for the changes to take effect.

