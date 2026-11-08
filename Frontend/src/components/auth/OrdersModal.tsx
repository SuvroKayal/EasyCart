import React, { useEffect, useState } from 'react';
import { Package, Calendar, FileText } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { api } from '../../services/api';
import { Order } from '../../types';

interface OrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewInvoice: (order: Order) => void;
}

export const OrdersModal: React.FC<OrdersModalProps> = ({
  isOpen,
  onClose,
  onViewInvoice,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchOrders();
    }
  }, [isOpen]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await api.getUserOrders();
      setOrders(data);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="3xl" title="Order History & Tax Invoices">
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3 py-6">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-xl bg-stone-light/40 dark:bg-dark-elevated animate-pulse border border-softBorder dark:border-dark-border"
              />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-xl bg-stone-light dark:bg-dark-elevated flex items-center justify-center text-bronze mb-4 border border-softBorder dark:border-dark-border">
              <Package className="w-7 h-7" />
            </div>
            <h4 className="font-serif text-base font-semibold text-espresso dark:text-porcelain">
              No previous orders found
            </h4>
            <p className="text-xs text-mutedGrey dark:text-dark-muted mt-1 mb-4">
              Your confirmed acquisitions and official tax invoices will appear here.
            </p>
            <Button onClick={onClose} variant="primary" size="sm">
              Discover Collections
            </Button>
          </div>
        ) : (
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            {orders.map((ord) => (
              <div
                key={ord.id}
                className="p-5 rounded-xl bg-white dark:bg-dark-card border border-softBorder dark:border-dark-border space-y-3.5 transition-all hover:border-bronze/40 shadow-luxury-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-softBorder dark:border-dark-border text-xs">
                  <div>
                    <span className="font-mono font-bold text-sm text-espresso dark:text-porcelain">
                      Order #{ord.id}
                    </span>
                    <div className="flex items-center gap-2 text-mutedGrey dark:text-dark-muted mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-bronze" />
                      <span>
                        {new Date(ord.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                      {ord.status || 'Confirmed'}
                    </span>
                    <Button
                      onClick={() => {
                        onClose();
                        onViewInvoice(ord);
                      }}
                      variant="secondary"
                      size="sm"
                      leftIcon={<FileText className="w-3.5 h-3.5 text-bronze" />}
                    >
                      Tax Invoice
                    </Button>
                  </div>
                </div>

                {/* Items preview in this order */}
                <div className="space-y-1.5 text-xs">
                  {(ord.items || []).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-mutedGrey dark:text-dark-muted">
                      <span>
                        {item.quantity} × {item.product_name || item.title || `Item #${item.product_id}`}
                      </span>
                      <span className="font-medium text-espresso dark:text-porcelain">
                        ₹{(item.total_price || item.unit_price * item.quantity).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-softBorder dark:border-dark-border flex justify-between items-center text-xs">
                  <span className="text-mutedGrey dark:text-dark-muted">
                    Total Amount ({ord.payment_method || 'Online / Card'}):
                  </span>
                  <span className="font-bold text-sm text-espresso dark:text-porcelain">
                    ₹{ord.total?.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
