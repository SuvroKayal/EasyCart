import React from 'react';
import { Sparkles, MapPin, Sun, Moon, Copy, Check } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../common/Toast';

export const AnnouncementBar: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    showToast(`Code ${code} copied to clipboard!`, 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside aria-label="Store Announcement" className="bg-espresso text-porcelain text-xs border-b border-white/10 relative z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-4">
        {/* Left: Location & Assurance */}
        <div className="hidden sm:flex items-center gap-1.5 text-stone/80 text-[11px] tracking-wide">
          <MapPin className="w-3.5 h-3.5 text-bronze" />
          <span>Curated Delivery to <strong className="text-white font-medium">India</strong></span>
        </div>

        {/* Center: Promo message with one-click copy coupon */}
        <div className="flex-1 text-center flex items-center justify-center gap-2 text-[11px] sm:text-xs">
          <Sparkles className="w-3.5 h-3.5 text-bronze animate-pulse hidden xs:inline shrink-0" />
          <span className="text-stone">
            Complimentary Shipping on orders over ₹999 • Use voucher{' '}
            <button
              onClick={() => handleCopy('WELCOME10')}
              className="inline-flex items-center gap-1 font-mono font-bold tracking-wider text-bronze bg-white/10 hover:bg-white/20 px-1.5 py-0.5 rounded border border-white/20 transition-all cursor-pointer"
              title="Click to copy WELCOME10"
            >
              WELCOME10
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-bronze/80" />}
            </button>{' '}
            for 10% savings
          </span>
        </div>

        {/* Right: Theme Switcher */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-all border border-white/10 shrink-0 text-white cursor-pointer"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          {theme === 'light' ? (
            <>
              <Moon className="w-3 h-3 text-bronze" />
              <span className="hidden md:inline text-stone">Dark</span>
            </>
          ) : (
            <>
              <Sun className="w-3 h-3 text-bronze-gold" />
              <span className="hidden md:inline text-stone">Light</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
