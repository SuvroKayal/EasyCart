import React from 'react';
import { Settings, ShieldCheck, Database, Server, CreditCard, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AdminSettings: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-crystal-royal" />
          Storefront & Engine Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          System policies, database configuration, financial parameters, and administrator access controls.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Administrator Accounts */}
        <div className="p-6 rounded-3xl bg-white dark:bg-crystal-navyCard/90 border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-crystal-royal" />
            Authorized Superadministrators
          </h3>
          <p className="text-xs text-slate-500">
            Protected root administrators with non-revocable system privileges.
          </p>

          <div className="space-y-3 pt-2">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div>
                <p className="font-bold text-xs text-slate-900 dark:text-white">
                  Shraddha Singh
                </p>
                <p className="text-[10px] font-mono text-slate-500">shraddha.singh@gmail.com</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Protected Superadmin
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div>
                <p className="font-bold text-xs text-slate-900 dark:text-white">
                  Suvro Kayal
                </p>
                <p className="text-[10px] font-mono text-slate-500">suvro@gmail.com</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Protected Superadmin
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300">
            <strong>Safeguard Active:</strong> Deletion and deactivation API requests targeting either root admin account are rejected server-side with an HTTP 403 Forbidden status.
          </div>
        </div>

        {/* Commerce & Pricing Rules */}
        <div className="p-6 rounded-3xl bg-white dark:bg-crystal-navyCard/90 border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-500" />
            Commercial & Tax Policy
          </h3>

          <div className="space-y-3 pt-2 text-xs">
            <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-white/5">
              <span className="text-slate-500 dark:text-slate-400">Default Currency:</span>
              <span className="font-bold text-slate-900 dark:text-white">INR (₹) Indian Rupee</span>
            </div>

            <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-white/5">
              <span className="text-slate-500 dark:text-slate-400">Goods & Services Tax (GST):</span>
              <span className="font-bold text-slate-900 dark:text-white">18% (Item inclusive / Itemized)</span>
            </div>

            <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-white/5">
              <span className="text-slate-500 dark:text-slate-400">Free Shipping Threshold:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">Orders &ge; ₹500</span>
            </div>

            <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-white/5">
              <span className="text-slate-500 dark:text-slate-400">Standard Delivery Fee:</span>
              <span className="font-bold text-slate-900 dark:text-white">₹40</span>
            </div>
          </div>
        </div>

        {/* Database & Storage Architecture */}
        <div className="p-6 rounded-3xl bg-white dark:bg-crystal-navyCard/90 border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-500" />
            Persistence & Database Storage
          </h3>

          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 font-mono text-[11px] space-y-1">
              <div><strong>Engine:</strong> SQLite 3 (ACID compliant)</div>
              <div><strong>Database:</strong> Backend/easycart.db</div>
              <div><strong>Backup:</strong> Backend/easycart.db.backup</div>
              <div><strong>Foreign Keys:</strong> PRAGMA foreign_keys = ON</div>
            </div>
          </div>
        </div>

        {/* Architecture & Session Environment */}
        <div className="p-6 rounded-3xl bg-white dark:bg-crystal-navyCard/90 border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-500" />
            Runtime Environment
          </h3>

          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 space-y-1">
              <div><strong>Frontend:</strong> React 18 + TypeScript + Vite + Tailwind CSS</div>
              <div><strong>Backend API:</strong> Python 3 Flask REST Services</div>
              <div><strong>Design System:</strong> Crystal Luxury (Apple Liquid Glass)</div>
              <div><strong>Current Session:</strong> {user?.name} ({user?.email})</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
