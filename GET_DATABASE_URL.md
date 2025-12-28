# 🔗 How to Get DATABASE_URL for Production (Render)

Step-by-step guide to find your PostgreSQL database connection URL.

---

## Method 1: Automatic (Recommended - Easiest)

If you used the **Blueprint** method with `render.yaml`:

✅ **DATABASE_URL is automatically set!**

1. Go to your **Web Service** (`chat-application`)
2. Click **"Environment"** tab
3. You'll see `DATABASE_URL` already listed
4. **You don't need to do anything** - it's already configured!

---

## Method 2: Manual - Find Database URL

If you created the database manually or want to see the URL:

### Step 1: Go to Your Database Service

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Find your **PostgreSQL** service (named `chat-database` or similar)
3. Click on it to open the database dashboard

### Step 2: Find the Connection String

You'll see several connection options:

#### Option A: Internal Database URL (For Web Service)
1. Scroll down to **"Connections"** section
2. Look for **"Internal Database URL"**
3. It looks like:
   ```
   postgresql://chatuser:password@dpg-xxxxx-a.oregon-postgres.render.com:5432/chatdb
   ```
4. **This is what you need!** Copy this URL

#### Option B: External Database URL (For Local Tools)
- Only use if you need to connect from outside Render
- Format is similar but uses different hostname

### Step 3: Use the URL

**If using Blueprint (render.yaml):**
- ✅ Already linked automatically
- No action needed

**If deploying manually:**
1. Go to your **Web Service**
2. Click **"Environment"** tab
3. Click **"Link Database"** button
4. Select your PostgreSQL database
5. `DATABASE_URL` will be added automatically

**OR manually add:**
1. Click **"Add Environment Variable"**
2. Key: `DATABASE_URL`
3. Value: Paste the **Internal Database URL** you copied
4. Click **"Save Changes"**

---

## Method 3: Link Database (Easiest Manual Method)

### Step 1: Go to Web Service

1. Open your **Web Service** (`chat-application`)
2. Click **"Environment"** tab (left sidebar)

### Step 2: Link Database

1. Look for **"Link Database"** or **"Link Resource"** button
2. Click it
3. A dropdown will show available databases
4. Select your PostgreSQL database (`chat-database`)
5. Click **"Link"** or **"Save"**

### Step 3: Verify

1. `DATABASE_URL` will appear in your environment variables
2. It will be automatically set to the correct value
3. Your service will redeploy automatically

---

## 📋 What the DATABASE_URL Looks Like

### Format:
```
postgresql://username:password@hostname:port/database_name
```

### Example:
```
postgresql://chatuser:abc123xyz@dpg-xxxxx-a.oregon-postgres.render.com:5432/chatdb
```

### Breakdown:
- `postgresql://` - Protocol
- `chatuser` - Database username
- `abc123xyz` - Database password
- `dpg-xxxxx-a.oregon-postgres.render.com` - Hostname
- `5432` - Port (PostgreSQL default)
- `chatdb` - Database name

---

## 🔍 Where to Find It in Render Dashboard

### Visual Guide:

```
Render Dashboard
├── Services
    ├── chat-database (PostgreSQL) ← Click here
    │   └── Scroll to "Connections" section
    │       └── "Internal Database URL" ← Copy this
    │
    └── chat-application (Web Service) ← Or go here
        └── Environment tab
            └── "Link Database" button ← Click to auto-link
                └── Select chat-database
                    └── DATABASE_URL auto-added ✅
```

---

## ✅ Verification Checklist

After setting up DATABASE_URL:

- [ ] Go to Web Service → Environment tab
- [ ] See `DATABASE_URL` in the list
- [ ] Value starts with `postgresql://`
- [ ] Check logs - should see "Database initialized"
- [ ] Test app - register/login should work
- [ ] Data persists after refresh

---

## 🚨 Important Notes

1. **Internal vs External URL:**
   - **Internal Database URL**: Use this for your Web Service (same network)
   - **External Database URL**: Only for connecting from outside Render

2. **Security:**
   - Never share your DATABASE_URL publicly
   - It contains your database password
   - Render automatically masks it in the UI (shows as `***`)

3. **Auto-Linking:**
   - If you used Blueprint, it's already linked
   - Manual linking is easier than copying/pasting

4. **If You See SQLite:**
   - If `DATABASE_URL` shows `sqlite:///./chat.db`
   - This means database is NOT linked
   - Follow Method 3 to link it

---

## 🆘 Troubleshooting

### Problem: Can't find DATABASE_URL

**Solution:**
- Check if database service exists (green status)
- If not, create PostgreSQL database first
- Then link it to web service

### Problem: DATABASE_URL shows SQLite

**Solution:**
- Database is not linked
- Go to Web Service → Environment → Link Database
- Select your PostgreSQL database

### Problem: Connection errors

**Solution:**
- Verify database service is running (green)
- Check you're using Internal Database URL (not External)
- Make sure database name matches

---

## 📝 Quick Reference

**Easiest Method:**
1. Web Service → Environment tab
2. Click "Link Database"
3. Select your database
4. Done! ✅

**Manual Method:**
1. Database service → Copy Internal Database URL
2. Web Service → Environment → Add `DATABASE_URL`
3. Paste URL → Save

---

**Need more help?** Check your Render dashboard logs for specific error messages.
