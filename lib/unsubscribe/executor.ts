/**
 * Unsubscribe executor - handles the actual unsubscribe process
 * Implements Tier 1 (One-Click) and Tier 2 (Simple HTTP GET)
 */

import { prisma } from "@/lib/prisma";
import { google } from "googleapis";

export interface UnsubscribeResult {
  status: "success" | "failure" | "needs_confirmation" | "no_url";
  method?: "one-click" | "simple-http" | "none";
  message: string;
  url?: string;
  responseStatus?: number;
  responsePreview?: string; // First 500 chars of HTML response for debugging
  error?: string;
}

/**
 * Execute unsubscribe for a given email
 */
export async function unsubscribeEmail(emailId: string, userId: string): Promise<UnsubscribeResult> {
  // Fetch email from database
  const email = await prisma.email.findUnique({
    where: { id: emailId },
  });

  if (!email) {
    return {
      status: "failure",
      message: "Email not found",
      error: "Email not found in database",
    };
  }

  if (!email.unsubscribeUrl) {
    return {
      status: "no_url",
      method: "none",
      message: "No unsubscribe link found for this email",
    };
  }

  console.log(`[Unsubscribe] Starting unsubscribe for email "${email.subject}"`);
  console.log(`[Unsubscribe] URL: ${email.unsubscribeUrl}`);

  // Handle mailto: links
  if (email.unsubscribeUrl.startsWith("mailto:")) {
    return {
      status: "needs_confirmation",
      message: "Email-based unsubscribe requires manual action",
      url: email.unsubscribeUrl,
    };
  }

  // Tier 1: Try List-Unsubscribe-Post (One-Click)
  const oneClickResult = await tryOneClickUnsubscribe(email.gmailId, email.unsubscribeUrl, userId);
  if (oneClickResult) {
    return oneClickResult;
  }

  // Tier 2: Try simple HTTP GET
  const simpleHttpResult = await trySimpleHttpUnsubscribe(email.unsubscribeUrl);
  return simpleHttpResult;
}

/**
 * Tier 1: Try RFC 8058 one-click unsubscribe
 * Checks if the email has List-Unsubscribe-Post header and sends POST request
 */
async function tryOneClickUnsubscribe(
  gmailId: string,
  unsubscribeUrl: string,
  userId: string
): Promise<UnsubscribeResult | null> {
  try {
    // Get Gmail API access
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "google",
        access_token: { not: null },
      },
    });

    if (!account || !account.access_token) {
      console.log("[Unsubscribe] No Gmail account found, skipping one-click check");
      return null;
    }

    // Setup Gmail API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Fetch email headers
    const message = await gmail.users.messages.get({
      userId: "me",
      id: gmailId,
      format: "metadata",
      metadataHeaders: ["List-Unsubscribe-Post", "List-Unsubscribe"],
    });

    const headers = message.data.payload?.headers || [];
    const listUnsubscribePost = headers.find((h) => h.name === "List-Unsubscribe-Post")?.value;

    if (!listUnsubscribePost || !listUnsubscribePost.includes("One-Click")) {
      console.log("[Unsubscribe] No List-Unsubscribe-Post header, skipping one-click");
      return null;
    }

    console.log("[Unsubscribe] Found List-Unsubscribe-Post header, attempting one-click");

    // Send POST request with List-Unsubscribe=One-Click
    const response = await fetch(unsubscribeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "List-Unsubscribe=One-Click",
      redirect: "follow",
    });

    console.log(`[Unsubscribe] One-click response: ${response.status} ${response.statusText}`);

    if (response.ok) {
      return {
        status: "success",
        method: "one-click",
        message: "Successfully unsubscribed using one-click method",
        url: unsubscribeUrl,
        responseStatus: response.status,
      };
    } else {
      console.log("[Unsubscribe] One-click failed, will try simple HTTP");
      return null; // Fall back to simple HTTP
    }
  } catch (error: any) {
    console.error("[Unsubscribe] One-click error:", error.message);
    return null; // Fall back to simple HTTP
  }
}

/**
 * Tier 2: Try simple HTTP GET request
 * Most unsubscribe links work with a simple GET request
 */
async function trySimpleHttpUnsubscribe(unsubscribeUrl: string): Promise<UnsubscribeResult> {
  try {
    console.log("[Unsubscribe] Attempting simple HTTP GET");

    const response = await fetch(unsubscribeUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      redirect: "follow",
    });

    console.log(`[Unsubscribe] Simple HTTP response: ${response.status} ${response.statusText}`);
    console.log(`[Unsubscribe] Final URL: ${response.url}`);

    if (!response.ok) {
      return {
        status: "failure",
        method: "simple-http",
        message: `Failed with HTTP ${response.status}`,
        url: response.url,
        responseStatus: response.status,
        error: response.statusText,
      };
    }

    // Get response body to check for confirmation pages
    const html = await response.text();
    console.log(`[Unsubscribe] Response body length: ${html.length} chars`);

    // Basic check: does the page require confirmation?
    const requiresConfirmation = detectConfirmationPage(html);

    if (requiresConfirmation) {
      console.log("[Unsubscribe] Page requires confirmation");
      return {
        status: "needs_confirmation",
        method: "simple-http",
        message: "Unsubscribe page requires manual confirmation",
        url: response.url,
        responseStatus: response.status,
      };
    }

    // If we got here, assume success (we'll improve detection later)
    console.log("[Unsubscribe] Assuming success (no confirmation detected)");

    // Save first 500 chars of response for debugging
    const htmlPreview = html.substring(0, 500);

    return {
      status: "success",
      method: "simple-http",
      message: "Unsubscribe link visited successfully (manual verification recommended)",
      url: response.url,
      responseStatus: response.status,
      responsePreview: htmlPreview, // For debugging
    };
  } catch (error: any) {
    console.error("[Unsubscribe] Simple HTTP error:", error.message);
    return {
      status: "failure",
      method: "simple-http",
      message: "Failed to access unsubscribe link",
      error: error.message,
    };
  }
}

/**
 * Detect if the page requires user confirmation
 * Returns true if page has confirmation buttons/forms
 */
function detectConfirmationPage(html: string): boolean {
  // Look for confirmation-related keywords near buttons/forms
  const confirmationPatterns = [
    /<button[^>]*>.*?(confirm|yes|unsubscribe|proceed).*?<\/button>/i,
    /<input[^>]*type=["']submit["'][^>]*value=["'][^"']*confirm[^"']*["']/i,
    /<input[^>]*value=["'][^"']*confirm[^"']*["'][^>]*type=["']submit["']/i,
    /click.*?(confirm|button).*?unsubscribe/i,
    /confirm.*?unsubscri/i,
  ];

  for (const pattern of confirmationPatterns) {
    if (pattern.test(html)) {
      return true;
    }
  }

  // Check for forms (most confirmation pages have forms)
  if (/<form/i.test(html)) {
    // If there's a form AND mentions of unsubscribe, likely needs confirmation
    if (/unsubscri/i.test(html)) {
      return true;
    }
  }

  return false;
}
