/**
 * Backfill unsubscribe links for existing emails in the database
 * Run with: npx tsx scripts/backfill-unsubscribe-links.ts
 */

import { prisma } from "../lib/prisma";
import { google } from "googleapis";
import { findUnsubscribeLinkInHeader, findUnsubscribeLinkInBody } from "../lib/unsubscribe";

interface GmailMessage {
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
      parts?: Array<{
        mimeType: string;
        body?: { data?: string };
      }>;
    }>;
  };
}

function extractEmailBody(message: GmailMessage): string {
  if (!message.payload) {
    return "";
  }

  // Check if body is directly in payload
  if (message.payload.body?.data) {
    return Buffer.from(message.payload.body.data, "base64").toString("utf-8");
  }

  // Check parts for multipart messages
  if (message.payload.parts) {
    // Try to find HTML part first
    const htmlPart = message.payload.parts.find(
      (part) => part.mimeType === "text/html"
    );

    if (htmlPart?.body?.data) {
      return Buffer.from(htmlPart.body.data, "base64").toString("utf-8");
    }

    // Fall back to plain text
    const textPart = message.payload.parts.find(
      (part) => part.mimeType === "text/plain"
    );

    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data, "base64").toString("utf-8");
    }

    // Check nested parts
    for (const part of message.payload.parts) {
      if (part.parts) {
        const nestedHtml = part.parts.find(
          (p) => p.mimeType === "text/html"
        );
        if (nestedHtml?.body?.data) {
          return Buffer.from(nestedHtml.body.data, "base64").toString("utf-8");
        }

        const nestedText = part.parts.find(
          (p) => p.mimeType === "text/plain"
        );
        if (nestedText?.body?.data) {
          return Buffer.from(nestedText.body.data, "base64").toString("utf-8");
        }
      }
    }
  }

  return "";
}

async function backfillUnsubscribeLinks() {
  console.log("Starting backfill of unsubscribe links...\n");

  // Get all users with accounts
  const users = await prisma.user.findMany({
    include: {
      accounts: {
        where: {
          provider: "google",
          access_token: { not: null },
        },
      },
      emails: {
        where: {
          unsubscribeUrl: null, // Only emails without unsubscribe URLs
        },
      },
    },
  });

  console.log(`Found ${users.length} users to process\n`);

  let totalProcessed = 0;
  let totalUpdated = 0;

  for (const user of users) {
    console.log(`Processing user: ${user.email}`);

    if (user.accounts.length === 0) {
      console.log("  No active Google account, skipping\n");
      continue;
    }

    const account = user.accounts[0];

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

    console.log(`  Processing ${user.emails.length} emails without unsubscribe URLs`);

    for (const email of user.emails) {
      totalProcessed++;

      try {
        // Fetch full email from Gmail
        const fullMessage = await gmail.users.messages.get({
          userId: "me",
          id: email.gmailId,
          format: "full",
        });

        const headers = fullMessage.data.payload?.headers || [];
        const subject = email.subject || "(no subject)";

        // Try header first
        const listUnsubscribe = headers.find((h: any) => h.name === "List-Unsubscribe")?.value || "";
        let unsubscribeUrl: string | null = findUnsubscribeLinkInHeader(listUnsubscribe);

        // Try body if no header
        if (!unsubscribeUrl) {
          const emailBody = extractEmailBody(fullMessage.data as any);
          if (emailBody) {
            unsubscribeUrl = findUnsubscribeLinkInBody(emailBody);
          }
        }

        // Update database if we found a link
        if (unsubscribeUrl) {
          await prisma.email.update({
            where: { id: email.id },
            data: { unsubscribeUrl },
          });
          totalUpdated++;
          console.log(`    ✓ "${subject.substring(0, 50)}..." -> ${unsubscribeUrl.substring(0, 60)}...`);
        } else {
          console.log(`    ✗ "${subject.substring(0, 50)}..." -> no unsubscribe link found`);
        }

        // Rate limiting - wait 100ms between emails
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error: any) {
        console.error(`    ERROR processing email "${email.subject}":`, error.message);
      }
    }

    console.log();
  }

  console.log("\n=== Backfill Complete ===");
  console.log(`Processed: ${totalProcessed} emails`);
  console.log(`Updated: ${totalUpdated} emails with unsubscribe links`);
  console.log(`No link found: ${totalProcessed - totalUpdated} emails`);
}

backfillUnsubscribeLinks()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
