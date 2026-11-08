import React, { useEffect, useState } from 'react';
import {
  ShoppingBag,
  Search,
  Filter,
  Eye,
  XCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import { Order } from '../../types';
import { useToast } from '../common/Toast';

export const AdminOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { showToast } = useToast();

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await api.adminGetSalesOrders({
        search: search || undefined,
        order_status: statusFilter || undefined,
        payment_status: paymentFilter || undefined,
      });
      setOrders(res.orders || []);
    } catch {
      showToast('Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [search, statusFilter, paymentFilter]);

  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      setUpdatingId(orderId);
      await api.adminUpdateOrderStatus(orderId, { status });
      setOrders((prev) =>
        prev.map((o) => ((o.order_id || o.id) === orderId ? { ...o, status } : o))
      );
      if (selectedOrder && (selectedOrder.order_id || selectedOrder.id) === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status } : null));
      }
      showToast(`Order status updated to ${status}`, 'success');
    } catch {
      showToast('Failed to update order status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpdatePaymentStatus = async (orderId: string, payment_status: string) => {
    try {
      setUpdatingId(orderId);
      await api.adminUpdateOrderStatus(orderId, { payment_status });
      setOrders((prev) =>
        prev.map((o) => ((o.order_id || o.id) === orderId ? { ...o, payment_status } : o))
      );
      if (selectedOrder && (selectedOrder.order_id || selectedOrder.id) === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, payment_status } : null));
      }
      showToast(`Payment status updated to ${payment_status}`, 'success');
    } catch {
      showToast('Failed to update payment status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-crystal-royal" />
            Order Fulfillment & Tracking
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track customer deliveries, update fulfillment lifecycles, and audit payment settlements.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-crystal-navyCard/90 border border-slate-200 dark:border-white/10 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Order ID, name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-crystal-royal"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Fulfillment:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-crystal-royal"
          >
            <option value="">All Statuses</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Processing">Processing</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 ml-2">
            <span>Payment:</span>
          </div>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-crystal-royal"
          >
            <option value="">All Payments</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Refunded">Refunded</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-hidden rounded-2xl bg-white dark:bg-crystal-navyCard/90 border border-slate-200 dark:border-white/10 shadow-sm">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-3 border-crystal-royal border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500">Retrieving order database...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center text-slate-500 dark:text-slate-400 text-sm">
            No orders match the current criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Net Amount</th>
                  <th className="py-3 px-4">Fulfillment Status</th>
                  <th className="py-3 px-4">Payment Status</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-700 dark:text-slate-200 font-medium">
                {orders.map((o) => {
                  const currentOrderId = o.order_id || o.id;
                  const isUpdating = updatingId === currentOrderId;

                  return (
                    <tr key={currentOrderId} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-crystal-royal">
                        #{currentOrderId}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(o.created_at || o.date || Date.now()).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {o.customer_name || 'Customer'}
                        </div>
                        <div className="text-[10px] text-slate-400">{o.customer_email || o.email || o.address || o.shipping_address}</div>
                      </td>
                      <td className="py-3 px-4">
                        {o.items?.length || 1} items
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        ₹{(o.net_total || o.total || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          disabled={isUpdating}
                          value={o.status || 'Confirmed'}
                          onChange={(e) => handleUpdateStatus(currentOrderId, e.target.value)}
                          className="px-2 py-1 text-[11px] font-bold rounded-lg bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none"
                        >
                          <option value="Confirmed">Confirmed</option>
                          <option value="Processing">Processing</option>
                          <option value="Shipped">Shipped</option>
                          <option value="Delivered">Delivered</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          disabled={isUpdating}
                          value={o.payment_status || 'Paid'}
                          onChange={(e) => handleUpdatePaymentStatus(currentOrderId, e.target.value)}
                          className="px-2 py-1 text-[11px] font-bold rounded-lg bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none"
                        >
                          <option value="Paid">Paid</option>
                          <option value="Pending">Pending</option>
                          <option value="Refunded">Refunded</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedOrder(o)}
                          className="p-1.5 rounded-lg bg-crystal-royal/10 hover:bg-crystal-royal/20 text-crystal-royal transition-colors"
                          title="View Order Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-white dark:bg-crystal-navyCard rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Order Details #{selectedOrder.order_id || selectedOrder.id}
                </h3>
                <p className="text-xs text-slate-500">
                  Placed on {new Date(selectedOrder.created_at || selectedOrder.date || Date.now()).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              {/* Shipping info */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider block mb-1">
                  Recipient & Delivery Address
                </span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {selectedOrder.customer_name || 'Customer'}
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  {selectedOrder.shipping_address || selectedOrder.address || 'No physical address provided'}
                </p>
                <p className="text-slate-400 mt-1">Payment Method: {selectedOrder.payment_method || 'Online Card / UPI'}</p>
              </div>

              {/* Items List */}
              <div>
                <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider block mb-2">
                  Line Items Purchased
                </span>
                <div className="space-y-2">
                  {(selectedOrder.items || []).map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">
                          {item.product_name || item.title}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Qty: {item.quantity} × ₹{(item.unit_price || item.price || 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        ₹{((item.unit_price || item.price || 0) * item.quantity).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial breakdown */}
              <div className="p-4 rounded-2xl bg-crystal-royal/5 border border-crystal-royal/10 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Gross Subtotal:</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    ₹{(selectedOrder.subtotal || selectedOrder.total).toLocaleString('en-IN')}
                  </span>
                </div>
                {selectedOrder.discount ? (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount Applied ({selectedOrder.coupon_code || 'VOUCHER'}):</span>
                    <span>-₹{selectedOrder.discount.toLocaleString('en-IN')}</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-slate-500">Shipping Fee:</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    ₹{selectedOrder.shipping || selectedOrder.delivery_fee || 0}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-crystal-royal/20 font-black text-sm text-crystal-royal">
                  <span>Net Charged:</span>
                  <span>
                    ₹{(selectedOrder.net_total || selectedOrder.total).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
