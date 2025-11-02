"use client";

export function AddAccountButton() {
  const handleAddAccount = () => {
    // Use our custom OAuth flow instead of NextAuth's signIn
    window.location.href = "/api/auth/add-account";
  };

  return (
    <button
      onClick={handleAddAccount}
      className="group relative bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-200 cursor-pointer flex items-center justify-center w-full"
    >
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 mb-3">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Connect Another Gmail Account
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          Add more accounts to manage multiple inboxes
        </p>
      </div>
    </button>
  );
}
