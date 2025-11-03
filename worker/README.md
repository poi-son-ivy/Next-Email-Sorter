# Background Worker for Email Sorter

This is a standalone Node.js worker that processes unsubscribe jobs with Puppeteer.

## Why a Separate Worker?

Vercel has limitations:
- ❌ 10-second timeout for Hobby tier
- ❌ Chromium binaries are challenging in serverless
- ❌ Memory limits

Render.com solves all these:
- ✅ No timeout limits
- ✅ Full Chrome/Puppeteer support
- ✅ 512 MB RAM (Free tier)
- ✅ Persistent processes
- ✅ 100% Free!

## How It Works

1. **Inngest** sends job to this worker via HTTP
2. **Worker** processes with Puppeteer (full browser automation)
3. **Worker** updates database directly when done
4. User sees real-time updates via Pusher

## Local Development

### Install Dependencies

```bash
cd worker
npm install
```

### Set Up Environment

```bash
cp .env.example .env
```

Edit `.env`:
```bash
DATABASE_URL="your-postgres-connection-string"
WORKER_API_KEY="change-me"
PORT=3001
```

### Generate Prisma Client

```bash
npx prisma generate
```

### Start Worker

```bash
npm start
```

Worker runs on: http://localhost:3001

### Test Health Check

```bash
curl http://localhost:3001/health
```

### Test Job Processing

```bash
curl -X POST http://localhost:3001/process \
  -H "Content-Type: application/json" \
  -H "X-API-Key: change-me" \
  -d '{"jobId": "some-job-id"}'
```

## Deploy to Render.com

### Option 1: Automatic (Recommended)

Push to GitHub - Render will auto-deploy using `render.yaml` from root directory.

### Option 2: Manual

1. Create new Web Service on Render
2. Connect GitHub repo
3. Set:
   - **Build Command**: `cd worker && npm install && npx prisma generate`
   - **Start Command**: `cd worker && npm start`
   - **Plan**: Free
4. Add environment variables:
   - `DATABASE_URL`
   - `WORKER_API_KEY`
5. Deploy!

## API Endpoints

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

### `POST /process`

Process an unsubscribe job.

**Headers:**
- `Content-Type: application/json`
- `X-API-Key: your-worker-api-key`

**Request Body:**
```json
{
  "jobId": "cm123456789"
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Job accepted for processing",
  "jobId": "cm123456789"
}
```

Job processes in background - check database for status updates.

## Monitoring

### Logs

On Render.com:
1. Go to your service
2. Click **Logs** tab
3. Watch Puppeteer processing in real-time!

### Database

Job status updates in real-time:
- `PENDING` → Job created
- `PROCESSING` → Worker picked it up
- `COMPLETED` → Success!
- `FAILED` → Error occurred
- `NEEDS_CONFIRMATION` → Manual verification needed

## Troubleshooting

### Worker Not Responding

Check Render logs for:
```
[Worker] Server running on port 10000
```

If not seeing this, check:
1. Build logs for errors
2. DATABASE_URL is correct
3. Prisma generation succeeded

### Puppeteer Errors

Render includes Chrome - it should "just work". If issues:

```
Error: Failed to launch the browser process
```

Solution: Redeploy service (Render may need to reinstall dependencies)

### Database Connection Errors

```
Error: Can't reach database server
```

Solutions:
1. Use **pooled connection** URL from Neon
2. Verify Neon allows connections from `0.0.0.0/0`
3. Check DATABASE_URL has correct format

### API Key Mismatch

```
401 Unauthorized
```

Ensure `WORKER_API_KEY` matches in:
- Worker environment (Render)
- Vercel environment variables

## Performance

### Free Tier Limits

- **Cold Start**: ~30-60 seconds after sleep
- **Warm Response**: <1 second
- **Processing Time**: 10-60 seconds per job
- **Concurrent Jobs**: Handled one at a time (queued)

### Scaling

To handle more load:
1. Upgrade to Render Starter ($7/mo) - no sleep
2. Or deploy multiple workers
3. Or upgrade to higher tier for more memory/CPU

## Security

- ✅ API key authentication required
- ✅ CORS headers configured
- ✅ No public endpoints (except /health)
- ✅ Secure database connections

**Important:** Keep `WORKER_API_KEY` secret!

## Dependencies

- `puppeteer` - Full Chrome browser automation
- `@prisma/client` - Database ORM
- `dotenv` - Environment variables

No frameworks needed - just Node.js + HTTP server!
