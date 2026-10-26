"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/context/cart-context";
import { api } from "@/lib/api-client";

export function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    updateQuantity,
    removeItem,
    clearCart,
    totalAmountInCents,
    checkoutAttemptId,
    resetCheckoutAttempt,
  } = useCart();

  const queryClient = useQueryClient();
  const [completedOrder, setCompletedOrder] = useState<{ id: string; status: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);

      // Group cart items and format payload
      const payload = {
        storeId: "01940000-0000-7000-8000-000000000001", // Default Flagship Store ID or from context
        items: items.map((i) => ({
          variantId: i.variantId,
          sku: i.sku,
          quantity: i.quantity,
        })),
        shippingAddress: {
          fullName: "Verified Customer",
          street: "1 Market St",
          city: "San Francisco",
          state: "CA",
          postalCode: "94105",
          country: "US",
        },
      };

      const res = await api.api.orders.$post(
        { json: payload },
        {
          headers: {
            "Idempotency-Key": checkoutAttemptId,
          },
        },
      );

      const json = (await res.json()) as {
        data?: { orderId: string; status: string };
        error?: string;
      };

      if (!res.ok) {
        throw new Error(json.error || "Failed to process checkout");
      }

      if (!json.data) {
        throw new Error("Missing order confirmation from server");
      }

      return json.data;
    },
    onSuccess: (data) => {
      setCompletedOrder({ id: data.orderId, status: data.status });
      clearCart();
      // Invalidate live inventory queries so badges on the page immediately reflect lower stock
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Checkout failed";
      setErrorMessage(message);
      // Rotate idempotency key if user needs to retry after adjusting cart
      resetCheckoutAttempt();
    },
  });

  const handleClose = () => {
    closeCart();
    setCompletedOrder(null);
    setErrorMessage(null);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-neutral-700" />
              <Dialog.Title className="text-base font-semibold text-neutral-900">
                Your Cart
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {completedOrder ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <CheckCircle2 className="h-14 w-14 text-emerald-500 mb-3" />
                <h3 className="text-lg font-bold text-neutral-900">Order Confirmed!</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  Transactional Outbox job dispatched to BullMQ.
                </p>
                <div className="mt-4 rounded-lg bg-neutral-50 p-3 font-mono text-xs text-neutral-700 border border-neutral-200">
                  Order ID: {completedOrder.id}
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-6 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
                >
                  Continue Shopping
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-neutral-400">
                <ShoppingBag className="h-12 w-12 stroke-[1.5] mb-2" />
                <p className="text-sm font-medium">Your cart is currently empty</p>
                <p className="text-xs text-neutral-400 mt-1">Select variants to add items</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {items.map((item) => (
                  <div key={item.sku} className="flex items-center justify-between py-4">
                    <div className="flex-1 pr-4">
                      <h4 className="text-sm font-semibold text-neutral-900">
                        {item.productTitle}
                      </h4>
                      <p className="text-xs text-neutral-500">
                        {item.variantName} •{" "}
                        <span className="font-mono text-[10px]">{item.sku}</span>
                      </p>
                      <p className="mt-1 text-xs font-bold text-neutral-900">
                        ${((item.priceInCents * item.quantity) / 100).toFixed(2)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center rounded-lg border border-neutral-200 bg-neutral-50">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.sku, -1)}
                          className="p-1.5 text-neutral-600 hover:text-neutral-900"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.sku, 1)}
                          className="p-1.5 text-neutral-600 hover:text-neutral-900"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(item.sku)}
                        className="p-1.5 text-neutral-400 hover:text-rose-600"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {!completedOrder && items.length > 0 && (
            <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-4">
              {errorMessage && (
                <div className="mb-3 rounded-lg bg-rose-50 p-2.5 text-xs font-medium text-rose-700 border border-rose-200">
                  {errorMessage}
                </div>
              )}

              <div className="flex items-center justify-between text-sm mb-3">
                <span className="text-neutral-500">Subtotal</span>
                <span className="font-bold text-neutral-900">
                  ${(totalAmountInCents / 100).toFixed(2)}
                </span>
              </div>

              <div className="mb-3 text-[10px] text-neutral-400 flex items-center justify-between font-mono">
                <span>Idempotency-Key:</span>
                <span>{checkoutAttemptId.slice(0, 16)}...</span>
              </div>

              <button
                type="button"
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
                className="w-full rounded-lg bg-neutral-900 py-3 text-center text-xs font-semibold text-white shadow-xs hover:bg-neutral-800 disabled:opacity-50 transition-colors"
              >
                {checkoutMutation.isPending
                  ? "Reserving Stock & Committing..."
                  : "Complete Purchase"}
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
