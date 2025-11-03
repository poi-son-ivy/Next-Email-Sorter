# Deployment Guide

This application uses a hybrid architecture for reliable background job processing:

## Architecture Overview

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   Vercel    │      │   Inngest    │      │   Render.com    │
│  (Next.js)  │─────>│  (Free Tier) │─────>│     Worker      │
│   Free      │      │ Orchestrator │      │   (Free Tier)   │
└─────────────┘      └──────────────┘      └─────────────────┘
      │                                              │
      └──────────────────┬───────────────────────────┘
                         ▼
                  ┌──────────────┐
                  │  Neon DB     │
                  │ (Postgres)   │
                  └──────────────┘
```

**Why this architecture?**
- ✅ **100% Free** - All services have generous free tiers
- ✅ **No Timeouts** - Worker runs on Render with no Vercel limits
- ✅ **Puppeteer Works** - Full Chrome on Render.com
- ✅ **Reliable** - Inngest handles retries and orchestration
- ✅ **Scalable** - Can upgrade any component independently

## Step 1: Deploy to Vercel (Your Next.js App)

### 1.1 Connect GitHub Repository

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Vercel will auto-detect Next.js

### 1.2 Add Environment Variables

Add these in Vercel → Settings → Environment Variables:

```bash
# Database
DATABASE_URL="your-neon-postgres-pooled-connection"
DIRECT_DATABASE_URL="your-neon-postgres-direct-connection"

# NextAuth
AUTH_SECRET="generate-with: openssl rand -base64 32"
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"
NEXTAUTH_URL="https://your-app.vercel.app"

# Inngest (get from inngest.com after signup)
INNGEST_EVENT_KEY="prod_your_event_key"
INNGEST_SIGNING_KEY="signkey-prod-your_signing_key"

# Worker (will get after deploying to Render)
WORKER_URL="https://your-worker.onrender.com"
WORKER_API_KEY="generate-a-secure-random-string"

# Pusher (optional, for real-time updates)
NEXT_PUBLIC_PUSHER_KEY="your-pusher-key"
PUSHER_SECRET="your-pusher-secret"
PUSHER_APP_ID="your-pusher-app-id"
```

### 1.3 Deploy

Click **"Deploy"** - Vercel will build and deploy your app.

## Step 2: Set Up Inngest (Job Orchestration)

### 2.1 Sign Up

1. Go to [inngest.com](https://www.inngest.com/)
2. Sign up with GitHub (free, no credit card)
3. Create a new app or use default

### 2.2 Get Your Keys

1. In Inngest dashboard, go to **Settings** → **Keys**
2. Copy **Event Key** (starts with `prod_`)
3. Copy **Signing Key** (starts with `signkey-prod-`)

### 2.3 Add Keys to Vercel

Add these to Vercel environment variables:
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`

### 2.4 Connect Inngest to Your App

1. In Inngest dashboard, go to **Apps** → **Serve**
2. Click **"Add App URL"**
3. Enter: `https://your-app.vercel.app/api/inngest`
4. Click **Save**

Inngest will automatically sync your functions!

## Step 3: Deploy Worker to Render.com

### 3.1 Sign Up for Render

1. Go to [render.com](https://render.com)
2. Sign up with GitHub (free)

### 3.2 Create New Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Render will detect `render.yaml`

### 3.3 Configure the Service

Render auto-configures from `render.yaml`, but verify:

- **Name**: `email-sorter-worker`
- **Runtime**: Node
- **Build Command**: `cd worker && npm install && npx prisma generate`
- **Start Command**: `cd worker && npm start`
- **Plan**: Free

### 3.4 Add Environment Variables

In Render → Environment:

```bash
# Database (same as Vercel)
DATABASE_URL="your-neon-postgres-pooled-connection"

# Worker API Key (generate a secure random string)
WORKER_API_KEY="use-same-value-as-in-vercel"
```

**Important:** Use the **same** `WORKER_API_KEY` in both Vercel and Render!

### 3.5 Deploy

Click **"Create Web Service"** - Render will deploy your worker.

Once deployed, copy the URL (e.g., `https://your-worker.onrender.com`)

### 3.6 Update Vercel

Go back to Vercel → Environment Variables and add:

```bash
WORKER_URL="https://your-worker.onrender.com"
```

Then redeploy your Vercel app.

## Step 4: Test the Integration

### 4.1 Test Worker Health

Visit: `https://your-worker.onrender.com/health`

You should see:
```json
{
  "status": "ok",
  "timestamp": "2024-01-..."
}
```

### 4.2 Test Full Flow

1. Go to your app: `https://your-app.vercel.app`
2. Sign in and load emails
3. Click "Unsubscribe" on an email
4. Check:
   - Vercel logs: Job enqueued
   - Inngest dashboard: Function executed
   - Render logs: Worker processing job
   - Your app: Job status updates

## Local Development

### Terminal 1: Next.js App
```bash
npm run dev
```

### Terminal 2: Inngest Dev Server
```bash
npx inngest-cli@latest dev
```

### Terminal 3: Worker
```bash
cd worker
npm install
cp .env.example .env
# Edit .env with your local DATABASE_URL
npm run dev
```

Then:
- App: http://localhost:3000
- Inngest: http://localhost:8288
- Worker: http://localhost:3001

## Monitoring & Logs

### Vercel
- Go to vercel.com → Your Project → Logs
- See API requests and Inngest events

### Inngest
- Go to app.inngest.com
- See function executions, retries, failures

### Render
- Go to render.com → Your Service → Logs
- See Puppeteer processing in real-time

## Troubleshooting

### Jobs Not Processing

1. **Check Inngest connection**
   - Inngest dashboard → Apps → Check if connected
   - Verify `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` in Vercel

2. **Check Worker**
   - Visit `https://your-worker.onrender.com/health`
   - Check Render logs for errors
   - Verify `DATABASE_URL` is correct

3. **Check API Key**
   - Ensure `WORKER_API_KEY` matches in both Vercel and Render

### Puppeteer Errors on Render

Render includes full Chrome - it should "just work". If issues:

1. Check Render logs for specific error
2. Verify build completed successfully
3. Try redeploying

### Database Connection Errors

- Ensure using **pooled connection string** (not direct)
- Verify IP allowlist in Neon (should allow all IPs: `0.0.0.0/0`)
- Check Prisma schema is synced (`npx prisma generate`)

## Cost Breakdown

| Service | Tier | Cost | Limits |
|---------|------|------|--------|
| Vercel | Free | $0 | 100GB bandwidth, 6000 build minutes |
| Inngest | Free | $0 | 50,000 runs/month |
| Render | Free | $0 | 750 hours/month, sleeps after 15min inactivity |
| Neon | Free | $0 | 512 MB storage, 10 branches |
| **Total** | | **$0/month** | Perfect for side projects! |

### Render Free Tier Notes

- Service sleeps after 15 minutes of inactivity
- First request after sleep takes ~30-60 seconds
- For instant response, upgrade to $7/month (optional)

## Scaling (When You Outgrow Free Tiers)

### When to upgrade:
- More than 50k unsubscribes/month → Inngest paid ($29/mo for 250k)
- Need instant worker response → Render paid ($7/mo)
- More storage → Neon paid ($19/mo for 10GB)

You can upgrade each service independently!

## Support

- **Inngest**: [Discord](https://www.inngest.com/discord) - Very responsive!
- **Render**: [docs.render.com](https://docs.render.com) - Excellent docs
- **Vercel**: [vercel.com/docs](https://vercel.com/docs)
