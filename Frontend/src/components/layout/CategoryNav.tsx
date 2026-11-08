import React from 'react';

export const CATEGORIES = [
  'All',
  'Electronics',
  'Grocery',
  'Fashion',
  'Home & Kitchen',
  'Beauty & Personal Care',
  'Books & Stationery',
  'Sports & Fitness',
  'Toys & Accessories',
] as const;

interface CategoryNavProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export const CategoryNav: React.FC<CategoryNavProps> = ({
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <nav aria-label="Product Categories" className="w-full bg-porcelain/60 dark:bg-dark-bg/60 backdrop-blur-md border-b border-softBorder dark:border-dark-border py-3 overflow-x-auto no-scrollbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 min-w-max">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => onSelectCategory(cat)}
                className={`text-xs sm:text-sm font-medium px-4 py-1.5 rounded-full transition-all duration-200 select-none cursor-pointer ${
                  isActive
                    ? 'bg-espresso text-porcelain dark:bg-bronze dark:text-espresso shadow-luxury-sm font-semibold'
                    : 'bg-white/80 dark:bg-dark-surface/80 text-mutedGrey dark:text-dark-muted hover:text-espresso dark:hover:text-porcelain hover:bg-white dark:hover:bg-dark-elevated border border-softBorder dark:border-dark-border'
                }`}
              >
                {cat === 'All' ? 'All Collections' : cat}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
