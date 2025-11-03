import { NextResponse } from "next/server";
import { unsubscribeQueue } from "@/lib/queue/unsubscribe-queue";

/**
 * Start the queue processor
 * This should be called on server startup
 */
export async function POST() {
  try {
    unsubscribeQueue.start();

    return NextResponse.json({
      success: true,
      message: "Queue started",
    });
  } catch (error: any) {
    console.error("[Queue API] Error starting queue:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start queue" },
      { status: 500 }
    );
  }
}

/**
 * Get queue running status
 */
export async function GET() {
  try {
    const stats = await unsubscribeQueue.getStats();

    return NextResponse.json({
      isRunning: stats.isRunning,
      stats,
    });
  } catch (error: any) {
    console.error("[Queue API] Error getting queue status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get queue status" },
      { status: 500 }
    );
  }
}
