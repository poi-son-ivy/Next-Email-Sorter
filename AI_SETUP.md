# AI Setup Guide

This guide will walk you through setting up AI providers for the email categorization feature.

## Overview

The application uses AI to automatically categorize incoming emails. We support two providers:

1. **Anthropic (Primary)** - Uses Claude models for superior email understanding
2. **OpenAI (Fallback)** - Automatically used if Anthropic is unavailable

## Getting API Keys

### 1. Anthropic API Key (Recommended Primary)

**Steps:**

1. Go to [https://console.anthropic.com](https://console.anthropic.com)
2. Sign up for an account or log in
3. Navigate to **Settings** → **API Keys** or go directly to [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
4. Click **"Create Key"**
5. Give it a name (e.g., "Email Sorter App")
6. Copy the API key (it starts with `sk-ant-`)

**Pricing:**
- Claude 3.5 Sonnet: ~$3 per million input tokens, ~$15 per million output tokens
- Free credits available for new accounts

**Add to your `.env` file:**
```bash
ANTHROPIC_API_KEY=sk-ant-api03-xxx...
```

### 2. OpenAI API Key (Fallback)

**Steps:**

1. Go to [https://platform.openai.com](https://platform.openai.com)
2. Sign up for an account or log in
3. Navigate to **API Keys** or go directly to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
4. Click **"Create new secret key"**
5. Give it a name (e.g., "Email Sorter Fallback")
6. Copy the API key (it starts with `sk-`)

**Pricing:**
- GPT-4o-mini: ~$0.15 per million input tokens, ~$0.60 per million output tokens
- Requires adding a payment method

**Add to your `.env` file:**
```bash
OPENAI_API_KEY=sk-xxx...
```

## Configuration

### Minimum Setup (Anthropic Only)

For the best experience, you only need the Anthropic key:

```bash
ANTHROPIC_API_KEY=sk-ant-api03-xxx...
```

### Recommended Setup (Both Providers)

For maximum reliability with automatic fallback:

```bash
ANTHROPIC_API_KEY=sk-ant-api03-xxx...
OPENAI_API_KEY=sk-xxx...
```

### OpenAI Only (Not Recommended)

If you prefer to only use OpenAI:

```bash
OPENAI_API_KEY=sk-xxx...
```

The system will automatically skip Anthropic and use OpenAI directly.

## How It Works

### Automatic Fallback Logic

1. **Primary Attempt**: The system tries Anthropic first if the API key is configured
2. **Error Handling**: If Anthropic fails (API down, rate limit, network issue), it automatically falls back
3. **Fallback Attempt**: OpenAI is used as the backup provider
4. **Error**: If both providers fail, an error is returned

### Models Used

- **Anthropic**: `claude-3-5-sonnet-20241022` (can be customized)
- **OpenAI**: `gpt-4o-mini` (can be customized)

### Logging

The system logs which provider is being used:

```
[AI] Attempting to use Anthropic...
[AI] Successfully used Anthropic
```

or

```
[AI] Anthropic error: Rate limit exceeded
[AI] Falling back to OpenAI...
[AI] Successfully used OpenAI
```

## Testing Your Setup

After adding your API keys:

1. Restart your development server:
   ```bash
   npm run dev
   ```

2. Connect a Gmail account and start watching for emails

3. Send a test email to your connected account

4. Check the server logs to see which AI provider was used

5. The email should automatically be categorized into one of your categories

## Troubleshooting

### "No AI API keys configured" Error

- Make sure you've added at least one API key to your `.env` file
- Restart your development server after adding keys

### Anthropic Always Failing

- Check your API key is valid
- Verify your account has available credits
- Check Anthropic's status page: [https://status.anthropic.com](https://status.anthropic.com)

### OpenAI Always Failing

- Ensure you have a payment method on file
- Check your usage limits
- Verify your API key hasn't been revoked

### Both Providers Failing

- Check your internet connection
- Verify both API keys are correct
- Look at the server console for detailed error messages

## Cost Estimation

For typical email categorization (analyzing subject + snippet):

**Per email categorization:**
- Input: ~200 tokens (categories + email content)
- Output: ~10 tokens (category name)

**Estimated costs:**

- **Anthropic**: ~$0.0006 per email (~600 emails per $1)
- **OpenAI**: ~$0.00003 per email (~30,000 emails per $1)

**For 1000 emails/month:**
- Anthropic: ~$0.60/month
- OpenAI: ~$0.03/month

Both providers are very cost-effective for this use case!

## Advanced Configuration

If you need to customize the AI models or parameters, you can modify `/lib/ai.ts`:

```typescript
const anthropicModel = "claude-3-5-sonnet-20241022";
const openaiModel = "gpt-4o-mini";
const temperature = 0.3; // Lower = more consistent
const maxTokens = 50; // Enough for category name
```

## Security Notes

- **Never commit your `.env` file** - it's already in `.gitignore`
- API keys have full access to your AI accounts - keep them secure
- Rotate your keys periodically
- Use environment variables in production (Vercel, Railway, etc. all support this)
