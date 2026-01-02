# Verify Your Email in SendGrid - Step by Step

## Current Issue
Your `.env` file is set to use `akiyoshiyapa@gmail.com`, but:
1. This email needs to be verified in SendGrid first
2. Your server needs to be restarted to pick up the new .env value

## Steps to Fix (Do This Now)

### Step 1: Verify Email in SendGrid (5 minutes)

1. **Go to SendGrid Dashboard**:
   - Open: https://app.sendgrid.com
   - Log in with your SendGrid account

2. **Navigate to Sender Authentication**:
   - Click **"Settings"** in the left sidebar
   - Click **"Sender Authentication"**

3. **Verify Single Sender**:
   - Click the **"Verify a Single Sender"** button
   - Fill in the form:
     - **From Email**: `akiyoshiyapa@gmail.com`
     - **From Name**: `InterviewAI Pro`
     - **Reply To**: `akiyoshiyapa@gmail.com` (same as from email)
     - **Company**: Your company name (e.g., "InterviewAI Pro")
     - **Address**: Your address
     - **City**: Your city
     - **State**: Your state
     - **Zip**: Your zip code
     - **Country**: Your country
   - Click **"Create"**

4. **Check Your Email**:
   - Go to your Gmail inbox for `akiyoshiyapa@gmail.com`
   - Look for an email from SendGrid
   - Click the verification link in the email
   - You should see "Sender Verified" confirmation

### Step 2: Restart Your Server

After verifying the email, restart your server:

```bash
# Stop your current server (Ctrl+C)
# Then restart it:
cd server
npm run dev
```

### Step 3: Test Again

1. Go to your admin dashboard
2. Reject an organization
3. Check server logs - you should see:
   ```
   ✅ Email sent via SendGrid to user@example.com - Status: 202
   ```
4. Check the recipient's email inbox

## Verification Checklist

- [ ] Email `akiyoshiyapa@gmail.com` is verified in SendGrid
- [ ] Server has been restarted after .env change
- [ ] Server logs show "✅ SendGrid API key initialized successfully" on startup
- [ ] Test rejection shows success in logs

## If You Still Get Errors

1. **Check SendGrid Dashboard**:
   - Go to Settings → Sender Authentication
   - Make sure `akiyoshiyapa@gmail.com` shows as "Verified" (green checkmark)

2. **Check Server Logs**:
   - Look for the FROM_EMAIL being used
   - Should show: `📤 SendGrid: Preparing to send email from akiyoshiyapa@gmail.com`

3. **Double-check .env**:
   - Make sure `FROM_EMAIL=akiyoshiyapa@gmail.com` (no typos)
   - Make sure there are no extra spaces

4. **Wait a few minutes**:
   - Sometimes SendGrid verification takes a minute to propagate

## Quick Test

After verification and restart, the logs should show:
```
📤 SendGrid: Preparing to send email from akiyoshiyapa@gmail.com to user@example.com
✅ Email sent via SendGrid to user@example.com - Status: 202
✅ Rejection email sent successfully to user@example.com
```

If you see this, it's working! 🎉

