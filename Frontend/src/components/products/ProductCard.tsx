import React from 'react';
import { Star, ShoppingBag, Eye } from 'lucide-react';
import { Product } from '../../types';
import { getProductImage } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useToast } from '../common/Toast';

interface ProductCardProps {
  product: Product;
  onOpenDetail: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onOpenDetail }) => {
  const { items, addToCart } = useCart();
  const { showToast } = useToast();

  const cartItem = items.find((i) => i.id === product.id);
  const cartQty = cartItem ? cartItem.quantity : 0;
  const remainingStock = Math.max(0, product.quantity - cartQty);
  const isOutOfStock = remainingStock <= 0;

  const discountPercent =
    product.original_price && product.original_price > product.price
      ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
      : 0;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) {
      showToast(`Sorry, ${product.name} is out of stock`, 'error');
      return;
    }
    await addToCart(product.id, 1);
    showToast(`Added ${product.name} to your bag!`, 'success');
  };

  const [imgSrc, setImgSrc] = React.useState(() => getProductImage(product));

  return (
    <div
      onClick={() => onOpenDetail(product)}
      className="group relative flex flex-col rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm hover:shadow-luxury-lg hover:border-bronze/50 transition-all duration-300 cursor-pointer p-3 sm:p-4"
    >
      {/* Badges Overlay */}
      <div className="absolute top-5 left-5 right-5 z-10 flex items-center justify-between pointer-events-none">
        {discountPercent > 0 ? (
          <span className="bg-espresso text-porcelain dark:bg-bronze dark:text-espresso font-bold text-[10px] tracking-wider uppercase px-2.5 py-1 rounded shadow-xs">
            {discountPercent}% OFF
          </span>
        ) : <span />}
        <div className="flex items-center gap-1 bg-white/90 dark:bg-dark-elevated/90 px-2 py-0.5 rounded border border-softBorder dark:border-dark-border text-[11px] font-semibold text-espresso dark:text-porcelain shadow-xs">
          <Star className="w-3 h-3 fill-bronze text-bronze" />
          <span>{typeof product.rating === 'number' ? product.rating.toFixed(1) : product.rating?.rate?.toFixed(1) || '4.5'}</span>
        </div>
      </div>

      {/* Product Image Stage */}
      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-porcelain/60 dark:bg-dark-elevated/40 flex items-center justify-center p-4">
        <img
          src={imgSrc}
          alt={product.name}
          className="w-full h-full object-contain transition-transform duration-500 ease-out group-hover:scale-105"
          loading="lazy"
          onError={() => {
            const fallback = `/static/images/p${product.id}.svg`;
            if (imgSrc !== fallback) {
              setImgSrc(fallback);
            }
          }}
        />

        {/* Quick View Hover Pill */}
        <div className="absolute inset-0 bg-espresso/20 dark:bg-black/30 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-dark-card text-espresso dark:text-porcelain text-xs font-semibold shadow-luxury">
            <Eye className="w-3.5 h-3.5 text-bronze" />
            Inspect
          </span>
        </div>
      </div>

      {/* Product Meta */}
      <div className="mt-3 flex flex-col flex-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-bronze dark:text-bronze-gold">
          {product.category}
        </span>
        <h3 className="text-sm font-medium text-espresso dark:text-porcelain line-clamp-2 mt-1 leading-snug group-hover:text-bronze transition-colors">
          {product.name}
        </h3>

        {/* Pricing */}
        <div className="mt-auto pt-3 flex items-baseline gap-2">
          <span className="text-base sm:text-lg font-bold text-espresso dark:text-porcelain">
            ₹{product.price.toLocaleString('en-IN')}
          </span>
          {product.original_price && product.original_price > product.price && (
            <span className="text-xs text-mutedGrey line-through">
              ₹{product.original_price.toLocaleString('en-IN')}
            </span>
          )}
        </div>

        {/* Stock & Action Bar */}
        <div className="mt-3 pt-2.5 border-t border-softBorder dark:border-dark-border flex items-center justify-between gap-2">
          <div>
            {isOutOfStock ? (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded">
                Out of Stock
              </span>
            ) : remainingStock <= 5 ? (
              <span className="text-[10px] font-medium tracking-wide text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded">
                Only {remainingStock} left
              </span>
            ) : (
              <span className="text-[10px] font-medium tracking-wide text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded">
                In Stock ({remainingStock})
              </span>
            )}
          </div>

          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className={`p-2 rounded-lg transition-all cursor-pointer ${
              isOutOfStock
                ? 'opacity-40 cursor-not-allowed bg-stone-light text-mutedGrey'
                : 'bg-espresso hover:bg-bronze text-white dark:bg-bronze dark:hover:bg-bronze-hover dark:text-espresso shadow-luxury-sm'
            }`}
            title={isOutOfStock ? 'Item currently out of stock' : 'Add to Shopping Bag'}
            aria-label="Add to cart"
          >
            <ShoppingBag className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
