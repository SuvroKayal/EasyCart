import React, { useEffect, useState } from 'react';
import { Tag, Sparkles, Copy, Check, Percent, IndianRupee, Truck } from 'lucide-react';
import { api } from '../../services/api';
import { AdminOffer } from '../../types';
import { useToast } from '../common/Toast';

export const AdminOffers: React.FC = () => {
  const [offers, setOffers] = useState<AdminOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { showToast } = useToast();

  const fetchOffers = async () => {
    try {
      setLoading(true);
      const res = await api.adminGetOffers();
      setOffers(res.offers || []);
    } catch {
      showToast('Failed to load active promotions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast(`Copied coupon code ${code}`, 'info');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Tag className="w-6 h-6 text-crystal-royal" />
            Promotions & Discount Vouchers
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Active coupon codes, discount triggers, minimum basket thresholds, and redemption rates.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-3 border-crystal-royal border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500">Loading discount vouchers...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {offers.map((coupon) => {
            const isPercent = coupon.type === 'percent';
            const isShipping = coupon.type === 'free_shipping';

            return (
              <div
                key={coupon.code}
                className="relative overflow-hidden rounded-3xl bg-white dark:bg-crystal-navyCard/90 border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        (coupon.status || 'active') === 'active'
                          ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {coupon.status || 'active'}
                    </span>
                    <div className="p-2 rounded-xl bg-crystal-royal/10 text-crystal-royal">
                      {isShipping ? (
                        <Truck className="w-4 h-4" />
                      ) : isPercent ? (
                        <Percent className="w-4 h-4" />
                      ) : (
                        <IndianRupee className="w-4 h-4" />
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xl font-black tracking-widest text-crystal-royal">
                        {coupon.code}
                      </span>
                      <button
                        onClick={() => handleCopy(coupon.code)}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 transition-colors"
                        title="Copy coupon code"
                      >
                        {copiedCode === coupon.code ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {coupon.description}
                    </p>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-white/5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Discount Benefit:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {isShipping
                          ? '100% Free Shipping'
                          : isPercent
                          ? `${coupon.value}% Off Basket Total`
                          : `Flat ₹${coupon.value} Off`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Min. Cart Value:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        ₹{(coupon.min_purchase ?? coupon.min_order ?? 0).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Store Redemptions:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {coupon.usage_count ?? coupon.total_uses ?? 0} times applied
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Auto-calculated in cart calculations</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
