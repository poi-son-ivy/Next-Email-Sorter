# Quick Deploy with ngrok (50 minutes to production!)

This guide gets you running in production in 50 minutes using your local machine with ngrok.

## Why This Works

- ✅ **No Render deployment issues** - runs locally
- ✅ **Full Puppeteer support** - your machine has Chrome
- ✅ **Fast setup** - 15 minutes total
- ✅ **Reliable** - direct control over worker
- ⚠️ **Requirement**: Keep your machine running

## Step 1: Setup Worker Locally (5 minutes)

### 1.1 Install ngrok

```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

### 1.2 Configure Worker

```bash
cd worker
cp .env.example .env
```

Edit `worker/.env`:
```bash
DATABASE_URL="your-neon-postgres-pooled-connection"
WORKER_API_KEY="$(openssl rand -base64 32)"  # Generate secure key
PORT=3001
```

**Save the WORKER_API_KEY - you'll need it for Vercel!**

### 1.3 Install Dependencies

```bash
npm install
```

## Step 2: Start Worker + ngrok (2 minutes)

### Option A: Use Startup Script (Recommended)

```bash
cd worker
./start-worker.sh
```

The script will:
- ✅ Check dependencies
- ✅ Start worker
- ✅ Start ngrok
- ✅ Show you the public URL

**Copy the ngrok URL** (looks like: `https://abc123.ngrok-free.app`)

### Option B: Manual Start

Terminal 1 (Worker):
```bash
cd worker
npm start
```

Terminal 2 (ngrok):
```bash
ngrok http 3001
```

Copy the **Forwarding URL** from ngrok output.

## Step 3: Deploy to Vercel (10 minutes)

### 3.1 Push Code to GitHub

```bash
git add .
git commit -m "Add Inngest + worker setup"
git push
```

### 3.2 Create Vercel Project

1. Go to [vercel.com](https://vercel.com)
2. Click **"New Project"**
3. Import your GitHub repo
4. Vercel auto-detects Next.js

### 3.3 Add Environment Variables

In Vercel → Settings → Environment Variables, add:

```bash
# Database
DATABASE_URL="your-neon-postgres-pooled-connection"
DIRECT_DATABASE_URL="your-neon-postgres-direct-connection"

# Auth
AUTH_SECRET="your-auth-secret"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
NEXTAUTH_URL="https://your-app.vercel.app"

# AI
ANTHROPIC_API_KEY="your-anthropic-key"

# Inngest (leave empty for now - we'll add after Inngest setup)
INNGEST_EVENT_KEY=""
INNGEST_SIGNING_KEY=""

# Worker (YOUR NGROK URL!)
WORKER_URL="https://YOUR-NGROK-URL.ngrok-free.app"
WORKER_API_KEY="the-key-you-generated-in-step-1.2"

# Pusher (optional)
NEXT_PUBLIC_PUSHER_KEY="your-pusher-key"
PUSHER_SECRET="your-pusher-secret"
PUSHER_APP_ID="your-pusher-app-id"
```

### 3.4 Deploy

Click **"Deploy"** - takes ~3 minutes

## Step 4: Setup Inngest (5 minutes)

### 4.1 Sign Up

1. Go to [inngest.com](https://www.inngest.com/)
2. Sign up with GitHub (free, no CC)
3. Create app (or use default)

### 4.2 Get Keys

1. Settings → Keys
2. Copy **Event Key** (starts with `prod_`)
3. Copy **Signing Key** (starts with `signkey-prod-`)

### 4.3 Add to Vercel

Go back to Vercel → Environment Variables:

```bash
INNGEST_EVENT_KEY="prod_your_key_here"
INNGEST_SIGNING_KEY="signkey-prod-your_key_here"
```

Click **"Save"** then **"Redeploy"**

### 4.4 Connect Inngest

1. In Inngest dashboard → Apps → Serve
2. Click **"Add App URL"**
3. Enter: `https://your-app.vercel.app/api/inngest`
4. Click **"Save"**

Inngest will sync your functions automatically!

## Step 5: Test Everything (5 minutes)

### 5.1 Test Worker

```bash
curl https://your-ngrok-url.ngrok-free.app/health
```

Should return:
```json
{"status":"ok","timestamp":"..."}
```

### 5.2 Test Full Flow

1. Go to your Vercel app: `https://your-app.vercel.app`
2. Sign in with Google
3. Load some emails
4. Click **"Unsubscribe"** on an email

**Watch it work:**
- Vercel logs: Job enqueued
- Inngest dashboard: Function executed
- Worker terminal: Processing job
- Your app: Status updates!

## Monitoring

### Worker Logs

Watch your terminal where worker is running:
```
[Worker] Processing job cm123456789
[Worker] Opening browser for: https://...
[Worker] Job cm123456789 completed: SUCCESS
```

### Inngest Dashboard

Go to [app.inngest.com](https://app.inngest.com):
- See all function runs
- View execution logs
- Check for failures

### ngrok Dashboard

Open [http://localhost:4040](http://localhost:4040):
- See all HTTP requests to worker
- Inspect request/response details
- Great for debugging!

## Keeping Worker Running

### During Development

Just keep the terminal open! If you close it:

```bash
cd worker
./start-worker.sh
```

Update `WORKER_URL` in Vercel if ngrok URL changes.

### Production Options

#### Option 1: Keep Mac Running (Simplest)

- Keep your Mac awake
- Worker runs 24/7
- Free!

**Prevent Mac from sleeping:**
```bash
# Terminal
caffeinate -d
```

Or: System Settings → Energy → Prevent sleep

#### Option 2: PM2 Process Manager

Make it resilient:

```bash
npm install -g pm2
cd worker
pm2 start index.js --name email-worker
pm2 startup  # Auto-start on reboot
pm2 save
```

Now worker survives restarts!

#### Option 3: Deploy to Render Later

When Render is working, follow `DEPLOYMENT.md` to migrate off local machine.

## Troubleshooting

### ngrok URL Changes

If you restart ngrok, URL changes. Update Vercel:

1. Get new URL from ngrok
2. Vercel → Environment Variables → `WORKER_URL`
3. Update value
4. Redeploy

### Worker Not Receiving Requests

Check:
1. ✅ Worker running? (`curl http://localhost:3001/health`)
2. ✅ ngrok running? (Visit ngrok dashboard: `http://localhost:4040`)
3. ✅ `WORKER_URL` in Vercel matches ngrok URL?
4. ✅ `WORKER_API_KEY` matches in both places?

### Inngest Not Calling Worker

1. Check Inngest dashboard for errors
2. Verify app is connected: Apps → Serve
3. Check `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` in Vercel

### Puppeteer Errors

Your local machine has Chrome, so it should work! If issues:

```bash
# Install dependencies (macOS)
brew install chromium

# Test Puppeteer
cd worker
node -e "const p = require('puppeteer'); p.launch().then(b => b.close()).then(() => console.log('✅ Works!'))"
```

## Costs

- ✅ Vercel: Free
- ✅ Inngest: Free (50k runs/month)
- ✅ ngrok: Free
- ✅ Your Mac: Electricity only (~$5/month)
- **Total: ~$5/month**

## Later: Migrate to Render

When you want to move off your local machine:

1. Follow `DEPLOYMENT.md` for Render setup
2. Deploy worker to Render
3. Update `WORKER_URL` in Vercel to Render URL
4. Stop local worker + ngrok
5. Done!

No code changes needed!

## Quick Reference

### Start Everything

```bash
# Terminal 1: Worker + ngrok
cd worker
./start-worker.sh

# Terminal 2: Next.js (for local dev)
npm run dev

# Terminal 3: Inngest (for local dev)
npx inngest-cli@latest dev
```

### URLs

- **App**: https://your-app.vercel.app
- **Worker**: https://your-ngrok-url.ngrok-free.app
- **Inngest**: https://app.inngest.com
- **ngrok Dashboard**: http://localhost:4040

### Environment Variables Checklist

Vercel needs:
- ✅ `DATABASE_URL`
- ✅ `AUTH_SECRET`
- ✅ `GOOGLE_CLIENT_ID`
- ✅ `GOOGLE_CLIENT_SECRET`
- ✅ `INNGEST_EVENT_KEY`
- ✅ `INNGEST_SIGNING_KEY`
- ✅ `WORKER_URL` (your ngrok URL!)
- ✅ `WORKER_API_KEY`
- ✅ `ANTHROPIC_API_KEY`

Worker `.env` needs:
- ✅ `DATABASE_URL`
- ✅ `WORKER_API_KEY` (same as Vercel!)

## You're Done! 🎉

Your app is now:
- ✅ Running on Vercel (UI + API)
- ✅ Using Inngest (job orchestration)
- ✅ Processing with local worker (Puppeteer)
- ✅ 100% functional!

Time to deploy: **~25 minutes** ⚡
