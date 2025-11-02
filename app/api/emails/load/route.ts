import { auth } from "@/lib/auth";
import { fetchGmailEmails, storeEmails } from "@/lib/gmail";
import { NextRequest, NextResponse } from "next/server";

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

    // Fetch emails from Gmail
    console.log(`[Load Emails] Fetching emails for account ${accountId}`);
    const messages = await fetchGmailEmails(accountId, 20); // Fetch last 20 emails

    // Store emails and trigger Pusher events
    console.log(`[Load Emails] Storing ${messages.length} emails`);
    const storedEmails = await storeEmails(session.user.id, accountId, messages);

    return NextResponse.json({
      success: true,
      count: storedEmails.length,
      message: `Loaded ${storedEmails.length} new emails`,
    });
  } catch (error) {
    console.error("[Load Emails] Error:", error);
    return NextResponse.json(
      { error: "Failed to load emails" },
      { status: 500 }
    );
  }
}
