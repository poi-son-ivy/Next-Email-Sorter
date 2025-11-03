/**
 * Clean up pending jobs that were scheduled for retry
 * These jobs exist from the old retry logic and should be marked as failed
 */

import { prisma } from "../lib/prisma";
import { JobStatus } from "../lib/generated/prisma";

async function cleanupRetryJobs() {
  console.log("Looking for pending retry jobs...");

  // Find all PENDING jobs with attempts > 0 (these are retries from old logic)
  const retryJobs = await prisma.unsubscribeJob.findMany({
    where: {
      status: JobStatus.PENDING,
      attempts: {
        gt: 0,
      },
    },
    include: {
      email: true,
    },
  });

  console.log(`Found ${retryJobs.length} pending retry jobs`);

  if (retryJobs.length === 0) {
    console.log("No cleanup needed!");
    return;
  }

  // Mark them all as failed
  for (const job of retryJobs) {
    console.log(`Marking job ${job.id} as failed (was attempt ${job.attempts})`);
    console.log(`  Email: "${job.email.subject}"`);

    await prisma.unsubscribeJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        completedAt: new Date(),
        error: "Cancelled - retry logic has been disabled",
      },
    });
  }

  console.log(`✓ Cleaned up ${retryJobs.length} jobs`);
}

cleanupRetryJobs()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
