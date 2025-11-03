import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { unsubscribeEmail } from "@/lib/unsubscribe/executor";
import { pusher } from "@/lib/pusher";
import { JobStatus } from "@/lib/generated/prisma";

/**
 * Inngest function to process unsubscribe jobs
 * Runs on Inngest's infrastructure with no timeout limits
 */
export const processUnsubscribe = inngest.createFunction(
  {
    id: "process-unsubscribe",
    name: "Process Unsubscribe Email",
    throttle: {
      limit: 3,
      period: "1m", // Max 3 concurrent unsubscribes per minute
    },
    retries: 2, // Retry failed jobs up to 2 times
  },
  { event: "email/unsubscribe.requested" },
  async ({ event, step }) => {
    const { emailId, userId, jobId } = event.data;

    console.log(`[Inngest] Processing unsubscribe job ${jobId} for email ${emailId}`);

    // Mark job as processing
    await step.run("mark-processing", async () => {
      await prisma.unsubscribeJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.PROCESSING,
          startedAt: new Date(),
        },
      });
    });

    // Call the Render.com worker to execute unsubscribe with Puppeteer
    const result = await step.run("execute-unsubscribe", async () => {
      const workerUrl = process.env.WORKER_URL || 'http://localhost:3001';
      const workerApiKey = process.env.WORKER_API_KEY || 'change-me-in-production';

      console.log(`[Inngest] Calling worker at ${workerUrl}`);

      // Call worker API
      const response = await fetch(`${workerUrl}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': workerApiKey,
        },
        body: JSON.stringify({ jobId }),
      });

      if (!response.ok) {
        throw new Error(`Worker returned ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      console.log(`[Inngest] Worker accepted job ${jobId}`);

      // Worker processes in background, so we return a pending status
      // The worker will update the database directly when done
      return {
        status: 'success',
        method: 'puppeteer',
        message: 'Job sent to worker for processing',
      };
    });

    console.log(`[Inngest] Job ${jobId} sent to worker`);

    // Note: The worker will update the job status and email status directly
    // when processing completes. We don't need to do it here.
    // The worker has direct database access and will:
    // 1. Update job status to COMPLETED/FAILED/NEEDS_CONFIRMATION
    // 2. Update email unsubscribeStatus to SUCCEEDED if successful
    // 3. Store the result in the job record

    return {
      jobId,
      emailId,
      status: result.status,
      method: result.method,
    };
  }
);

/**
 * Export all Inngest functions
 */
export const functions = [processUnsubscribe];
