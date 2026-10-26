"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

export interface CartItem {
  variantId: string;
  sku: string;
  productTitle: string;
  variantName: string;
  priceInCents: number;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  isOpen: boolean;
  checkoutAttemptId: string;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (sku: string) => void;
  updateQuantity: (sku: string, delta: number) => void;
  clearCart: () => void;
  resetCheckoutAttempt: () => void;
  totalAmountInCents: number;
  totalItemCount: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  // Deterministic Idempotency Key for current cart state
  const [checkoutAttemptId, setCheckoutAttemptId] = useState<string>("");

  useEffect(() => {
    setCheckoutAttemptId(crypto.randomUUID());
  }, []);

  const rotateIdempotencyKey = () => {
    setCheckoutAttemptId(crypto.randomUUID());
  };

  const addItem = (item: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.sku === item.sku);
      if (existing) {
        return prev.map((i) => (i.sku === item.sku ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    rotateIdempotencyKey();
    setIsOpen(true);
  };

  const removeItem = (sku: string) => {
    setItems((prev) => prev.filter((i) => i.sku !== sku));
    rotateIdempotencyKey();
  };

  const updateQuantity = (sku: string, delta: number) => {
    setItems(
      (prev) =>
        prev
          .map((i) => {
            if (i.sku === sku) {
              const nextQty = i.quantity + delta;
              return nextQty > 0 ? { ...i, quantity: nextQty } : null;
            }
            return i;
          })
          .filter(Boolean) as CartItem[],
    );
    rotateIdempotencyKey();
  };

  const clearCart = () => {
    setItems([]);
    rotateIdempotencyKey();
  };

  const totalAmountInCents = items.reduce((sum, i) => sum + i.priceInCents * i.quantity, 0);
  const totalItemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        checkoutAttemptId,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        resetCheckoutAttempt: rotateIdempotencyKey,
        totalAmountInCents,
        totalItemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
