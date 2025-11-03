/**
 * Tier 3: AI-powered browser automation for complex unsubscribe flows
 * Uses Playwright + AI to navigate multi-step unsubscribe processes
 */

import { chromium, Browser, Page } from "playwright";
import { analyzePageText, analyzeScreenshot, PageAnalysis } from "./ai-analyzer";

export interface PlaywrightResult {
  status: "success" | "needs_manual" | "failure";
  method: "playwright";
  message: string;
  url?: string;
  screenshotBase64?: string;
  steps: string[]; // Log of actions taken
  aiReasoning: string[]; // AI's reasoning for each step
  error?: string;
}

const MAX_STEPS = 10; // Prevent infinite loops
const STEP_TIMEOUT = 30000; // 30 seconds per step

/**
 * Execute unsubscribe using Playwright + AI
 */
export async function unsubscribeWithPlaywright(
  unsubscribeUrl: string,
  emailAddress?: string
): Promise<PlaywrightResult> {
  console.log(`[Playwright] Starting AI-powered unsubscribe for: ${unsubscribeUrl}`);

  let browser: Browser | null = null;
  let page: Page | null = null;
  const steps: string[] = [];
  const aiReasoning: string[] = [];

  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true, // Run in background
      timeout: 30000,
    });

    page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    });

    // Navigate to unsubscribe page
    steps.push(`Navigate to ${unsubscribeUrl}`);
    await page.goto(unsubscribeUrl, { waitUntil: "networkidle", timeout: STEP_TIMEOUT });

    // Main automation loop
    for (let step = 0; step < MAX_STEPS; step++) {
      console.log(`[Playwright] Step ${step + 1}/${MAX_STEPS}`);

      // Get current page state
      const html = await page.content();
      const url = page.url();

      // Analyze page with AI
      const analysis = await analyzePageText(html, url, steps);
      aiReasoning.push(`${analysis.action}: ${analysis.reasoning}`);

      // Handle different actions
      if (analysis.action === "success") {
        // Success! Take screenshot for verification
        const screenshot = await page.screenshot({ fullPage: true });
        const screenshotBase64 = screenshot.toString("base64");

        // Verify with AI vision
        const verification = await analyzeScreenshot(screenshotBase64, url, "Verify unsubscribe completion");

        if (verification.isSuccess && verification.confidence > 0.7) {
          steps.push(`✓ Unsubscribe confirmed successful`);
          aiReasoning.push(`Visual verification: ${verification.reasoning}`);

          await browser.close();
          return {
            status: "success",
            method: "playwright",
            message: `Successfully unsubscribed using AI automation (${steps.length} steps)`,
            url,
            screenshotBase64,
            steps,
            aiReasoning,
          };
        } else {
          // AI is not confident - needs manual verification
          steps.push(`⚠ AI detected success but low confidence (${verification.confidence})`);

          await browser.close();
          return {
            status: "needs_manual",
            method: "playwright",
            message: `Automation completed but needs manual verification. AI confidence: ${Math.round(verification.confidence * 100)}%`,
            url,
            screenshotBase64,
            steps,
            aiReasoning,
          };
        }
      } else if (analysis.action === "needs_manual") {
        // Page requires manual intervention (login, CAPTCHA, etc.)
        const screenshot = await page.screenshot({ fullPage: true });
        steps.push(`⚠ Manual intervention required: ${analysis.reasoning}`);

        await browser.close();
        return {
          status: "needs_manual",
          method: "playwright",
          message: analysis.reasoning,
          url,
          screenshotBase64: screenshot.toString("base64"),
          steps,
          aiReasoning,
        };
      } else if (analysis.action === "error") {
        // AI encountered an error
        steps.push(`✗ AI error: ${analysis.reasoning}`);

        await browser.close();
        return {
          status: "failure",
          method: "playwright",
          message: analysis.reasoning,
          url,
          steps,
          aiReasoning,
          error: analysis.reasoning,
        };
      } else if (analysis.action === "click") {
        // Click an element
        if (!analysis.selector) {
          throw new Error("AI provided click action but no selector");
        }

        try {
          steps.push(`Click: ${analysis.selector}`);
          await page.click(analysis.selector, { timeout: 10000 });
          await page.waitForLoadState("networkidle", { timeout: STEP_TIMEOUT });
        } catch (error) {
          // If exact selector fails, try fuzzy matching
          console.log(`[Playwright] Exact selector failed, trying fuzzy match`);
          const clicked = await tryFuzzyClick(page, analysis.selector, analysis.reasoning);

          if (!clicked) {
            throw new Error(`Failed to click element: ${analysis.selector}`);
          }

          steps.push(`Click (fuzzy): ${analysis.selector}`);
          await page.waitForLoadState("networkidle", { timeout: STEP_TIMEOUT });
        }
      } else if (analysis.action === "fill") {
        // Fill a form field
        if (!analysis.selector || !analysis.value) {
          throw new Error("AI provided fill action but missing selector or value");
        }

        const value = analysis.value === "(email)" ? emailAddress || "" : analysis.value;

        steps.push(`Fill: ${analysis.selector} = ${value}`);
        await page.fill(analysis.selector, value, { timeout: 10000 });
      } else if (analysis.action === "submit") {
        // Submit a form
        if (!analysis.selector) {
          throw new Error("AI provided submit action but no selector");
        }

        steps.push(`Submit: ${analysis.selector}`);
        await Promise.all([
          page.click(analysis.selector, { timeout: 10000 }),
          page.waitForLoadState("networkidle", { timeout: STEP_TIMEOUT }),
        ]);
      }

      // Small delay between steps
      await page.waitForTimeout(1000);
    }

    // Reached max steps without success
    const screenshot = await page.screenshot({ fullPage: true });
    steps.push(`⚠ Reached maximum steps (${MAX_STEPS})`);

    await browser.close();
    return {
      status: "needs_manual",
      method: "playwright",
      message: `Automation incomplete after ${MAX_STEPS} steps - manual verification needed`,
      url: page.url(),
      screenshotBase64: screenshot.toString("base64"),
      steps,
      aiReasoning,
    };
  } catch (error: any) {
    console.error("[Playwright] Error:", error);

    // Try to capture screenshot on error
    let screenshotBase64: string | undefined;
    if (page) {
      try {
        const screenshot = await page.screenshot({ fullPage: true });
        screenshotBase64 = screenshot.toString("base64");
      } catch (screenshotError) {
        console.error("[Playwright] Failed to capture error screenshot:", screenshotError);
      }
    }

    if (browser) {
      await browser.close();
    }

    return {
      status: "failure",
      method: "playwright",
      message: `Automation failed: ${error.message}`,
      steps,
      aiReasoning,
      screenshotBase64,
      error: error.message,
    };
  }
}

/**
 * Try to click an element using fuzzy matching
 * Fallback when exact selector fails
 */
async function tryFuzzyClick(page: Page, selector: string, reasoning: string): Promise<boolean> {
  try {
    // Extract text from reasoning if it mentions what to click
    const textMatch = reasoning.match(/["']([^"']+)["']/);
    if (!textMatch) return false;

    const text = textMatch[1];

    // Try common button/link patterns
    const fuzzySelectors = [
      `button:has-text("${text}")`,
      `a:has-text("${text}")`,
      `input[type="submit"][value*="${text}" i]`,
      `button:text-is("${text}")`,
      `a:text-is("${text}")`,
      `[role="button"]:has-text("${text}")`,
    ];

    for (const fuzzy of fuzzySelectors) {
      try {
        const element = await page.$(fuzzy);
        if (element) {
          await element.click();
          return true;
        }
      } catch (error) {
        continue;
      }
    }

    return false;
  } catch (error) {
    return false;
  }
}
