import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

/**
 * Fetch full email content from Gmail
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: emailId } = await params;

    // Find email in database
    const email = await prisma.email.findUnique({
      where: { id: emailId },
      include: { user: true },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Verify email belongs to user
    if (email.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find the account to get access token
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

    // Fetch full email from Gmail API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    try {
      const fullMessage = await gmail.users.messages.get({
        userId: "me",
        id: email.gmailId,
        format: "full",
      });

      // Extract email body
      const body = extractEmailBody(fullMessage.data);

      return NextResponse.json({
        ...email,
        body,
      });
    } catch (gmailError: any) {
      // If email was deleted from Gmail, return the snippet we have stored
      if (gmailError.code === 404) {
        console.log(`[Email API] Email ${email.gmailId} not found in Gmail, returning stored snippet`);
        return NextResponse.json({
          ...email,
          body: email.snippet || "<p>This email has been deleted from Gmail. Only the preview is available.</p>",
          deletedFromGmail: true,
        });
      }
      throw gmailError; // Re-throw if it's a different error
    }
  } catch (error) {
    console.error("[Email API] Error fetching email:", error);
    return NextResponse.json(
      { error: "Failed to fetch email" },
      { status: 500 }
    );
  }
}

/**
 * Extract email body from Gmail message
 * Handles both plain text and HTML emails
 */
function extractEmailBody(message: any): string {
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
      (part: any) => part.mimeType === "text/html"
    );

    if (htmlPart?.body?.data) {
      return Buffer.from(htmlPart.body.data, "base64").toString("utf-8");
    }

    // Fall back to plain text
    const textPart = message.payload.parts.find(
      (part: any) => part.mimeType === "text/plain"
    );

    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data, "base64").toString("utf-8");
    }

    // Check nested parts
    for (const part of message.payload.parts) {
      if (part.parts) {
        const nestedHtml = part.parts.find(
          (p: any) => p.mimeType === "text/html"
        );
        if (nestedHtml?.body?.data) {
          return Buffer.from(nestedHtml.body.data, "base64").toString("utf-8");
        }

        const nestedText = part.parts.find(
          (p: any) => p.mimeType === "text/plain"
        );
        if (nestedText?.body?.data) {
          return Buffer.from(nestedText.body.data, "base64").toString("utf-8");
        }
      }
    }
  }

  return message.snippet || "";
}
