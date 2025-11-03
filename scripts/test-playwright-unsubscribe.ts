/**
 * Test script for Playwright unsubscribe functionality
 * Usage: npx tsx scripts/test-playwright-unsubscribe.ts <unsubscribe-url>
 */

import { unsubscribeWithPlaywright } from "../lib/unsubscribe/playwright-executor";

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error("Usage: npx tsx scripts/test-playwright-unsubscribe.ts <unsubscribe-url>");
    process.exit(1);
  }

  console.log(`Testing Playwright unsubscribe for: ${url}`);
  console.log("");

  const result = await unsubscribeWithPlaywright(url);

  console.log("\n=== RESULT ===");
  console.log(`Status: ${result.status}`);
  console.log(`Method: ${result.method}`);
  console.log(`Message: ${result.message}`);
  console.log(`Final URL: ${result.url || "N/A"}`);

  if (result.steps && result.steps.length > 0) {
    console.log("\n=== STEPS TAKEN ===");
    result.steps.forEach((step, i) => {
      console.log(`${i + 1}. ${step}`);
    });
  }

  if (result.aiReasoning && result.aiReasoning.length > 0) {
    console.log("\n=== AI REASONING ===");
    result.aiReasoning.forEach((reasoning, i) => {
      console.log(`${i + 1}. ${reasoning}`);
    });
  }

  if (result.screenshotBase64) {
    console.log("\n=== SCREENSHOT ===");
    console.log(`Screenshot captured (${result.screenshotBase64.length} bytes)`);
    console.log("To view: save the base64 string to a .txt file and decode");
  }

  if (result.error) {
    console.log("\n=== ERROR ===");
    console.log(result.error);
  }
}

main().catch(console.error);
