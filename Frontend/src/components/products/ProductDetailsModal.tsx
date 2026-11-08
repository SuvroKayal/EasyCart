import React, { useEffect, useState } from 'react';
import { Star, ShieldCheck, Truck, RefreshCw, Plus, Minus, ShoppingBag, Check, Building2 } from 'lucide-react';
import { Product } from '../../types';
import { api, getProductImage } from '../../services/api';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useCart } from '../../context/CartContext';
import { useToast } from '../common/Toast';

interface ProductDetailsModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectRelated?: (product: Product) => void;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  product,
  isOpen,
  onClose,
  onSelectRelated,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [imgSrc, setImgSrc] = useState<string>('');
  const [allImages, setAllImages] = useState<string[]>([]);
  const [supplierName, setSupplierName] = useState<string | null>(null);

  const { items, addToCart } = useCart();
  const { showToast } = useToast();

  useEffect(() => {
    if (product) {
      setQuantity(1);
      const primary = getProductImage(product);
      setImgSrc(primary);

      const gallery = Array.isArray(product.gallery_images) ? product.gallery_images : [];
      const combined = [primary, ...gallery.filter((g) => g && g !== primary)];
      setAllImages(combined);
      setSupplierName(product.supplier_name || null);

      fetchFullDetails(product.id);
    }
  }, [product]);

  const fetchFullDetails = async (id: number) => {
    try {
      const data = await api.getProduct(id);
      if (data.related) {
        setRelatedProducts(data.related);
      }
      if (data.product?.supplier_name) {
        setSupplierName(data.product.supplier_name);
      }
    } catch (err) {
      console.error('Failed to load full product details:', err);
    }
  };

  if (!product) return null;

  const cartItem = items.find((i) => i.id === product.id);
  const cartQty = cartItem ? cartItem.quantity : 0;
  const remainingStock = Math.max(0, product.quantity - cartQty);
  const isOutOfStock = remainingStock <= 0;

  const discountPercent =
    product.original_price && product.original_price > product.price
      ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
      : 0;

  const handleAddToCart = async () => {
    if (isOutOfStock) return;
    if (quantity > remainingStock) {
      showToast(`Only ${remainingStock} items available in stock`, 'error');
      return;
    }
    await addToCart(product.id, quantity);
    showToast(`Added ${quantity} × ${product.name} to your bag!`, 'success');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="4xl">
      <div className="space-y-8">
        {/* Main Product Info (2 columns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Left: Product Image Stage & Gallery Carousel */}
          <div className="space-y-3">
            <div className="relative aspect-square rounded-2xl bg-white dark:bg-dark-elevated p-6 flex items-center justify-center border border-softBorder dark:border-dark-border overflow-hidden shadow-luxury-sm">
              <img
                src={imgSrc}
                alt={product.name}
                className="w-full h-full object-contain transition-transform duration-500 hover:scale-105"
                onError={() => {
                  const fallback = `/static/images/p${product.id}.svg`;
                  if (imgSrc !== fallback) {
                    setImgSrc(fallback);
                  }
                }}
              />
              {discountPercent > 0 && (
                <span className="absolute top-4 left-4 bg-espresso text-porcelain dark:bg-bronze dark:text-espresso font-bold text-xs px-3 py-1 rounded shadow-luxury-sm tracking-wider uppercase">
                  Save {discountPercent}%
                </span>
              )}
            </div>

            {/* Gallery Thumbnails Strip */}
            {allImages.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setImgSrc(img)}
                    className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 bg-white dark:bg-dark-surface p-1 cursor-pointer ${
                      imgSrc === img
                        ? 'border-bronze shadow-luxury-sm'
                        : 'border-softBorder dark:border-dark-border opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Details & Purchase actions */}
          <div className="flex flex-col space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-bronze dark:text-bronze-gold">
                  {product.category}
                </span>
                {product.sku && (
                  <span className="font-mono text-[10px] text-mutedGrey bg-porcelain dark:bg-dark-elevated px-2 py-0.5 rounded border border-softBorder dark:border-dark-border">
                    {product.sku}
                  </span>
                )}
              </div>

              <h2 className="font-serif text-xl sm:text-2xl font-semibold text-espresso dark:text-porcelain mt-1 leading-snug">
                {product.name}
              </h2>

              {/* Rating */}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1 bg-stone-light dark:bg-dark-elevated text-espresso dark:text-porcelain px-2.5 py-0.5 rounded text-xs font-semibold border border-softBorder dark:border-dark-border">
                  <Star className="w-3.5 h-3.5 fill-bronze text-bronze" />
                  <span>{typeof product.rating === 'number' ? product.rating.toFixed(1) : product.rating?.rate?.toFixed(1) || '4.5'}</span>
                </div>
                <span className="text-xs text-mutedGrey dark:text-dark-muted">
                  ({product.rating_count || 120} verified customer reviews)
                </span>
              </div>
            </div>

            {/* Price Box */}
            <div className="p-4 rounded-xl bg-ivory dark:bg-dark-card border border-softBorder dark:border-dark-border">
              <div className="flex items-baseline gap-3">
                <span className="text-2xl sm:text-3xl font-bold text-espresso dark:text-porcelain">
                  ₹{product.price.toLocaleString('en-IN')}
                </span>
                {product.original_price && product.original_price > product.price && (
                  <span className="text-sm text-mutedGrey line-through">
                    ₹{product.original_price.toLocaleString('en-IN')}
                  </span>
                )}
              </div>
              <p className="text-xs text-mutedGrey dark:text-dark-muted mt-1">
                Inclusive of all applicable taxes. Complimentary express dispatch on orders above ₹999.
              </p>
            </div>

            {/* Description */}
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-widest text-mutedGrey mb-1.5">
                Product Narrative &amp; Craftsmanship
              </h4>
              <p className="text-xs sm:text-sm text-espresso/80 dark:text-porcelain/80 leading-relaxed font-light">
                {product.description ||
                  'Manufactured with premium grade materials adhering to stringent international quality controls and certified provenance guarantees.'}
              </p>
            </div>

            {/* Supplier Origin */}
            {supplierName && (
              <div className="flex items-center gap-1.5 text-xs text-mutedGrey dark:text-dark-muted">
                <Building2 className="w-3.5 h-3.5 text-bronze shrink-0" />
                <span>Procured via certified vendor: <strong className="text-espresso dark:text-porcelain font-semibold">{supplierName}</strong></span>
              </div>
            )}

            {/* Stock status */}
            <div>
              <span className="text-[10px] font-semibold text-mutedGrey uppercase tracking-widest block mb-1">
                Inventory Status
              </span>
              {isOutOfStock ? (
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded inline-block">
                  Currently Out of Stock
                </span>
              ) : remainingStock <= 5 ? (
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded inline-block">
                  Limited Allocation: Only {remainingStock} units remain
                </span>
              ) : (
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> In Stock ({remainingStock} units ready for dispatch)
                </span>
              )}
            </div>

            {/* Quantity Stepper & Add to Bag */}
            {!isOutOfStock && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
                <div className="flex items-center justify-between border border-softBorder dark:border-dark-border rounded-xl px-3 py-2 bg-white dark:bg-dark-card w-full sm:w-36">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="p-1 rounded hover:bg-stone-light dark:hover:bg-dark-elevated text-espresso dark:text-porcelain disabled:opacity-30 transition-colors cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-semibold text-sm text-espresso dark:text-porcelain px-2">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(remainingStock, q + 1))}
                    disabled={quantity >= remainingStock}
                    className="p-1 rounded hover:bg-stone-light dark:hover:bg-dark-elevated text-espresso dark:text-porcelain disabled:opacity-30 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <Button
                  onClick={handleAddToCart}
                  variant="primary"
                  size="md"
                  className="flex-1"
                  leftIcon={<ShoppingBag className="w-4 h-4" />}
                >
                  Add to Shopping Bag • ₹{(product.price * quantity).toLocaleString('en-IN')}
                </Button>
              </div>
            )}

            {/* Trust Assurances */}
            <div className="pt-3 border-t border-softBorder dark:border-dark-border grid grid-cols-2 gap-3 text-xs text-mutedGrey dark:text-dark-muted">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-bronze shrink-0" />
                <span>100% Verified Authentic</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-bronze shrink-0" />
                <span>Free Express &gt; ₹999</span>
              </div>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-bronze shrink-0" />
                <span>7-Day Return Protocol</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-bronze shrink-0" />
                <span>Brand Warranty Included</span>
              </div>
            </div>
          </div>
        </div>

        {/* Related Curated Products */}
        {relatedProducts.length > 0 && (
          <div className="pt-6 border-t border-softBorder dark:border-dark-border space-y-4">
            <h4 className="font-serif text-base font-semibold text-espresso dark:text-porcelain">
              Related Items in {product.category}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {relatedProducts.map((rel) => (
                <div
                  key={rel.id}
                  onClick={() => {
                    if (onSelectRelated) {
                      onSelectRelated(rel);
                    }
                  }}
                  className="p-3 rounded-xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border hover:border-bronze transition-all cursor-pointer group shadow-luxury-sm"
                >
                  <div className="aspect-square rounded-lg bg-porcelain/60 dark:bg-dark-elevated p-2 mb-2 flex items-center justify-center overflow-hidden">
                    <img
                      src={getProductImage(rel)}
                      alt={rel.name}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <h5 className="font-medium text-xs text-espresso dark:text-porcelain line-clamp-1 group-hover:text-bronze transition-colors">
                    {rel.name}
                  </h5>
                  <div className="font-bold text-xs text-espresso dark:text-porcelain mt-1">
                    ₹{rel.price.toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
