import React from 'react';
import { Product } from '../../types';
import { ProductCard } from './ProductCard';
import { PackageX, RotateCcw } from 'lucide-react';
import { Button } from '../common/Button';

interface ProductGridProps {
  products: Product[];
  isLoading?: boolean;
  onOpenDetail: (product: Product) => void;
  onResetFilters?: () => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  isLoading,
  onOpenDetail,
  onResetFilters,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border p-4 animate-pulse space-y-4"
          >
            <div className="aspect-square rounded-xl bg-stone/40 dark:bg-dark-elevated" />
            <div className="h-3 bg-stone/40 dark:bg-dark-elevated rounded w-1/4" />
            <div className="h-4 bg-stone/40 dark:bg-dark-elevated rounded w-3/4" />
            <div className="h-5 bg-stone/40 dark:bg-dark-elevated rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="py-16 px-6 rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border text-center max-w-lg mx-auto flex flex-col items-center shadow-luxury-sm">
        <div className="w-14 h-14 rounded-2xl bg-stone-light dark:bg-dark-elevated flex items-center justify-center text-bronze mb-4 border border-softBorder dark:border-dark-border">
          <PackageX className="w-7 h-7" />
        </div>
        <h3 className="font-serif text-lg font-semibold text-espresso dark:text-porcelain">
          No Products Found
        </h3>
        <p className="text-xs text-mutedGrey dark:text-dark-muted mt-1.5 mb-6 max-w-sm">
          We could not find items matching your active criteria. Consider relaxing price boundaries or resetting search keywords.
        </p>
        {onResetFilters && (
          <Button
            onClick={onResetFilters}
            variant="secondary"
            size="sm"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Reset Filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onOpenDetail={onOpenDetail}
        />
      ))}
    </div>
  );
};
