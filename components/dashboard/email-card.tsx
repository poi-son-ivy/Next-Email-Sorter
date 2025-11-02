"use client";

import { Email } from "@/lib/generated/prisma";

interface EmailCardProps {
  email: Email;
  onClick: () => void;
}

export function EmailCard({ email, onClick }: EmailCardProps) {
  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;

    return new Date(date).toLocaleDateString();
  };

  // Decode HTML entities (&#39; -> ', &amp; -> &, etc.)
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

  return (
    <div
      onClick={onClick}
      className="group bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
          {email.from.charAt(0).toUpperCase()}
        </div>

        {/* Email Content */}
        <div className="flex-1 min-w-0">
          {/* From & Time */}
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {email.from.split("<")[0].trim() || email.from}
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
              {formatDate(email.receivedAt)}
            </span>
          </div>

          {/* To (recipient account) */}
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">To:</span>
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
              {email.to[0] || "Unknown"}
            </p>
          </div>

          {/* Subject */}
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-1 truncate">
            {email.subject ? decodeHtml(email.subject) : "(No subject)"}
          </p>

          {/* AI Summary (or fallback to snippet) */}
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            {email.summary ? decodeHtml(email.summary) : email.snippet ? decodeHtml(email.snippet) : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
