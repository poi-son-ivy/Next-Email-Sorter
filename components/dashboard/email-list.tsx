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

  const handleEmailClick = (email: Email) => {
    setSelectedEmail(email);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedEmail(null), 300); // Clear after animation
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
            </p>
          </div>

          {/* Refresh Button */}
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
            <EmailCard key={email.id} email={email} onClick={() => handleEmailClick(email)} />
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
