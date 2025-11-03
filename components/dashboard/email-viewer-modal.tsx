"use client";

import { useEffect, useState } from "react";
import { Email } from "@/lib/generated/prisma";

interface EmailViewerModalProps {
  email: Email | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EmailViewerModal({ email, isOpen, onClose }: EmailViewerModalProps) {
  const [fullEmailHtml, setFullEmailHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [deletedFromGmail, setDeletedFromGmail] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    if (isOpen && email) {
      fetchFullEmail(email.id);
    }
  }, [isOpen, email]);

  const fetchFullEmail = async (emailId: string) => {
    setIsLoading(true);
    setDeletedFromGmail(false);
    try {
      const response = await fetch(`/api/emails/${emailId}`);
      if (!response.ok) throw new Error("Failed to fetch email");

      const data = await response.json();
      setFullEmailHtml(data.body || email?.snippet || "");
      setDeletedFromGmail(data.deletedFromGmail || false);
    } catch (error) {
      console.error("Error fetching full email:", error);
      setFullEmailHtml(email?.snippet || "No content available");
    } finally {
      setIsLoading(false);
    }
  };

  const decodeHtml = (html: string) => {
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&#x27;': "'",
      '&apos;': "'",
    };

    return html.replace(/&[#\w]+;/g, (entity) => {
      return entities[entity] || entity;
    });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen || !email) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleUpdateUnsubscribeStatus = async (status: "SUCCEEDED" | "FAILED") => {
    if (!email) return;

    setIsUpdatingStatus(true);
    try {
      const response = await fetch(`/api/emails/${email.id}/unsubscribe-status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update status");
      }

      // Refresh the page to show updated border
      window.location.reload();
    } catch (error: any) {
      console.error("Error updating unsubscribe status:", error);
      alert(error.message || "Failed to update unsubscribe status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1 min-w-0 mr-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {email.subject ? decodeHtml(email.subject) : "(No subject)"}
            </h2>

            {/* From */}
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
              <span className="font-medium">From:</span>
              <span>{decodeHtml(email.from)}</span>
            </div>

            {/* To */}
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
              <span className="font-medium">To:</span>
              <span>{email.to[0] || "Unknown"}</span>
            </div>

            {/* Date */}
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Date:</span>
              <span>{formatDate(email.receivedAt)}</span>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Deleted from Gmail Notice */}
        {deletedFromGmail && (
          <div className="mx-6 mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Email not found in Gmail
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  This email has been archived or deleted from your Gmail account. Showing the saved preview only.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Email Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <svg
                  className="animate-spin h-8 w-8 text-blue-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <p className="text-sm text-gray-600 dark:text-gray-400">Loading email...</p>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {/* Display email body - handle both HTML and plain text */}
              {fullEmailHtml.includes('<') ? (
                <div
                  dangerouslySetInnerHTML={{ __html: fullEmailHtml }}
                  className="email-content"
                />
              ) : (
                <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                  {decodeHtml(fullEmailHtml)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {email.labelIds.map((label) => (
                <span
                  key={label}
                  className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded"
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {/* Show unsubscribe status feedback buttons for any status */}
              {email.unsubscribeStatus && (
                <>
                  <button
                    onClick={() => handleUpdateUnsubscribeStatus("SUCCEEDED")}
                    disabled={isUpdatingStatus || email.unsubscribeStatus === "SUCCEEDED"}
                    className={`px-3 py-1.5 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 ${
                      email.unsubscribeStatus === "SUCCEEDED"
                        ? "bg-green-700 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                    title={email.unsubscribeStatus === "SUCCEEDED" ? "Already marked as successful" : "Mark unsubscribe as successful"}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Worked</span>
                  </button>
                  <button
                    onClick={() => handleUpdateUnsubscribeStatus("FAILED")}
                    disabled={isUpdatingStatus || email.unsubscribeStatus === "FAILED"}
                    className={`px-3 py-1.5 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 ${
                      email.unsubscribeStatus === "FAILED"
                        ? "bg-red-700 cursor-not-allowed"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                    title={email.unsubscribeStatus === "FAILED" ? "Already marked as failed" : "Mark unsubscribe as failed"}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>Failed</span>
                  </button>
                </>
              )}

              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
