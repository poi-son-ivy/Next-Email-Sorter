import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  fetchNewGmailEmails,
  processAndStoreNewEmails,
} from "@/lib/gmail-realtime";

/**
 * Gmail Push Notification Webhook
 *
 * This endpoint receives notifications from Google Pub/Sub when new emails arrive.
 * It fetches only the NEW emails (using historyId) and archives them after processing.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

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

    // Fetch only NEW emails since last historyId
    const newMessages = await fetchNewGmailEmails(account.id);

    if (newMessages.length === 0) {
      console.log("[Webhook] No new messages to process");
      return NextResponse.json({ success: true, processed: 0 });
    }

    // Store emails and archive them in Gmail
    const storedEmails = await processAndStoreNewEmails(
      account.userId,
      account.id,
      newMessages
    );

    console.log(`[Webhook] Successfully processed ${storedEmails.length} new emails`);

    return NextResponse.json({
      success: true,
      processed: storedEmails.length,
    });
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
