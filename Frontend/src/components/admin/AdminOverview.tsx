import React, { useEffect, useState } from 'react';
import {
  Users,
  TrendingUp,
  ShoppingBag,
  Layers,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  Clock,
  Sparkles,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../services/api';
import { AdminOverview as IAdminOverview, AdminActivity } from '../../types';
import { AdminTab } from './AdminLayout';

interface AdminOverviewProps {
  onNavigate: (tab: AdminTab) => void;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({ onNavigate }) => {
  const [data, setData] = useState<IAdminOverview | null>(null);
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [overviewData, activityData] = await Promise.all([
        api.adminGetOverview(),
        api.adminGetActivity().catch(() => ({ activities: [] })),
      ]);
      setData(overviewData);
      setActivities(activityData.activities.slice(0, 8));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load admin overview';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-8 h-8 border-2 border-bronze border-t-transparent rounded-full animate-spin" />
        <p className="text-mutedGrey dark:text-dark-muted font-medium text-xs tracking-wider uppercase">
          Loading executive metrics...
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-center">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="font-serif text-lg font-bold text-rose-800 dark:text-rose-300">Unable to load metrics</h3>
        <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-espresso hover:bg-bronze text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  const netRevenue = data?.net_revenue ?? 0;
  const totalOrders = data?.total_orders ?? 0;
  const totalCustomers = data?.total_customers ?? 0;
  const activeCustomers = data?.active_customers ?? 0;
  const lowStockCount = data?.low_stock_count ?? 0;
  const todayLogins = data?.today_logins ?? 0;
  const lowStockItems = data?.low_stock_items || [];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Executive Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-espresso p-6 sm:p-8 text-white shadow-luxury border border-white/10">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-bronze/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-bronze/20 text-bronze-light border border-bronze/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-bronze" />
                Live Control Center
              </span>
              <span className="text-xs text-stone/80 flex items-center gap-1">
                <Clock className="w-3 h-3 text-bronze" />
                Real-time telemetry
              </span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-porcelain">
              Executive Storefront Overview
            </h1>
            <p className="text-stone/80 text-xs sm:text-sm mt-1 max-w-xl leading-relaxed">
              Real-time enterprise metrics, verified SQLite order ledger, live customer accounts, and authentication telemetry.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={fetchData}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/10 backdrop-blur-md flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Data
            </button>
            <button
              onClick={() => onNavigate('sales')}
              className="px-4 py-2 rounded-xl bg-bronze hover:bg-bronze-hover text-espresso text-xs font-bold shadow-luxury-sm flex items-center gap-2 transition-colors cursor-pointer"
            >
              Sales Analytics
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Revenue */}
        <div
          onClick={() => onNavigate('sales')}
          className="group cursor-pointer p-5 rounded-xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm hover:border-bronze transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-mutedGrey dark:text-dark-muted uppercase tracking-widest">
              Net Sales Revenue
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 group-hover:scale-105 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="font-serif text-2xl font-bold text-espresso dark:text-porcelain">
              ₹{netRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-mutedGrey dark:text-dark-muted">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">{totalOrders} confirmed orders</span>
              <span>• SQLite ledger</span>
            </div>
          </div>
        </div>

        {/* Customer Accounts */}
        <div
          onClick={() => onNavigate('customers')}
          className="group cursor-pointer p-5 rounded-xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm hover:border-bronze transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-mutedGrey dark:text-dark-muted uppercase tracking-widest">
              Registered Customers
            </span>
            <div className="p-2 rounded-lg bg-stone-light dark:bg-dark-elevated text-bronze group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="font-serif text-2xl font-bold text-espresso dark:text-porcelain">
              {totalCustomers}
            </span>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-mutedGrey dark:text-dark-muted">
              <span className="font-semibold text-bronze">{activeCustomers} active accounts</span>
              <span>• Safeguards on</span>
            </div>
          </div>
        </div>

        {/* Product Stock */}
        <div
          onClick={() => onNavigate('inventory')}
          className="group cursor-pointer p-5 rounded-xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm hover:border-bronze transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-mutedGrey dark:text-dark-muted uppercase tracking-widest">
              Product Inventory
            </span>
            <div className="p-2 rounded-lg bg-stone-light dark:bg-dark-elevated text-bronze group-hover:scale-105 transition-transform">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="font-serif text-2xl font-bold text-espresso dark:text-porcelain">
              {lowStockCount > 0 ? (
                <span className="text-amber-700 dark:text-amber-400">{lowStockCount} Low Allocation</span>
              ) : (
                <span className="text-emerald-700 dark:text-emerald-400">Inventory Sound</span>
              )}
            </span>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-mutedGrey dark:text-dark-muted">
              <span>Threshold: &le; 10 units</span>
            </div>
          </div>
        </div>

        {/* Security Telemetry */}
        <div
          onClick={() => onNavigate('logins')}
          className="group cursor-pointer p-5 rounded-xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm hover:border-bronze transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-mutedGrey dark:text-dark-muted uppercase tracking-widest">
              Security Telemetry
            </span>
            <div className="p-2 rounded-lg bg-stone-light dark:bg-dark-elevated text-bronze group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="font-serif text-2xl font-bold text-espresso dark:text-porcelain">
              {todayLogins} <span className="text-xs font-normal text-mutedGrey">Today</span>
            </span>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
              <span>Audit Logging Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Low Stock Watchlist & Recent Admin Audit Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Watchlist */}
        <div className="p-6 rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h2 className="font-serif font-semibold text-espresso dark:text-porcelain">
                Low Inventory Watchlist
              </h2>
            </div>
            <button
              onClick={() => onNavigate('inventory')}
              className="text-xs font-semibold text-bronze hover:underline flex items-center gap-1 cursor-pointer"
            >
              Manage Inventory
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {lowStockItems.length === 0 ? (
            <div className="py-12 text-center text-mutedGrey dark:text-dark-muted text-xs">
              All inventory levels are currently above reorder thresholds.
            </div>
          ) : (
            <div className="space-y-2.5">
              {lowStockItems.slice(0, 5).map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-ivory dark:bg-dark-card border border-softBorder dark:border-dark-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white dark:bg-dark-surface p-1 flex items-center justify-center border border-softBorder dark:border-dark-border shrink-0">
                      <img
                        src={item.image_url || `/static/images/p${item.id}.svg`}
                        alt={item.title}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/banner/Electronics.png';
                        }}
                      />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-espresso dark:text-porcelain line-clamp-1">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-mutedGrey dark:text-dark-muted">
                        {item.category} • ₹{item.price}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        item.quantity === 0
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {item.quantity === 0 ? 'Out of Stock' : `${item.quantity} units left`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Administrative Audit Log */}
        <div className="p-6 rounded-2xl bg-white dark:bg-dark-surface border border-softBorder dark:border-dark-border shadow-luxury-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-stone-light dark:bg-dark-elevated text-bronze">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h2 className="font-serif font-semibold text-espresso dark:text-porcelain">
                Admin Activity Audit Trail
              </h2>
            </div>
            <button
              onClick={() => onNavigate('activity')}
              className="text-xs font-semibold text-bronze hover:underline flex items-center gap-1 cursor-pointer"
            >
              Full Audit Log
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {activities.length === 0 ? (
            <div className="py-12 text-center text-mutedGrey dark:text-dark-muted text-xs">
              No recent administrative actions recorded.
            </div>
          ) : (
            <div className="space-y-2.5">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="p-3 rounded-xl bg-ivory dark:bg-dark-card border border-softBorder dark:border-dark-border text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-espresso dark:text-porcelain">
                      {act.admin_name || act.admin_email}
                    </span>
                    <span className="text-[10px] text-mutedGrey dark:text-dark-muted">
                      {new Date(act.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-mutedGrey dark:text-dark-muted">
                    <span className="font-semibold text-bronze uppercase tracking-wider text-[10px] mr-1">
                      [{act.action}]
                    </span>
                    {act.details}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="p-6 rounded-2xl bg-ivory dark:bg-dark-surface border border-softBorder dark:border-dark-border">
        <h3 className="font-serif text-sm font-semibold uppercase tracking-wider text-espresso dark:text-porcelain mb-4">
          Direct Module Shortcuts
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('customers')}
            className="p-4 rounded-xl bg-white dark:bg-dark-card hover:border-bronze border border-softBorder dark:border-dark-border text-left transition-all shadow-luxury-sm cursor-pointer"
          >
            <Users className="w-5 h-5 text-bronze mb-2" />
            <p className="font-semibold text-xs text-espresso dark:text-porcelain">Customer Accounts</p>
            <p className="text-[10px] text-mutedGrey dark:text-dark-muted">Search &amp; safeguards</p>
          </button>
          <button
            onClick={() => onNavigate('sales')}
            className="p-4 rounded-xl bg-white dark:bg-dark-card hover:border-bronze border border-softBorder dark:border-dark-border text-left transition-all shadow-luxury-sm cursor-pointer"
          >
            <TrendingUp className="w-5 h-5 text-bronze mb-2" />
            <p className="font-semibold text-xs text-espresso dark:text-porcelain">Sales &amp; Revenue</p>
            <p className="text-[10px] text-mutedGrey dark:text-dark-muted">Real orders &amp; export</p>
          </button>
          <button
            onClick={() => onNavigate('logins')}
            className="p-4 rounded-xl bg-white dark:bg-dark-card hover:border-bronze border border-softBorder dark:border-dark-border text-left transition-all shadow-luxury-sm cursor-pointer"
          >
            <ShieldAlert className="w-5 h-5 text-bronze mb-2" />
            <p className="font-semibold text-xs text-espresso dark:text-porcelain">Login Security</p>
            <p className="text-[10px] text-mutedGrey dark:text-dark-muted">IP &amp; session telemetry</p>
          </button>
          <button
            onClick={() => onNavigate('offers')}
            className="p-4 rounded-xl bg-white dark:bg-dark-card hover:border-bronze border border-softBorder dark:border-dark-border text-left transition-all shadow-luxury-sm cursor-pointer"
          >
            <ShoppingBag className="w-5 h-5 text-bronze mb-2" />
            <p className="font-semibold text-xs text-espresso dark:text-porcelain">Privileges &amp; Offers</p>
            <p className="text-[10px] text-mutedGrey dark:text-dark-muted">Vouchers &amp; rules</p>
          </button>
        </div>
      </div>
    </div>
  );
};
