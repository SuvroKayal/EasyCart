import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { CartItem, CartCalculation } from '../types';
import { api } from '../services/api';

interface CartContextType {
  items: CartItem[];
  calculation: CartCalculation | null;
  loading: boolean;
  couponCode: string;
  isCartOpen: boolean;
  cartCount: number;
  addToCart: (productId: number, quantity?: number) => Promise<boolean>;
  updateQuantity: (productId: number, quantity: number) => Promise<void>;
  removeFromCart: (productId: number) => Promise<void>;
  clearCart: () => void;
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string }>;
  removeCoupon: () => Promise<void>;
  openCart: () => void;
  closeCart: () => void;
  syncCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('easycart_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [couponCode, setCouponCode] = useState<string>(() => {
    return localStorage.getItem('easycart_coupon') || '';
  });

  const [calculation, setCalculation] = useState<CartCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Sync calculation with backend
  const syncCartWithServer = useCallback(
    async (currentItems: CartItem[], currentCoupon: string) => {
      if (currentItems.length === 0) {
        setCalculation({
          items: [],
          subtotal: 0,
          discount: 0,
          delivery_fee: 0,
          total: 0,
          free_delivery_threshold: 999,
          applied_coupon: null,
          stock_errors: [],
        });
        return;
      }

      try {
        setLoading(true);
        const calc = await api.calculateCart(currentItems, currentCoupon);
        setCalculation(calc);
      } catch (err) {
        console.error('Failed to sync cart:', err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    syncCartWithServer(items, couponCode);
    localStorage.setItem('easycart_cart', JSON.stringify(items));
  }, [items, couponCode, syncCartWithServer]);

  const addToCart = async (productId: number, quantity = 1): Promise<boolean> => {
    const existingIndex = items.findIndex((i) => i.id === productId);
    let updated: CartItem[];

    if (existingIndex > -1) {
      updated = [...items];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: updated[existingIndex].quantity + quantity,
      };
    } else {
      updated = [...items, { id: productId, quantity }];
    }

    setItems(updated);
    return true;
  };

  const updateQuantity = async (productId: number, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(productId);
      return;
    }
    const updated = items.map((item) =>
      item.id === productId ? { ...item, quantity } : item
    );
    setItems(updated);
  };

  const removeFromCart = async (productId: number) => {
    const updated = items.filter((item) => item.id !== productId);
    setItems(updated);
  };

  const clearCart = () => {
    setItems([]);
    setCouponCode('');
    localStorage.removeItem('easycart_cart');
    localStorage.removeItem('easycart_coupon');
    setCalculation(null);
  };

  const applyCoupon = async (code: string): Promise<{ success: boolean; message: string }> => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      return { success: false, message: 'Please enter a coupon code' };
    }

    try {
      const calc = await api.calculateCart(items, trimmed);
      setCalculation(calc);

      if (calc.applied_coupon) {
        setCouponCode(trimmed);
        localStorage.setItem('easycart_coupon', trimmed);
        return { success: true, message: calc.coupon_message || `Coupon ${trimmed} applied!` };
      } else {
        return {
          success: false,
          message: calc.coupon_message || `Coupon ${trimmed} could not be applied.`,
        };
      }
    } catch (e: any) {
      return { success: false, message: e.message || 'Failed to validate coupon' };
    }
  };

  const removeCoupon = async () => {
    setCouponCode('');
    localStorage.removeItem('easycart_coupon');
    await syncCartWithServer(items, '');
  };

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);
  const syncCart = () => syncCartWithServer(items, couponCode);

  const cartCount = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        calculation,
        loading,
        couponCode,
        isCartOpen,
        cartCount,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        applyCoupon,
        removeCoupon,
        openCart,
        closeCart,
        syncCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

