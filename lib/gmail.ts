import { google } from "googleapis";
import { prisma } from "./prisma";
import { pusher } from "./pusher";
import { categorizeEmail, generateEmailSummary } from "./ai";

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
  };
  internalDate: string;
}

/**
 * Fetches emails from Gmail API for a given account
 */
export async function fetchGmailEmails(
  accountId: string,
  maxResults: number = 10
) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { user: true },
  });

  if (!account || !account.access_token) {
    throw new Error("Account not found or missing access token");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Fetch list of messages
  const response = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    q: "in:inbox", // Only inbox emails
  });

  const messages = response.data.messages || [];

  // Fetch full message details for each
  const emailPromises = messages.map(async (msg) => {
    const fullMessage = await gmail.users.messages.get({
      userId: "me",
      id: msg.id!,
      format: "full",
    });

    return fullMessage.data as GmailMessage;
  });

  const fullMessages = await Promise.all(emailPromises);

  return fullMessages;
}

/**
 * Stores Gmail messages in the database
 */
export async function storeEmails(
  userId: string,
  accountId: string,
  messages: GmailMessage[]
) {
  const storedEmails = [];

  for (const message of messages) {
    const headers = message.payload.headers;
    const subject = headers.find((h) => h.name === "Subject")?.value || "";
    const from = headers.find((h) => h.name === "From")?.value || "";
    const to = headers.find((h) => h.name === "To")?.value || "";
    const date = headers.find((h) => h.name === "Date")?.value || "";

    // Check if email already exists
    const existing = await prisma.email.findUnique({
      where: { gmailId: message.id },
    });

    if (existing) {
      continue; // Skip if already stored
    }

    // Get user's categories for AI categorization
    const categories = await prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, description: true },
    });

    // Use AI to categorize the email
    let categoryId: string | null = null;
    let summary: string | null = null;

    if (categories.length > 0) {
      try {
        // Run categorization and summary generation in parallel
        const [suggestedCategory, emailSummary] = await Promise.all([
          categorizeEmail(
            {
              subject,
              from,
              snippet: message.snippet,
            },
            categories
          ),
          generateEmailSummary({
            subject,
            from,
            snippet: message.snippet,
          }),
        ]);

        // Find the category ID
        const category = categories.find((c) => c.name === suggestedCategory);
        categoryId = category?.id || null;
        summary = emailSummary;

        console.log(`[Email AI] "${subject}" → Category: ${suggestedCategory}, Summary: ${summary.substring(0, 50)}...`);
      } catch (error) {
        console.error("[Email AI] Error:", error);
        // If AI fails, find "General" category as fallback
        const generalCategory = categories.find(
          (c) => c.name.toLowerCase() === "general"
        );
        categoryId = generalCategory?.id || null;
        summary = message.snippet; // Fallback to snippet if summary fails
      }
    } else {
      // No categories, but still generate summary
      try {
        summary = await generateEmailSummary({
          subject,
          from,
          snippet: message.snippet,
        });
        console.log(`[Email Summary] "${subject}" → ${summary.substring(0, 50)}...`);
      } catch (error) {
        console.error("[Email Summary] Error:", error);
        summary = message.snippet;
      }
    }

    // Store new email with category and summary
    const email = await prisma.email.create({
      data: {
        userId,
        gmailId: message.id,
        threadId: message.threadId,
        subject,
        from,
        to: [to],
        snippet: message.snippet,
        summary,
        labelIds: message.labelIds || [],
        receivedAt: new Date(parseInt(message.internalDate)),
        categoryId,
      },
    });

    storedEmails.push(email);

    // Trigger Pusher event for real-time update
    await pusher.trigger(`user-${userId}`, "new-email", {
      email,
      accountId,
    });
  }

  return storedEmails;
}

/**
 * Sets up Gmail push notifications via Pub/Sub
 */
export async function watchGmailInbox(accountId: string) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
  });

  if (!account || !account.access_token) {
    throw new Error("Account not found or missing access token");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Set up push notification
  const response = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName: process.env.GMAIL_PUBSUB_TOPIC!, // We'll set this up next
      labelIds: ["INBOX"],
    },
  });

  // Store watch details in account
  await prisma.account.update({
    where: { id: accountId },
    data: {
      // We'll need to add these fields to the schema
      // historyId: response.data.historyId,
      // expiresAt: new Date(parseInt(response.data.expiration!)),
    },
  });

  return response.data;
}
