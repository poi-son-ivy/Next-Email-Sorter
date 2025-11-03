/**
 * Database-backed queue for processing unsubscribe jobs
 */

import { prisma } from "@/lib/prisma";
import { JobStatus } from "@/lib/generated/prisma";
import { unsubscribeEmail } from "@/lib/unsubscribe/executor";
import { pusher } from "@/lib/pusher";

export class UnsubscribeQueue {
  private isRunning = false;
  private concurrency = 3; // Max 3 simultaneous unsubscribes
  private pollInterval = 2000; // Check for jobs every 2 seconds
  private activeJobs = new Set<string>();
  private pollTimeout: NodeJS.Timeout | null = null;

  /**
   * Add a job to the queue
   */
  async enqueue(emailId: string, userId: string, priority = 0) {
    const job = await prisma.unsubscribeJob.create({
      data: {
        emailId,
        userId,
        priority,
        status: JobStatus.PENDING,
        scheduledFor: new Date(),
      },
    });

    console.log(`[Queue] ✓ Enqueued job ${job.id} for email ${emailId}`);

    // Start processing if not already running
    if (!this.isRunning) {
      this.start();
    }

    return job;
  }

  /**
   * Start the queue processor
   */
  start() {
    if (this.isRunning) {
      console.log("[Queue] Already running");
      return;
    }

    this.isRunning = true;
    console.log("[Queue] ▶ Started processing jobs");
    this.processLoop();
  }

  /**
   * Stop the queue processor
   */
  stop() {
    this.isRunning = false;
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }
    console.log("[Queue] ⏹ Stopped processing jobs");
  }

  /**
   * Main processing loop
   */
  private async processLoop() {
    while (this.isRunning) {
      try {
        await this.processNextBatch();
      } catch (error) {
        console.error("[Queue] Error in process loop:", error);
      }

      // Wait before next poll
      await new Promise((resolve) => {
        this.pollTimeout = setTimeout(resolve, this.pollInterval);
      });
    }
  }

  /**
   * Process next batch of jobs
   */
  private async processNextBatch() {
    // How many slots available?
    const availableSlots = this.concurrency - this.activeJobs.size;
    if (availableSlots <= 0) {
      return;
    }

    // Fetch pending jobs
    const jobs = await prisma.unsubscribeJob.findMany({
      where: {
        status: JobStatus.PENDING,
        scheduledFor: {
          lte: new Date(), // Only jobs scheduled for now or past
        },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: availableSlots,
      include: {
        email: true,
        user: true,
      },
    });

    if (jobs.length === 0) {
      return;
    }

    console.log(`[Queue] Processing ${jobs.length} job(s)`);

    // Process each job (fire and forget)
    for (const job of jobs) {
      this.processJob(job).catch((error) => {
        console.error(`[Queue] Unexpected error processing job ${job.id}:`, error);
      });
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: any) {
    const jobId = job.id;
    this.activeJobs.add(jobId);

    try {
      // Mark as processing
      await prisma.unsubscribeJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.PROCESSING,
          startedAt: new Date(),
          attempts: job.attempts + 1,
        },
      });

      console.log(`[Queue] 🔄 Processing job ${jobId} (attempt ${job.attempts + 1}/${job.maxAttempts})`);
      console.log(`[Queue]    Email: "${job.email.subject}"`);

      // Execute the unsubscribe
      const result = await unsubscribeEmail(job.emailId, job.userId);

      console.log(`[Queue]    Result: ${result.status} (${result.method || "none"})`);

      // Update job based on result
      if (result.status === "success") {
        // Store result with screenshots and AI reasoning if available
        const jobResult: any = {
          status: result.status,
          method: result.method,
          message: result.message,
          url: result.url,
        };

        // Add Playwright-specific data if present
        if (result.screenshotBase64) {
          jobResult.screenshotBase64 = result.screenshotBase64;
        }
        if (result.steps) {
          jobResult.steps = result.steps;
        }
        if (result.aiReasoning) {
          jobResult.aiReasoning = result.aiReasoning;
        }

        await prisma.unsubscribeJob.update({
          where: { id: jobId },
          data: {
            status: JobStatus.COMPLETED,
            completedAt: new Date(),
            result: jobResult,
          },
        });

        // Set email status to ATTEMPTED (yellow border)
        await prisma.email.update({
          where: { id: job.emailId },
          data: { unsubscribeStatus: "ATTEMPTED" },
        });

        console.log(`[Queue] ✓ Job ${jobId} completed successfully`);

        // Notify user via Pusher
        await this.notifyUser(job.userId, jobId, "success", result.message);
      } else if (result.status === "needs_confirmation") {
        // Store result with screenshots and AI reasoning if available
        const jobResult: any = {
          status: result.status,
          method: result.method,
          message: result.message,
          url: result.url,
        };

        if (result.screenshotBase64) {
          jobResult.screenshotBase64 = result.screenshotBase64;
        }
        if (result.steps) {
          jobResult.steps = result.steps;
        }
        if (result.aiReasoning) {
          jobResult.aiReasoning = result.aiReasoning;
        }

        await prisma.unsubscribeJob.update({
          where: { id: jobId },
          data: {
            status: JobStatus.NEEDS_CONFIRMATION,
            completedAt: new Date(),
            result: jobResult,
          },
        });

        // Set email status to ATTEMPTED (yellow border)
        await prisma.email.update({
          where: { id: job.emailId },
          data: { unsubscribeStatus: "ATTEMPTED" },
        });

        console.log(`[Queue] ⚠ Job ${jobId} needs user confirmation`);

        // Notify user
        await this.notifyUser(job.userId, jobId, "needs_confirmation", result.message);
      } else if (result.status === "no_url") {
        await prisma.unsubscribeJob.update({
          where: { id: jobId },
          data: {
            status: JobStatus.FAILED,
            completedAt: new Date(),
            result: result as any,
            error: result.message,
          },
        });

        console.log(`[Queue] ✗ Job ${jobId} failed: no unsubscribe URL`);

        // Notify user
        await this.notifyUser(job.userId, jobId, "failed", result.message);
      } else {
        // Failure - retry or mark as failed
        await this.handleFailure(job, result);
      }
    } catch (error: any) {
      console.error(`[Queue] ✗ Job ${jobId} error:`, error);
      await this.handleFailure(job, {
        status: "failure" as const,
        message: "Unexpected error",
        error: error.message,
      });
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Handle job failure - NO RETRIES
   * We try once with Playwright + AI, if it fails we mark it for manual review
   */
  private async handleFailure(job: any, result: any) {
    // Store result with screenshots and AI reasoning if available
    const jobResult: any = {
      status: result.status,
      message: result.message,
    };

    if (result.screenshotBase64) {
      jobResult.screenshotBase64 = result.screenshotBase64;
    }
    if (result.steps) {
      jobResult.steps = result.steps;
    }
    if (result.aiReasoning) {
      jobResult.aiReasoning = result.aiReasoning;
    }

    // No retries - just mark as failed immediately
    await prisma.unsubscribeJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        completedAt: new Date(),
        error: result.error || result.message,
        result: jobResult,
      },
    });

    // Set email status to ATTEMPTED (yellow border) even on failure
    // This shows the user we tried to unsubscribe
    await prisma.email.update({
      where: { id: job.emailId },
      data: { unsubscribeStatus: "ATTEMPTED" },
    });

    console.log(`[Queue] ✗ Job ${job.id} failed: ${result.error || result.message}`);

    // Notify user of failure
    await this.notifyUser(
      job.userId,
      job.id,
      "failed",
      result.message || "Failed to unsubscribe - may require manual action"
    );
  }

  /**
   * Notify user via Pusher
   */
  private async notifyUser(userId: string, jobId: string, status: string, message: string) {
    try {
      await pusher.trigger(`user-${userId}`, "unsubscribe-update", {
        jobId,
        status,
        message,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Queue] Failed to send Pusher notification:", error);
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string) {
    return await prisma.unsubscribeJob.findUnique({
      where: { id: jobId },
      include: { email: true },
    });
  }

  /**
   * Get all jobs for a user
   */
  async getUserJobs(userId: string, limit = 50) {
    return await prisma.unsubscribeJob.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { email: true },
    });
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string) {
    const job = await prisma.unsubscribeJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error("Job not found");
    }

    if (job.status === JobStatus.PROCESSING) {
      throw new Error("Cannot cancel job that is currently processing");
    }

    await prisma.unsubscribeJob.update({
      where: { id: jobId },
      data: { status: JobStatus.CANCELLED },
    });

    console.log(`[Queue] Cancelled job ${jobId}`);
  }

  /**
   * Get queue stats
   */
  async getStats() {
    const [pending, processing, completed, failed, needsConfirmation] = await Promise.all([
      prisma.unsubscribeJob.count({ where: { status: JobStatus.PENDING } }),
      prisma.unsubscribeJob.count({ where: { status: JobStatus.PROCESSING } }),
      prisma.unsubscribeJob.count({ where: { status: JobStatus.COMPLETED } }),
      prisma.unsubscribeJob.count({ where: { status: JobStatus.FAILED } }),
      prisma.unsubscribeJob.count({ where: { status: JobStatus.NEEDS_CONFIRMATION } }),
    ]);

    return {
      pending,
      processing,
      completed,
      failed,
      needsConfirmation,
      activeJobs: this.activeJobs.size,
      isRunning: this.isRunning,
    };
  }
}

// Singleton instance
export const unsubscribeQueue = new UnsubscribeQueue();
