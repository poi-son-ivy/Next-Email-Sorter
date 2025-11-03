# Architecture: 100% Free Serverless + Background Worker

## The Problem We Solved

**Original Issue**: Vercel serverless has:
- ❌ 10-second timeout (Hobby tier)
- ❌ Chromium/Puppeteer doesn't work reliably
- ❌ Jobs would stop when function terminates

**Solution**: Hybrid architecture using 3 free services!

## The Solution

```
User Action (Unsubscribe Click)
        │
        ▼
┌────────────────────────────────────────┐
│       Vercel (Next.js App)             │
│   • Receives unsubscribe request      │
│   • Creates job in database            │
│   • Sends event to Inngest             │
│   Cost: $0/month (Free tier)           │
└────────────┬───────────────────────────┘
             │
             ▼
┌────────────────────────────────────────┐
│        Inngest (Orchestrator)          │
│   • Receives event                     │
│   • Calls worker API                   │
│   • Handles retries (up to 2x)         │
│   • Provides monitoring dashboard      │
│   Cost: $0/month (50k runs/month)      │
└────────────┬───────────────────────────┘
             │
             ▼
┌────────────────────────────────────────┐
│      Render.com (Worker)               │
│   • Receives job from Inngest          │
│   • Runs Puppeteer with full Chrome    │
│   • No timeout limits!                 │
│   • Updates database when complete     │
│   Cost: $0/month (750 hrs/month)       │
└────────────┬───────────────────────────┘
             │
             ▼
┌────────────────────────────────────────┐
│      Neon PostgreSQL (Database)        │
│   • Stores jobs and results            │
│   • Accessed by both Vercel & Worker   │
│   Cost: $0/month (512 MB storage)      │
└────────────────────────────────────────┘
```

## Why This Works

### 1. **Vercel** - UI & API
- Fast static site hosting
- No database logic in serverless functions
- Just creates jobs and sends events

### 2. **Inngest** - Reliable Orchestration
- Ensures jobs don't get lost
- Automatic retries on failure
- Provides monitoring dashboard
- Works with serverless (no persistent processes needed)

### 3. **Render.com** - Heavy Lifting
- Persistent process (not serverless!)
- Full Chrome/Puppeteer support
- No timeout limits
- Directly updates database

### 4. **Neon** - Shared Database
- Both Vercel and Worker access same database
- Real-time job status updates
- Serverless-friendly (connection pooling)

## Request Flow

### Step 1: User Clicks Unsubscribe

```typescript
// Frontend (Next.js)
POST /api/queue/enqueue
{
  "emailIds": ["email_123"]
}
```

### Step 2: Vercel Creates Job

```typescript
// app/api/queue/enqueue/route.ts
1. Create job in database (status: PENDING)
2. Send event to Inngest:
   inngest.send({
     name: "email/unsubscribe.requested",
     data: { jobId, emailId, userId }
   })
3. Return immediately (no waiting!)
```

### Step 3: Inngest Receives Event

```typescript
// lib/inngest/functions.ts (runs on Inngest)
1. Mark job as PROCESSING in database
2. Call worker API:
   POST https://worker.onrender.com/process
   { "jobId": "job_123" }
3. Return (worker processes in background)
```

### Step 4: Worker Processes Job

```typescript
// worker/index.js (runs on Render.com)
1. Receive HTTP request
2. Return 202 Accepted immediately
3. Process in background:
   - Launch Puppeteer
   - Navigate to unsubscribe URL
   - Take screenshot
   - Determine success
   - Update database (COMPLETED/FAILED)
```

### Step 5: User Sees Result

```typescript
// Frontend polls or Pusher real-time update
GET /api/queue/job/job_123
{
  "status": "COMPLETED",
  "result": {...}
}
```

## Key Design Decisions

### Why Not Run Puppeteer on Vercel?

❌ **Doesn't work**:
- Serverless timeout limits
- Chromium binaries are huge
- Memory constraints
- Cold start issues

### Why Not Just Use Inngest Functions?

❌ **Inngest functions still run on YOUR infrastructure**:
- They orchestrate, but code runs on Vercel
- Same timeout issues apply

### Why Render.com?

✅ **Perfect for this**:
- Free tier includes persistent processes
- Full Linux environment (Chrome works)
- No timeout limits
- 512 MB RAM (enough for Puppeteer)
- Sleeps after 15 min (acceptable for background jobs)

### Alternative: Railway

Could also use:
- **Railway** ($5 credit/month, ~500 hours)
- **Fly.io** (3 VMs free)

But Render.com has simpler setup!

## Monitoring & Debugging

### Local Development

**Terminal 1: Next.js**
```bash
npm run dev
# http://localhost:3000
```

**Terminal 2: Inngest Dev Server**
```bash
npx inngest-cli@latest dev
# http://localhost:8288
```

**Terminal 3: Worker**
```bash
cd worker && npm run dev
# http://localhost:3001
```

### Production Monitoring

1. **Vercel** - See API logs
   - vercel.com → Your Project → Logs

2. **Inngest** - See function executions
   - app.inngest.com → Functions tab
   - Real-time execution logs
   - Retry history

3. **Render** - See worker logs
   - render.com → Your Service → Logs
   - Watch Puppeteer processing live

4. **Database** - Query job status
   ```sql
   SELECT * FROM UnsubscribeJob
   WHERE status = 'PROCESSING'
   ORDER BY startedAt DESC;
   ```

## Failure Handling

### Scenario 1: Worker is Down

1. Inngest calls worker → gets error
2. Inngest retries (up to 2 times)
3. If all retries fail → mark job as FAILED
4. User notified to try again

### Scenario 2: Database Connection Lost

1. Worker catches error
2. Marks job as FAILED (if it can reconnect)
3. Job remains in PROCESSING state otherwise
4. Manual intervention needed (check logs)

### Scenario 3: Puppeteer Crash

1. Worker catches error in try/catch
2. Updates job status to FAILED
3. Error message stored in job record
4. User can retry

### Scenario 4: Render Sleeps (Free Tier)

1. First request after sleep takes ~30-60 seconds
2. Inngest waits (has longer timeout)
3. Subsequent requests are fast (stays warm)
4. Acceptable for background jobs!

## Cost Analysis

### Current Setup (Free)

| Service | Usage | Free Tier | Monthly Cost |
|---------|-------|-----------|--------------|
| Vercel | 10k unsubscribes | 100 GB | $0 |
| Inngest | 10k unsubscribes | 50k runs | $0 |
| Render | 24/7 uptime | 750 hours | $0 |
| Neon | 1M rows | 512 MB | $0 |
| **Total** | | | **$0** |

### If You Outgrow Free Tiers

**Scenario: 100k unsubscribes/month**

| Service | Paid Plan | Monthly Cost |
|---------|-----------|--------------|
| Vercel | Pro ($20) | $20 |
| Inngest | Growth ($29) | $29 |
| Render | Starter ($7) | $7 |
| Neon | Pro ($19) | $19 |
| **Total** | | **$75/month** |

Still very affordable!

### Alternative: All-in-One Solutions

**Heroku**: $7/month (basic dyno)
- But you'd need to self-host Next.js
- Less scalable than hybrid approach

**AWS Lambda + ECS**: Complex setup
- Lambda for API ($0-5/mo)
- ECS for worker ($10-20/mo)
- More expensive and harder to manage

**Our approach is best for small-to-medium scale!**

## Scaling Strategy

### Stage 1: Current (Free)
- 0-10k unsubscribes/month
- Cost: $0

### Stage 2: Light Usage
- 10k-50k unsubscribes/month
- Upgrade Render to Starter ($7) - no sleep
- Cost: $7/month

### Stage 3: Growing
- 50k-250k unsubscribes/month
- Upgrade Inngest to Growth ($29)
- Upgrade Render to Standard ($25)
- Cost: $54/month

### Stage 4: Scale
- 250k+ unsubscribes/month
- Multiple workers (horizontal scaling)
- Dedicated database
- Consider AWS/GCP for better pricing
- Cost: $200-500/month

## Security Considerations

### API Keys

- ✅ `WORKER_API_KEY` required for worker access
- ✅ Inngest signing key validates requests
- ✅ Database credentials in env vars only
- ✅ No API keys in code

### Network

- ✅ Worker only accepts POST to `/process`
- ✅ CORS configured properly
- ✅ HTTPS everywhere (Vercel + Render)

### Data

- ✅ No sensitive data in logs
- ✅ Screenshots stored as base64 (not files)
- ✅ Database uses SSL connections

## Alternatives Considered

### 1. Playwright on Vercel with @sparticuz/chromium

❌ **Tried, didn't work**:
- Binary file issues
- Still hit timeout limits
- Unreliable even with chromium-min

### 2. BrowserlessIO ($79/month)

✅ **Would work**, but not free:
- Managed browser service
- No timeout issues
- But costs money

### 3. Puppeteer on AWS Lambda

⚠️ **Possible, but complex**:
- Need to configure Lambda layers
- Cold start issues
- More expensive than Render
- Harder to debug

### 4. Background Jobs on Vercel with Vercel Cron

❌ **Doesn't solve core issue**:
- Still serverless
- Still has timeout
- Cron is for scheduling, not processing

## Conclusion

This architecture gives you:

✅ **100% free** for small scale
✅ **No timeout issues** (Render handles long jobs)
✅ **Reliable** (Inngest handles retries)
✅ **Scalable** (upgrade components independently)
✅ **Maintainable** (simple, well-documented)
✅ **Monitorable** (dashboards for everything)

Perfect for side projects and MVPs!
