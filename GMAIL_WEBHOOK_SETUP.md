# Gmail Push Notification Setup Guide

This guide explains how to set up Gmail push notifications using Google Cloud Pub/Sub for **true real-time email processing**.

## What We've Built

✅ **Pusher Channels Integration** - Real-time updates to frontend
✅ **Gmail Webhook Endpoint** - Receives push notifications from Gmail
✅ **History-based Email Fetching** - Only processes NEW emails (not existing ones)
✅ **Auto-Archive** - Archives emails in Gmail after processing
✅ **Watch API** - Starts monitoring Gmail accounts

## How It Works

1. User clicks "Start Watching" on account card
2. System calls Gmail watch API and stores current historyId
3. Gmail sends push notification when new email arrives
4. Webhook fetches ONLY new emails (using historyId)
5. Email stored in database
6. Email archived in Gmail
7. Pusher pushes to frontend → UI updates instantly!

## Next Step: Automatic Push Notifications

To make emails appear automatically when they arrive in Gmail, you need to:

### 1. Enable Gmail API in Google Cloud Console

1. Go to https://console.cloud.google.com/apis/library
2. Search for "Gmail API"
3. Click "Enable" (if not already enabled)

### 2. Create Pub/Sub Topic

1. Go to https://console.cloud.google.com/cloudpubsub/topic/list
2. Click "CREATE TOPIC"
3. Topic ID: `gmail-notifications`
4. Click "CREATE"

### 3. Grant Gmail Permission to Pub/Sub Topic

Run this command in Cloud Shell or your terminal:

```bash
gcloud pubsub topics add-iam-policy-binding gmail-notifications \
  --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
  --role=roles/pubsub.publisher
```

### 4. Create Push Subscription

1. In the Pub/Sub console, click on your `gmail-notifications` topic
2. Click "CREATE SUBSCRIPTION"
3. Subscription ID: `gmail-push-subscription`
4. Delivery type: **Push**
5. Endpoint URL: `https://your-domain.com/api/webhooks/gmail` (use ngrok for local dev)
6. Click "CREATE"

### 5. Add Environment Variable

Add to your `.env` file:

```
GMAIL_PUBSUB_TOPIC=projects/YOUR_PROJECT_ID/topics/gmail-notifications
```

Replace `YOUR_PROJECT_ID` with your Google Cloud project ID.

### 6. Start Watching Gmail Inbox

Once the webhook is set up, you can call the watch API:

```bash
POST /api/emails/watch
{
  "accountId": "account-id-here"
}
```

This tells Gmail to send notifications to your webhook when new emails arrive.

## Architecture

```
Gmail receives email
  ↓
Gmail pushes notification to Pub/Sub
  ↓
Pub/Sub calls your webhook (/api/webhooks/gmail)
  ↓
Webhook fetches new emails via Gmail API
  ↓
Emails stored in database
  ↓
Pusher pushes to frontend
  ↓
UI updates in real-time! ⚡
```

## For Local Development

Use **ngrok** to expose your local server:

```bash
ngrok http 3000
```

Then use the ngrok URL as your push endpoint:
`https://abc123.ngrok.io/api/webhooks/gmail`

## Testing

1. Set up the webhook endpoint
2. Start watching an account's inbox
3. Send a test email to that Gmail account
4. Watch it appear in your UI within seconds! 🎉

## Notes

- Gmail watch expires after 7 days - you'll need to renew it
- You can watch multiple accounts by calling watch API for each
- Pub/Sub is free for the first 10GB per month
- This setup works great for demo/interview projects!
