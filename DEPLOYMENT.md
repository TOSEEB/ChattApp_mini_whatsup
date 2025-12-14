# 🚀 Deployment Guide - Render

## Step-by-Step Deployment on Render

### Prerequisites
- GitHub account
- Render account (free at https://render.com)
- Your code pushed to GitHub

---

## Step 1: Prepare Your Code

### 1.1 Ensure all files are ready
- ✅ `requirements.txt` exists
- ✅ `main.py` is the entry point
- ✅ All code is committed to Git

### 1.2 Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit - Chat Application"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

---

## Step 2: Create Render Account

1. Go to https://render.com
2. Sign up with GitHub (recommended) or email
3. Verify your email if needed

---

## Step 3: Create New Web Service

1. **Click "New +"** button (top right)
2. **Select "Web Service"**
3. **Connect your GitHub repository:**
   - Click "Connect account" if not connected
   - Select your repository
   - Click "Connect"

---

## Step 4: Configure Service Settings

### Basic Settings:
- **Name**: `chat-application` (or any name you like)
- **Region**: Choose closest to you (e.g., `Oregon (US West)`)
- **Branch**: `main` (or your default branch)
- **Root Directory**: Leave empty (or `./` if needed)

### Build & Deploy:
- **Runtime**: `Python 3`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Environment Variables (Optional):
Click "Advanced" → "Add Environment Variable":
- `PYTHON_VERSION` = `3.13.0` (or `3.11.0` if 3.13 not available)
- `SECRET_KEY` = (generate a random secret key - optional)

### Plan:
- **Free Plan** is fine for portfolio/demo

---

## Step 5: Deploy

1. Click **"Create Web Service"**
2. Wait for build to complete (2-5 minutes)
3. Your app will be live at: `https://your-app-name.onrender.com`

---

## Step 6: Verify Deployment

1. Visit your app URL
2. Test registration/login
3. Test messaging features
4. Check logs if any issues

---

## Important Notes

### Database:
- SQLite works on Render, but data is **ephemeral** (resets on restart)
- For persistent data, use Render PostgreSQL (free tier available)

### File Uploads:
- `uploads/` folder is in `.gitignore`
- Files uploaded will be lost on restart
- For production, use cloud storage (AWS S3, Cloudinary, etc.)

### WebSocket:
- Render supports WebSockets on paid plans
- Free plan may have limitations
- Test WebSocket functionality after deployment

---

## Troubleshooting

### Build Fails:
- Check `requirements.txt` is correct
- Verify Python version compatibility
- Check build logs for errors

### App Crashes:
- Check logs in Render dashboard
- Verify `startCommand` is correct
- Ensure port uses `$PORT` environment variable

### 401 Errors:
- Database might be empty
- Register a new user first
- Check authentication endpoints

---

## Optional: Use PostgreSQL (Persistent Data)

1. Create PostgreSQL database in Render
2. Get connection string
3. Add environment variable: `DATABASE_URL` = (your PostgreSQL URL)
4. Update `app/database.py` to use PostgreSQL URL

---

## Your App URL Format:
```
https://your-app-name.onrender.com
```

---

**That's it! Your app is now live! 🎉**

