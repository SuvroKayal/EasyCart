import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, Trash2, Plus, Minus, Tag, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { getProductImage } from '../../services/api';
import { Button } from '../common/Button';
import { useToast } from '../common/Toast';

interface CartDrawerProps {
  onProceedCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onProceedCheckout }) => {
  const {
    isCartOpen,
    closeCart,
    calculation,
    items,
    updateQuantity,
    removeFromCart,
    clearCart,
    applyCoupon,
    removeCoupon,
  } = useCart();

  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const { showToast } = useToast();

  const quickCoupons = ['WELCOME10', 'SAVE50', 'FREESHIP'];

  const handleApplyCoupon = async (codeToApply?: string) => {
    const code = (codeToApply || couponInput).trim();
    if (!code) return;

    setCouponLoading(true);
    const res = await applyCoupon(code);
    setCouponLoading(false);

    if (res.success) {
      showToast(res.message, 'success');
      setCouponInput('');
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleRemoveCoupon = async () => {
    await removeCoupon();
    showToast('Coupon removed', 'info');
  };

  const handleProceed = () => {
    if (items.length === 0) return;
    closeCart();
    onProceedCheckout();
  };

  // Free shipping progress calculation (Free above ₹999)
  const freeShippingThreshold = calculation?.free_delivery_threshold || 999;
  const currentSubtotal = calculation?.subtotal || 0;
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - currentSubtotal);
  const freeShippingPercent = Math.min(100, Math.round((currentSubtotal / freeShippingThreshold) * 100));

  return (
    <AnimatePresence>
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Frosted Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeCart}
            className="fixed inset-0 bg-espresso/60 dark:bg-black/75 backdrop-blur-sm"
          />

          {/* Sliding Cart Drawer */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className="w-screen max-w-md bg-white dark:bg-dark-surface border-l border-softBorder dark:border-dark-border shadow-luxury-lg flex flex-col"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-softBorder dark:border-dark-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-bronze/10 text-bronze dark:text-bronze-gold">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-serif text-base font-semibold text-espresso dark:text-porcelain">
                      Shopping Bag
                    </h2>
                    <p className="text-[11px] text-mutedGrey dark:text-dark-muted">
                      {calculation?.items?.length || 0} unique curated selections
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeCart}
                  className="p-2 rounded-lg text-mutedGrey hover:text-espresso dark:hover:text-porcelain hover:bg-stone-light dark:hover:bg-dark-elevated transition-colors cursor-pointer"
                  aria-label="Close cart"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Free Delivery Incentive Bar */}
              {items.length > 0 && (
                <div className="px-6 py-3 bg-ivory dark:bg-dark-card border-b border-softBorder dark:border-dark-border">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="flex items-center gap-1.5 font-medium text-espresso dark:text-porcelain text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-bronze" />
                      {remainingForFreeShipping === 0
                        ? 'Complimentary Delivery Unlocked!'
                        : `Add ₹${remainingForFreeShipping.toLocaleString('en-IN')} for Free Express Delivery`}
                    </span>
                    <span className="font-semibold text-[11px] text-bronze">
                      {freeShippingPercent}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-stone-light dark:bg-dark-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-bronze transition-all duration-300"
                      style={{ width: `${freeShippingPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {items.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12">
                    <div className="w-16 h-16 rounded-2xl bg-stone-light dark:bg-dark-elevated flex items-center justify-center text-bronze mb-4 border border-softBorder dark:border-dark-border">
                      <ShoppingBag className="w-8 h-8 stroke-[1.5]" />
                    </div>
                    <h3 className="font-serif text-lg font-semibold text-espresso dark:text-porcelain">
                      Your bag is empty
                    </h3>
                    <p className="text-xs text-mutedGrey dark:text-dark-muted max-w-xs mt-1 mb-6">
                      Explore our handcrafted collections and discover exceptional lifestyle essentials.
                    </p>
                    <Button onClick={closeCart} variant="primary">
                      Explore Collections
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Stock errors warning */}
                    {calculation?.stock_errors && calculation.stock_errors.length > 0 && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Stock notice:</p>
                          <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                            {calculation.stock_errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Verified Items */}
                    <div className="space-y-3">
                      {(calculation?.items || []).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3.5 p-3 rounded-xl bg-white dark:bg-dark-card border border-softBorder dark:border-dark-border shadow-luxury-sm"
                        >
                          {/* Thumbnail */}
                          <div className="w-16 h-16 rounded-lg bg-porcelain/60 dark:bg-dark-elevated p-2 flex items-center justify-center shrink-0 overflow-hidden">
                            <img
                              src={getProductImage(item)}
                              alt={item.name}
                              className="w-full h-full object-contain"
                            />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-semibold text-espresso dark:text-porcelain truncate">
                              {item.name}
                            </h4>
                            <div className="text-xs font-bold text-bronze dark:text-bronze-gold mt-0.5">
                              ₹{item.price.toLocaleString('en-IN')}
                            </div>

                            {/* Stepper */}
                            <div className="flex items-center gap-2 mt-2">
                              <div className="flex items-center border border-softBorder dark:border-dark-border rounded-lg bg-porcelain/40 dark:bg-dark-elevated">
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  className="p-1 hover:text-bronze disabled:opacity-30 cursor-pointer"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-xs font-semibold px-2">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  disabled={item.quantity >= item.max_stock}
                                  className="p-1 hover:text-bronze disabled:opacity-30 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="text-mutedGrey hover:text-rose-600 p-1 transition-colors cursor-pointer"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Item Subtotal */}
                          <div className="text-xs font-bold text-espresso dark:text-porcelain shrink-0">
                            ₹{item.total.toLocaleString('en-IN')}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Clear Cart Button */}
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={clearCart}
                        className="text-[11px] text-mutedGrey hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        Empty Shopping Bag
                      </button>
                    </div>

                    {/* Coupon Input & Applied Pill */}
                    <div className="pt-3 border-t border-softBorder dark:border-dark-border space-y-3">
                      {calculation?.applied_coupon ? (
                        <div className="p-3 rounded-xl bg-stone-light/60 dark:bg-dark-elevated border border-bronze/30 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-bronze shrink-0" />
                            <div>
                              <span className="font-mono text-xs font-bold text-bronze dark:text-bronze-gold">
                                {calculation.applied_coupon.code}
                              </span>
                              <p className="text-[10px] text-mutedGrey dark:text-dark-muted">
                                {calculation.applied_coupon.description}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={handleRemoveCoupon}
                            className="text-xs font-semibold text-rose-600 hover:underline px-2 cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Enter coupon code"
                              value={couponInput}
                              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                              onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                              className="flex-1 bg-white dark:bg-dark-card border border-softBorder dark:border-dark-border rounded-xl px-3 py-2 text-xs font-mono uppercase text-espresso dark:text-porcelain placeholder:text-mutedGrey focus:outline-none focus:border-bronze"
                            />
                            <Button
                              onClick={() => handleApplyCoupon()}
                              variant="secondary"
                              size="sm"
                              isLoading={couponLoading}
                            >
                              Apply
                            </Button>
                          </div>

                          {/* Quick Offer Chips */}
                          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar">
                            <span className="text-[10px] text-mutedGrey uppercase tracking-wider shrink-0">
                              Privilege:
                            </span>
                            {quickCoupons.map((code) => (
                              <button
                                key={code}
                                onClick={() => handleApplyCoupon(code)}
                                className="px-2 py-0.5 rounded bg-stone-light dark:bg-dark-elevated hover:border-bronze border border-softBorder dark:border-dark-border text-[10px] font-mono text-espresso dark:text-porcelain transition-colors shrink-0 cursor-pointer"
                              >
                                {code}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Financial Summary & Checkout Action */}
              {items.length > 0 && calculation && (
                <div className="p-6 border-t border-softBorder dark:border-dark-border bg-ivory dark:bg-dark-card space-y-3">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-mutedGrey dark:text-dark-muted">
                      <span>Bag Subtotal</span>
                      <span className="font-semibold text-espresso dark:text-porcelain">
                        ₹{calculation.subtotal.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {calculation.discount > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                        <span>Privilege Savings</span>
                        <span>-₹{calculation.discount.toLocaleString('en-IN')}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-mutedGrey dark:text-dark-muted">
                      <span>White-Glove Delivery</span>
                      <span>
                        {calculation.delivery_fee === 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider text-[11px]">
                            COMPLIMENTARY
                          </span>
                        ) : (
                          `₹${calculation.delivery_fee}`
                        )}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-softBorder dark:border-dark-border flex justify-between text-base font-bold text-espresso dark:text-porcelain">
                      <span className="font-serif">Grand Total</span>
                      <span className="text-bronze dark:text-bronze-gold font-bold">
                        ₹{calculation.total.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={handleProceed}
                    variant="primary"
                    size="lg"
                    className="w-full"
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Proceed to Express Checkout
                  </Button>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
