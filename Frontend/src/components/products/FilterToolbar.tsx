import React from 'react';
import { ArrowLeft, SlidersHorizontal, RotateCcw } from 'lucide-react';

interface FilterToolbarProps {
  currentCategory: string;
  productCount: number;
  inStockOnly: boolean;
  onToggleInStock: (val: boolean) => void;
  priceFilter: string;
  onPriceFilterChange: (val: string) => void;
  sortBy: string;
  onSortChange: (val: string) => void;
  onResetFilters: () => void;
  onBackToBanners?: () => void;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  currentCategory,
  productCount,
  inStockOnly,
  onToggleInStock,
  priceFilter,
  onPriceFilterChange,
  sortBy,
  onSortChange,
  onResetFilters,
  onBackToBanners,
}) => {
  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm space-y-4 mb-6 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Title & Count */}
        <div className="flex items-center gap-3">
          {currentCategory !== 'All' && onBackToBanners && (
            <button
              onClick={onBackToBanners}
              className="p-2 rounded-lg bg-stone-light dark:bg-dark-elevated hover:bg-stone dark:hover:bg-dark-card text-espresso dark:text-porcelain transition-colors cursor-pointer"
              title="Return to all collections"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h2 className="font-serif text-lg sm:text-xl font-semibold text-espresso dark:text-porcelain">
              {currentCategory === 'All' ? 'Curated Offerings & Catalogue' : currentCategory}
            </h2>
            <p className="text-xs text-mutedGrey dark:text-dark-muted">
              Displaying <span className="font-semibold text-espresso dark:text-porcelain">{productCount}</span> verified products
            </p>
          </div>
        </div>

        {/* Reset button */}
        <button
          onClick={onResetFilters}
          className="self-start sm:self-auto flex items-center gap-1.5 text-xs text-mutedGrey hover:text-bronze transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset All Filters</span>
        </button>
      </div>

      {/* Filter Controls Row */}
      <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-softBorder dark:border-dark-border text-xs">
        {/* In-stock toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-lg bg-stone-light/50 dark:bg-dark-elevated border border-softBorder dark:border-dark-border hover:border-bronze transition-colors">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => onToggleInStock(e.target.checked)}
            className="w-4 h-4 rounded text-bronze focus:ring-bronze/30 cursor-pointer accent-bronze"
          />
          <span className="font-medium text-espresso dark:text-porcelain">In Stock Only</span>
        </label>

        {/* Price Filter */}
        <div className="flex items-center gap-1.5">
          <select
            value={priceFilter}
            onChange={(e) => onPriceFilterChange(e.target.value)}
            className="bg-stone-light/50 dark:bg-dark-elevated border border-softBorder dark:border-dark-border rounded-lg px-3 py-1.5 text-xs font-medium text-espresso dark:text-porcelain focus:outline-none focus:border-bronze cursor-pointer"
          >
            <option value="all">Price: All Ranges</option>
            <option value="under-500">Under ₹500</option>
            <option value="500-1500">₹500 to ₹1,500</option>
            <option value="1500-5000">₹1,500 to ₹5,000</option>
            <option value="above-5000">Above ₹5,000</option>
          </select>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-1.5 ml-auto">
          <SlidersHorizontal className="w-3.5 h-3.5 text-mutedGrey hidden sm:inline" />
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="bg-stone-light/50 dark:bg-dark-elevated border border-softBorder dark:border-dark-border rounded-lg px-3 py-1.5 text-xs font-medium text-espresso dark:text-porcelain focus:outline-none focus:border-bronze cursor-pointer"
          >
            <option value="default">Sort: Recommended</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
            <option value="name">Alphabetical (A-Z)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
