/**
 * Backfill unsubscribeStatus for emails that have completed jobs
 * but don't have their status set (from before we added status updates)
 */

import { prisma } from "../lib/prisma";

async function backfillEmailStatuses() {
  console.log("Finding emails with completed jobs but no status...");

  // Find emails that have unsubscribe jobs but no status set
  const emails = await prisma.email.findMany({
    where: {
      unsubscribeStatus: null,
      unsubscribeJobs: {
        some: {
          status: {
            in: ["COMPLETED", "FAILED", "NEEDS_CONFIRMATION"],
          },
        },
      },
    },
    include: {
      unsubscribeJobs: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });

  console.log(`Found ${emails.length} emails to update`);

  if (emails.length === 0) {
    console.log("No emails need updating!");
    return;
  }

  // Update each email to ATTEMPTED status
  for (const email of emails) {
    const job = email.unsubscribeJobs[0];
    console.log(`Updating email: "${email.subject?.substring(0, 50)}"`);
    console.log(`  Latest job: ${job.status}`);

    await prisma.email.update({
      where: { id: email.id },
      data: { unsubscribeStatus: "ATTEMPTED" },
    });
  }

  console.log(`✓ Updated ${emails.length} emails to ATTEMPTED status (yellow border)`);
  console.log("\nRefresh your browser to see the yellow borders!");
}

backfillEmailStatuses()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
