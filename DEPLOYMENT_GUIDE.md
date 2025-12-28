# 🚀 Deployment Guide - Render & Vercel

Complete step-by-step guide to deploy your WhatsApp-like Chat Application.

---

## 📋 Table of Contents

1. [Deploy to Render (Backend + Database)](#deploy-to-render)
2. [Deploy to Vercel (Frontend)](#deploy-to-vercel)
3. [Full Stack Deployment (Render Backend + Vercel Frontend)](#full-stack-deployment)
4. [Troubleshooting](#troubleshooting)

---

## 🟢 Deploy to Render (Backend + Database)

Render is perfect for deploying your FastAPI backend with PostgreSQL database.

### Prerequisites
- GitHub account
- Render account (sign up at [render.com](https://render.com))
- Your code pushed to GitHub

### Step 1: Push Code to GitHub

```bash
# Make sure all changes are committed
git add .
git commit -m "Ready for deployment"
git push origin main
```

### Step 2: Deploy Using Blueprint (Recommended)

1. **Go to Render Dashboard**
   - Visit [dashboard.render.com](https://dashboard.render.com)
   - Sign in or create account

2. **Create New Blueprint**
   - Click **"New +"** button (top right)
   - Select **"Blueprint"**

3. **Connect GitHub Repository**
   - Click **"Connect account"** if not connected
   - Authorize Render to access your repositories
   - Select your repository: `ChattApp_mini_whatsup` (or your repo name)
   - Click **"Connect"**

4. **Review Blueprint Configuration**
   - Render will automatically detect `render.yaml`
   - You'll see:
     - ✅ PostgreSQL Database (`chat-database`)
     - ✅ Web Service (`chat-application`)
   - Review the configuration

5. **Apply Blueprint**
   - Click **"Apply"** button
   - Render will create both services automatically

6. **Wait for Deployment**
   - Database will be created first (~2 minutes)
   - Web service will build and deploy (~5-10 minutes)
   - Watch the logs for progress

7. **Get Your URL**
   - Once deployed, you'll see: `https://chattapp-mini-whatsup.onrender.com`
   - This is your live application URL!

### Step 3: Verify Deployment

1. **Check Services**
   - Go to Dashboard
   - You should see 2 services:
     - `chat-database` (PostgreSQL) - Green ✅
     - `chat-application` (Web Service) - Green ✅

2. **Test Your App**
   - Visit your URL
   - Register a new account
   - Send a message
   - Data should persist!

### Alternative: Manual Deployment (If Blueprint Doesn't Work)

#### Create Database Manually:

1. **New PostgreSQL**
   - Dashboard → "New +" → "PostgreSQL"
   - Name: `chat-database`
   - Database: `chatdb`
   - User: `chatuser`
   - Plan: Free
   - Click **"Create Database"**

2. **Get Database URL**
   - Click on your database
   - Copy the **"Internal Database URL"**

#### Create Web Service Manually:

1. **New Web Service**
   - Dashboard → "New +" → "Web Service"
   - Connect your GitHub repository
   - Select repository

2. **Configure Service**
   - **Name**: `chat-application`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

3. **Add Environment Variables**
   - Go to "Environment" tab
   - Click **"Link Database"**
   - Select `chat-database`
   - `DATABASE_URL` will be added automatically

4. **Deploy**
   - Click **"Create Web Service"**
   - Wait for deployment

---

## ⚡ Deploy to Vercel (Frontend Only)

Vercel is great for frontend deployment, but your FastAPI backend needs to be on Render.

### Option A: Deploy Frontend to Vercel (Backend on Render)

This setup:
- **Frontend**: Vercel (fast CDN, great performance)
- **Backend**: Render (handles WebSockets, database)

#### Step 1: Prepare for Vercel

1. **Create `vercel.json`** (in project root):

```json
{
  "version": 2,
  "builds": [
    {
      "src": "static/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/static/(.*)",
      "dest": "/static/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/static/index.html"
    }
  ]
}
```

2. **Update API Base URL** in `app.js`:

You'll need to point your frontend to your Render backend URL.

#### Step 2: Deploy to Vercel

1. **Install Vercel CLI** (optional, or use web interface):
   ```bash
   npm i -g vercel
   ```

2. **Deploy via Web Interface**:
   - Go to [vercel.com](https://vercel.com)
   - Sign in with GitHub
   - Click **"Add New Project"**
   - Import your GitHub repository
   - Configure:
     - **Framework Preset**: Other
     - **Root Directory**: `./` (or leave default)
   - Click **"Deploy"**

3. **Configure Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add: `API_BASE_URL` = `https://your-render-app.onrender.com`
   - Update your frontend code to use this

### Option B: Full Stack on Vercel (Serverless Functions)

Vercel supports Python serverless functions, but WebSockets require special handling.

**Note**: Vercel's serverless functions have limitations:
- ❌ WebSockets don't work well (timeout after 10 seconds)
- ❌ Long-running connections not supported
- ✅ Good for REST APIs only

**Recommendation**: Use Render for backend (supports WebSockets), Vercel for frontend only.

---

## 🔄 Full Stack Deployment (Recommended)

### Architecture:
- **Backend + Database**: Render (handles WebSockets, PostgreSQL)
- **Frontend**: Vercel (fast CDN, global distribution)

### Step-by-Step:

#### Part 1: Deploy Backend to Render

Follow the [Render deployment steps](#deploy-to-render) above.

**Get your Render URL**: `https://your-app.onrender.com`

#### Part 2: Update Frontend for Vercel

1. **Create `vercel.json`**:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "static/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/static/(.*)",
      "dest": "/static/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/static/index.html"
    }
  ],
  "env": {
    "API_BASE_URL": "https://your-app.onrender.com"
  }
}
```

2. **Update `app.js` to use environment variable**:

```javascript
// At the top of app.js, replace:
const API_BASE = window.location.origin;

// With:
const API_BASE = process.env.API_BASE_URL || window.location.origin;
```

**OR** create a config file that Vercel can inject.

3. **Deploy to Vercel**:
   - Connect GitHub repo
   - Deploy
   - Add environment variable: `API_BASE_URL` = your Render URL

---

## 🛠️ Troubleshooting

### Render Issues

**Problem**: Database not connecting
- **Solution**: Check `DATABASE_URL` environment variable is set
- Verify database service is running (green status)

**Problem**: Build fails
- **Solution**: Check `requirements.txt` has all dependencies
- Verify Python version matches (3.13.0)

**Problem**: WebSocket not working
- **Solution**: Render supports WebSockets on paid plans
- Free tier may have limitations
- Check WebSocket URL uses `wss://` (secure)

**Problem**: App sleeps after inactivity
- **Solution**: Free tier apps sleep after 15 minutes
- First request takes ~30 seconds to wake up
- Consider upgrading to paid plan

### Vercel Issues

**Problem**: API calls failing
- **Solution**: Check CORS settings on Render backend
- Verify `API_BASE_URL` is set correctly
- Check network tab for errors

**Problem**: Static files not loading
- **Solution**: Verify `vercel.json` routes are correct
- Check file paths in HTML

**Problem**: WebSocket not connecting
- **Solution**: Vercel serverless functions don't support WebSockets
- Must use Render or another service for WebSocket backend

---

## 📝 Post-Deployment Checklist

After deploying:

- [ ] Test user registration
- [ ] Test login
- [ ] Send a message
- [ ] Upload a file
- [ ] Test WebSocket (real-time messaging)
- [ ] Verify data persists (refresh page)
- [ ] Check mobile responsiveness
- [ ] Test on different browsers

---

## 🔗 Quick Links

- **Render Dashboard**: [dashboard.render.com](https://dashboard.render.com)
- **Vercel Dashboard**: [vercel.com/dashboard](https://vercel.com/dashboard)
- **Your Render App**: Check your Render dashboard
- **Your Vercel App**: Check your Vercel dashboard

---

## 💡 Pro Tips

1. **Use Render for Full Stack**: Easiest option, everything in one place
2. **Use Vercel for Frontend Only**: If you want faster CDN for static assets
3. **Monitor Logs**: Both platforms provide detailed logs
4. **Set Up Auto-Deploy**: Connect GitHub for automatic deployments
5. **Use Custom Domains**: Both platforms support custom domains

---

## 🎯 Recommended Setup

**For Beginners**: 
- ✅ Deploy everything to Render (simplest)

**For Performance**:
- ✅ Backend on Render
- ✅ Frontend on Vercel
- ✅ Connect them via environment variables

---

**Need Help?** Check the logs in your deployment dashboard for specific error messages.
