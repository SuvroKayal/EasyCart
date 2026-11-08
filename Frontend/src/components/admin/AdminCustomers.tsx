import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Customer, CustomerDetail } from '../../types';
import { api } from '../../services/api';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { useToast } from '../common/Toast';

export const AdminCustomers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Selected customer for detail inspection
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<CustomerDetail | null>(null);
  const [, setDetailLoading] = useState(false);

  // Safeguarded Account Deletion / Deactivation modal
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [actionType, setActionType] = useState<'deactivate' | 'delete'>('deactivate');
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const { showToast } = useToast();

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.adminGetCustomers({
        search: search.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        sort: sortBy,
      });
      setCustomers(data.customers);
    } catch (err: any) {
      showToast(err.message || 'Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sortBy, showToast]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleOpenDetail = async (userId: number) => {
    try {
      setDetailLoading(true);
      const detail = await api.adminGetCustomerDetail(userId);
      setSelectedCustomerDetail(detail);
    } catch (err: any) {
      showToast(err.message || 'Failed to load customer details', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExecuteStatusChange = async () => {
    if (!deletingCustomer) return;

    try {
      setActionLoading(true);
      const targetStatus = actionType === 'delete' ? 'deleted' : 'deactivated';
      const res = await api.adminUpdateCustomerStatus(
        deletingCustomer.id,
        targetStatus,
        actionReason || `Administrative ${actionType}`
      );

      showToast(res.message, 'success');
      setDeletingCustomer(null);
      setActionReason('');
      fetchCustomers();
      if (selectedCustomerDetail?.customer.id === deletingCustomer.id) {
        handleOpenDetail(deletingCustomer.id);
      }
    } catch (err: any) {
      showToast(err.message || 'Action rejected by server safeguard', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async (customer: Customer) => {
    try {
      const res = await api.adminUpdateCustomerStatus(customer.id, 'active', 'Reactivated by administrator');
      showToast(res.message, 'success');
      fetchCustomers();
    } catch (err: any) {
      showToast(err.message || 'Failed to reactivate customer', 'error');
    }
  };

  const handleRevokeSessions = async (userId: number) => {
    try {
      const res = await api.adminRevokeCustomerSessions(userId);
      showToast(res.message, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to revoke sessions', 'error');
    }
  };

  const isProtectedAdmin = (c: Customer) => {
    return (
      c.role === 'admin' ||
      ['shraddha.singh@gmail.com', 'suvro@gmail.com', 'suvrokayal2005@gmail.com'].includes(c.email)
    );
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-crystal-royal" />
            <h1 className="text-2xl font-black text-crystal-navy dark:text-white">
              Customer Account Management
            </h1>
          </div>
          <p className="text-xs text-crystal-textMuted mt-1">
            Search, inspect purchase metrics, verify login history, and manage customer account lifecycles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-crystal-navy dark:text-white shadow-2xs">
            Total Records: <strong className="text-crystal-royal">{customers.length}</strong>
          </span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white/70 dark:bg-crystal-navyCard/70 backdrop-blur-md border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-crystal-textMuted" />
          <input
            type="text"
            placeholder="Search by name, email, or Customer ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-crystal-navyDark border border-slate-200 dark:border-white/10 text-xs text-crystal-navy dark:text-white placeholder:text-crystal-textMuted focus:outline-none focus:border-crystal-royal"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-crystal-textMuted">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white dark:bg-crystal-navyDark border border-slate-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-crystal-navy dark:text-white focus:outline-none focus:border-crystal-royal"
            >
              <option value="all">All Accounts</option>
              <option value="active">Active Only</option>
              <option value="deactivated">Deactivated</option>
              <option value="deleted">Deleted (Soft-Deleted)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-crystal-textMuted">
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white dark:bg-crystal-navyDark border border-slate-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-crystal-navy dark:text-white focus:outline-none focus:border-crystal-royal"
            >
              <option value="newest">Registration: Newest</option>
              <option value="oldest">Registration: Oldest</option>
              <option value="spending_desc">Spending: Highest</option>
              <option value="orders_desc">Orders: Highest</option>
              <option value="name_asc">Name: A to Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="rounded-3xl bg-white dark:bg-crystal-navyCard border border-slate-200 dark:border-white/10 overflow-hidden shadow-crystal">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-crystal-textMuted font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Customer ID</th>
                <th className="py-3.5 px-4">Full Name</th>
                <th className="py-3.5 px-4">Email Address</th>
                <th className="py-3.5 px-4">Role / Permissions</th>
                <th className="py-3.5 px-4">Registration Date</th>
                <th className="py-3.5 px-4 text-center">Orders</th>
                <th className="py-3.5 px-4 text-right">Total Spent</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-crystal-textMuted">
                    Loading customer accounts from SQLite...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-crystal-textMuted">
                    No matching customer accounts found.
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const isAdmin = isProtectedAdmin(c);

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => handleOpenDetail(c.id)}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-crystal-royal">
                        #{c.id}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-crystal-navy dark:text-white">
                        {c.name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {c.email}
                      </td>
                      <td className="py-3.5 px-4">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-crystal-royal/10 text-crystal-royal font-bold text-[10px] border border-crystal-royal/20">
                            <Lock className="w-3 h-3" /> Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 text-[10px]">
                            Customer
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-crystal-textMuted">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-crystal-navy dark:text-white">
                        {c.total_orders}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-crystal-royal">
                        ₹{c.total_spending.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {c.status === 'active' && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800/40">
                            Active
                          </span>
                        )}
                        {c.status === 'deactivated' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-200 dark:border-amber-800/40">
                            Deactivated
                          </span>
                        )}
                        {c.status === 'deleted' && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[10px] font-bold border border-rose-200 dark:border-rose-800/40">
                            Deleted
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDetail(c.id)}
                            className="p-1.5 rounded-lg text-crystal-textMuted hover:text-crystal-royal hover:bg-crystal-royal/10 transition-colors"
                            title="Inspect complete history"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {c.status === 'active' && !isAdmin && (
                            <button
                              onClick={() => {
                                setDeletingCustomer(c);
                                setActionType('deactivate');
                              }}
                              className="px-2 py-1 rounded-lg text-[10px] font-semibold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                              title="Safely deactivate customer"
                            >
                              Deactivate
                            </button>
                          )}

                          {c.status !== 'active' && !isAdmin && (
                            <button
                              onClick={() => handleReactivate(c)}
                              className="px-2 py-1 rounded-lg text-[10px] font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                              title="Reactivate customer account"
                            >
                              Reactivate
                            </button>
                          )}

                          {!isAdmin && (
                            <button
                              onClick={() => {
                                setDeletingCustomer(c);
                                setActionType('delete');
                              }}
                              className="px-2 py-1 rounded-lg text-[10px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                              title="Safe Soft-Delete (Preserves Orders)"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Details Modal */}
      {selectedCustomerDetail && (
        <Modal
          isOpen={!!selectedCustomerDetail}
          onClose={() => setSelectedCustomerDetail(null)}
          maxWidth="4xl"
          title={`Customer File: ${selectedCustomerDetail.customer.name}`}
        >
          <div className="space-y-6">
            {/* Customer Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-crystal-navy dark:text-white">
                    {selectedCustomerDetail.customer.name}
                  </h3>
                  <span className="font-mono text-xs text-crystal-textMuted">
                    (ID #{selectedCustomerDetail.customer.id})
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Email: <strong className="text-crystal-navy dark:text-white">{selectedCustomerDetail.customer.email}</strong>
                </p>
                <p className="text-[11px] text-crystal-textMuted mt-0.5">
                  Registered: {new Date(selectedCustomerDetail.customer.created_at).toLocaleString('en-IN')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => handleRevokeSessions(selectedCustomerDetail.customer.id)}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Revoke Active Sessions
                </Button>
              </div>
            </div>

            {/* Purchase KPI Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-white dark:bg-crystal-navyDark border border-slate-200/60 dark:border-white/10">
                <span className="text-[10px] font-bold text-crystal-textMuted uppercase tracking-wider block">
                  Total Spent
                </span>
                <span className="text-lg font-black text-crystal-royal mt-1 block">
                  ₹{selectedCustomerDetail.stats.total_spent.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-crystal-navyDark border border-slate-200/60 dark:border-white/10">
                <span className="text-[10px] font-bold text-crystal-textMuted uppercase tracking-wider block">
                  Completed Orders
                </span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                  {selectedCustomerDetail.stats.completed_orders}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-crystal-navyDark border border-slate-200/60 dark:border-white/10">
                <span className="text-[10px] font-bold text-crystal-textMuted uppercase tracking-wider block">
                  Average Order Value
                </span>
                <span className="text-lg font-black text-crystal-navy dark:text-white mt-1 block">
                  ₹{selectedCustomerDetail.stats.average_order_value.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-crystal-navyDark border border-slate-200/60 dark:border-white/10">
                <span className="text-[10px] font-bold text-crystal-textMuted uppercase tracking-wider block">
                  Last Purchase
                </span>
                <span className="text-xs font-semibold text-crystal-navy dark:text-white mt-2 block truncate">
                  {selectedCustomerDetail.stats.last_purchase_date
                    ? new Date(selectedCustomerDetail.stats.last_purchase_date).toLocaleDateString('en-IN')
                    : 'No orders yet'}
                </span>
              </div>
            </div>

            {/* Customer Order History */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-crystal-navy dark:text-white mb-3">
                Associated Orders & Financial History ({selectedCustomerDetail.orders.length})
              </h4>
              <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
                {selectedCustomerDetail.orders.length === 0 ? (
                  <p className="text-xs text-crystal-textMuted py-4 text-center">
                    No orders placed by this customer.
                  </p>
                ) : (
                  selectedCustomerDetail.orders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3 rounded-2xl bg-white dark:bg-crystal-navyDark border border-slate-200/60 dark:border-white/10 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-crystal-navy dark:text-white">
                            {ord.id}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 text-[10px] font-bold">
                            {ord.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-crystal-textMuted mt-0.5">
                          Date: {new Date(ord.created_at).toLocaleString('en-IN')} • Payment: {ord.payment_method}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-sm text-crystal-royal">
                          ₹{ord.total.toLocaleString('en-IN')}
                        </span>
                        <p className="text-[10px] text-crystal-textMuted">
                          {ord.items?.length || 0} line items
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Status Modification Audit Trail */}
            {selectedCustomerDetail.status_history.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-crystal-navy dark:text-white mb-2">
                  Account Status Audit History
                </h4>
                <div className="space-y-1.5 text-xs text-crystal-textMuted">
                  {selectedCustomerDetail.status_history.map((h) => (
                    <div key={h.id} className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/40">
                      <span>Changed from <strong>{h.previous_status}</strong> to <strong>{h.new_status}</strong> by admin ID {h.changed_by_admin_id} ({h.admin_name || 'Admin'}). Reason: "{h.reason}" on {new Date(h.created_at).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Safeguarded Deletion / Deactivation Confirmation Dialog */}
      {deletingCustomer && (
        <Modal
          isOpen={!!deletingCustomer}
          onClose={() => setDeletingCustomer(null)}
          maxWidth="md"
          title={
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <span>Confirm Account {actionType === 'delete' ? 'Safe Deletion' : 'Deactivation'}</span>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              You are about to {actionType} the customer account below. This will revoke all active sessions and prevent the customer from logging in.
            </p>

            {/* Identity Card */}
            <div className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs space-y-1">
              <div>
                Customer ID: <strong className="font-mono text-crystal-navy dark:text-white">#{deletingCustomer.id}</strong>
              </div>
              <div>
                Full Name: <strong className="text-crystal-navy dark:text-white">{deletingCustomer.name}</strong>
              </div>
              <div>
                Email: <strong className="text-crystal-navy dark:text-white">{deletingCustomer.email}</strong>
              </div>
              <div>
                Total Associated Orders: <strong className="text-crystal-navy dark:text-white">{deletingCustomer.total_orders} (Preserved in Database)</strong>
              </div>
            </div>

            {/* Safeguard Guarantee Note */}
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Financial integrity guaranteed: Invoices and past order records will NOT be deleted.</span>
            </div>

            {/* Reason Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-crystal-textMuted uppercase tracking-wider block">
                Reason for Audit Log:
              </label>
              <input
                type="text"
                placeholder="e.g. Requested account closure, suspicious activity"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-crystal-navyDark border border-slate-200 dark:border-white/10 text-xs focus:outline-none focus:border-crystal-royal"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/10">
              <Button onClick={() => setDeletingCustomer(null)} variant="secondary" size="sm">
                Cancel
              </Button>
              <Button
                onClick={handleExecuteStatusChange}
                variant="danger"
                size="sm"
                isLoading={actionLoading}
              >
                Confirm & {actionType === 'delete' ? 'Soft Delete' : 'Deactivate'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
