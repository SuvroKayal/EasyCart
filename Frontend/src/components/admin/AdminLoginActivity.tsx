import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Laptop,
  Globe,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { LoginActivityResponse } from '../../types';
import { api } from '../../services/api';
import { Button } from '../common/Button';
import { useToast } from '../common/Toast';

export const AdminLoginActivity: React.FC = () => {
  const [data, setData] = useState<LoginActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [emailQuery, setEmailQuery] = useState('');

  const { showToast } = useToast();

  const fetchLogins = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.adminGetLogins({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        email: emailQuery.trim() || undefined,
        limit: 100,
      });
      setData(res);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch login events', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, emailQuery, showToast]);

  useEffect(() => {
    fetchLogins();
  }, [fetchLogins]);

  const handleRevoke = async (userId: number, email: string) => {
    try {
      await api.adminRevokeCustomerSessions(userId);
      showToast(`Active sessions for ${email} revoked successfully`, 'success');
      fetchLogins();
    } catch (err: any) {
      showToast(err.message || 'Failed to revoke session', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-crystal-royal" />
            <h1 className="text-2xl font-black text-crystal-navy dark:text-white">
              Login Activity & Security Monitoring
            </h1>
          </div>
          <p className="text-xs text-crystal-textMuted mt-1">
            Real-time audit log tracking successful logins, credential failures, IP origin, and session activity.
          </p>
        </div>

        <Button
          onClick={fetchLogins}
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw className="w-3.5 h-3.5 text-crystal-royal" />}
        >
          Refresh Feed
        </Button>
      </div>

      {/* Security Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-3xl bg-white dark:bg-crystal-navyCard border border-slate-200 dark:border-white/10 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-crystal-textMuted uppercase tracking-wider">
              Total Logins Logged
            </span>
            <Clock className="w-4 h-4 text-crystal-royal" />
          </div>
          <span className="text-2xl font-black text-crystal-navy dark:text-white mt-2 block">
            {data?.stats.total_events || 0}
          </span>
          <span className="text-[11px] text-crystal-textMuted mt-1 block">
            All database-tracked auth attempts
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-crystal-navyCard border border-slate-200 dark:border-white/10 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-crystal-textMuted uppercase tracking-wider">
              Successful Authorizations
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 block">
            {data?.stats.successful_logins || 0}
          </span>
          <span className="text-[11px] text-crystal-textMuted mt-1 block">
            Verified session token issuances
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-crystal-navyCard border border-slate-200 dark:border-white/10 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-crystal-textMuted uppercase tracking-wider">
              Failed Attempts
            </span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2 block">
            {data?.stats.failed_logins || 0}
          </span>
          <span className="text-[11px] text-crystal-textMuted mt-1 block">
            Invalid passwords / unknown accounts
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-crystal-navyCard border border-slate-200 dark:border-white/10 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-crystal-textMuted uppercase tracking-wider">
              Repeated Failures Alert
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2 block">
            {data?.stats.repeated_failed_attempts || 0}
          </span>
          <span className="text-[11px] text-crystal-textMuted mt-1 block">
            Accounts with $\ge 2$ consecutive failures
          </span>
        </div>
      </div>

      {/* Repeated Failed Attempts Alert Banner if any */}
      {data?.stats.repeated_failures && data.stats.repeated_failures.length > 0 && (
        <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Security Notice: Repeated Authentication Failures Detected</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {data.stats.repeated_failures.map((f, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full bg-white dark:bg-crystal-navyCard border border-amber-500/20 text-crystal-navy dark:text-white"
              >
                <strong>{f.email}</strong>: {f.failed_count} failures (Last: {new Date(f.last_attempt).toLocaleTimeString('en-IN')})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white/70 dark:bg-crystal-navyCard/70 backdrop-blur-md border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-crystal-textMuted" />
          <input
            type="text"
            placeholder="Search by email address..."
            value={emailQuery}
            onChange={(e) => setEmailQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-crystal-navyDark border border-slate-200 dark:border-white/10 text-xs text-crystal-navy dark:text-white placeholder:text-crystal-textMuted focus:outline-none focus:border-crystal-royal"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-crystal-textMuted">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white dark:bg-crystal-navyDark border border-slate-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-crystal-navy dark:text-white focus:outline-none focus:border-crystal-royal"
            >
              <option value="all">All Events</option>
              <option value="success">Success Only</option>
              <option value="failed">Failed Only</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-crystal-textMuted">
            <span>Actor:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-white dark:bg-crystal-navyDark border border-slate-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-crystal-navy dark:text-white focus:outline-none focus:border-crystal-royal"
            >
              <option value="all">All Actors</option>
              <option value="customer">Customers</option>
              <option value="admin">Administrators</option>
            </select>
          </div>
        </div>
      </div>

      {/* Log Activity Table */}
      <div className="rounded-3xl bg-white dark:bg-crystal-navyCard border border-slate-200 dark:border-white/10 overflow-hidden shadow-crystal">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-crystal-textMuted font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Event Status</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Target Email</th>
                <th className="py-3.5 px-4">Customer Name</th>
                <th className="py-3.5 px-4">Actor Type</th>
                <th className="py-3.5 px-4">IP Address</th>
                <th className="py-3.5 px-4">Client / Device</th>
                <th className="py-3.5 px-4 text-right">Session Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-crystal-textMuted">
                    Reading login security audit log from SQLite...
                  </td>
                </tr>
              ) : !data || data.logins.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-crystal-textMuted">
                    No login events match the selected criteria.
                  </td>
                </tr>
              ) : (
                data.logins.map((evt) => {
                  const isSuccess = evt.success === 1;

                  return (
                    <tr key={evt.id} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-4">
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] border border-emerald-200 dark:border-emerald-800/40">
                            <CheckCircle2 className="w-3 h-3" /> Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-[10px] border border-rose-200 dark:border-rose-800/40">
                            <XCircle className="w-3 h-3" /> Failed Attempt
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-crystal-textMuted font-mono">
                        {new Date(evt.created_at).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-crystal-navy dark:text-white">
                        {evt.email}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {evt.user_name || <span className="text-slate-400 italic">Unregistered</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        {evt.event_type.startsWith('admin') ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-crystal-royal">
                            <Lock className="w-3 h-3" /> Admin Auth
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">Customer</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3 text-crystal-textMuted" />
                          {evt.ip_address || '127.0.0.1'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-500 truncate max-w-xs" title={evt.user_agent}>
                        <span className="flex items-center gap-1">
                          <Laptop className="w-3 h-3 text-crystal-textMuted shrink-0" />
                          <span className="truncate">{evt.user_agent || 'Standard Web Browser'}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {evt.user_id && isSuccess && (
                          <button
                            onClick={() => handleRevoke(evt.user_id!, evt.email)}
                            className="px-2 py-1 rounded-lg text-[10px] font-semibold text-crystal-royal hover:bg-crystal-royal/10 transition-colors"
                            title="Revoke active customer session"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
