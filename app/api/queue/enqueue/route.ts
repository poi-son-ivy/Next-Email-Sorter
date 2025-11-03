import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unsubscribeQueue } from "@/lib/queue/unsubscribe-queue";

/**
 * Enqueue unsubscribe jobs for multiple emails
 */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { emailIds } = body;

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json(
        { error: "emailIds array is required" },
        { status: 400 }
      );
    }

    console.log(`[Queue API] Enqueueing ${emailIds.length} unsubscribe job(s) for user ${session.user.id}`);

    // Enqueue all jobs
    const jobs = await Promise.all(
      emailIds.map((emailId) =>
        unsubscribeQueue.enqueue(emailId, session.user.id!)
      )
    );

    return NextResponse.json({
      success: true,
      message: `Enqueued ${jobs.length} unsubscribe job(s)`,
      jobs: jobs.map((job) => ({
        id: job.id,
        emailId: job.emailId,
        status: job.status,
      })),
    });
  } catch (error: any) {
    console.error("[Queue API] Error enqueueing jobs:", error);
    return NextResponse.json(
      { error: error.message || "Failed to enqueue jobs" },
      { status: 500 }
    );
  }
}
