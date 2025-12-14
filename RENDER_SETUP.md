# 🚀 Render Deployment Guide - Database Setup

## Option 1: Using render.yaml (Recommended - Automatic Setup)

If you're deploying using the `render.yaml` file (Render Blueprint), the database is configured automatically:

1. **Push your code to GitHub** (with the updated `render.yaml`)
2. **Go to Render Dashboard** → "New" → "Blueprint"
3. **Connect your GitHub repository**
4. **Render will automatically:**
   - Create a PostgreSQL database service (`chat-database`)
   - Create your web service (`chat-application`)
   - Link them together (DATABASE_URL will be set automatically)
   - Tables will be created on first startup

**✅ No manual configuration needed!** The database will work automatically.

---

## Option 2: Manual Setup (If not using Blueprint)

If you're creating services manually on Render:

### Step 1: Create PostgreSQL Database

1. Go to **Render Dashboard** → "New" → "PostgreSQL"
2. Fill in:
   - **Name**: `chat-database` (or any name you prefer)
   - **Database**: `chatdb`
   - **User**: `chatuser`
   - **Region**: Choose closest to your users
   - **Plan**: Free (or upgrade for production)
3. Click **"Create Database"**

### Step 2: Create Web Service

1. Go to **Render Dashboard** → "New" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `chat-application`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Step 3: Link Database to Web Service

1. In your **Web Service** settings, go to **"Environment"** tab
2. Click **"Link Database"** or **"Add Environment Variable"**
3. Select your PostgreSQL database (`chat-database`)
4. The `DATABASE_URL` will be automatically added

**OR manually add:**
- **Key**: `DATABASE_URL`
- **Value**: Copy the **"Internal Database URL"** from your database service

### Step 4: Verify Database Connection

1. Deploy your service
2. Check the logs - you should see: `"Database tables initialized (existing data preserved)"`
3. If you see errors, check that `DATABASE_URL` is set correctly

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Database service is running (green status)
- [ ] Web service is running (green status)
- [ ] `DATABASE_URL` environment variable is set in web service
- [ ] Application logs show "Database initialized" message
- [ ] You can register/login (this confirms database is working)

---

## 🔧 Troubleshooting

### Database Connection Errors

**Error**: `could not connect to server` or `connection refused`

**Solution**:
- Make sure you're using the **Internal Database URL** (not External)
- Verify the database service is running
- Check that `DATABASE_URL` environment variable is set correctly

### Tables Not Created

**Error**: `relation "users" does not exist`

**Solution**:
- Check application logs for initialization errors
- The `init_db()` function runs on startup automatically
- If tables aren't created, check for errors in the startup logs

### Data Not Persisting

**Problem**: Data disappears after restart

**Solution**:
- Make sure you're using PostgreSQL (not SQLite)
- Verify `DATABASE_URL` points to PostgreSQL
- Check that database service is not being deleted/recreated

---

## 📝 Important Notes

1. **Free Tier Limitations**: 
   - Render's free PostgreSQL database sleeps after 90 days of inactivity
   - Consider upgrading to a paid plan for production

2. **Database URL Format**:
   - Internal: `postgresql://user:password@hostname:5432/database`
   - Your app automatically detects PostgreSQL vs SQLite

3. **Automatic Table Creation**:
   - Tables are created automatically on first startup
   - No manual SQL scripts needed
   - Data persists across deployments

4. **Backup**:
   - Render provides automatic backups for paid plans
   - For free tier, consider manual backups if needed

---

## 🎯 Quick Start (Using Blueprint)

1. Push code to GitHub
2. Render Dashboard → New → Blueprint
3. Connect repository
4. Click "Apply" 
5. Wait for deployment
6. Done! Database is ready ✅
