/**
 * Manually fetch and parse unsubscribe URL for a specific email
 */

import { google } from "googleapis";
import { prisma } from "../lib/prisma";
import { findUnsubscribeLinkInHeader, findUnsubscribeLinkInBody } from "../lib/unsubscribe";

async function fixNewsletterEmail() {
  const emailId = "cmhinl919000bjx04agrdnx7s"; // The 7am Novelist email

  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { user: { include: { accounts: true } } },
  });

  if (!email) {
    console.log("Email not found");
    return;
  }

  console.log(`Fetching Gmail message for: "${email.subject}"`);

  const account = email.user.accounts.find((a) => a.provider === "google");
  if (!account || !account.access_token) {
    console.log("No Google account found");
    return;
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

  // Fetch full message from Gmail
  const message = await gmail.users.messages.get({
    userId: "me",
    id: email.gmailId,
    format: "full",
  });

  const headers = message.data.payload?.headers || [];
  const subject = headers.find((h) => h.name === "Subject")?.value || "";

  // Try header first
  const listUnsubscribe = headers.find((h) => h.name === "List-Unsubscribe")?.value || "";
  let unsubscribeUrl = findUnsubscribeLinkInHeader(listUnsubscribe);

  if (unsubscribeUrl) {
    console.log(`✓ Found in header: ${unsubscribeUrl}`);
  } else {
    console.log("Not in header, trying body...");

    // Try body
    const payload = message.data.payload;
    let emailBody = "";

    if (payload?.body?.data) {
      emailBody = Buffer.from(payload.body.data, "base64").toString("utf-8");
    } else if (payload?.parts) {
      const htmlPart = payload.parts.find((part: any) => part.mimeType === "text/html");
      if (htmlPart?.body?.data) {
        emailBody = Buffer.from(htmlPart.body.data, "base64").toString("utf-8");
      }
    }

    if (emailBody) {
      console.log(`Email body: ${emailBody.length} chars`);
      unsubscribeUrl = findUnsubscribeLinkInBody(emailBody);
      if (unsubscribeUrl) {
        console.log(`✓ Found in body: ${unsubscribeUrl}`);
      } else {
        console.log("✗ No unsubscribe link found in body");
      }
    }
  }

  if (unsubscribeUrl) {
    await prisma.email.update({
      where: { id: emailId },
      data: { unsubscribeUrl },
    });
    console.log(`\n✓ Updated email with unsubscribe URL!`);
  } else {
    console.log(`\n✗ Could not find unsubscribe URL`);
  }

  await prisma.$disconnect();
}

fixNewsletterEmail().catch(console.error);
