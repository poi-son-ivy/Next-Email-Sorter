/**
 * Auto-start the unsubscribe queue when the server starts
 */

import { unsubscribeQueue } from "./queue/unsubscribe-queue";

// Only run on server-side
if (typeof window === "undefined") {
  console.log("[Queue Init] Starting unsubscribe queue...");
  unsubscribeQueue.start();
}

export { unsubscribeQueue };
