import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: accountId } = await params;

    // Verify the account belongs to the user
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (account.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You don't have permission to delete this account" },
        { status: 403 }
      );
    }

    // Delete all emails associated with this account
    // Match emails by the account's email address in the 'to' field
    if (account.email) {
      // First, find all emails that might belong to this account
      // The 'to' field might contain "Name <email@example.com>" format
      const userEmails = await prisma.email.findMany({
        where: {
          userId: session.user.id,
        },
        select: {
          id: true,
          to: true,
        },
      });

      // Filter emails where the 'to' field contains the account email
      const emailIdsToDelete = userEmails
        .filter((email) =>
          email.to.some((recipient) =>
            recipient.toLowerCase().includes(account.email!.toLowerCase())
          )
        )
        .map((email) => email.id);

      if (emailIdsToDelete.length > 0) {
        const deletedEmails = await prisma.email.deleteMany({
          where: {
            id: {
              in: emailIdsToDelete,
            },
          },
        });
        console.log(`[Account Delete] Deleted ${deletedEmails.count} emails for account ${account.email}`);
      } else {
        console.log(`[Account Delete] No emails found for account ${account.email}`);
      }
    }

    // Delete the account
    await prisma.account.delete({
      where: { id: accountId },
    });

    return NextResponse.json({
      success: true,
      message: "Account and associated emails deleted successfully"
    });
  } catch (error: any) {
    console.error("[Account Delete] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete account" },
      { status: 500 }
    );
  }
}
