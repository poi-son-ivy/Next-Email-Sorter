import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { JobStatus } from "@/lib/generated/prisma";

/**
 * Enqueue unsubscribe jobs for multiple emails
 * Uses Inngest for reliable background processing with no timeout limits
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

    // Create jobs in database
    const jobs = await Promise.all(
      emailIds.map((emailId) =>
        prisma.unsubscribeJob.create({
          data: {
            emailId,
            userId: session.user.id!,
            priority: 0,
            status: JobStatus.PENDING,
            scheduledFor: new Date(),
          },
        })
      )
    );

    // Send events to Inngest for background processing
    await Promise.all(
      jobs.map((job) =>
        inngest.send({
          name: "email/unsubscribe.requested",
          data: {
            emailId: job.emailId,
            userId: session.user.id!,
            jobId: job.id,
          },
        })
      )
    );

    console.log(`[Queue API] Sent ${jobs.length} event(s) to Inngest`);

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
