# 🔐 Environment Variables Guide

Complete guide for environment variables needed for frontend and backend deployment.

---

## 🟢 Backend (Render)

### Required Environment Variables

#### 1. `DATABASE_URL` ✅ (Auto-set by Render)
- **What it is**: PostgreSQL database connection string
- **Format**: `postgresql://user:password@host:port/database`
- **How to set**: Automatically set when you link PostgreSQL database in Render
- **Manual setup** (if needed):
  - Go to Web Service → Environment tab
  - Add: `DATABASE_URL` = `postgresql://chatuser:password@host:port/chatdb`
  - Get value from: Database service → "Internal Database URL"

#### 2. `SECRET_KEY` ⚠️ (Recommended for Production)
- **What it is**: Secret key for JWT token signing
- **Default**: `"your-secret-key-change-in-production-please-use-a-random-string"`
- **How to generate**:
  ```python
  import secrets
  print(secrets.token_urlsafe(32))
  ```
  Or use: `openssl rand -hex 32`
- **How to set in Render**:
  - Go to Web Service → Environment tab
  - Add: `SECRET_KEY` = `your-generated-secret-key-here`
- **Why important**: Without this, tokens can be easily forged

#### 3. `ENCRYPTION_KEY` ⚠️ (Optional but Recommended)
- **What it is**: Key for encrypting messages
- **Default**: `"your-encryption-key-change-in-production"`
- **How to generate**: Same as SECRET_KEY
- **How to set**: Web Service → Environment → Add `ENCRYPTION_KEY`

#### 4. `ENCRYPTION_SALT` ⚠️ (Optional but Recommended)
- **What it is**: Salt for encryption
- **Default**: `"your-salt-change-in-production"`
- **How to generate**: Same as SECRET_KEY
- **How to set**: Web Service → Environment → Add `ENCRYPTION_SALT`

#### 5. `PYTHON_VERSION` ✅ (Already in render.yaml)
- **Value**: `3.13.0`
- **Status**: Already configured in `render.yaml`

---

## ⚡ Frontend (Vercel)

### Required Environment Variables

#### 1. `API_BASE_URL` ⚠️ (Required if frontend on Vercel, backend on Render)
- **What it is**: Backend API URL
- **Value**: Your Render backend URL (e.g., `https://your-app.onrender.com`)
- **How to set in Vercel**:
  1. Go to Project Settings → Environment Variables
  2. Add:
     - **Key**: `API_BASE_URL`
     - **Value**: `https://your-render-app.onrender.com`
     - **Environment**: Production, Preview, Development (select all)
  3. Click "Save"

#### 2. Update `app.js` to use environment variable:

**Current code** (line 20):
```javascript
const API_BASE = window.location.origin;
```

**Change to**:
```javascript
const API_BASE = import.meta.env.VITE_API_BASE_URL || 
                 process.env.API_BASE_URL || 
                 window.location.origin;
```

**OR** (simpler, for Vercel):
```javascript
// For Vercel, use environment variable
const API_BASE = (typeof process !== 'undefined' && process.env.API_BASE_URL) 
                 ? process.env.API_BASE_URL 
                 : window.location.origin;
```

**OR** (even simpler - create config):
```javascript
// Check if we're on Vercel (different origin) or same origin
const API_BASE = window.location.hostname.includes('vercel.app') 
                 ? 'https://your-render-app.onrender.com'  // Replace with your Render URL
                 : window.location.origin;
```

---

## 📋 Quick Setup Checklist

### Render (Backend)

- [ ] `DATABASE_URL` - ✅ Auto-set when linking database
- [ ] `SECRET_KEY` - ⚠️ Generate and add manually
- [ ] `ENCRYPTION_KEY` - ⚠️ Generate and add manually (optional)
- [ ] `ENCRYPTION_SALT` - ⚠️ Generate and add manually (optional)
- [ ] `PYTHON_VERSION` - ✅ Already in render.yaml

### Vercel (Frontend)

- [ ] `API_BASE_URL` - ⚠️ Add your Render backend URL
- [ ] Update `app.js` to use `API_BASE_URL` environment variable

---

## 🔧 How to Add Environment Variables

### On Render:

1. Go to your **Web Service** dashboard
2. Click **"Environment"** tab (left sidebar)
3. Click **"Add Environment Variable"**
4. Enter:
   - **Key**: `SECRET_KEY`
   - **Value**: `your-generated-key`
5. Click **"Save Changes"**
6. Service will automatically redeploy

### On Vercel:

1. Go to your **Project** dashboard
2. Click **"Settings"** tab
3. Click **"Environment Variables"** (left sidebar)
4. Click **"Add New"**
5. Enter:
   - **Key**: `API_BASE_URL`
   - **Value**: `https://your-render-app.onrender.com`
   - **Environment**: Select all (Production, Preview, Development)
6. Click **"Save"**
7. Redeploy your project

---

## 🔑 Generate Secure Keys

### Using Python:
```python
import secrets
print("SECRET_KEY:", secrets.token_urlsafe(32))
print("ENCRYPTION_KEY:", secrets.token_urlsafe(32))
print("ENCRYPTION_SALT:", secrets.token_urlsafe(32))
```

### Using OpenSSL (Terminal):
```bash
openssl rand -hex 32
```

### Using Online (less secure):
- Visit: https://generate-secret.vercel.app/32
- Copy the generated key

---

## ⚠️ Important Security Notes

1. **Never commit secrets to GitHub**
   - Use environment variables
   - Add `.env` to `.gitignore` (already done)

2. **Use different keys for production**
   - Don't use default values
   - Generate unique keys for each environment

3. **Rotate keys periodically**
   - Change SECRET_KEY every 6-12 months
   - Users will need to re-login after rotation

4. **Keep keys secure**
   - Don't share in screenshots
   - Don't post in public forums
   - Use Render/Vercel's secure environment variable storage

---

## 🎯 Recommended Setup

### Minimum (Works but less secure):
- ✅ `DATABASE_URL` (auto-set)
- ⚠️ `SECRET_KEY` (generate and add)

### Recommended (More secure):
- ✅ `DATABASE_URL` (auto-set)
- ✅ `SECRET_KEY` (generate and add)
- ✅ `ENCRYPTION_KEY` (generate and add)
- ✅ `ENCRYPTION_SALT` (generate and add)

### Frontend (If using Vercel):
- ✅ `API_BASE_URL` (your Render backend URL)

---

## 📝 Example Values (DO NOT USE THESE - Generate Your Own!)

```
SECRET_KEY=abc123xyz789  # ❌ Don't use - generate your own!
ENCRYPTION_KEY=def456uvw012  # ❌ Don't use - generate your own!
ENCRYPTION_SALT=ghi789rst345  # ❌ Don't use - generate your own!
API_BASE_URL=https://your-app.onrender.com  # ✅ Replace with your URL
```

---

## ✅ Verification

After setting environment variables:

1. **Check Render Logs**:
   - Should see: "Database initialized"
   - No errors about missing keys

2. **Test Frontend**:
   - Open browser console
   - Check network requests point to correct backend URL
   - Test login/registration

3. **Test Backend**:
   - Visit: `https://your-app.onrender.com/docs`
   - API should work correctly

---

**Need help?** Check deployment logs for specific error messages.
