# AI-Powered Playwright Unsubscribe System

## Overview

This document explains the Tier 3 unsubscribe system that uses Playwright browser automation combined with AI analysis to handle complex multi-step unsubscribe flows.

## Architecture

The system uses a **hybrid AI approach**:
1. **Text Analysis** - Fast, cheap analysis of page HTML to determine actions
2. **Vision Verification** - Screenshot analysis to verify success visually

## Components

### 1. AI Analyzer (`lib/unsubscribe/ai-analyzer.ts`)

Provides two main functions:

#### `analyzePageText(html, url, previousActions)`
- **Purpose**: Analyze page HTML to determine next action
- **Model**: Claude 3.5 Sonnet (fast, accurate)
- **Input**: Simplified HTML, URL, action history
- **Output**: PageAnalysis object with:
  - `action`: "click" | "fill" | "submit" | "success" | "needs_manual" | "error"
  - `reasoning`: AI's explanation
  - `selector`: CSS selector for element to interact with
  - `value`: Value to fill (for forms)
  - `confidence`: 0-1 confidence score

#### `analyzeScreenshot(screenshotBase64, url, context)`
- **Purpose**: Verify unsubscribe completion visually
- **Model**: Claude Sonnet (no fallback - single attempt)
- **Input**: Base64 screenshot, URL, context
- **Output**: VisualVerification object with:
  - `isSuccess`: true if unsubscribe confirmed
  - `reasoning`: What AI sees in screenshot
  - `confidence`: 0-1 confidence score
- **Note**: No OpenAI fallback - uses whichever AI connects successfully initially

### 2. Playwright Executor (`lib/unsubscribe/playwright-executor.ts`)

#### `unsubscribeWithPlaywright(unsubscribeUrl, emailAddress?)`

Main automation loop:
1. Launch headless Chromium browser
2. Navigate to unsubscribe URL
3. For each step (max 10):
   - Analyze current page with AI
   - Execute action (click, fill, submit, etc.)
   - Wait for page load
   - Repeat until success or needs manual intervention
4. Take screenshot for verification
5. Use AI vision to verify success
6. Return detailed result with steps, reasoning, screenshot

**Safety Features**:
- 10-step maximum to prevent infinite loops
- 30-second timeout per step
- Fuzzy selector matching as fallback
- Screenshot on error for debugging

### 3. Main Executor (`lib/unsubscribe/executor.ts`)

**Primary Strategy**: Always use Playwright + AI for reliable verification

Rationale: Simple HTTP GET requests often return 200 OK without actually unsubscribing. To ensure success, we always use AI-powered browser automation.

Fallback: If Playwright fails completely, falls back to simple HTTP GET as last resort.

## Usage Flow

### Automatic (via Queue)

When you select emails and click "Unsubscribe":

1. Jobs are enqueued to `UnsubscribeJob` table
2. Queue worker processes each job:
   - Attempts Playwright + AI automation (single attempt, no retries)
   - Falls back to simple HTTP only if Playwright fails to start
3. Results are stored with screenshots and AI reasoning
4. Pusher notifies user of completion
5. **No retries** - if AI fails or can't complete, job is marked for manual review

### Manual Testing

Test a specific URL:

```bash
npx tsx scripts/test-playwright-unsubscribe.ts "https://example.com/unsubscribe"
```

This will:
- Run the Playwright automation
- Show step-by-step actions taken
- Display AI reasoning for each step
- Report success/failure with screenshot

## Database Storage

All results are stored in `UnsubscribeJob.result` (JSON field):

```json
{
  "status": "success",
  "method": "playwright",
  "message": "Successfully unsubscribed using AI automation (3 steps)",
  "url": "https://final-url.com",
  "screenshotBase64": "iVBORw0KG...",
  "steps": [
    "Navigate to https://...",
    "Click: button:has-text('Unsubscribe')",
    "✓ Unsubscribe confirmed successful"
  ],
  "aiReasoning": [
    "click: I see an 'Unsubscribe' button that needs to be clicked",
    "success: Page shows 'You've been unsubscribed' confirmation",
    "Visual verification: Screenshot shows success message with green checkmark"
  ]
}
```

## AI Costs

Approximate costs per unsubscribe:

- **Text Analysis**: ~$0.001 per page (Claude 3.5 Sonnet)
- **Vision Verification**: ~$0.003 per screenshot (Claude 3.5 Sonnet)
- **Total**: ~$0.004 per unsubscribe (assuming 1 page + 1 verification)

For 1000 unsubscribes: ~$4

## Success Detection

The system uses multiple methods to detect success:

1. **Text Analysis**: Looks for keywords like:
   - "unsubscribed"
   - "subscription updated"
   - "preferences saved"
   - "removed from list"

2. **Visual Verification**: AI analyzes screenshot for:
   - Success messages
   - Confirmation checkmarks
   - Absence of unsubscribe buttons/forms
   - Error messages (if present)

3. **Confidence Threshold**: Only marks as success if confidence > 0.7

## Failure Modes

The system can return three statuses:

1. **success** - Unsubscribe completed with high confidence
2. **needs_manual** - Requires user intervention:
   - Login required
   - CAPTCHA present
   - AI not confident (< 0.7)
   - Reached max steps (10)
3. **failure** - Error occurred:
   - Page load failed
   - Selector not found
   - Timeout exceeded

## Debugging

All jobs are logged with:
- Console logs showing each step
- AI reasoning for each decision
- Screenshots on completion or error
- Full action history

To view a job's details:

```sql
SELECT * FROM "UnsubscribeJob" WHERE id = 'job_id';
```

The `result` JSON field contains all debugging info.

## Future Improvements

1. **Pattern Learning**: Store successful patterns to skip AI for common sites
2. **Batch Processing**: Process multiple unsubscribes in parallel
3. **CAPTCHA Solving**: Integrate CAPTCHA solving service
4. **Visual Regression**: Compare screenshots to detect changes
5. **Success Tracking**: Build database of confirmed working patterns

## Environment Variables

Required:
- `ANTHROPIC_API_KEY` - For Claude AI (primary)
- `OPENAI_API_KEY` - For GPT-4o (fallback vision)

## Troubleshooting

### "AI analysis failed"
- Check API keys are set correctly
- Verify internet connection
- Check API rate limits

### "Failed to click element"
- AI provided wrong selector
- Page structure changed
- Element hidden/disabled
- Try fuzzy matching (automatic)

### "Reached maximum steps"
- Page requires manual intervention
- AI stuck in loop
- Increase MAX_STEPS if needed

### "Screenshot capture failed"
- Browser crashed
- Out of memory
- Playwright not installed correctly

Run `npx playwright install chromium` to fix.
