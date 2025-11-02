import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";

/**
 * Bulk delete emails from both database and Gmail
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { emailIds } = body;

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json(
        { error: "Email IDs array is required" },
        { status: 400 }
      );
    }

    // Fetch emails to verify ownership and get Gmail IDs
    const emails = await prisma.email.findMany({
      where: {
        id: { in: emailIds },
        userId: session.user.id,
      },
    });

    if (emails.length === 0) {
      return NextResponse.json(
        { error: "No emails found or access denied" },
        { status: 404 }
      );
    }

    // Get user's active Google account for Gmail API access
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google",
        access_token: { not: null },
      },
    });

    if (!account || !account.access_token) {
      return NextResponse.json(
        { error: "No active Gmail account found" },
        { status: 400 }
      );
    }

    // Setup Gmail API client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Delete from Gmail (use trash for safety, or delete permanently)
    const gmailDeleteResults = await Promise.allSettled(
      emails.map((email) =>
        gmail.users.messages.trash({
          userId: "me",
          id: email.gmailId,
        })
      )
    );

    // Count successes and failures
    const gmailSuccessCount = gmailDeleteResults.filter(
      (r) => r.status === "fulfilled"
    ).length;
    const gmailFailCount = gmailDeleteResults.filter(
      (r) => r.status === "rejected"
    ).length;

    console.log(
      `[Bulk Delete] Gmail: ${gmailSuccessCount} trashed, ${gmailFailCount} failed`
    );

    // Delete from database (regardless of Gmail success)
    const dbResult = await prisma.email.deleteMany({
      where: {
        id: { in: emailIds },
        userId: session.user.id,
      },
    });

    console.log(`[Bulk Delete] Database: ${dbResult.count} deleted`);

    return NextResponse.json({
      success: true,
      deleted: {
        database: dbResult.count,
        gmail: gmailSuccessCount,
      },
      failed: {
        gmail: gmailFailCount,
      },
      message: `Deleted ${dbResult.count} email(s) from database and moved ${gmailSuccessCount} to Gmail trash`,
    });
  } catch (error: any) {
    console.error("[Bulk Delete] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete emails" },
      { status: 500 }
    );
  }
}
