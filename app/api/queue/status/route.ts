import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unsubscribeQueue } from "@/lib/queue/unsubscribe-queue";

/**
 * Get queue stats and user's jobs
 */
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [stats, userJobs] = await Promise.all([
      unsubscribeQueue.getStats(),
      unsubscribeQueue.getUserJobs(session.user.id, 20),
    ]);

    return NextResponse.json({
      stats,
      recentJobs: userJobs.map((job) => ({
        id: job.id,
        emailId: job.emailId,
        emailSubject: job.email.subject,
        status: job.status,
        attempts: job.attempts,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        result: job.result,
        error: job.error,
      })),
    });
  } catch (error: any) {
    console.error("[Queue API] Error fetching status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch queue status" },
      { status: 500 }
    );
  }
}
