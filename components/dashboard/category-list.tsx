"use client";

import { useState } from "react";
import { Category } from "@/lib/generated/prisma";
import { CategoryCard } from "./category-card";
import { AddCategoryButton } from "./add-category-button";
import { CategoryModal } from "./category-modal";

interface CategoryListProps {
  categories: Category[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string) => void;
}

export function CategoryList({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: CategoryListProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Categories
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Organize your emails with AI-powered categories
          </p>
        </div>

        {/* Category List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {categories.length === 0 ? (
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
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                No categories yet
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                Create your first category to start organizing emails
              </p>
            </div>
          ) : (
            categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                isSelected={category.id === selectedCategoryId}
                onClick={() => onSelectCategory(category.id)}
              />
            ))
          )}

          {/* Add Category Button */}
          <AddCategoryButton onClick={() => setIsModalOpen(true)} />
        </div>
      </div>

      {/* Category Modal */}
      <CategoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
