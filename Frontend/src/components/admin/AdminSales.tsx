import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Download,
  Calendar,
  PackageCheck,
  Clock,
  Receipt,
  Eye,
  CheckCircle2,
  ShoppingBag,
} from 'lucide-react';
import { SalesOverview, SalesAnalytics, Order } from '../../types';
import { api } from '../../services/api';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { useToast } from '../common/Toast';

export const AdminSales: React.FC = () => {
  const [overview, setOverview] = useState<SalesOverview | null>(null);
  const [analytics, setAnalytics] = useState<SalesAnalytics | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [, setLoading] = useState(true);

  // Date range filter
  const [range, setRange] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Orders filters
  const [orderSearch, setOrderSearch] = useState('');
  const [orderPaymentStatus, setOrderPaymentStatus] = useState('all');
  const [orderStatus, setOrderStatus] = useState('all');

  // Selected Order for full inspection
  const [inspectingOrder, setInspectingOrder] = useState<Order | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [newOrderStatus, setNewOrderStatus] = useState('');
  const [newPaymentStatus, setNewPaymentStatus] = useState('');
  const [refundAmount, setRefundAmount] = useState('0');

  const { showToast } = useToast();

  const fetchSalesData = useCallback(async () => {
    try {
      setLoading(true);
      const [ov, an, ords] = await Promise.all([
        api.adminGetSalesOverview({
          range,
          start_date: range === 'custom' ? startDate : undefined,
          end_date: range === 'custom' ? endDate : undefined,
        }),
        api.adminGetSalesAnalytics(),
        api.adminGetSalesOrders({
          search: orderSearch.trim() || undefined,
          payment_status: orderPaymentStatus !== 'all' ? orderPaymentStatus : undefined,
          order_status: orderStatus !== 'all' ? orderStatus : undefined,
        }),
      ]);

      setOverview(ov);
      setAnalytics(an);
      setOrders(ords.orders);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch sales records', 'error');
    } finally {
      setLoading(false);
    }
  }, [range, startDate, endDate, orderSearch, orderPaymentStatus, orderStatus, showToast]);

  useEffect(() => {
    fetchSalesData();
  }, [fetchSalesData]);

  const handleUpdateStatus = async () => {
    if (!inspectingOrder) return;

    try {
      setStatusUpdating(true);
      await api.adminUpdateOrderStatus(inspectingOrder.id, {
        status: newOrderStatus || undefined,
        payment_status: newPaymentStatus || undefined,
        refund_amount: parseFloat(refundAmount) || 0,
      });

      showToast(`Order ${inspectingOrder.id} status updated successfully`, 'success');
      setInspectingOrder(null);
      fetchSalesData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update order', 'error');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDownloadCsv = (type: 'sales_report' | 'orders' | 'products' | 'customers') => {
    const url = api.adminGetExportUrl(
      type,
      range,
      range === 'custom' ? startDate : undefined,
      range === 'custom' ? endDate : undefined
    );
    window.open(url, '_blank');
    showToast(`Generating and exporting ${type.replace('_', ' ')} CSV...`, 'info');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-crystal-royal" />
            <h1 className="text-2xl font-black text-crystal-navy dark:text-white">
              Complete Sales & Revenue Management
            </h1>
          </div>
          <p className="text-xs text-crystal-textMuted mt-1">
            Authoritative transactional ledger derived strictly from completed database orders and payment confirmations.
          </p>
        </div>

        {/* CSV Export Button Group */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => handleDownloadCsv('sales_report')}
            variant="secondary"
            size="sm"
            leftIcon={<Download className="w-3.5 h-3.5 text-crystal-royal" />}
          >
            Sales Summary CSV
          </Button>
          <Button
            onClick={() => handleDownloadCsv('orders')}
            variant="secondary"
            size="sm"
            leftIcon={<Download className="w-3.5 h-3.5 text-crystal-royal" />}
          >
            Orders CSV
          </Button>
          <Button
            onClick={() => handleDownloadCsv('products')}
            variant="secondary"
            size="sm"
            leftIcon={<Download className="w-3.5 h-3.5 text-crystal-royal" />}
          >
            Product Sales CSV
          </Button>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="p-4 rounded-2xl bg-white/70 dark:bg-crystal-navyCard/70 backdrop-blur-md border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-crystal-textMuted uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-crystal-royal" />
            Period:
          </span>
          {[
            { id: 'all', label: 'All-Time' },
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: '7days', label: 'Last 7 Days' },
            { id: '30days', label: 'Last 30 Days' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Previous Month' },
            { id: 'this_year', label: 'This Year' },
            { id: 'custom', label: 'Custom Range' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setRange(btn.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                range === btn.id
                  ? 'bg-crystal-royal text-white shadow-crystal'
                  : 'bg-white dark:bg-crystal-navyDark text-crystal-navy dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {range === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1 rounded-xl bg-white dark:bg-crystal-navyDark border border-slate-200 dark:border-white/10 text-xs"
            />
            <span className="text-crystal-textMuted">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1 rounded-xl bg-white dark:bg-crystal-navyDark border border-slate-200 dark:border-white/10 text-xs"
            />
          </div>
        )}
      </div>

      {/* Primary Financial Overview Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Net Revenue */}
        <div className="p-4 rounded-3xl bg-white dark:bg-crystal-navyCard border border-slate-200 dark:border-white/10 shadow-xs">
          <span className="text-[10px] font-bold text-crystal-textMuted uppercase tracking-wider block">
            Net Sales Revenue
          </span>
          <span className="text-2xl font-black text-crystal-royal mt-1.5 block">
            ₹{overview?.net_revenue?.toLocaleString('en-IN') || '0.00'}
          </span>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 block">
            Net of discounts & refunds
          </span>
        </div>

        {/* Gross Sales */}
        <div className="p-4 rounded-3xl bg-white dark:bg-crystal-navyCard border border-slate-200 dark:border-white/10 shadow-xs">
          <span className="text-[10px] font-bold text-crystal-textMuted uppercase tracking-wider block">
            Gross Sales
          </span>
          <span className="text-2xl font-black text-crystal-navy dark:text-white mt-1.5 block">
            ₹{overview?.gross_sales?.toLocaleString('en-IN') || '0.00'}
          </span>
          <span className="text-[11px] text-crystal-textMuted mt-1 block">
            Subtotals + delivery fees
          </span>
        </div>

        {/* Total Discounts */}
        <div className="p-4 rounded-3xl bg-white dark:bg-crystal-navyCard border border-slate-200 dark:border-white/10 shadow-xs">
          <span className="text-[10px] font-bold text-crystal-textMuted uppercase tracking-wider block">
            Discounts Granted
          </span>
          <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1.5 block">
            -₹{overview?.total_discounts?.toLocaleString('en-IN') || '0.00'}
          </span>
          <span className="text-[11px] text-crystal-textMuted mt-1 block">
            Active promo deductions
          </span>
        </div>

        {/* Total Refunds */}
        <div className="p-4 rounded-3xl bg-white dark:bg-crystal-navyCard border border-slate-200 dark:border-white/10 shadow-xs">
          <span className="text-[10px] font-bold text-crystal-textMuted uppercase tracking-wider block">
            Refunds Issued
          </span>
          <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1.5 block">
            -₹{overview?.total_refunds?.toLocaleString('en-IN') || '0.00'}
          </span>
          <span className="text-[11px] text-crystal-textMuted mt-1 block">
            Processed reversals
          </span>
        </div>

        {/* Average Order Value */}
        <div className="p-4 rounded-3xl bg-white dark:bg-crystal-navyCard border border-slate-200 dark:border-white/10 shadow-xs">
          <span className="text-[10px] font-bold text-crystal-textMuted uppercase tracking-wider block">
            Average Order Value
          </span>
          <span className="text-2xl font-black text-crystal-navy dark:text-white mt-1.5 block">
            ₹{overview?.average_order_value?.toLocaleString('en-IN') || '0.00'}
          </span>
          <span className="text-[11px] text-crystal-textMuted mt-1 block">
            Per completed purchase
          </span>
        </div>
      </div>

      {/* Secondary Operational Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-2xl bg-white/70 dark:bg-crystal-navyCard/70 border border-slate-200/60 dark:border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-crystal-textMuted uppercase font-bold">Total Orders</span>
            <p className="text-lg font-black text-crystal-navy dark:text-white">{overview?.total_orders || 0}</p>
          </div>
          <Receipt className="w-5 h-5 text-crystal-royal opacity-70" />
        </div>

        <div className="p-3 rounded-2xl bg-white/70 dark:bg-crystal-navyCard/70 border border-slate-200/60 dark:border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold">Paid & Confirmed</span>
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{overview?.paid_orders || 0}</p>
          </div>
          <PackageCheck className="w-5 h-5 text-emerald-500 opacity-70" />
        </div>

        <div className="p-3 rounded-2xl bg-white/70 dark:bg-crystal-navyCard/70 border border-slate-200/60 dark:border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-bold">Pending Orders</span>
            <p className="text-lg font-black text-amber-600 dark:text-amber-400">{overview?.pending_orders || 0}</p>
          </div>
          <Clock className="w-5 h-5 text-amber-500 opacity-70" />
        </div>

        <div className="p-3 rounded-2xl bg-white/70 dark:bg-crystal-navyCard/70 border border-slate-200/60 dark:border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-crystal-textMuted uppercase font-bold">Total Units Sold</span>
            <p className="text-lg font-black text-crystal-navy dark:text-white">{overview?.total_units_sold || 0}</p>
          </div>
          <ShoppingBag className="w-5 h-5 text-crystal-royal opacity-70" />
        </div>
      </div>

      {/* Analytics Charts & Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best-Selling vs Least-Selling Products */}
        <div className="p-5 rounded-3xl bg-white dark:bg-crystal-navyCard border border-slate-200 dark:border-white/10 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-crystal-navy dark:text-white">
              Product Performance Rankings
            </h3>
            <span className="text-[10px] text-crystal-textMuted">Top Units Sold</span>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Best-Selling Collections
            </h4>
            <div className="space-y-2">
              {analytics?.best_selling?.map((p, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/40 text-xs flex items-center justify-between"
                >
                  <div className="truncate max-w-[200px]">
                    <span className="font-bold text-crystal-navy dark:text-white">{p.product_name}</span>
                    <span className="text-[10px] text-crystal-textMuted block">{p.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-crystal-royal">{p.units_sold} units</span>
                    <span className="text-[10px] text-crystal-textMuted block">
                      ₹{p.total_revenue?.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400 pt-2 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Least-Selling / High-Inventory Products
            </h4>
            <div className="space-y-2">
              {analytics?.least_selling?.map((p, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/40 text-xs flex items-center justify-between"
                >
                  <div className="truncate max-w-[200px]">
                    <span className="font-semibold text-crystal-navy dark:text-white">{p.product_name}</span>
                    <span className="text-[10px] text-crystal-textMuted block">In Stock: {p.current_stock}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-slate-500">{p.units_sold} units sold</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Category Revenue Performance */}
        <div className="p-5 rounded-3xl bg-white dark:bg-crystal-navyCard border border-slate-200 dark:border-white/10 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-crystal-navy dark:text-white">
              Category Revenue Share
            </h3>
            <span className="text-[10px] text-crystal-textMuted">By Total Invoiced Revenue</span>
          </div>

          <div className="space-y-3 pt-1">
            {analytics?.category_performance?.map((cat, idx) => {
              const maxRev = analytics.category_performance[0]?.revenue || 1;
              const pct = Math.min(100, Math.round((cat.revenue / maxRev) * 100));

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-crystal-navy dark:text-white">{cat.category}</span>
                    <span className="font-bold text-crystal-royal">
                      ₹{cat.revenue?.toLocaleString('en-IN')} ({cat.units_sold} items)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-crystal-royal to-sky-400 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Individual Order Records Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-base font-bold text-crystal-navy dark:text-white">
            Individual Order Records ({orders.length})
          </h3>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search by Order ID or Customer..."
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-crystal-navyDark border border-slate-200 dark:border-white/10 text-xs w-56"
            />
            <select
              value={orderPaymentStatus}
              onChange={(e) => setOrderPaymentStatus(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-crystal-navyDark border border-slate-200 dark:border-white/10 text-xs"
            >
              <option value="all">Payment: All</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Refunded">Refunded</option>
            </select>
            <select
              value={orderStatus}
              onChange={(e) => setOrderStatus(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-crystal-navyDark border border-slate-200 dark:border-white/10 text-xs"
            >
              <option value="all">Fulfillment: All</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Processing">Processing</option>
              <option value="Shipped">Shipped</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-crystal-navyCard border border-slate-200 dark:border-white/10 overflow-hidden shadow-crystal">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-crystal-textMuted font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Order ID</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4 text-center">Items</th>
                  <th className="py-3.5 px-4 text-right">Subtotal</th>
                  <th className="py-3.5 px-4 text-right">Discount</th>
                  <th className="py-3.5 px-4 text-right">Grand Total</th>
                  <th className="py-3.5 px-4 text-center">Payment Status</th>
                  <th className="py-3.5 px-4 text-center">Order Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-crystal-textMuted">
                      No matching order records found.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr
                      key={o.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => {
                        setInspectingOrder(o);
                        setNewOrderStatus(o.status);
                        setNewPaymentStatus(o.payment_status || 'Paid');
                        setRefundAmount(o.refund_amount ? o.refund_amount.toString() : '0');
                      }}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-crystal-royal">
                        {o.id}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-crystal-navy dark:text-white block truncate max-w-[120px]">
                          {o.customer_name}
                        </span>
                        <span className="text-[10px] text-crystal-textMuted truncate block max-w-[120px]">
                          {o.customer_email}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-crystal-textMuted">
                        {new Date(o.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold">
                        {o.items?.length || 0}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium">
                        ₹{o.subtotal.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-right text-emerald-600">
                        {o.discount > 0 ? `-₹${o.discount.toLocaleString('en-IN')}` : '₹0'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-crystal-navy dark:text-white">
                        ₹{o.total.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 text-[10px] font-bold">
                          {o.payment_status || 'Paid'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-crystal-navy dark:text-white text-[10px] font-semibold">
                          {o.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setInspectingOrder(o);
                            setNewOrderStatus(o.status);
                            setNewPaymentStatus(o.payment_status || 'Paid');
                            setRefundAmount(o.refund_amount ? o.refund_amount.toString() : '0');
                          }}
                          className="p-1.5 rounded-lg text-crystal-textMuted hover:text-crystal-royal hover:bg-crystal-royal/10 transition-colors"
                          title="Inspect and edit status"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Inspect & Update Order Modal */}
      {inspectingOrder && (
        <Modal
          isOpen={!!inspectingOrder}
          onClose={() => setInspectingOrder(null)}
          maxWidth="2xl"
          title={`Order Inspection #${inspectingOrder.id}`}
        >
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border text-xs">
              <div>
                <span className="text-crystal-textMuted block">Customer:</span>
                <strong className="text-sm text-crystal-navy dark:text-white">{inspectingOrder.customer_name}</strong>
                <p className="text-crystal-textMuted">{inspectingOrder.customer_email}</p>
                <p className="text-crystal-textMuted">{inspectingOrder.customer_phone}</p>
              </div>
              <div className="text-right">
                <span className="text-crystal-textMuted block">Shipping Address:</span>
                <p className="text-slate-700 dark:text-slate-300">{inspectingOrder.address}</p>
                <p className="text-slate-700 dark:text-slate-300">
                  {inspectingOrder.city}, {inspectingOrder.state} - {inspectingOrder.postal_code}
                </p>
                <p className="font-semibold text-crystal-royal mt-1">Payment: {inspectingOrder.payment_method}</p>
              </div>
            </div>

            {/* Line items */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-crystal-navy dark:text-white mb-2">
                Purchased Products ({inspectingOrder.items?.length || 0})
              </h4>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 text-xs">
                {inspectingOrder.items?.map((it, i) => (
                  <div key={i} className="flex justify-between p-2 rounded-xl bg-white dark:bg-crystal-navyDark border">
                    <span>
                      {it.product_name} <strong>× {it.quantity}</strong>
                    </span>
                    <span className="font-bold">₹{it.total_price?.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Status Update Controls */}
            <div className="p-4 rounded-2xl bg-crystal-ice/20 dark:bg-white/5 border border-crystal-ice/40 dark:border-white/10 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-crystal-navy dark:text-white">
                Update Order & Payment Lifecycle
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-crystal-textMuted uppercase block mb-1">
                    Order Status:
                  </label>
                  <select
                    value={newOrderStatus}
                    onChange={(e) => setNewOrderStatus(e.target.value)}
                    className="w-full p-2 rounded-xl bg-white dark:bg-crystal-navyDark border"
                  >
                    <option value="Confirmed">Confirmed</option>
                    <option value="Processing">Processing</option>
                    <option value="Dispatched">Dispatched</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-crystal-textMuted uppercase block mb-1">
                    Payment Status:
                  </label>
                  <select
                    value={newPaymentStatus}
                    onChange={(e) => setNewPaymentStatus(e.target.value)}
                    className="w-full p-2 rounded-xl bg-white dark:bg-crystal-navyDark border"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Refunded">Refunded</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-crystal-textMuted uppercase block mb-1">
                    Refund Amount (₹):
                  </label>
                  <input
                    type="number"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full p-2 rounded-xl bg-white dark:bg-crystal-navyDark border"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleUpdateStatus}
                  variant="primary"
                  size="sm"
                  isLoading={statusUpdating}
                >
                  Save Status Modifications
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
