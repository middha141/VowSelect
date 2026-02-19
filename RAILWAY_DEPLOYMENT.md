# 🚂 Railway Deployment Guide — VowSelect

This guide walks you through deploying the **VowSelect backend** on [Railway](https://railway.app) and connecting it to **MongoDB Atlas** (recommended) for your database.

---

## 📋 Table of Contents

1. [MongoDB: Railway vs Atlas (Recommendation)](#-mongodb-railway-vs-atlas)
2. [Prerequisites](#-prerequisites)
3. [Step 1 — Prepare Your Repository](#step-1--prepare-your-repository)
4. [Step 2 — Create a Railway Project](#step-2--create-a-railway-project)
5. [Step 3 — Configure Environment Variables](#step-3--configure-environment-variables)
6. [Step 4 — Deploy the Backend](#step-4--deploy-the-backend)
7. [Step 5 — Update Frontend to Use Production URL](#step-5--update-frontend-to-use-production-url)
8. [Step 6 — Deploy Frontend (Optional)](#step-6--deploy-frontend-optional)
9. [Step 7 — Configure Google OAuth for Production](#step-7--configure-google-oauth-for-production)
10. [Troubleshooting](#-troubleshooting)

---

## 🗄️ MongoDB: Railway vs Atlas

### ✅ Recommendation: **Keep MongoDB on Atlas** (not Railway)

| Factor | MongoDB Atlas (Recommended) | MongoDB on Railway |
|--------|---------------------------|-------------------|
| **Free Tier** | 512 MB free forever (M0) | No free DB — uses your Railway credits |
| **Backups** | Automatic daily backups | You must configure manually |
| **Scaling** | Easy vertical/horizontal scaling | Limited to Railway container resources |
| **Monitoring** | Built-in performance advisor, charts | Basic logs only |
| **Uptime** | 99.995% SLA on paid tiers | Depends on Railway uptime |
| **Connection** | Works with Railway via connection string | Internal networking |
| **Cost** | Free for small apps, ~$9/mo for dedicated | ~$5-10/mo in Railway credits |

**Bottom line:** Your app already uses MongoDB Atlas — keep it there. Atlas gives you a better free tier, automatic backups, and a dedicated monitoring dashboard. Railway is best used just for running your Python backend.

---

## ✅ Prerequisites

- [Railway account](https://railway.app) (sign up with GitHub)
- Your code pushed to a **GitHub repository**
- **MongoDB Atlas** cluster already set up (you have this)
- Google Cloud OAuth credentials (for Google Drive features)

---

## Step 1 — Prepare Your Repository

Your repo should already have these files (created for you):

```
backend/
├── railway.json          # Railway build/deploy config
├── Procfile              # Process start command
├── runtime.txt           # Python version
├── requirements_clean.txt # Production dependencies
├── server.py             # Your FastAPI app
└── ...
```

### Verify `.gitignore` includes:
```
.env
.env.local
backend/.env
frontend/.env
```

> ⚠️ **Never commit `.env` files** — Railway has its own environment variable manager.

### Push to GitHub:
```bash
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

---

## Step 2 — Create a Railway Project

1. Go to [railway.app](https://railway.app) and log in
2. Click **"New Project"**
3. Select **"Deploy from GitHub Repo"**
4. Connect your GitHub account (if not already)
5. Select your **VowSelect** repository
6. Railway will auto-detect the project — **don't deploy yet**, configure variables first

### Set the Root Directory

Since the backend is in a subfolder:

1. Click on your service in the Railway dashboard
2. Go to **Settings** → **General**
3. Set **Root Directory** to: `backend`
4. Set **Watch Paths** to: `/backend/**`

---

## Step 3 — Configure Environment Variables

Go to your Railway service → **Variables** tab and add each variable:

### Required Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `MONGO_URL` | `mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority` | Your MongoDB Atlas connection string |
| `DB_NAME` | `vowselect` | Your database name |
| `PORT` | *(auto-set by Railway)* | Railway sets this automatically — **do not add** |

### Google OAuth Variables (for Drive import/export)

| Variable | Value | Description |
|----------|-------|-------------|
| `GOOGLE_CLIENT_ID` | `xxxx.apps.googleusercontent.com` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxx` | From Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://your-app.up.railway.app/api/auth/callback` | Must match your Railway URL |

### Optional Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `FRONTEND_URL` | `https://your-frontend-domain.com` | For strict CORS (leave unset for `*` during testing) |
| `DRIVE_BATCH_SIZE` | `10` | Photos per batch for Drive imports |
| `RAILWAY_ENVIRONMENT` | *(auto-set by Railway)* | Railway sets this — **do not add** |

### How to Add Variables in Railway

1. Click your service → **Variables** tab
2. Click **"+ New Variable"**
3. Enter the key and value
4. Repeat for each variable
5. Railway will **auto-redeploy** after saving

> 💡 **Tip:** You can also use **Raw Editor** to paste all variables at once in `KEY=VALUE` format.

---

## Step 4 — Deploy the Backend

1. After setting variables, go to **Deployments** tab
2. Click **"Deploy"** (or it may auto-deploy)
3. Watch the build logs for any errors
4. Once deployed, Railway gives you a public URL like:
   ```
   https://vowselect-backend-production.up.railway.app
   ```

### Verify the Deployment

Visit your Railway URL in a browser:
```
https://your-app.up.railway.app/api/
```

You should see:
```json
{"message": "VowSelect API", "version": "1.0"}
```

### Generate a Public Domain

1. Go to **Settings** → **Networking**
2. Click **"Generate Domain"** to get a `.up.railway.app` URL
3. Or add a **Custom Domain** if you have one

---

## Step 5 — Update Frontend to Use Production URL

Update your frontend `.env.local` file:

```env
# For production
EXPO_PUBLIC_BACKEND_URL=https://your-app.up.railway.app

# Keep local for development (comment/uncomment as needed)
# EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

---

## Step 6 — Deploy Frontend (Optional)

The Expo/React Native frontend can be deployed as a **web app** on Railway or other platforms:

### Option A: Vercel (Recommended for web frontend)
1. Push the frontend to GitHub
2. Import into [Vercel](https://vercel.com)
3. Set root directory to `frontend`
4. Add env variable: `EXPO_PUBLIC_BACKEND_URL=https://your-railway-backend-url.up.railway.app`
5. Deploy

### Option B: Railway (second service)
1. Add a new service in your Railway project
2. Point to same repo, set root directory to `frontend`
3. Set build command: `npx expo export:web`
4. Set start command: `npx serve dist`

### Option C: Mobile App Only
If you only need the native mobile app (iOS/Android), you don't need to deploy the frontend — just update the `.env.local` with your Railway backend URL and build with `expo build` or EAS Build.

---

## Step 7 — Configure Google OAuth for Production

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** → **Credentials**
3. Edit your OAuth 2.0 Client ID
4. Add your Railway URL to **Authorized redirect URIs**:
   ```
   https://your-app.up.railway.app/api/auth/callback
   ```
5. Add your frontend URL to **Authorized JavaScript origins**:
   ```
   https://your-frontend-domain.com
   ```
6. Save and update the `GOOGLE_REDIRECT_URI` variable in Railway

---

## 🔧 Troubleshooting

### Build Fails
- Check that **Root Directory** is set to `backend` in Railway settings
- Ensure `requirements_clean.txt` has all needed packages
- Check build logs for specific dependency errors

### MongoDB Connection Fails
- Verify `MONGO_URL` is correct in Railway variables
- In MongoDB Atlas → **Network Access**, add `0.0.0.0/0` to allow connections from anywhere (Railway IPs change)
- Ensure your Atlas cluster is **not paused** (free tier pauses after 60 days of inactivity)

### CORS Errors
- Set `FRONTEND_URL` in Railway to your exact frontend URL (e.g., `https://your-frontend.vercel.app`)
- During testing, leave `FRONTEND_URL` unset to allow all origins
- Make sure there's no trailing slash in the URL

### 500 Internal Server Error
- Check **Logs** in Railway dashboard for the full traceback
- Verify all required environment variables are set
- Test the `/api/` root endpoint first to confirm the server starts

### Port Issues
- **Do NOT** set `PORT` manually — Railway auto-assigns it
- The `railway.json` and `Procfile` already use `$PORT`

### Google OAuth Not Working
- Update `GOOGLE_REDIRECT_URI` to use your Railway URL
- Make sure the redirect URI in Railway matches exactly what's in Google Cloud Console
- Add Railway domain to authorized origins in Google Cloud Console

---

## 📊 Cost Estimate

Railway pricing (as of 2026):

| Tier | Cost | Includes |
|------|------|----------|
| **Hobby** | $5/month | 8 GB RAM, 8 vCPU, 100 GB bandwidth |
| **Pro** | $20/month | Team features, more resources |

MongoDB Atlas:

| Tier | Cost | Storage |
|------|------|---------|
| **M0 (Free)** | $0/month | 512 MB |
| **M2** | ~$9/month | 2 GB |
| **M10** | ~$57/month | 10 GB+ |

**For a small wedding app, Railway Hobby ($5/mo) + Atlas Free ($0) = $5/month total.**

---

## 🚀 Quick Deploy Checklist

- [ ] Code pushed to GitHub
- [ ] Railway project created, connected to repo
- [ ] Root directory set to `backend`
- [ ] `MONGO_URL` variable set in Railway
- [ ] `DB_NAME` variable set in Railway
- [ ] MongoDB Atlas Network Access allows `0.0.0.0/0`
- [ ] Deployment successful (check `/api/` endpoint)
- [ ] Frontend `.env.local` updated with Railway URL
- [ ] Google OAuth redirect URI updated (if using Drive features)
- [ ] `FRONTEND_URL` set in Railway (for production CORS)
