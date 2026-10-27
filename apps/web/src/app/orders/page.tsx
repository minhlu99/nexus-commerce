"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock, RefreshCw, ShoppingBag, Truck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";

interface OrderItem {
  id: string;
  variantId: string;
  frozenSku: string;
  frozenName: string;
  unitPriceInCents: number;
  quantity: number;
  totalPriceInCents: number;
}

interface OrderRecord {
  id: string;
  storeId: string;
  customerId: string;
  status: string;
  totalAmountInCents: number;
  currency: string;
  idempotencyKey: string | null;
  shippingAddress: {
    fullName: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  createdAt: string;
  items: OrderItem[];
}

export default function OrdersPage() {
  const { data: session } = useSession();
  const [filterMine, setFilterMine] = useState(false);

  // Poll orders every 2.5s if any order is pending; otherwise every 10s
  const {
    data: orders,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<OrderRecord[]>({
    queryKey: ["orders", filterMine ? session?.user?.id : "all"],
    queryFn: async () => {
      const queryParams = filterMine && session?.user?.id ? { customerId: session.user.id } : {};
      const res = await api.api.orders.$get({ query: queryParams });
      if (!res.ok) throw new Error("Failed to fetch order history");
      const json = await res.json();
      return (json as { data: OrderRecord[] }).data;
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasPending = data?.some((o) => o.status === "pending");
      return hasPending ? 2500 : 10000;
    },
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 border-b border-neutral-200 pb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 mb-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Storefront
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-neutral-900 sm:text-3xl">
              Customer Order History
            </h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
              Live Outbox Tracking
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Chronologically indexed via native PostgreSQL 18 uuidv7(). Real-time status transitions
            stream from the Transactional Outbox worker.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {session?.user && (
            <button
              type="button"
              onClick={() => setFilterMine(!filterMine)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                filterMine
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              {filterMine ? "Showing My Orders" : "Filter: My Orders Only"}
            </button>
          )}

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin text-emerald-600" : ""}`}
            />
            {isRefetching ? "Polling..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 rounded-xl border border-neutral-200 bg-white p-6 animate-pulse"
            />
          ))}
        </div>
      ) : !orders || orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 p-12 text-center bg-white">
          <ShoppingBag className="h-12 w-12 text-neutral-300 stroke-[1.5] mb-3" />
          <h3 className="text-base font-bold text-neutral-900">No Orders Found</h3>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm">
            Place an order from the storefront or run the flash-sale stress test to populate
            customer orders.
          </p>
          <Link
            href="/"
            className="mt-5 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
          >
            Explore Catalog
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isFulfilled = order.status === "fulfilled";
            const isPending = order.status === "pending";

            return (
              <div
                key={order.id}
                className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs transition-shadow hover:shadow-md"
              >
                {/* Order Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 bg-neutral-50/60 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white font-mono text-xs font-bold">
                      📦
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-neutral-900">
                          {order.id}
                        </span>
                        <span className="text-[11px] text-neutral-400 font-medium">
                          • PG18 uuidv7
                        </span>
                      </div>
                      <span className="text-[11px] text-neutral-500 font-sans">
                        Placed at {new Date(order.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Status Badge */}
                    {isFulfilled ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Fulfilled by Outbox
                      </span>
                    ) : isPending ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-800">
                        <Clock className="h-3.5 w-3.5 text-amber-600 animate-spin" />
                        Pending Worker Poll
                      </span>
                    ) : (
                      <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-700 uppercase">
                        {order.status}
                      </span>
                    )}

                    <span className="text-base font-black text-neutral-900">
                      ${(order.totalAmountInCents / 100).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Line Items */}
                <div className="divide-y divide-neutral-100 px-6">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-3.5">
                      <div className="pr-4">
                        <span className="text-sm font-bold text-neutral-900">
                          {item.frozenName}
                        </span>
                        <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                          SKU: {item.frozenSku} • Unit Price: $
                          {(item.unitPriceInCents / 100).toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-neutral-900">
                          Qty: {item.quantity}
                        </span>
                        <div className="text-xs font-black text-neutral-900 mt-0.5">
                          ${(item.totalPriceInCents / 100).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer details: Customer & Shipping */}
                <div className="border-t border-neutral-100 bg-neutral-50/40 px-6 py-3 flex flex-wrap items-center justify-between text-[11px] text-neutral-500">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-700">Customer:</span>
                    <span className="font-mono text-neutral-600">{order.customerId}</span>
                  </div>
                  {order.shippingAddress && (
                    <div className="flex items-center gap-1.5 text-neutral-600">
                      <Truck className="h-3 w-3 text-neutral-400" />
                      <span>
                        Ship to: {order.shippingAddress.fullName}, {order.shippingAddress.city},{" "}
                        {order.shippingAddress.state} {order.shippingAddress.postalCode}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
