# Admin Setup After Fresh Firebase
## Creating the First System Admin When Firebase Is Empty

**Use case:** You deleted everything in Firebase (Auth users, Firestore data, Realtime Database). This guide walks you through creating the **first system admin** so you can manage the platform. All other accounts (candidates, companies, recruiters) are created through the app’s normal registration and sign-up flows.

---

## Prerequisites

- [x] Firebase project is empty (Auth, Firestore, Realtime DB cleared)
- [x] Backend server is running (`npm run dev` in `server/`)
- [x] `ADMIN_SETUP_TOKEN` is set in `server/.env` (you already have this)

---

## Step 1: Get Your Admin Setup Token

Your setup token is in **`server/.env`**:

```bash
ADMIN_SETUP_TOKEN=WoMgiAd_GRf90SV0c6mfKEbuihcNpHQgk0DYEQUJMXDAFqJPloqQEfclbwE9-6q3
```

Copy this value. You will send it in the request header in the next step.

---

## Step 2: Create the First System Admin (One API Call)

Use the **bootstrap-admin** endpoint. It will:

1. Create a new user in **Firebase Authentication** (email + password)
2. Create/update the user in **Firestore** with `accountType: SYSTEM_ADMIN`
3. Add the admin to **Realtime Database** (`/admins/{uid}`)
4. Initialize system settings and audit log as needed

### Option A: Using PowerShell

```powershell
$token = "WoMgiAd_GRf90SV0c6mfKEbuihcNpHQgk0DYEQUJMXDAFqJPloqQEfclbwE9-6q3"
$body = @{
  email    = "your-admin@example.com"
  password = "YourSecurePassword123!"
  fullName = "System Administrator"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/admin/auth/bootstrap-admin" `
  -Method POST `
  -Headers @{ "x-admin-setup-token" = $token; "Content-Type" = "application/json" } `
  -Body $body
```

Replace:

- `your-admin@example.com` with the email you want for the admin account  
- `YourSecurePassword123!` with a strong password (min 6 characters)  
- `System Administrator` with the display name you want  

### Option B: Using curl (Windows Git Bash / WSL)

```bash
curl -X POST "http://localhost:3000/api/admin/auth/bootstrap-admin" \
  -H "x-admin-setup-token: WoMgiAd_GRf90SV0c6mfKEbuihcNpHQgk0DYEQUJMXDAFqJPloqQEfclbwE9-6q3" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"your-admin@example.com\",\"password\":\"YourSecurePassword123!\",\"fullName\":\"System Administrator\"}"
```

Again, replace the email, password, and full name with your values.

### Option C: Using Postman / Insomnia

1. **Method:** POST  
2. **URL:** `http://localhost:3000/api/admin/auth/bootstrap-admin`  
3. **Headers:**
   - `x-admin-setup-token`: `WoMgiAd_GRf90SV0c6mfKEbuihcNpHQgk0DYEQUJMXDAFqJPloqQEfclbwE9-6q3`
   - `Content-Type`: `application/json`
4. **Body (raw JSON):**
   ```json
   {
     "email": "your-admin@example.com",
     "password": "YourSecurePassword123!",
     "fullName": "System Administrator"
   }
   ```

---

## Step 3: Check the Response

**Success (201 Created):**

```json
{
  "success": true,
  "message": "System admin created successfully",
  "user": {
    "id": "<firebase-uid>",
    "email": "your-admin@example.com",
    "accountType": "SYSTEM_ADMIN",
    "fullName": "System Administrator"
  },
  "credentials": {
    "email": "your-admin@example.com",
    "uid": "<firebase-uid>",
    "note": "You can now log in with this email and password"
  }
}
```

You can now log in to the **frontend** with this email and password. That user will have system admin access.

**If you get 403 "Invalid setup token":**  
- Check that `ADMIN_SETUP_TOKEN` in `server/.env` matches exactly what you send in `x-admin-setup-token` (no extra spaces or quotes).

**If you get 503 "Admin bootstrap is not configured":**  
- Add `ADMIN_SETUP_TOKEN=...` to `server/.env` and restart the server.

**If you get 429 (rate limit):**  
- Bootstrap is limited to 3 attempts per 24 hours. Wait or use a different IP/env if needed.

---

## Step 4: Log In as Admin

1. Open your app (e.g. `http://localhost:4028` or wherever the frontend runs).
2. Log in with the **email** and **password** you used in the bootstrap request.
3. You should see the system admin dashboard and be able to manage organizations, users, and platform settings.

---

## Other Accounts (Candidates, Companies, etc.)

You do **not** need to create these via API or scripts:

| Account type | How it’s created |
|-------------|-------------------|
| **Candidates** | Sign up via the app (e.g. “Sign up as candidate”). |
| **Organisation admin / Company** | Register organisation via the app; first user becomes org admin. |
| **Recruiters / Reviewers** | Invited by org admin (team invitations) or added as members to the organisation. |

So after you have created the **first system admin** with the steps above, everyone else can be created through normal registration and invitation flows in the system.

---

## Optional: Add Another System Admin Later

After at least one system admin exists, you can create more system admins in two ways:

### 1. Bootstrap again (creates a new Firebase user)

Call the same **bootstrap-admin** endpoint again with a **new** email/password.  
You must send the same `x-admin-setup-token` header. If your backend requires an authenticated admin for this path, log in as an existing system admin and send the Firebase ID token in the `Authorization` header as well (depending on how `optionalAuth` is used).

### 2. Promote an existing user (seed-admin)

If the user **already exists** in Firebase Auth (e.g. they signed up as a candidate or org user), you can promote them to system admin:

```bash
POST /api/admin/auth/seed-admin
Header: x-admin-setup-token: <your-token>
Body: { "email": "existing-user@example.com", "fullName": "Another Admin" }
```

This sets their Firestore `accountType` to `SYSTEM_ADMIN` and adds them to the Realtime Database admin list. They do not need a new password; they keep their current one.

---

## Quick Reference

| Item | Value |
|------|--------|
| Endpoint | `POST http://localhost:3000/api/admin/auth/bootstrap-admin` |
| Auth | Header `x-admin-setup-token` = value of `ADMIN_SETUP_TOKEN` from `.env` |
| Body | `email`, `password` (min 6 chars), `fullName` (optional) |
| Rate limit | 3 attempts per 24 hours per IP |

After one successful call, you have a system admin and can use the app normally for all other accounts.
