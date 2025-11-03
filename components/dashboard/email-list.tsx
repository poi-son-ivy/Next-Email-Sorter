"use client";

import { useState, useEffect } from "react";
import Pusher from "pusher-js";
import { Email } from "@/lib/generated/prisma";
import { EmailCard } from "./email-card";
import { EmailViewerModal } from "./email-viewer-modal";

interface EmailListProps {
  initialEmails: Email[];
  userId: string;
  selectedCategoryId: string | null;
  onNewEmail: (email: Email) => void;
}

export function EmailList({ initialEmails, userId, selectedCategoryId, onNewEmail }: EmailListProps) {
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [processedJobIds, setProcessedJobIds] = useState<Set<string>>(new Set());

  const handleEmailClick = (email: Email) => {
    setSelectedEmail(email);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedEmail(null), 300); // Clear after animation
  };

  const handleToggleSelect = (emailId: string) => {
    setSelectedEmailIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedEmailIds.size === initialEmails.length) {
      setSelectedEmailIds(new Set());
    } else {
      setSelectedEmailIds(new Set(initialEmails.map((e) => e.id)));
    }
  };

  const handleUnsubscribeSelected = async () => {
    if (selectedEmailIds.size === 0) return;

    const count = selectedEmailIds.size;
    if (!confirm(`Start unsubscribe process for ${count} email(s)?`)) {
      return;
    }

    setIsDeleting(true); // Reuse this loading state
    try {
      const response = await fetch("/api/queue/enqueue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailIds: Array.from(selectedEmailIds),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to enqueue unsubscribe jobs");
      }

      const result = await response.json();

      // Clear selection
      setSelectedEmailIds(new Set());

      // Show success message
      alert(`Successfully queued ${result.jobs.length} unsubscribe job(s). You'll be notified when complete.`);
    } catch (error: any) {
      console.error("Error enqueueing unsubscribe jobs:", error);
      alert(error.message || "Failed to start unsubscribe process");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedEmailIds.size === 0) return;

    if (!confirm(`Delete ${selectedEmailIds.size} email(s)? This will remove them from both the database and Gmail.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch("/api/emails/bulk-delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailIds: Array.from(selectedEmailIds),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete emails");
      }

      // Clear selection and reload
      setSelectedEmailIds(new Set());
      window.location.reload();
    } catch (error: any) {
      console.error("Error deleting emails:", error);
      alert(error.message || "Failed to delete emails");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    console.log("[Pusher] Initializing with key:", process.env.NEXT_PUBLIC_PUSHER_KEY);
    console.log("[Pusher] Cluster:", process.env.NEXT_PUBLIC_PUSHER_CLUSTER);

    // Initialize Pusher with error logging
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    // Log connection state changes
    pusher.connection.bind("state_change", (states: any) => {
      console.log(`[Pusher] State changed: ${states.previous} -> ${states.current}`);
    });

    pusher.connection.bind("error", (err: any) => {
      console.error("[Pusher] Connection error:", err);
    });

    pusher.connection.bind("connected", () => {
      console.log("[Pusher] Connected successfully!");
    });

    // Subscribe to user's channel
    const channel = pusher.subscribe(`user-${userId}`);

    console.log(`[Pusher] Subscribing to channel: user-${userId}`);

    // Log channel subscription
    channel.bind("pusher:subscription_succeeded", () => {
      console.log(`[Pusher] Successfully subscribed to user-${userId}`);
    });

    channel.bind("pusher:subscription_error", (status: any) => {
      console.error(`[Pusher] Subscription error:`, status);
    });

    // Listen for new email events
    channel.bind("new-email", (data: { email: Email; accountId: string }) => {
      console.log("[Pusher] Received new-email event:", data);

      // Add email to parent state (no filtering here - parent handles it)
      onNewEmail(data.email);
      console.log("[Pusher] Email sent to parent");

      // Optional: Show browser notification
      if (Notification.permission === "granted") {
        new Notification("New Email", {
          body: `${data.email.from}: ${data.email.subject}`,
          icon: "/favicon.ico",
        });
      }
    });

    // Listen for unsubscribe updates
    channel.bind("unsubscribe-update", (data: { jobId: string; status: string; message: string }) => {
      console.log("[Pusher] Received unsubscribe-update event:", data);

      // Deduplicate events - only process each job once
      if (processedJobIds.has(data.jobId)) {
        console.log("[Pusher] Already processed job", data.jobId, "- ignoring duplicate");
        return;
      }

      setProcessedJobIds(prev => new Set(prev).add(data.jobId));

      // Show alert based on status
      let message = data.message;

      if (data.status === "success") {
        message = `✓ ${data.message}\n\nTip: Refresh the page to see the yellow border. Check in a few days to verify you stopped receiving emails.`;
      } else if (data.status === "needs_confirmation") {
        message = `⚠ ${data.message}\n\nPlease check the unsubscribe link manually.`;
      } else if (data.status === "failed") {
        message = `✗ ${data.message}`;
      }

      alert(message);

      // Log to console for debugging
      console.log(`[Unsubscribe] ${data.status}: ${data.message}`);
    });

    // Cleanup on unmount
    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, [userId, onNewEmail]);

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Inbox
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {initialEmails.length} {initialEmails.length === 1 ? "email" : "emails"}
              {selectedEmailIds.size > 0 && ` (${selectedEmailIds.size} selected)`}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {initialEmails.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                title={selectedEmailIds.size === initialEmails.length ? "Deselect all" : "Select all"}
              >
                {selectedEmailIds.size === initialEmails.length ? "Deselect all" : "Select all"}
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Refresh"
            >
              <svg
                className="w-5 h-5 text-gray-600 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedEmailIds.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-6 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              {selectedEmailIds.size} email{selectedEmailIds.size !== 1 ? "s" : ""} selected
            </p>
            <div className="flex items-center gap-2">
              {/* Unsubscribe Button */}
              <button
                onClick={handleUnsubscribeSelected}
                disabled={isDeleting}
                className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Unsubscribe
              </button>

              {/* Delete Button */}
              <button
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email List */}
      <div className="flex-1 overflow-y-auto">
        {initialEmails.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 mb-4">
              <svg
                className="w-8 h-8 text-gray-400 dark:text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
              No emails yet
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Click "Load Emails" on an account to fetch emails
            </p>
          </div>
        ) : (
          initialEmails.map((email) => (
            <EmailCard
              key={email.id}
              email={email}
              onClick={() => handleEmailClick(email)}
              isSelected={selectedEmailIds.has(email.id)}
              onToggleSelect={() => handleToggleSelect(email.id)}
            />
          ))
        )}
      </div>

      {/* Email Viewer Modal */}
      <EmailViewerModal
        email={selectedEmail}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
