# 50-Minute Deployment Checklist ⏱️

**Goal**: Get to production in 50 minutes using ngrok

## ⏰ Time Budget

- [ ] Worker setup: 10 min
- [ ] Vercel deployment: 15 min
- [ ] Inngest setup: 10 min
- [ ] Testing: 10 min
- [ ] Buffer: 5 min

---

## Phase 1: Worker Setup (10 min) ⏱️

### Step 1: Install ngrok (if needed)
```bash
brew install ngrok
# Or download from https://ngrok.com/download
```

### Step 2: Configure Worker
```bash
cd worker
cp .env.example .env
```

Edit `worker/.env`:
```bash
DATABASE_URL="your-neon-postgres-connection"
WORKER_API_KEY="$(openssl rand -base64 32)"
```

**⚠️ SAVE THIS API KEY!** You'll need it for Vercel!

### Step 3: Install & Test
```bash
npm install
npm start
```

**✅ Checkpoint**: Should see:
```
[Worker] Server running on port 3001
```

### Step 4: Start ngrok (NEW TERMINAL)
```bash
ngrok http 3001
```

**✅ Checkpoint**: Copy the **Forwarding URL** (https://abc123.ngrok-free.app)

Test:
```bash
curl https://YOUR-NGROK-URL/health
# Should return: {"status":"ok",...}
```

**🎯 TIME CHECK: 10 minutes**

---

## Phase 2: Vercel Deployment (15 min) ⏱️

### Step 1: Push to GitHub (2 min)
```bash
git add .
git commit -m "Add Inngest + worker"
git push
```

### Step 2: Create Vercel Project (3 min)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your repo
3. **DON'T DEPLOY YET!**

### Step 3: Add Environment Variables (8 min)

**Required vars:**
```bash
DATABASE_URL="your-neon-pooled"
DIRECT_DATABASE_URL="your-neon-direct"
AUTH_SECRET="your-secret"
GOOGLE_CLIENT_ID="your-id"
GOOGLE_CLIENT_SECRET="your-secret"
NEXTAUTH_URL="https://your-app.vercel.app"  # Use Vercel's suggested URL
ANTHROPIC_API_KEY="your-key"
WORKER_URL="https://YOUR-NGROK-URL"  # From Phase 1 Step 4!
WORKER_API_KEY="your-api-key-from-phase-1"  # From Phase 1 Step 2!
```

**Skip for now (add later):**
```bash
INNGEST_EVENT_KEY=""  # We'll add this after Inngest setup
INNGEST_SIGNING_KEY=""  # We'll add this after Inngest setup
```

**✅ Checkpoint**: All env vars added except Inngest

### Step 4: Deploy (2 min)

Click **"Deploy"**

Wait for build to complete...

**✅ Checkpoint**: Vercel app is live!

**🎯 TIME CHECK: 25 minutes**

---

## Phase 3: Inngest Setup (10 min) ⏱️

### Step 1: Sign Up (3 min)

1. Go to [inngest.com](https://www.inngest.com/)
2. Sign up with GitHub
3. Create app (or use default)

### Step 2: Get Keys (2 min)

1. Settings → Keys
2. Copy **Event Key** (starts with `prod_`)
3. Copy **Signing Key** (starts with `signkey-prod-`)

### Step 3: Add to Vercel (3 min)

Go to Vercel → Your Project → Settings → Environment Variables

Add:
```bash
INNGEST_EVENT_KEY="prod_your_key"
INNGEST_SIGNING_KEY="signkey-prod-your_key"
```

Click **"Redeploy"** (top right)

### Step 4: Connect Inngest (2 min)

1. In Inngest: Apps → Serve → **"Add App URL"**
2. Enter: `https://your-app.vercel.app/api/inngest`
3. Click **"Save"**

**✅ Checkpoint**: Inngest shows "Connected" ✅

**🎯 TIME CHECK: 35 minutes**

---

## Phase 4: Testing (10 min) ⏱️

### Test 1: Worker Health (1 min)
```bash
curl https://YOUR-NGROK-URL/health
# ✅ Should return: {"status":"ok"}
```

### Test 2: App Loads (2 min)

1. Go to: `https://your-app.vercel.app`
2. Sign in with Google

**✅ Checkpoint**: Can sign in

### Test 3: Emails Load (2 min)

1. After sign in, should load your emails
2. Check they appear in the UI

**✅ Checkpoint**: Emails visible

### Test 4: Unsubscribe Works (5 min)

1. Click **"Unsubscribe"** on an email
2. Watch logs:
   - **Vercel logs**: Job enqueued ✅
   - **Inngest dashboard**: Function ran ✅
   - **Worker terminal**: Processing job ✅
3. Check job status in your app

**✅ Checkpoint**: Job completes successfully!

**🎯 TIME CHECK: 45 minutes**

---

## ✅ You're Live!

Your app is now:
- ✅ Running on Vercel
- ✅ Using Inngest for jobs
- ✅ Processing with local worker via ngrok
- ✅ Puppeteer works perfectly!

**🎯 TOTAL TIME: 45 minutes** (5 min buffer remaining!)

---

## Quick Reference

### If Something Breaks

**Worker not responding?**
```bash
# Restart worker
cd worker
npm start
```

**ngrok URL changed?**
1. Get new URL from ngrok terminal
2. Vercel → Env Vars → Update `WORKER_URL`
3. Redeploy

**Inngest not working?**
1. Check Inngest dashboard for errors
2. Verify keys in Vercel match Inngest
3. Check Apps → Serve shows "Connected"

### Monitoring

- **App**: https://your-app.vercel.app
- **Vercel Logs**: vercel.com → Your Project → Deployments
- **Inngest**: app.inngest.com
- **Worker**: Your terminal
- **ngrok**: http://localhost:4040

### Keep Running

**Important**: Keep these running:
1. Worker terminal
2. ngrok terminal

If you close them, restart with:
```bash
# Terminal 1
cd worker && npm start

# Terminal 2
ngrok http 3001
```

---

## Post-Launch

### Later: Migrate to Render

When you have time, follow `DEPLOYMENT.md` to move worker to Render.com.

### Prevent Mac Sleep

Keep worker running:
```bash
# System Settings → Energy → Prevent sleep when display is off
# Or: caffeinate -d
```

### Use PM2 for Auto-Restart

```bash
npm install -g pm2
cd worker
pm2 start index.js --name worker
pm2 startup
pm2 save
```

---

## 🎉 Congratulations!

You deployed a complex architecture with:
- Next.js on Vercel
- Inngest job orchestration
- Puppeteer worker via ngrok
- Full AI-powered automation

**In under 50 minutes!** ⚡
