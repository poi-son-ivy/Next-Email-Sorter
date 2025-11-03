import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unsubscribeQueue } from "@/lib/queue/unsubscribe-queue";

/**
 * Get detailed job information
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
    const { id: jobId } = await params;

    const job = await unsubscribeQueue.getJobStatus(jobId);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Verify job belongs to user
    if (job.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      id: job.id,
      emailId: job.emailId,
      emailSubject: job.email?.subject,
      emailFrom: job.email?.from,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      scheduledFor: job.scheduledFor,
      result: job.result,
      error: job.error,
    });
  } catch (error: any) {
    console.error("[Queue API] Error fetching job:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch job" },
      { status: 500 }
    );
  }
}
