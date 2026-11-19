import React, { useState, useEffect } from 'react';
import { CreditCard, Truck, Smartphone, AlertCircle, ShieldCheck, Check } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { api, getProductImage } from '../../services/api';
import { DeliveryDetails } from '../../types';
import { useToast } from '../common/Toast';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderSuccess: (orderData: any) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onOrderSuccess,
}) => {
  const { calculation, items, clearCart, couponCode } = useCart();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState<DeliveryDetails>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
  });

  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery (Demo)');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill user data if available
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || user.name || '',
        email: prev.email || user.email || '',
        phone: prev.phone || '9876543210',
        address: prev.address || 'Suite 4B, The Grand Avenue',
        city: prev.city || 'Kolkata',
        state: prev.state || 'West Bengal',
        postal_code: prev.postal_code || '700001',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || 'Shraddha Singh',
        email: prev.email || 'shraddha@gmail.com',
        phone: prev.phone || '9876543210',
        address: prev.address || 'Suite 4B, The Grand Avenue',
        city: prev.city || 'Kolkata',
        state: prev.state || 'West Bengal',
        postal_code: prev.postal_code || '700001',
      }));
    }
  }, [user, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.phone.trim() ||
      !formData.address.trim() ||
      !formData.city.trim() ||
      !formData.state.trim() ||
      !formData.postal_code.trim()
    ) {
      setError('Please complete all shipping address fields.');
      return;
    }

    // Validate 10-digit Indian mobile number
    const rawPhone = formData.phone.replace(/[\s\-().+]/g, '');
    let cleanPhone = rawPhone;
    if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
      cleanPhone = cleanPhone.slice(2);
    } else if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
      cleanPhone = cleanPhone.slice(1);
    }
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    // Validate 6-digit PIN code
    if (!/^\d{6}$/.test(formData.postal_code.trim())) {
      setError('Please enter a valid 6-digit postal PIN code.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.checkout(
        items,
        formData,
        paymentMethod,
        couponCode || undefined
      );

      if (res.success) {
        clearCart();
        showToast('Order confirmed! Generating your official invoice...', 'success');
        onOrderSuccess(res.order_details || res);
        onClose();
      } else {
        setError(res.message || 'Checkout failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to place order. Please review your details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-softBorder dark:border-dark-border">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl font-semibold text-espresso dark:text-porcelain">
              Express Checkout
            </h2>
            <p className="text-xs text-mutedGrey dark:text-dark-muted mt-0.5">
              Confirm your delivery coordinates and complete your acquisition protocol
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded bg-stone-light/60 dark:bg-dark-elevated text-espresso dark:text-porcelain text-xs font-semibold border border-softBorder dark:border-dark-border">
            <ShieldCheck className="w-4 h-4 text-bronze" />
            <span>256-Bit SSL Demo Protection</span>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column (7 cols): Customer & Shipping Form */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-espresso dark:text-porcelain mb-3">
                  1. Shipping &amp; Contact Information
                </h3>
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <Input
                      label="Full Name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Your full legal name"
                      required
                    />
                    <Input
                      label="Contact Phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="10-digit mobile number"
                      required
                    />
                  </div>

                  <Input
                    label="Email Address"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="order.updates@example.com"
                    required
                  />

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-mutedGrey dark:text-dark-muted">
                      Street Address
                    </label>
                    <textarea
                      name="address"
                      rows={2}
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="Flat, suite, building, street, landmark"
                      required
                      className="w-full bg-white dark:bg-dark-card border border-softBorder dark:border-dark-border rounded-xl px-4 py-2.5 text-xs sm:text-sm text-espresso dark:text-porcelain placeholder:text-mutedGrey/70 focus:outline-none focus:border-bronze focus:ring-2 focus:ring-bronze/20 transition-all shadow-luxury-sm"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      label="City"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="City"
                      required
                    />
                    <Input
                      label="State"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      placeholder="State"
                      required
                    />
                    <Input
                      label="PIN Code"
                      name="postal_code"
                      value={formData.postal_code}
                      onChange={handleChange}
                      placeholder="6 digits"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-espresso dark:text-porcelain mb-3">
                  2. Payment Method (Demonstration)
                </h3>
                <div className="space-y-2.5">
                  {[
                    {
                      id: 'Cash on Delivery (Demo)',
                      title: 'Cash on Delivery (Demo)',
                      desc: 'Pay cash or card upon verified parcel receipt',
                      icon: <Truck className="w-5 h-5 text-bronze" />,
                    },
                    {
                      id: 'Simulated UPI (Demo)',
                      title: 'Simulated UPI (Instant Demo)',
                      desc: 'Instant zero-fee demonstration transaction via Virtual VPA',
                      icon: <Smartphone className="w-5 h-5 text-bronze" />,
                    },
                    {
                      id: 'Simulated Card (Demo)',
                      title: 'Simulated Credit / Debit Card',
                      desc: 'Simulated Visa, Mastercard, RuPay authorization',
                      icon: <CreditCard className="w-5 h-5 text-bronze" />,
                    },
                  ].map((p) => {
                    const isSelected = paymentMethod === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setPaymentMethod(p.id)}
                        className={`p-3.5 rounded-xl cursor-pointer border transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-ivory dark:bg-dark-card border-bronze shadow-luxury-sm'
                            : 'bg-white dark:bg-dark-surface border-softBorder dark:border-dark-border hover:border-bronze/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-porcelain dark:bg-dark-elevated shadow-xs">
                            {p.icon}
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-espresso dark:text-porcelain">
                              {p.title}
                            </h4>
                            <p className="text-[11px] text-mutedGrey dark:text-dark-muted">{p.desc}</p>
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected
                              ? 'border-bronze bg-bronze text-white'
                              : 'border-stone dark:border-dark-border'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column (5 cols): Order Review & Financial Breakdown */}
            <div className="lg:col-span-5 rounded-xl bg-ivory dark:bg-dark-card p-5 border border-softBorder dark:border-dark-border space-y-4 shadow-luxury-sm">
              <h3 className="font-serif text-sm font-semibold uppercase tracking-wider text-espresso dark:text-porcelain">
                Order Summary
              </h3>

              {/* Items List */}
              <div className="max-h-56 overflow-y-auto space-y-2.5 pr-1">
                {(calculation?.items || []).map((item) => (
                  <div key={item.id} className="flex items-center gap-3 text-xs">
                    <img
                      src={getProductImage(item)}
                      alt={item.name}
                      className="w-10 h-10 object-contain rounded bg-white dark:bg-dark-surface p-1 shrink-0 border border-softBorder dark:border-dark-border"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-espresso dark:text-porcelain truncate">
                        {item.name}
                      </p>
                      <p className="text-mutedGrey dark:text-dark-muted text-[11px]">
                        Qty: {item.quantity} × ₹{item.price.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <span className="font-semibold text-espresso dark:text-porcelain">
                      ₹{item.total.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Financial Breakdown */}
              {calculation && (
                <div className="pt-4 border-t border-softBorder dark:border-dark-border space-y-2 text-xs">
                  <div className="flex justify-between text-mutedGrey dark:text-dark-muted">
                    <span>Subtotal</span>
                    <span className="font-medium text-espresso dark:text-porcelain">
                      ₹{calculation.subtotal.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {calculation.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                      <span>Privilege Savings ({calculation.applied_coupon?.code})</span>
                      <span>-₹{calculation.discount.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-mutedGrey dark:text-dark-muted">
                    <span>Shipping Charges</span>
                    <span>
                      {calculation.delivery_fee === 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider text-[11px]">
                          COMPLIMENTARY
                        </span>
                      ) : (
                        `₹${calculation.delivery_fee}`
                      )}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-softBorder dark:border-dark-border flex justify-between text-base font-bold text-espresso dark:text-porcelain">
                    <span className="font-serif">Total Amount</span>
                    <span className="text-bronze dark:text-bronze-gold font-bold">
                      ₹{calculation.total.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isSubmitting}
                  className="w-full"
                >
                  Confirm &amp; Place Order • ₹{calculation?.total?.toLocaleString('en-IN')}
                </Button>
                <p className="text-[10px] text-mutedGrey dark:text-dark-muted text-center mt-2">
                  Zero real charge is made. An official printable invoice will be generated.
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
