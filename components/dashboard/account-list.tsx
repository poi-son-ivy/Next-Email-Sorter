import { User, Account } from "@/lib/generated/prisma";
import { AccountCard } from "./account-card";
import { SignOut } from "@/components/sign-out";
import { AddAccountButton } from "./add-account-button";

type UserWithAccounts = User & {
  accounts: Account[];
};

interface AccountListProps {
  user: UserWithAccounts | null;
}

export function AccountList({ user }: AccountListProps) {
  if (!user) {
    return (
      <div className="p-8">
        <div className="mb-4">
          <p className="text-gray-600 dark:text-gray-400 mb-4">No user found. Please sign out and sign in again.</p>
          <SignOut />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Connected Accounts
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {user.accounts.length} {user.accounts.length === 1 ? "account" : "accounts"} connected
            </p>
          </div>
          <SignOut />
        </div>
      </div>

      {/* Account List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-3">
          {user.accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              userEmail={user.email}
              userName={user.name}
              userImage={user.image}
            />
          ))}

          {/* Add Another Account Button */}
          <AddAccountButton />
        </div>
      </div>
    </div>
  );
}
