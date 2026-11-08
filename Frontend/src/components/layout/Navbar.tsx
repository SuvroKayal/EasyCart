import React, { useState } from 'react';
import { ShoppingBag, Search, User as UserIcon, LogOut, Package, Menu, X, Sun, Moon, ShieldCheck, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useTheme } from '../../context/ThemeContext';

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: () => void;
  onLogoClick: () => void;
  onNavigateOrders?: () => void;
  onNavigateAdmin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onLogoClick,
  onNavigateOrders,
  onNavigateAdmin,
}) => {
  const { user, isAuthenticated, openAuthModal, logout, setAccountModalOpen } = useAuth();
  const { cartCount, calculation, openCart } = useCart();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearchSubmit();
      setMobileMenuOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-porcelain/90 dark:bg-dark-bg/90 backdrop-blur-md border-b border-softBorder dark:border-dark-border transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 sm:h-20 gap-4">
          {/* Brand Logo - Preserved authentic asset */}
          <button
            onClick={onLogoClick}
            className="flex items-center gap-3 group text-left shrink-0 select-none cursor-pointer"
            aria-label="EasyCart Home"
          >
            <div className="relative flex items-center justify-center">
              <img
                src="/banner/EasyCart%20logo%20transparent.png"
                alt="EasyCart"
                className="h-10 sm:h-12 w-auto object-contain transition-transform duration-300 group-hover:scale-102"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-espresso dark:text-porcelain ml-2">
                Easy<span className="text-bronze">Cart</span>
              </span>
            </div>
          </button>

          {/* Desktop Search Bar — Swiss Minimalism */}
          <div className="hidden md:flex flex-1 max-w-lg mx-6">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search premium collections, essentials..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border rounded-xl pl-10 pr-14 py-2.5 text-sm text-espresso dark:text-porcelain placeholder:text-mutedGrey focus:outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/20 transition-all shadow-luxury-sm"
              />
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mutedGrey pointer-events-none">
                <Search className="w-4 h-4" />
              </div>
              <button
                onClick={onSearchSubmit}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-espresso hover:bg-bronze text-white dark:bg-bronze dark:hover:bg-bronze-hover dark:text-espresso text-xs font-semibold rounded-lg transition-all cursor-pointer"
              >
                Search
              </button>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Admin Center Quick Access Button */}
            {user?.role === 'admin' && onNavigateAdmin && (
              <button
                onClick={onNavigateAdmin}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bronze/15 hover:bg-bronze/25 text-espresso dark:text-bronze-gold border border-bronze/30 text-xs font-semibold tracking-wide transition-all group cursor-pointer"
                title="Open Admin Control Center"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-bronze group-hover:scale-110 transition-transform" />
                <span className="hidden sm:inline">Admin Center</span>
              </button>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="hidden lg:flex p-2.5 rounded-xl bg-white dark:bg-dark-surface hover:bg-stone-light dark:hover:bg-dark-elevated text-espresso dark:text-porcelain border border-softBorder dark:border-dark-border transition-colors shadow-luxury-sm cursor-pointer"
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4 text-espresso" /> : <Sun className="w-4 h-4 text-bronze-gold" />}
            </button>

            {/* User Account / Auth Dropdown */}
            <div className="relative">
              {isAuthenticated ? (
                <div className="relative">
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-dark-surface hover:border-bronze border border-softBorder dark:border-dark-border text-left transition-all shadow-luxury-sm cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-full bg-espresso text-porcelain dark:bg-bronze dark:text-espresso flex items-center justify-center font-bold text-xs">
                      {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="hidden sm:block text-xs leading-tight">
                      <span className="text-mutedGrey block text-[10px] uppercase tracking-wider">Account</span>
                      <span className="font-semibold text-espresso dark:text-porcelain truncate max-w-[100px] block">
                        {user?.name || 'Customer'}
                      </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-mutedGrey hidden sm:block" />
                  </button>

                  {/* Dropdown Menu */}
                  {userDropdownOpen && (
                    <div
                      className="absolute right-0 mt-2 w-60 rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-lg p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      <div className="px-3 py-2.5 border-b border-softBorder dark:border-dark-border mb-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-mutedGrey">Signed in as</p>
                        <p className="text-xs font-semibold text-espresso dark:text-porcelain truncate mt-0.5">
                          {user?.email}
                        </p>
                        {user?.role === 'admin' && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-bronze/20 text-bronze-dark dark:text-bronze-gold">
                            Store Administrator
                          </span>
                        )}
                      </div>
                      {user?.role === 'admin' && onNavigateAdmin && (
                        <button
                          onClick={onNavigateAdmin}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-espresso dark:text-bronze-gold bg-bronze/10 hover:bg-bronze/20 rounded-lg transition-colors text-left mb-1 cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4 text-bronze" />
                          <span>Admin Control Center</span>
                        </button>
                      )}
                      <button
                        onClick={() => setAccountModalOpen(true)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-espresso dark:text-porcelain hover:bg-stone-light dark:hover:bg-dark-elevated rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <UserIcon className="w-4 h-4 text-bronze" />
                        <span>Account Profile</span>
                      </button>
                      {onNavigateOrders && (
                        <button
                          onClick={onNavigateOrders}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-espresso dark:text-porcelain hover:bg-stone-light dark:hover:bg-dark-elevated rounded-lg transition-colors text-left cursor-pointer"
                        >
                          <Package className="w-4 h-4 text-bronze" />
                          <span>Order History</span>
                        </button>
                      )}
                      <button
                        onClick={logout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors text-left mt-1 cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => openAuthModal('login')}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-dark-surface hover:border-bronze border border-softBorder dark:border-dark-border text-espresso dark:text-porcelain transition-all shadow-luxury-sm cursor-pointer"
                >
                  <UserIcon className="w-4 h-4 text-bronze" />
                  <span className="text-xs font-semibold hidden sm:inline">Sign In</span>
                </button>
              )}
            </div>

            {/* Shopping Bag Button — Editorial Badge */}
            <button
              onClick={openCart}
              className="relative flex items-center gap-2 px-4 py-2 rounded-xl bg-espresso hover:bg-bronze text-white dark:bg-bronze dark:hover:bg-bronze-hover dark:text-espresso transition-all shadow-luxury select-none group cursor-pointer"
              aria-label={`Shopping bag with ${cartCount} items`}
            >
              <ShoppingBag className="w-4 h-4 transition-transform group-hover:scale-105" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold bg-white/20 px-1.5 py-0.2 rounded text-center">
                  {cartCount}
                </span>
                {calculation && calculation.total > 0 && (
                  <span className="text-xs font-semibold hidden sm:inline tracking-tight">
                    ₹{calculation.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                )}
              </div>
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-white dark:bg-dark-surface text-espresso dark:text-porcelain border border-softBorder dark:border-dark-border cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Search & Menu Panel */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-softBorder dark:border-dark-border animate-in slide-in-from-top-2 duration-200">
            <div className="relative w-full mb-3">
              <input
                type="text"
                placeholder="Search products, brands..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border rounded-xl pl-9 pr-14 py-2 text-sm text-espresso dark:text-porcelain placeholder:text-mutedGrey focus:outline-none focus:border-bronze"
              />
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-mutedGrey" />
              <button
                onClick={() => {
                  onSearchSubmit();
                  setMobileMenuOpen(false);
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-espresso text-white text-xs font-semibold rounded-lg"
              >
                Go
              </button>
            </div>
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 text-xs font-medium text-espresso dark:text-porcelain"
              >
                {theme === 'light' ? <Moon className="w-4 h-4 text-bronze" /> : <Sun className="w-4 h-4 text-bronze-gold" />}
                <span>{theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}</span>
              </button>
              {user?.role === 'admin' && onNavigateAdmin && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onNavigateAdmin();
                  }}
                  className="text-xs font-bold text-bronze hover:underline"
                >
                  Admin Center →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
