import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchGmailEmails, storeEmails } from "@/lib/gmail";

/**
 * Process webhook asynchronously
 */
async function processWebhookAsync(userId: string, accountId: string) {
  console.log(`[Webhook Async] Starting processing for account ${accountId}`);

  const messages = await fetchGmailEmails(accountId, 5);

  if (messages.length === 0) {
    console.log("[Webhook Async] No messages found");
    return;
  }

  const storedEmails = await storeEmails(userId, accountId, messages);
  console.log(`[Webhook Async] Successfully processed ${storedEmails.length} new emails`);
}

/**
 * Gmail Push Notification Webhook
 *
 * This endpoint receives notifications from Google Pub/Sub when new emails arrive.
 * Returns 200 immediately and processes asynchronously to prevent retries.
 */
export async function POST(request: NextRequest) {
  try {
    // Clone the request to allow reading the body multiple times if needed
    const bodyText = await request.text();

    // Handle empty body (happens with duplicate webhook calls)
    if (!bodyText || bodyText.trim() === '') {
      console.log("[Webhook] Received empty body, skipping");
      return NextResponse.json({ success: true });
    }

    const body = JSON.parse(bodyText);
    console.log("[Webhook] Received Gmail notification:", JSON.stringify(body, null, 2));

    // Pub/Sub sends notifications in this format:
    // { message: { data: "base64-encoded-json", messageId: "..." } }
    const pubsubMessage = body.message;

    if (!pubsubMessage || !pubsubMessage.data) {
      console.log("[Webhook] No message data found");
      return NextResponse.json({ success: true }); // Return 200 to acknowledge
    }

    // Decode the base64 data
    const decodedData = Buffer.from(pubsubMessage.data, "base64").toString();
    const notification = JSON.parse(decodedData);

    console.log("[Webhook] Decoded notification:", notification);

    // Notification format: { emailAddress: "user@gmail.com", historyId: "12345" }
    const { emailAddress, historyId } = notification;

    if (!emailAddress) {
      console.log("[Webhook] No email address in notification");
      return NextResponse.json({ success: true });
    }

    // Find the account that matches this email
    const account = await prisma.account.findFirst({
      where: {
        provider: "google",
        email: emailAddress,
      },
      include: {
        user: true,
      },
    });

    if (!account) {
      console.log(`[Webhook] No account found for ${emailAddress}`);
      return NextResponse.json({ success: true });
    }

    console.log(`[Webhook] Processing notifications for account ${account.id}`);

    // Process the webhook asynchronously (don't await)
    // This allows us to return 200 immediately to prevent Pub/Sub retries
    processWebhookAsync(account.userId, account.id).catch((error) => {
      console.error("[Webhook] Error in async processing:", error);
    });

    // Return 200 immediately to acknowledge receipt
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Webhook] Error processing notification:", error);

    // Still return 200 to acknowledge receipt (prevents Pub/Sub retries)
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 200 }
    );
  }
}

/**
 * Handle Pub/Sub subscription verification
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "Gmail webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
}
