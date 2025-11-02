import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || state !== session.user.id) {
    return NextResponse.redirect(
      new URL("/dashboard?error=invalid_request", request.url)
    );
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/auth/add-account/callback`
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.id || !profile.email) {
      throw new Error("Failed to get user profile");
    }

    // Check if this account is already connected
    const existingAccount = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: profile.id,
        },
      },
    });

    if (existingAccount) {
      // Update existing account with new tokens
      await prisma.account.update({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: profile.id,
          },
        },
        data: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || existingAccount.refresh_token,
          expires_at: tokens.expiry_date
            ? Math.floor(tokens.expiry_date / 1000)
            : null,
          email: profile.email,
          name: profile.name || null,
          picture: profile.picture || null,
        },
      });
    } else {
      // Create new account linked to the current user
      await prisma.account.create({
        data: {
          userId: session.user.id,
          type: "oauth",
          provider: "google",
          providerAccountId: profile.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: tokens.expiry_date
            ? Math.floor(tokens.expiry_date / 1000)
            : null,
          token_type: tokens.token_type || "Bearer",
          scope: tokens.scope,
          id_token: tokens.id_token,
          email: profile.email,
          name: profile.name || null,
          picture: profile.picture || null,
        },
      });
    }

    return NextResponse.redirect(
      new URL("/dashboard?success=account_added", request.url)
    );
  } catch (error) {
    console.error("[Add Account] Error:", error);
    return NextResponse.redirect(
      new URL("/dashboard?error=failed_to_add", request.url)
    );
  }
}
