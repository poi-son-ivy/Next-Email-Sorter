import { google } from "googleapis";
import { prisma } from "./prisma";
import { pusher } from "./pusher";
import { categorizeEmail, generateEmailSummary } from "./ai";

/**
 * Fetches only NEW emails since the last historyId
 * This ensures we only process emails that arrived after we started watching
 */
export async function fetchNewGmailEmails(accountId: string) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { user: true },
  });

  if (!account || !account.access_token) {
    throw new Error("Account not found or missing access token");
  }

  if (!account.historyId) {
    console.log("[Gmail] No historyId found, skipping - account not watched yet");
    return [];
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

  try {
    // Get history of changes since last historyId
    const historyResponse = await gmail.users.history.list({
      userId: "me",
      startHistoryId: account.historyId,
      historyTypes: ["messageAdded"],
      labelId: "INBOX",
    });

    const history = historyResponse.data.history || [];

    if (history.length === 0) {
      console.log("[Gmail] No new messages in history");
      return [];
    }

    // Extract message IDs from history
    const messageIds = history
      .flatMap((h) => h.messagesAdded || [])
      .map((m) => m.message?.id)
      .filter((id): id is string => !!id);

    if (messageIds.length === 0) {
      console.log("[Gmail] No new message IDs found");
      return [];
    }

    console.log(`[Gmail] Found ${messageIds.length} new messages`);

    // Fetch full message details
    const messagePromises = messageIds.map(async (messageId) => {
      const fullMessage = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
      });
      return fullMessage.data;
    });

    const messages = await Promise.all(messagePromises);

    // Update historyId to latest
    const latestHistoryId = historyResponse.data.historyId;
    if (latestHistoryId) {
      await prisma.account.update({
        where: { id: accountId },
        data: { historyId: latestHistoryId },
      });
    }

    return messages;
  } catch (error: any) {
    if (error.code === 404) {
      // History expired, need to re-watch
      console.log("[Gmail] History expired, need to re-watch account");
      await refreshWatch(accountId);
      return [];
    }
    throw error;
  }
}

/**
 * Stores new emails and triggers Pusher events
 */
export async function processAndStoreNewEmails(
  userId: string,
  accountId: string,
  messages: any[]
) {
  const storedEmails = [];

  for (const message of messages) {
    const headers = message.payload.headers;
    const subject = headers.find((h: any) => h.name === "Subject")?.value || "";
    const from = headers.find((h: any) => h.name === "From")?.value || "";
    const to = headers.find((h: any) => h.name === "To")?.value || "";

    // Check if email already exists
    const existing = await prisma.email.findUnique({
      where: { gmailId: message.id },
    });

    if (existing) {
      console.log(`[Gmail] Email ${message.id} already exists, skipping`);
      continue;
    }

    // Get user's categories for AI categorization
    const categories = await prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, description: true },
    });

    // Use AI to categorize the email and generate summary
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

    console.log(`[Gmail] Stored new email: ${email.subject}`);

    // Archive the email in Gmail after processing
    await archiveEmailInGmail(accountId, message.id);

    // Trigger Pusher event for real-time update
    await pusher.trigger(`user-${userId}`, "new-email", {
      email,
      accountId,
    });
  }

  return storedEmails;
}

/**
 * Archives an email in Gmail (removes from INBOX)
 */
export async function archiveEmailInGmail(accountId: string, messageId: string) {
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

  // Remove INBOX label to archive
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      removeLabelIds: ["INBOX"],
    },
  });

  console.log(`[Gmail] Archived email ${messageId}`);
}

/**
 * Starts watching a Gmail account for new emails
 */
export async function startWatchingGmail(accountId: string) {
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

  // Get current historyId
  const profile = await gmail.users.getProfile({ userId: "me" });
  const currentHistoryId = profile.data.historyId;

  // Start watching for push notifications
  const watchResponse = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName: process.env.GMAIL_PUBSUB_TOPIC!,
      labelIds: ["INBOX"],
    },
  });

  // Store historyId and expiration
  await prisma.account.update({
    where: { id: accountId },
    data: {
      historyId: currentHistoryId || watchResponse.data.historyId,
      watchExpiration: new Date(parseInt(watchResponse.data.expiration!)),
    },
  });

  console.log(`[Gmail] Started watching account ${accountId}`);
  console.log(`[Gmail] HistoryId: ${currentHistoryId}`);
  console.log(`[Gmail] Expires: ${new Date(parseInt(watchResponse.data.expiration!))}`);

  return watchResponse.data;
}

/**
 * Refreshes an expired watch
 */
async function refreshWatch(accountId: string) {
  console.log(`[Gmail] Refreshing watch for account ${accountId}`);
  await startWatchingGmail(accountId);
}
