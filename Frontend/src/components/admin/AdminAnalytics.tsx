import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Package, PieChart } from 'lucide-react';
import { api } from '../../services/api';
import { SalesAnalytics } from '../../types';
import { useToast } from '../common/Toast';

export const AdminAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<SalesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.adminGetSalesAnalytics();
        setAnalytics(res);
      } catch {
        showToast('Failed to load deep analytics', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-8 h-8 border-3 border-crystal-royal border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-500">Generating analytical charts...</p>
      </div>
    );
  }

  const timeline = analytics?.daily_revenue || [];
  const topProducts = analytics?.best_selling || [];
  const categories = analytics?.category_performance || [];

  const maxRevenue = Math.max(...timeline.map((t) => t.revenue || 0), 1000);
  const maxCategoryRev = Math.max(...categories.map((c) => c.revenue || 0), 1000);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-crystal-royal" />
          Commerce Intelligence & Trends
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Historical order volume, category revenue contribution, and SKU product velocity.
        </p>
      </div>

      {/* Revenue Over Time Chart */}
      <div className="p-6 rounded-3xl bg-white dark:bg-crystal-navyCard/90 border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-crystal-royal" />
              Daily Revenue Trajectory
            </h3>
            <p className="text-xs text-slate-500">Derived from historical confirmed customer orders</p>
          </div>
        </div>

        {timeline.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No chronological order events recorded yet.
          </div>
        ) : (
          <div className="h-64 flex items-end gap-3 pt-6 pb-2 overflow-x-auto">
            {timeline.map((point, idx) => {
              const heightPercent = Math.min(100, Math.max(12, (point.revenue / maxRevenue) * 100));
              return (
                <div key={idx} className="flex-1 min-w-[48px] flex flex-col items-center gap-2 group">
                  <div className="text-[10px] font-bold text-crystal-royal opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    ₹{point.revenue.toLocaleString('en-IN')}
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-white/5 rounded-t-xl overflow-hidden h-48 flex items-end">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full bg-gradient-to-t from-crystal-royal to-blue-400 rounded-t-xl group-hover:from-blue-600 group-hover:to-crystal-royal transition-all duration-300"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {point.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Two Column: Category Share and Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Contribution */}
        <div className="p-6 rounded-3xl bg-white dark:bg-crystal-navyCard/90 border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <PieChart className="w-4 h-4 text-purple-500" />
            Revenue by Product Department
          </h3>

          <div className="space-y-3 pt-2">
            {categories.map((cat, idx) => {
              const pct = Math.max(4, Math.round((cat.revenue / maxCategoryRev) * 100));
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {cat.category}
                    </span>
                    <span className="font-black text-slate-900 dark:text-white">
                      ₹{cat.revenue.toLocaleString('en-IN')} ({cat.orders_count} orders)
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full bg-gradient-to-r from-purple-500 to-crystal-royal rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Velocity Products */}
        <div className="p-6 rounded-3xl bg-white dark:bg-crystal-navyCard/90 border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-500" />
            Top Velocity SKUs
          </h3>

          <div className="space-y-3 pt-2">
            {topProducts.map((prod, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-xs text-slate-400">#{idx + 1}</span>
                  <div>
                    <p className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                      {prod.product_name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {prod.units_sold} units fulfilled
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400">
                    ₹{prod.total_revenue.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
