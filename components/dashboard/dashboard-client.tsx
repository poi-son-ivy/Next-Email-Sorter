"use client";

import { useState, useEffect } from "react";
import { User, Account, Category, Email } from "@/lib/generated/prisma";
import { AccountList } from "./account-list";
import { CategoryList } from "./category-list";
import { EmailList } from "./email-list";

type UserWithRelations = User & {
  accounts: Account[];
  categories: Category[];
  emails: (Email & { category: Category | null })[];
};

interface DashboardClientProps {
  user: UserWithRelations | null;
}

export function DashboardClient({ user }: DashboardClientProps) {
  // Initialize with General category ID immediately
  const getDefaultCategoryId = () => {
    if (!user?.categories) return null;
    const generalCategory = user.categories.find(
      (c) => c.name.toLowerCase() === "general"
    );
    if (generalCategory) return generalCategory.id;
    if (user.categories.length > 0) return user.categories[0].id;
    return null;
  };

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(getDefaultCategoryId());
  const [emails, setEmails] = useState<Email[]>(user?.emails || []);

  // Update emails when user data changes
  useEffect(() => {
    setEmails(user?.emails || []);
  }, [user?.emails]);

  // Filter emails by selected category (only show emails when category is selected)
  const filteredEmails = selectedCategoryId
    ? emails.filter((email) => email.categoryId === selectedCategoryId)
    : [];

  // Callback to add new email from Pusher
  const handleNewEmail = (newEmail: Email) => {
    setEmails((prev) => [newEmail, ...prev]);
  };

  return (
    <div className="h-screen flex">
      {/* Left Pane - Gmail Accounts */}
      <div className="w-1/3 border-r border-gray-200 dark:border-gray-700">
        <AccountList user={user} />
      </div>

      {/* Middle Pane - Categories */}
      <div className="w-1/3 border-r border-gray-200 dark:border-gray-700">
        <CategoryList
          categories={user?.categories || []}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
        />
      </div>

      {/* Right Pane - Email List */}
      <div className="w-1/3 bg-white dark:bg-gray-900">
        <EmailList
          initialEmails={filteredEmails}
          userId={user?.id || ""}
          selectedCategoryId={selectedCategoryId}
          onNewEmail={handleNewEmail}
        />
      </div>
    </div>
  );
}
