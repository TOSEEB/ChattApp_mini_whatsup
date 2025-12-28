# 📊 Database Status Check

## ⚠️ Current Situation

If you **didn't set up a database** on Render, here's what's happening:

### What's Currently Happening:
- Your app is using **SQLite** (default fallback)
- Data is stored in a file called `chat.db` 
- **❌ PROBLEM**: This file is stored in the container's filesystem
- **❌ DATA WILL BE LOST** when:
  - The server restarts
  - You redeploy
  - The container is recreated
  - After 90 days of inactivity (free tier)

## ✅ Solution: Set Up PostgreSQL Database

You have **2 options**:

---

## Option 1: Use Blueprint (Easiest - Recommended)

If you deploy using the `render.yaml` file (Blueprint method):

1. **Go to Render Dashboard** → "New" → "Blueprint"
2. **Connect your GitHub repository**
3. **Click "Apply"**
4. **Render will automatically:**
   - ✅ Create PostgreSQL database
   - ✅ Link it to your web service
   - ✅ Set DATABASE_URL automatically
   - ✅ Data will persist forever

**No manual setup needed!**

---

## Option 2: Manual Setup

If you already deployed manually:

### Step 1: Create Database
1. Go to **Render Dashboard** → "New" → "PostgreSQL"
2. Fill in:
   - **Name**: `chat-database`
   - **Database**: `chatdb`
   - **User**: `chatuser`
   - **Plan**: Free (or upgrade for production)
3. Click **"Create Database"**

### Step 2: Link to Web Service
1. Go to your **Web Service** settings
2. Click **"Environment"** tab
3. Click **"Link Database"** or **"Add Environment Variable"**
4. Select your PostgreSQL database
5. The `DATABASE_URL` will be automatically added

### Step 3: Redeploy
- Your service will automatically redeploy
- Tables will be created on startup
- Data will now persist! ✅

---

## 🔍 How to Check if Database is Set Up

### Method 1: Check Render Dashboard
1. Go to your Render Dashboard
2. Look for a **PostgreSQL** service (green status)
3. If you see it → Database is set up ✅
4. If you don't see it → Database is NOT set up ❌

### Method 2: Check Environment Variables
1. Go to your **Web Service** → "Environment" tab
2. Look for `DATABASE_URL`
3. If it starts with `postgresql://` → PostgreSQL is set up ✅
4. If it's missing or starts with `sqlite://` → Using SQLite (data will be lost) ❌

### Method 3: Check Application Logs
1. Go to your **Web Service** → "Logs" tab
2. Look for startup messages
3. If you see: `"Database tables initialized"` → Database is working ✅
4. If you see errors about database connection → Database not set up ❌

---

## 📝 What Data is Stored

The database stores:
- ✅ User accounts (username, email, passwords)
- ✅ All messages (text, files, images)
- ✅ Conversations (1-on-1 chats)
- ✅ Rooms (group chats)
- ✅ File uploads metadata
- ✅ Message status (sent, delivered, read)

**Without a database, ALL of this data is lost on every restart!**

---

## 🚨 Important Notes

1. **Free Tier Limitation**: 
   - Render's free PostgreSQL database sleeps after 90 days of inactivity
   - First request after sleep takes ~30 seconds to wake up
   - Consider upgrading for production use

2. **SQLite on Render = Data Loss**:
   - SQLite files are stored in ephemeral filesystem
   - They disappear on every deployment
   - **Never use SQLite for production on cloud platforms**

3. **Backup**:
   - Render provides automatic backups for paid plans
   - Free tier: Consider manual backups if needed

---

## ✅ Quick Fix

**If you haven't set up the database yet:**

1. **Easiest**: Delete your current web service and redeploy using Blueprint
2. **Or**: Create PostgreSQL database manually and link it (see Option 2 above)

**Your data will start persisting immediately after setup!**
