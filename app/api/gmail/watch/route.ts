import { auth } from "@/lib/auth";
import { startWatchingGmail } from "@/lib/gmail-realtime";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Start watching a Gmail account for new emails
 *
 * This tells Gmail to send push notifications to our webhook
 * when new emails arrive in the INBOX.
 */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    // Verify account belongs to user
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Check if GMAIL_PUBSUB_TOPIC is configured
    if (!process.env.GMAIL_PUBSUB_TOPIC) {
      return NextResponse.json(
        {
          error: "Gmail Pub/Sub not configured",
          message:
            "Please set GMAIL_PUBSUB_TOPIC environment variable. See GMAIL_WEBHOOK_SETUP.md",
        },
        { status: 500 }
      );
    }

    // Start watching Gmail
    const watchData = await startWatchingGmail(accountId);

    return NextResponse.json({
      success: true,
      message: "Started watching Gmail account",
      expiration: new Date(parseInt(watchData.expiration!)),
      historyId: watchData.historyId,
    });
  } catch (error: any) {
    console.error("[Watch Gmail] Error:", error);

    return NextResponse.json(
      {
        error: "Failed to start watching Gmail",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
