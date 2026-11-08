import React from 'react';
import { Printer, CheckCircle2, ArrowRight } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface InvoiceModalProps {
  order: any | null;
  isOpen: boolean;
  onClose: () => void;
  onContinueShopping: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  order,
  isOpen,
  onClose,
  onContinueShopping,
}) => {
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const customer = order.customer || {};
  const items = order.items || [];
  const orderId = order.order_id || order.id || 'EC-DEMO';
  const orderDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="3xl">
      <div className="space-y-6">
        {/* Actions Bar (No Print) */}
        <div className="no-print flex items-center justify-between pb-4 border-b border-softBorder dark:border-dark-border">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-serif text-sm font-semibold">Acquisition Confirmed &amp; Logged</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              variant="secondary"
              size="sm"
              leftIcon={<Printer className="w-4 h-4 text-bronze" />}
            >
              Print Tax Invoice
            </Button>
            <Button
              onClick={() => {
                onClose();
                onContinueShopping();
              }}
              variant="primary"
              size="sm"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Continue Shopping
            </Button>
          </div>
        </div>

        {/* Printable Invoice Sheet */}
        <div className="printable-area p-6 sm:p-10 rounded-2xl bg-white text-espresso print-clean border border-softBorder shadow-luxury-sm space-y-8 font-sans">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-softBorder">
            <div>
              <div className="flex items-center gap-2">
                <img
                  src="/banner/EasyCart%20logo%20transparent.png"
                  alt="EasyCart"
                  className="h-9 w-auto object-contain"
                />
                <span className="font-serif text-2xl font-bold tracking-tight text-espresso">
                  Easy<span className="text-bronze">Cart</span>
                </span>
              </div>
              <p className="text-xs text-mutedGrey mt-1 tracking-wider uppercase font-semibold">
                Official Tax Invoice / Retail Sale Record
              </p>
            </div>

            <div className="text-left sm:text-right">
              <div className="inline-block px-3 py-1 bg-stone-light text-espresso font-semibold text-xs rounded border border-softBorder mb-1">
                Status: {order.status || 'Confirmed'}
              </div>
              <p className="text-sm font-mono font-bold text-espresso">
                Invoice #{orderId}
              </p>
              <p className="text-xs text-mutedGrey">Date: {orderDate}</p>
            </div>
          </div>

          {/* Customer & Shipping Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-mutedGrey uppercase tracking-widest block">
                Billed To
              </span>
              <p className="font-serif font-bold text-sm text-espresso">
                {customer.name || order.customer_name || 'Customer'}
              </p>
              <p className="text-mutedGrey">{customer.email || order.customer_email}</p>
              <p className="text-mutedGrey">{customer.phone || order.customer_phone}</p>
            </div>

            <div className="space-y-1 sm:text-right">
              <span className="text-[10px] font-bold text-mutedGrey uppercase tracking-widest block">
                Shipping Destination
              </span>
              <p className="text-espresso leading-relaxed">
                {customer.address || order.address}
              </p>
              <p className="text-mutedGrey">
                {customer.city || order.city}, {customer.state || order.state} -{' '}
                {customer.postal_code || order.postal_code}
              </p>
              <p className="text-mutedGrey mt-1">
                Settlement: <span className="font-semibold text-espresso">{order.payment_method}</span>
              </p>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-stone text-mutedGrey uppercase text-[10px] tracking-widest font-bold">
                  <th className="py-2.5">Item Description</th>
                  <th className="py-2.5 text-center">Unit Rate</th>
                  <th className="py-2.5 text-center">Qty</th>
                  <th className="py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-softBorder">
                {items.map((it: any, index: number) => {
                  const name = it.name || it.product_name;
                  const unitPrice = it.price || it.unit_price;
                  const total = it.total || it.total_price || unitPrice * it.quantity;
                  return (
                    <tr key={index}>
                      <td className="py-3 font-medium text-espresso">{name}</td>
                      <td className="py-3 text-center text-mutedGrey">
                        ₹{unitPrice?.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 text-center font-semibold text-espresso">
                        {it.quantity}
                      </td>
                      <td className="py-3 text-right font-bold text-espresso">
                        ₹{total?.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary Breakdown */}
          <div className="flex justify-end pt-2 border-t border-softBorder">
            <div className="w-full sm:w-64 space-y-2 text-xs">
              <div className="flex justify-between text-mutedGrey">
                <span>Subtotal</span>
                <span className="font-medium text-espresso">
                  ₹{order.subtotal?.toLocaleString('en-IN')}
                </span>
              </div>

              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Privilege Savings ({order.coupon_code || 'Promo'})</span>
                  <span>-₹{order.discount?.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div className="flex justify-between text-mutedGrey">
                <span>Delivery Charge</span>
                <span>
                  {order.delivery_fee === 0 ? (
                    <span className="text-emerald-700 font-semibold uppercase tracking-wider text-[10px]">COMPLIMENTARY</span>
                  ) : (
                    `₹${order.delivery_fee}`
                  )}
                </span>
              </div>

              <div className="pt-2 border-t-2 border-espresso flex justify-between text-sm font-bold text-espresso">
                <span className="font-serif">Grand Total Paid</span>
                <span className="text-bronze font-bold">
                  ₹{order.total?.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="pt-6 border-t border-softBorder text-center text-[10px] text-mutedGrey tracking-wide">
            <p className="font-serif italic">Thank you for selecting EasyCart Luxury Collections.</p>
            <p className="mt-0.5">
              This tax invoice was digitally generated under authenticated session records and requires no physical seal.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
};
