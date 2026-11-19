import React from 'react';
import { ShieldCheck, Truck, RefreshCw, Award, Copy, Check, Mail, Phone, User, Package, Heart } from 'lucide-react';
import { CATEGORIES } from './CategoryNav';
import { useToast } from '../common/Toast';

interface FooterProps {
  onSelectCategory: (category: string) => void;
  onOpenCouponCart?: (code: string) => void;
  onOpenOrders?: () => void;
  onOpenProfile?: () => void;
  onOpenAuth?: (tab: 'login' | 'register') => void;
  onOpenAdmin?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onSelectCategory,
  onOpenCouponCart,
  onOpenOrders,
  onOpenProfile,
  onOpenAuth,
  onOpenAdmin,
}) => {
  const { showToast } = useToast();
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

  const coupons = [
    { code: 'WELCOME10', desc: '10% savings on orders above ₹200 (Max ₹500)' },
    { code: 'SAVE50', desc: 'Flat ₹50 savings on orders above ₹499' },
    { code: 'FREESHIP', desc: 'Complimentary shipping on orders above ₹300' },
  ];

  const handleCopyCoupon = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast(`Voucher code ${code} copied to clipboard!`, 'success');
    if (onOpenCouponCart) {
      onOpenCouponCart(code);
    }
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <footer className="relative w-full mt-16 overflow-hidden">
      {/* Organic Curved Architectural Upper Boundary SVG */}
      <div className="w-full overflow-hidden leading-none text-[#201A14] pointer-events-none">
        <svg
          viewBox="0 0 1440 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-12 sm:h-20 object-fill block"
          preserveAspectRatio="none"
        >
          <path
            d="M0,32 C360,75 1080,-15 1440,32 L1440,80 L0,80 Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* Main Deep Espresso Body */}
      <div className="bg-[#201A14] text-[#F6F1E8] pt-4 pb-12">
        {/* Trust Guarantees Strip */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 border-b border-white/10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-bronze/20 text-bronze-light flex items-center justify-center shrink-0 border border-bronze/30">
                <ShieldCheck className="w-5 h-5 text-bronze" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-porcelain">100% Verified Provenance</h4>
                <p className="text-[11px] text-stone-300">Directly sourced authentic goods</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-bronze/20 text-bronze-light flex items-center justify-center shrink-0 border border-bronze/30">
                <Truck className="w-5 h-5 text-bronze" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-porcelain">Express Pan-India Logistics</h4>
                <p className="text-[11px] text-stone-300">Complimentary on orders &gt; ₹999</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-bronze/20 text-bronze-light flex items-center justify-center shrink-0 border border-bronze/30">
                <RefreshCw className="w-5 h-5 text-bronze" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-porcelain">7-Day Hassle-Free Returns</h4>
                <p className="text-[11px] text-stone-300">Simple, streamlined exchanges</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-bronze/20 text-bronze-light flex items-center justify-center shrink-0 border border-bronze/30">
                <Award className="w-5 h-5 text-bronze" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-porcelain">Curated Quality Standards</h4>
                <p className="text-[11px] text-stone-300">Hand-selected department collections</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Footer Directory */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
            {/* Col 1 (4 cols): Brand identity & description */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center gap-2.5">
                <img
                  src="/banner/EasyCart%20logo.png"
                  alt="EasyCart"
                  className="h-10 w-auto object-contain"
                />
                <span className="font-serif text-2xl font-bold tracking-tight text-porcelain">
                  Easy<span className="text-bronze">Cart</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-300 max-w-sm leading-relaxed font-light">
                Premium multi-department e-commerce platform blending Swiss minimalist precision, editorial elegance, and effortless daily shopping. Verified quality, fast fulfillment, and secure digital checkout.
              </p>
              <div className="pt-2 flex flex-col gap-2 text-xs text-stone-300">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-bronze shrink-0" />
                  <a href="mailto:concierge@easycart.luxury" className="hover:text-bronze transition-colors">
                    concierge@easycart.luxury
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-bronze shrink-0" />
                  <span>1800-EASY-CART (Mon – Sat, 9:00 AM – 8:00 PM IST)</span>
                </div>
              </div>
            </div>

            {/* Col 2 (2 cols): Department Collections */}
            <div className="lg:col-span-2 space-y-3">
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-bronze">
                Departments
              </h4>
              <ul className="space-y-2 text-xs">
                {CATEGORIES.slice(1, 6).map((cat) => (
                  <li key={cat}>
                    <button
                      onClick={() => onSelectCategory(cat)}
                      className="text-stone-300 hover:text-white transition-colors text-left cursor-pointer"
                    >
                      {cat}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 3 (2 cols): More Collections */}
            <div className="lg:col-span-2 space-y-3">
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-bronze">
                More Departments
              </h4>
              <ul className="space-y-2 text-xs">
                {CATEGORIES.slice(6).map((cat) => (
                  <li key={cat}>
                    <button
                      onClick={() => onSelectCategory(cat)}
                      className="text-stone-300 hover:text-white transition-colors text-left cursor-pointer"
                    >
                      {cat}
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    onClick={() => onSelectCategory('All')}
                    className="font-semibold text-bronze hover:underline cursor-pointer"
                  >
                    All Collections Catalog →
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 4 (2 cols): Account & Concierge */}
            <div className="lg:col-span-2 space-y-3">
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-bronze">
                Customer Services
              </h4>
              <ul className="space-y-2 text-xs text-stone-300">
                {onOpenProfile && (
                  <li>
                    <button
                      onClick={onOpenProfile}
                      className="hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-bronze" />
                      <span>Customer Profile</span>
                    </button>
                  </li>
                )}
                {onOpenOrders && (
                  <li>
                    <button
                      onClick={onOpenOrders}
                      className="hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Package className="w-3.5 h-3.5 text-bronze" />
                      <span>Orders &amp; Invoices</span>
                    </button>
                  </li>
                )}
                {onOpenAuth && (
                  <>
                    <li>
                      <button
                        onClick={() => onOpenAuth('login')}
                        className="hover:text-white transition-colors cursor-pointer"
                      >
                        Sign In
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => onOpenAuth('register')}
                        className="hover:text-white transition-colors cursor-pointer"
                      >
                        Register New Account
                      </button>
                    </li>
                  </>
                )}
                {onOpenAdmin && (
                  <li>
                    <button
                      onClick={onOpenAdmin}
                      className="hover:text-white transition-colors flex items-center gap-1.5 font-semibold text-bronze cursor-pointer pt-1"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-bronze" />
                      <span>Admin Control Center</span>
                    </button>
                  </li>
                )}
              </ul>
            </div>

            {/* Col 5 (2 cols): Active Privilege Vouchers */}
            <div className="lg:col-span-2 space-y-3">
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-bronze">
                Privilege Vouchers
              </h4>
              <div className="space-y-2">
                {coupons.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => handleCopyCoupon(c.code)}
                    className="w-full text-left p-2.5 rounded-xl bg-white/5 hover:bg-white/10 hover:border-bronze border border-white/10 transition-all group cursor-pointer"
                    title="Click to copy voucher code"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-bronze">
                        {c.code}
                      </span>
                      {copiedCode === c.code ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-stone-400 group-hover:text-bronze" />
                      )}
                    </div>
                    <p className="text-[10px] text-stone-300 mt-0.5 line-clamp-1">{c.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Bar: Copyright & Attribution */}
          <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-400">
            <div className="flex items-center gap-1.5 text-center sm:text-left">
              <span>© 2026 EasyCart. Architected with</span>
              <Heart className="w-3 h-3 text-bronze inline fill-bronze" />
              <span>using React, TypeScript, Tailwind CSS and Python Flask.</span>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span>Editorial Luxury</span>
              <span>•</span>
              <span>Swiss Minimalist UI</span>
              <span>•</span>
              <span className="text-bronze font-medium">All Rights Reserved</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
