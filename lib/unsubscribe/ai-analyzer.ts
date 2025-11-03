/**
 * AI-powered page analyzer for unsubscribe flows
 * Uses hybrid approach: text analysis + vision verification
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface PageAnalysis {
  action: "click" | "fill" | "submit" | "success" | "needs_manual" | "error";
  reasoning: string;
  selector?: string; // CSS selector for element to interact with
  value?: string; // For fill actions
  confidence: number; // 0-1
  nextStep?: string; // What to do after this action
}

export interface VisualVerification {
  isSuccess: boolean;
  reasoning: string;
  confidence: number;
}

/**
 * Analyze page HTML and text to determine next action
 * Fast, cheap first-pass analysis
 */
export async function analyzePageText(
  html: string,
  url: string,
  previousActions: string[] = []
): Promise<PageAnalysis> {
  const prompt = `You are analyzing an unsubscribe page to determine the next action to take.

URL: ${url}
Previous actions: ${previousActions.join(" → ") || "None"}

Page HTML (simplified):
${simplifyHtml(html)}

Your task:
1. Determine what action is needed to unsubscribe (click button, fill form, etc.)
2. Provide the CSS selector for the element to interact with
3. Assess if unsubscribe is complete or needs more steps

Respond in JSON format:
{
  "action": "click" | "fill" | "submit" | "success" | "needs_manual" | "error",
  "reasoning": "explanation of what you see and why this action",
  "selector": "CSS selector for element",
  "value": "value to fill (if action is fill)",
  "confidence": 0.0-1.0,
  "nextStep": "what will happen after this action"
}

Examples:
- If you see "Unsubscribe" button → action: "click", selector: "button:has-text('Unsubscribe')"
- If you see "Email:" field → action: "fill", selector: "input[type='email']", value: "(email)"
- If you see "You have been unsubscribed" → action: "success"
- If page requires login or CAPTCHA → action: "needs_manual"`;

  try {
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // Clean the response - extract JSON from various formats
    const jsonText = extractJSON(content.text);

    const analysis: PageAnalysis = JSON.parse(jsonText);
    console.log(`[AI Text] ${url} → ${analysis.action} (${analysis.confidence})`);
    console.log(`[AI Text] Reasoning: ${analysis.reasoning}`);

    return analysis;
  } catch (error) {
    console.error("[AI Text] Error:", error);
    return {
      action: "error",
      reasoning: `AI analysis failed: ${error}`,
      confidence: 0,
    };
  }
}

/**
 * Extract JSON from AI response text
 * Handles code blocks, extra commentary, and various formats
 */
function extractJSON(text: string): string {
  let cleaned = text.trim();

  // Try 1: Remove markdown code blocks
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```[\s\S]*$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```[\s\S]*$/, "");
  }

  // Try 2: Find JSON object boundaries
  // Look for the first { and find its matching }
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace === -1) {
    throw new Error("No JSON object found in response");
  }

  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  let lastBrace = -1;

  for (let i = firstBrace; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "{") {
        braceCount++;
      } else if (char === "}") {
        braceCount--;
        if (braceCount === 0) {
          lastBrace = i;
          break;
        }
      }
    }
  }

  if (lastBrace === -1) {
    throw new Error("Could not find matching closing brace for JSON object");
  }

  return cleaned.substring(firstBrace, lastBrace + 1);
}

/**
 * Analyze screenshot to verify success or determine action
 * More expensive but handles visual-only elements
 */
export async function analyzeScreenshot(
  screenshotBase64: string,
  url: string,
  context: string = "Verify if unsubscribe was successful"
): Promise<VisualVerification> {
  const prompt = `You are analyzing a screenshot of an unsubscribe page.

URL: ${url}
Context: ${context}

Look at the screenshot and determine:
1. Is the unsubscribe process complete? Look for confirmation messages like "You've been unsubscribed", "Subscription updated", etc.
2. Are there any error messages?
3. Does the page still show unsubscribe buttons/forms?

Respond in JSON format:
{
  "isSuccess": true/false,
  "reasoning": "what you see in the screenshot",
  "confidence": 0.0-1.0
}`;

  try {
    // Try Claude first (better vision capabilities)
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: screenshotBase64,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // Clean the response - extract JSON from various formats
    const jsonText = extractJSON(content.text);

    const verification: VisualVerification = JSON.parse(jsonText);
    console.log(`[AI Vision] ${url} → ${verification.isSuccess ? "Success" : "Not complete"} (${verification.confidence})`);
    console.log(`[AI Vision] Reasoning: ${verification.reasoning}`);

    return verification;
  } catch (error) {
    console.error("[AI Vision] Failed:", error);
    // Don't fall back to OpenAI - just return failure
    // This prevents unnecessary retries and keeps costs down
    return {
      isSuccess: false,
      reasoning: `AI vision analysis failed: ${error}`,
      confidence: 0,
    };
  }
}

/**
 * Simplify HTML for text analysis
 * Keep only relevant content, remove scripts/styles
 */
function simplifyHtml(html: string): string {
  // Remove scripts, styles, comments
  let simplified = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Extract text content and important attributes
  // Keep buttons, links, forms, inputs with their text
  const important = [];
  const buttonRegex = /<button[^>]*>(.*?)<\/button>/gi;
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  const inputRegex = /<input[^>]*type=["']([^"']+)["'][^>]*(?:placeholder=["']([^"']+)["'])?[^>]*>/gi;
  const formRegex = /<form[^>]*>/gi;

  let match;
  while ((match = buttonRegex.exec(simplified)) !== null) {
    important.push(`Button: ${match[1].replace(/<[^>]+>/g, "").trim()}`);
  }

  while ((match = linkRegex.exec(simplified)) !== null) {
    important.push(`Link: ${match[2].replace(/<[^>]+>/g, "").trim()} → ${match[1]}`);
  }

  while ((match = inputRegex.exec(simplified)) !== null) {
    important.push(`Input: type="${match[1]}" placeholder="${match[2] || ""}"`);
  }

  while ((match = formRegex.exec(simplified)) !== null) {
    important.push("Form present");
  }

  // Get body text (simplified)
  const bodyText = simplified
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 2000); // Limit to 2000 chars

  return `Text content:\n${bodyText}\n\nInteractive elements:\n${important.join("\n")}`;
}
