import React from 'react';
import {
  LayoutDashboard,
  Package,
  Layers,
  FolderTree,
  Truck,
  Tag,
  ShoppingBag,
  TrendingUp,
  Users,
  ShieldAlert,
  BarChart3,
  History,
  Settings,
  LogOut,
  ExternalLink,
  Sun,
  Moon,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export type AdminTab =
  | 'overview'
  | 'products'
  | 'inventory'
  | 'categories'
  | 'suppliers'
  | 'offers'
  | 'orders'
  | 'sales'
  | 'customers'
  | 'logins'
  | 'analytics'
  | 'activity'
  | 'settings';

interface AdminLayoutProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  onExitToStore: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentTab,
  onSelectTab,
  onExitToStore,
  children,
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const navigationItems = [
    { id: 'overview', label: 'Executive Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'products', label: 'Products & Catalogue', icon: <Package className="w-4 h-4" /> },
    { id: 'inventory', label: 'Inventory Allocation', icon: <Layers className="w-4 h-4" /> },
    { id: 'categories', label: 'Department Structure', icon: <FolderTree className="w-4 h-4" /> },
    { id: 'suppliers', label: 'Supplier Network', icon: <Truck className="w-4 h-4" /> },
    { id: 'offers', label: 'Privileges & Offers', icon: <Tag className="w-4 h-4" /> },
    { id: 'orders', label: 'Order Fulfilment', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'sales', label: 'Revenue Analytics', icon: <TrendingUp className="w-4 h-4" />, badge: 'Live' },
    { id: 'customers', label: 'Customer Accounts', icon: <Users className="w-4 h-4" /> },
    { id: 'logins', label: 'Authentication Security', icon: <ShieldAlert className="w-4 h-4" /> },
    { id: 'analytics', label: 'Commerce Intelligence', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'activity', label: 'Administrative Audit', icon: <History className="w-4 h-4" /> },
    { id: 'settings', label: 'System Configuration', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-porcelain dark:bg-dark-bg text-espresso dark:text-porcelain flex flex-col transition-colors duration-200">
      {/* Top Admin Executive Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-dark-surface/90 backdrop-blur-md border-b border-softBorder dark:border-dark-border px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onExitToStore}
              className="flex items-center gap-2 group select-none cursor-pointer"
              title="Return to Public Storefront"
            >
              <img
                src="/banner/EasyCart%20logo.png"
                alt="EasyCart"
                className="h-8 w-auto object-contain"
              />
              <span className="font-serif text-lg font-bold text-espresso dark:text-porcelain">
                Easy<span className="text-bronze">Cart</span>
              </span>
            </button>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-bronze/15 text-espresso dark:text-bronze-gold text-xs font-semibold border border-bronze/30">
              <ShieldCheck className="w-3.5 h-3.5 text-bronze" />
              <span>Executive Control Center</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme switcher */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-stone-light/60 dark:bg-dark-elevated hover:bg-stone dark:hover:bg-dark-card text-espresso dark:text-porcelain border border-softBorder dark:border-dark-border transition-colors cursor-pointer"
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4 text-bronze" /> : <Sun className="w-4 h-4 text-bronze-gold" />}
            </button>

            {/* Return to Storefront */}
            <button
              onClick={onExitToStore}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border text-xs font-semibold text-espresso dark:text-porcelain hover:border-bronze transition-colors shadow-luxury-sm cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-bronze" />
              <span className="hidden sm:inline">Storefront View</span>
            </button>

            {/* Administrator Profile Tag */}
            <div className="flex items-center gap-2 pl-2 border-l border-softBorder dark:border-dark-border">
              <div className="w-8 h-8 rounded-full bg-espresso text-porcelain dark:bg-bronze dark:text-espresso font-serif font-bold text-xs flex items-center justify-center shadow-luxury-sm">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="hidden md:block text-left text-xs leading-tight">
                <span className="font-semibold text-espresso dark:text-porcelain block">
                  {user?.name || 'Administrator'}
                </span>
                <span className="text-[10px] text-bronze dark:text-bronze-gold font-bold uppercase tracking-wider">
                  Authorized Superadmin
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace with 12-Item Sidebar */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-white/70 dark:bg-dark-surface/60 backdrop-blur-md border-r border-softBorder dark:border-dark-border flex flex-col shrink-0">
          <div className="p-4 border-b border-softBorder dark:border-dark-border">
            <span className="text-[10px] font-bold text-mutedGrey dark:text-dark-muted uppercase tracking-widest block mb-0.5">
              Management Suite
            </span>
            <p className="font-serif text-xs font-semibold text-espresso dark:text-porcelain">
              Enterprise Governance
            </p>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto no-scrollbar">
            {navigationItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id as AdminTab)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all select-none text-left cursor-pointer ${
                    isActive
                      ? 'bg-espresso text-porcelain dark:bg-bronze dark:text-espresso shadow-luxury-sm'
                      : 'text-espresso/80 dark:text-porcelain/80 hover:bg-stone-light/50 dark:hover:bg-dark-elevated'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={isActive ? 'text-bronze dark:text-espresso' : 'text-bronze'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                        isActive
                          ? 'bg-white/20 text-white dark:bg-black/20 dark:text-espresso'
                          : 'bg-stone-light text-espresso dark:bg-dark-elevated dark:text-bronze-gold'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Logout item */}
            <div className="pt-2 border-t border-softBorder dark:border-dark-border mt-2">
              <button
                onClick={logout}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Admin Sign Out</span>
              </button>
            </div>
          </nav>
        </aside>

        {/* Content Pane */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
