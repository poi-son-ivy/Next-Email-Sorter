"use client";

import { Category } from "@/lib/generated/prisma";

interface CategoryCardProps {
  category: Category;
  isSelected?: boolean;
  onClick?: () => void;
}

export function CategoryCard({ category, isSelected, onClick }: CategoryCardProps) {
  return (
    <div
      onClick={onClick}
      className={`group relative bg-white dark:bg-gray-800 rounded-lg border p-4 hover:shadow-md transition-all duration-200 cursor-pointer ${
        isSelected
          ? "border-blue-500 dark:border-blue-400 shadow-md ring-2 ring-blue-500/20"
          : "border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Color Indicator */}
        <div
          className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
          style={{ backgroundColor: category.color || "#3B82F6" }}
        />

        {/* Category Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            {category.name}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            {category.description}
          </p>
        </div>

        {/* Arrow Icon */}
        <div className="flex-shrink-0 text-gray-400 group-hover:text-blue-500 transition-colors">
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
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
