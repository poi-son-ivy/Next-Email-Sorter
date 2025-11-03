# Inngest Setup Guide

This application uses [Inngest](https://www.inngest.com/) for reliable background job processing with no serverless timeout limits.

## Why Inngest?

- ✅ **100% Free** - 50,000 function runs/month on free tier
- ✅ **No Timeout Issues** - Functions can run for hours
- ✅ **Built-in Puppeteer Support** - Runs browser automation on their infrastructure
- ✅ **Automatic Retries** - Failed jobs retry automatically
- ✅ **Throttling** - Built-in concurrency control (we use max 3 concurrent jobs)
- ✅ **No Credit Card Required**

## Setup Instructions

### 1. Sign Up for Inngest

1. Go to [inngest.com](https://www.inngest.com/)
2. Sign up with GitHub (free, no credit card)
3. Create a new app or use the default one

### 2. Get Your Event Key

1. In Inngest dashboard, go to **Settings** → **Keys**
2. Copy your **Event Key** (starts with `test_` for development)
3. You'll also see a **Signing Key** - copy that too

### 3. Add Environment Variables

Add these to your `.env` file:

```bash
# Inngest Configuration (Optional - works without in dev mode)
INNGEST_EVENT_KEY=test_your_event_key_here
INNGEST_SIGNING_KEY=signkey-test-your_signing_key_here
```

**Note:** Inngest works in development mode without keys! They're only required for production.

### 4. Run Inngest Dev Server (Local Development)

In a **separate terminal**, run:

```bash
npx inngest-cli@latest dev
```

This starts the Inngest Dev Server at `http://localhost:8288`

### 5. Start Your Next.js App

```bash
npm run dev
```

The Inngest Dev Server will automatically detect your functions at:
- `http://localhost:3000/api/inngest`

### 6. Test It Out!

1. Go to your app and trigger an unsubscribe
2. Open `http://localhost:8288` to see the Inngest dashboard
3. Watch your jobs process in real-time with full logs!

## Deploy to Production

### 1. Deploy to Vercel

```bash
git push
```

Vercel will automatically deploy your app.

### 2. Connect Inngest to Vercel

1. In Inngest dashboard, go to **Apps** → **Your App** → **Serve**
2. Click **Add App URL**
3. Enter: `https://your-app.vercel.app/api/inngest`
4. Click **Save**

### 3. Add Environment Variables to Vercel

In Vercel dashboard:
1. Go to **Settings** → **Environment Variables**
2. Add your production keys from Inngest:
   - `INNGEST_EVENT_KEY` (starts with `prod_`)
   - `INNGEST_SIGNING_KEY` (starts with `signkey-prod-`)

### 4. Redeploy

Vercel will auto-deploy, or trigger manually.

## How It Works

1. User clicks "Unsubscribe" in your app
2. Job is created in database with status `PENDING`
3. Inngest event `email/unsubscribe.requested` is sent
4. **Inngest runs the job on their infrastructure** (not Vercel!)
5. Puppeteer automation runs with no timeout
6. Job status updated in database
7. User notified via Pusher

## Monitoring

### Local Development
- Open `http://localhost:8288` to see Inngest Dev Server
- View real-time logs, retries, and function runs

### Production
- Go to [app.inngest.com](https://app.inngest.com)
- View **Functions** tab for execution logs
- Set up alerts for failures

## Throttling & Concurrency

Current settings in `lib/inngest/functions.ts`:
```typescript
throttle: {
  limit: 3,
  period: "1m", // Max 3 concurrent unsubscribes per minute
}
```

Adjust as needed based on your usage.

## Cost

- **Free Tier:** 50,000 runs/month
- Perfect for personal projects and small apps
- No credit card required

## Troubleshooting

### Functions not showing in Inngest Dev Server

1. Make sure Dev Server is running: `npx inngest-cli@latest dev`
2. Check that your Next.js app is running
3. Visit `http://localhost:8288` and check if the app is connected

### Jobs not processing

1. Check Inngest dashboard for errors
2. Verify environment variables are set correctly
3. Check database for job status

### Puppeteer issues on Inngest

Inngest supports Puppeteer natively - it should "just work"! If you see issues:
1. Check function logs in Inngest dashboard
2. Verify `@sparticuz/chromium-min` is installed
3. File a support ticket (Inngest support is excellent!)

## Additional Resources

- [Inngest Documentation](https://www.inngest.com/docs)
- [Inngest Quickstart](https://www.inngest.com/docs/quick-start)
- [Inngest Discord](https://www.inngest.com/discord) - Very responsive community!
