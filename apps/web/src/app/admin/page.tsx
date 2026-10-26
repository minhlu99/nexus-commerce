"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api-client";

interface VariantMetric {
  variantId: string;
  sku: string;
  variantName: string;
  priceInCents: number;
  productId: string;
  productTitle: string;
  pgPhysicalStock: number | null;
  valkeyPhysicalStock: number;
  activeHoldsCount: number;
  isSynchronized: boolean;
}

interface OutboxSummary {
  completed: number;
  pending: number;
  processing: number;
  failed: number;
}

interface OutboxEventRow {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  status: string;
  attempts: number;
  createdAt: string;
  processedAt: string | null;
}

interface OrderRow {
  id: string;
  customerId: string;
  status: string;
  totalAmountInCents: number;
  createdAt: string;
}

interface AdminMetricsResponse {
  inventory: VariantMetric[];
  outbox: {
    summary: OutboxSummary;
    recent: OutboxEventRow[];
  };
  orders: OrderRow[];
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [restockNotice, setRestockNotice] = useState<string | null>(null);

  // Poll telemetry metrics every 3 seconds for live streaming updates
  const { data, isLoading, isRefetching, refetch } = useQuery<AdminMetricsResponse>({
    queryKey: ["admin", "metrics"],
    queryFn: async () => {
      const res = await api.api.admin.metrics.$get();
      if (!res.ok) throw new Error("Failed to load admin metrics");
      const json = await res.json();
      return (json as { data: AdminMetricsResponse }).data;
    },
    refetchInterval: 3000,
  });

  const restockMutation = useMutation({
    mutationFn: async ({ sku, quantity }: { sku: string; quantity: number }) => {
      setRestockNotice(null);
      const res = await api.api.admin.inventory.restock.$post({
        json: { sku, quantity },
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error || "Failed to restock");
      }
      return (await res.json()) as { data: { sku: string; newPhysicalStock: number } };
    },
    onSuccess: (_result, vars) => {
      setRestockNotice(`Successfully added +${vars.quantity} units to ${vars.sku}!`);
      queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-200 pb-6">
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
              Merchant & Outbox Control Center
            </h1>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800 uppercase tracking-wider">
              Admin Telemetry
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Real-time synchronization between PostgreSQL 18 AIO, Valkey 9.1 HEXPIRE, and BullMQ
            Outbox
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin text-blue-600" : ""}`}
            />
            {isRefetching ? "Streaming..." : "Refresh Telemetry"}
          </button>
        </div>
      </div>

      {restockNotice && (
        <div className="mb-6 flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{restockNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setRestockNotice(null)}
            className="text-emerald-700 hover:text-emerald-950"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Section 1: Dual-Engine Inventory Telemetry & Restock Controls */}
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">
              Live Dual-Engine Inventory Ledger
            </h2>
            <p className="text-xs text-neutral-500">
              Validates that PostgreSQL physical stock equals Valkey in-memory counter with zero
              active hold drift
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs">
          <table className="min-w-full divide-y divide-neutral-200 text-left text-xs">
            <thead className="bg-neutral-50 text-neutral-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-6 py-3.5">SKU & Product</th>
                <th className="px-6 py-3.5">Postgres 18 Stock</th>
                <th className="px-6 py-3.5">Valkey 9.1 Stock</th>
                <th className="px-6 py-3.5">Active Holds (HLEN)</th>
                <th className="px-6 py-3.5">State Integrity</th>
                <th className="px-6 py-3.5 text-right">Instant Restock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-neutral-400">
                    Loading inventory telemetry...
                  </td>
                </tr>
              ) : (
                data?.inventory.map((item) => (
                  <tr key={item.sku} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-neutral-900">{item.productTitle}</div>
                      <div className="text-[11px] text-neutral-500 font-mono">
                        {item.variantName} • {item.sku}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-neutral-900">
                      {item.pgPhysicalStock ?? 0}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-neutral-900">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            item.valkeyPhysicalStock > 0 ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                        />
                        {item.valkeyPhysicalStock}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-neutral-600">
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                          item.activeHoldsCount === 0
                            ? "bg-neutral-100 text-neutral-600"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {item.activeHoldsCount} holds
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {item.isSynchronized ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          In Sync
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 border border-rose-200">
                          <AlertTriangle className="h-3 w-3" />
                          Drift Detected
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => restockMutation.mutate({ sku: item.sku, quantity: 50 })}
                          disabled={restockMutation.isPending}
                          className="rounded border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                        >
                          +50
                        </button>
                        <button
                          type="button"
                          onClick={() => restockMutation.mutate({ sku: item.sku, quantity: 100 })}
                          disabled={restockMutation.isPending}
                          className="rounded bg-neutral-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-neutral-800 disabled:opacity-50"
                        >
                          +100
                        </button>
                        <button
                          type="button"
                          onClick={() => restockMutation.mutate({ sku: item.sku, quantity: 500 })}
                          disabled={restockMutation.isPending}
                          className="rounded border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                        >
                          +500
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 2: Transactional Outbox Pipeline Monitor */}
      <section className="mb-10">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-neutral-900">
            Transactional Outbox Pipeline (SKIP LOCKED)
          </h2>
          <p className="text-xs text-neutral-500">
            Guarantees at-least-once message delivery from PostgreSQL ACID commit to background
            workers
          </p>
        </div>

        {/* Status Counters */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Completed Events
            </span>
            <div className="mt-2 text-2xl font-black text-emerald-600">
              {data?.outbox.summary.completed ?? 0}
            </div>
            <span className="text-[11px] text-neutral-500">Processed & committed</span>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Pending in Queue
            </span>
            <div className="mt-2 text-2xl font-black text-amber-500">
              {data?.outbox.summary.pending ?? 0}
            </div>
            <span className="text-[11px] text-neutral-500">Awaiting worker poll</span>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              In-Flight Processing
            </span>
            <div className="mt-2 text-2xl font-black text-blue-600">
              {data?.outbox.summary.processing ?? 0}
            </div>
            <span className="text-[11px] text-neutral-500">Locked via SKIP LOCKED</span>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Failed (Dead-Letter)
            </span>
            <div className="mt-2 text-2xl font-black text-rose-600">
              {data?.outbox.summary.failed ?? 0}
            </div>
            <span className="text-[11px] text-neutral-500">Exhausted retries</span>
          </div>
        </div>

        {/* Recent Events Table */}
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs">
          <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-3 font-semibold text-xs text-neutral-700">
            Recent 10 Outbox Events Stream
          </div>
          <table className="min-w-full divide-y divide-neutral-200 text-left text-xs">
            <thead className="bg-neutral-50 text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-6 py-3">Event ID</th>
                <th className="px-6 py-3">Event Type</th>
                <th className="px-6 py-3">Aggregate ID</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Attempts</th>
                <th className="px-6 py-3 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white font-mono text-[11px]">
              {data?.outbox.recent.map((ev) => (
                <tr key={ev.id} className="hover:bg-neutral-50/50">
                  <td className="px-6 py-3 text-neutral-500 truncate max-w-[140px]">{ev.id}</td>
                  <td className="px-6 py-3 font-bold text-neutral-900">{ev.eventType}</td>
                  <td className="px-6 py-3 text-neutral-600 truncate max-w-[160px]">
                    {ev.aggregateId}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                        ev.status === "completed"
                          ? "bg-emerald-100 text-emerald-800"
                          : ev.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {ev.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-neutral-600">{ev.attempts}</td>
                  <td className="px-6 py-3 text-right text-neutral-400 font-sans text-xs">
                    {new Date(ev.createdAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 3: Recent Orders Ledger */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-neutral-900">Recent Committed Orders Ledger</h2>
          <p className="text-xs text-neutral-500">
            Immutable snapshots of unit prices and customer billing created inside ACID transactions
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs">
          <table className="min-w-full divide-y divide-neutral-200 text-left text-xs">
            <thead className="bg-neutral-50 text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-6 py-3">Order ID</th>
                <th className="px-6 py-3">Customer ID</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Total Amount</th>
                <th className="px-6 py-3 text-right">Committed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white font-mono text-[11px]">
              {data?.orders.map((ord) => (
                <tr key={ord.id} className="hover:bg-neutral-50/50">
                  <td className="px-6 py-3 font-bold text-neutral-900 truncate max-w-[160px]">
                    {ord.id}
                  </td>
                  <td className="px-6 py-3 text-neutral-600 font-sans">{ord.customerId}</td>
                  <td className="px-6 py-3">
                    <span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-700">
                      {ord.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-bold text-neutral-900">
                    ${(ord.totalAmountInCents / 100).toFixed(2)}
                  </td>
                  <td className="px-6 py-3 text-right text-neutral-400 font-sans text-xs">
                    {new Date(ord.createdAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
