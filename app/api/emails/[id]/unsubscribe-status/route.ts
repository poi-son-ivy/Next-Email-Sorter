import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UnsubscribeStatus } from "@/lib/generated/prisma";

/**
 * Update unsubscribe status for an email (user feedback)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: emailId } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !["SUCCEEDED", "FAILED"].includes(status)) {
      return NextResponse.json(
        { error: "Status must be SUCCEEDED or FAILED" },
        { status: 400 }
      );
    }

    // Verify email belongs to user
    const email = await prisma.email.findUnique({
      where: { id: emailId },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    if (email.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update status
    const updated = await prisma.email.update({
      where: { id: emailId },
      data: { unsubscribeStatus: status as UnsubscribeStatus },
    });

    console.log(
      `[Unsubscribe Feedback] User marked email "${email.subject}" as ${status}`
    );

    return NextResponse.json({
      success: true,
      email: {
        id: updated.id,
        subject: updated.subject,
        unsubscribeStatus: updated.unsubscribeStatus,
      },
    });
  } catch (error: any) {
    console.error("[Unsubscribe Status API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update status" },
      { status: 500 }
    );
  }
}
