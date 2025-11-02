"use client";

interface AddCategoryButtonProps {
  onClick: () => void;
}

export function AddCategoryButton({ onClick }: AddCategoryButtonProps) {

  return (
    <button
      onClick={onClick}
      className="group relative bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-4 hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-200 cursor-pointer flex items-center justify-center w-full"
    >
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
          <svg
            className="w-4 h-4"
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
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          Add Category
        </span>
      </div>
    </button>
  );
}
