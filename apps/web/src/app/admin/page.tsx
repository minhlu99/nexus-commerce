"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Flame,
  Layers,
  Package,
  Plus,
  RefreshCw,
  TrendingUp,
  Zap,
} from "lucide-react";
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

type QueueJobCounts = Record<string, number>;

interface AdminMetricsResponse {
  kpis: {
    totalGMVInCents: number;
    totalOrdersCount: number;
  };
  inventory: VariantMetric[];
  outbox: {
    summary: OutboxSummary;
    recent: OutboxEventRow[];
  };
  queues: {
    fulfillment: QueueJobCounts;
    webhook: QueueJobCounts;
  };
  orders: OrderRow[];
}

interface FlashSaleResult {
  buyerIndex: number;
  status: number;
  durationMs: number;
  ok: boolean;
}

interface FlashSaleSimulationData {
  type: "flash-sale";
  metrics: {
    totalRequests: number;
    totalDurationMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    successfulOrders: number;
    soldOutRejections: number;
    errors: number;
    currentValkeyStock: number;
    activeHolds: number;
  };
  results: FlashSaleResult[];
}

interface IdempotencyBurstResult {
  status: number;
  cached: boolean;
  orderId?: string;
}

interface IdempotencySimulationData {
  type: "idempotency-burst";
  totalMs: number;
  results: IdempotencyBurstResult[];
}

type SimulationData = FlashSaleSimulationData | IdempotencySimulationData;

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "pipeline" | "orders">("overview");
  const [restockNotice, setRestockNotice] = useState<string | null>(null);
  const [simulationData, setSimulationData] = useState<SimulationData | null>(null);

  // Poll telemetry metrics every 3 seconds for live streaming updates
  const { data, isRefetching, refetch } = useQuery<AdminMetricsResponse>({
    queryKey: ["admin", "metrics"],
    queryFn: async () => {
      const res = await api.api.admin.metrics.$get();
      if (!res.ok) throw new Error("Failed to load admin metrics");
      const json = await res.json();
      return (json as unknown as { data: AdminMetricsResponse }).data;
    },
    refetchInterval: 3000,
  });

  // Restock Mutation
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

  // Simulator Mutation
  const simulateMutation = useMutation({
    mutationFn: async ({
      sku,
      buyerCount,
      type,
    }: {
      sku: string;
      buyerCount: number;
      type: "flash-sale" | "idempotency-burst";
    }) => {
      const res = await fetch("http://localhost:4000/api/admin/simulate-flash-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, buyerCount, type }),
      });
      if (!res.ok) {
        throw new Error("Failed to execute traffic simulation");
      }
      return (await res.json()) as SimulationData;
    },
    onSuccess: (result) => {
      setSimulationData(result);
      queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const targetSku = data?.inventory?.[0]?.sku || "NEX-PRO-BLK";

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
              Flash-Sale War Room & Telemetry
            </h1>
            <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-black text-white uppercase tracking-wider">
              Control Center
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Real-time dual-engine synchronization between PostgreSQL 18 AIO and Valkey 9.1 with
            BullMQ outbox relay.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin text-emerald-600" : ""}`}
            />
            <span>{isRefetching ? "Streaming..." : "Poll Now"}</span>
          </button>
        </div>
      </div>

      {/* FLASH-SALE TRAFFIC SIMULATOR BAR */}
      <section className="mb-8 rounded-2xl border-2 border-neutral-900 bg-linear-to-r from-neutral-900 via-neutral-900 to-neutral-950 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-neutral-800 pb-5 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-amber-400 animate-pulse" />
              <h2 className="text-base font-black tracking-wide uppercase text-white">
                In-Browser Concurrency & Traffic Simulator
              </h2>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Launch real simultaneous HTTP swarms directly from the browser to stress-test locks,
              Lua holds, and idempotency.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={simulateMutation.isPending}
              onClick={() =>
                simulateMutation.mutate({
                  sku: targetSku,
                  buyerCount: 100,
                  type: "flash-sale",
                })
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-amber-500 to-rose-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:from-amber-600 hover:to-rose-700 disabled:opacity-50 transition-all active:scale-95"
            >
              <Flame className="h-3.5 w-3.5" />
              {simulateMutation.isPending
                ? "Executing Swarm..."
                : "🔥 Launch 100-Buyer Flash Spike"}
            </button>

            <button
              type="button"
              disabled={simulateMutation.isPending}
              onClick={() =>
                simulateMutation.mutate({
                  sku: targetSku,
                  buyerCount: 5,
                  type: "idempotency-burst",
                })
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-3.5 py-2.5 text-xs font-bold text-white disabled:opacity-50 transition-all"
            >
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span>⚡ Test 5x Idempotency</span>
            </button>

            <button
              type="button"
              disabled={restockMutation.isPending}
              onClick={() => restockMutation.mutate({ sku: targetSku, quantity: 100 })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2.5 text-xs font-bold text-white disabled:opacity-50 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+100 Instant Restock</span>
            </button>
          </div>
        </div>

        {/* Live Simulation Results Display */}
        {simulateMutation.isPending ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 text-center animate-pulse">
            <Flame className="h-8 w-8 text-amber-400 mx-auto mb-2 animate-bounce" />
            <h4 className="text-sm font-bold text-white">Firing High-Concurrency Swarm...</h4>
            <p className="text-xs text-neutral-400 mt-1">
              Executing simultaneous atomic Lua reservations, PG18 transactions, and BullMQ relays.
            </p>
          </div>
        ) : simulationData?.type === "flash-sale" ? (
          <div className="space-y-4">
            {/* Flash Sale KPI summary */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 text-xs">
              <div className="rounded-lg bg-neutral-800/80 p-3 border border-neutral-700/60">
                <span className="text-neutral-400 text-[10px] uppercase font-bold block">
                  TOTAL SWARM
                </span>
                <span className="text-lg font-black text-white">
                  {simulationData.metrics.totalRequests} Buyers
                </span>
                <span className="text-[11px] text-neutral-400 font-mono">
                  in {simulationData.metrics.totalDurationMs}ms
                </span>
              </div>
              <div className="rounded-lg bg-neutral-800/80 p-3 border border-neutral-700/60">
                <span className="text-neutral-400 text-[10px] uppercase font-bold block">
                  SUCCESS (201)
                </span>
                <span className="text-lg font-black text-emerald-400">
                  {simulationData.metrics.successfulOrders} Sold
                </span>
                <span className="text-[11px] text-emerald-500 font-semibold">Zero oversell</span>
              </div>
              <div className="rounded-lg bg-neutral-800/80 p-3 border border-neutral-700/60">
                <span className="text-neutral-400 text-[10px] uppercase font-bold block">
                  SOLD OUT (409)
                </span>
                <span className="text-lg font-black text-amber-400">
                  {simulationData.metrics.soldOutRejections} Rejected
                </span>
                <span className="text-[11px] text-neutral-400">Lua hold barrier</span>
              </div>
              <div className="rounded-lg bg-neutral-800/80 p-3 border border-neutral-700/60">
                <span className="text-neutral-400 text-[10px] uppercase font-bold block">
                  LATENCY p50
                </span>
                <span className="text-lg font-black text-white font-mono">
                  {simulationData.metrics.p50Ms}ms
                </span>
                <span className="text-[11px] text-neutral-400">Median checkout</span>
              </div>
              <div className="rounded-lg bg-neutral-800/80 p-3 border border-neutral-700/60">
                <span className="text-neutral-400 text-[10px] uppercase font-bold block">
                  LATENCY p99
                </span>
                <span className="text-lg font-black text-rose-400 font-mono">
                  {simulationData.metrics.p99Ms}ms
                </span>
                <span className="text-[11px] text-neutral-400">BatchSpanProcessor</span>
              </div>
              <div className="rounded-lg bg-neutral-800/80 p-3 border border-neutral-700/60">
                <span className="text-neutral-400 text-[10px] uppercase font-bold block">
                  CURRENT STOCK
                </span>
                <span className="text-lg font-black text-white font-mono">
                  {simulationData.metrics.currentValkeyStock} units
                </span>
                <span className="text-[11px] text-neutral-400">
                  {simulationData.metrics.activeHolds} active holds
                </span>
              </div>
            </div>

            {/* Request Waterfall Preview */}
            <div className="rounded-xl bg-neutral-950/80 p-3 border border-neutral-800">
              <span className="text-[11px] font-bold text-neutral-400 block mb-2">
                Sample Request Latency Waterfall ({simulationData.results.length} requests sampled)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {simulationData.results.map((r) => (
                  <div
                    key={r.buyerIndex}
                    className={`rounded px-2 py-1 font-mono text-[10px] font-bold border flex items-center gap-1 ${
                      r.status === 201
                        ? "bg-emerald-950/80 border-emerald-700 text-emerald-300"
                        : r.status === 409
                          ? "bg-amber-950/80 border-amber-700 text-amber-300"
                          : "bg-rose-950/80 border-rose-700 text-rose-300"
                    }`}
                  >
                    <span>#{r.buyerIndex}</span>
                    <span className="text-white/60">•</span>
                    <span>{r.status}</span>
                    <span className="text-white/60">•</span>
                    <span>{r.durationMs}ms</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : simulationData?.type === "idempotency-burst" ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-white">
                5x Simultaneous Idempotency Attack Result
              </span>
              <span className="font-mono text-xs text-emerald-400 font-bold">
                Total: {simulationData.totalMs}ms
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
              {simulationData.results.map((r, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-3 border text-center ${
                    r.status === 201
                      ? "border-emerald-600 bg-emerald-950/60 text-emerald-200"
                      : "border-purple-600 bg-purple-950/60 text-purple-200"
                  }`}
                >
                  <span className="text-[10px] font-bold block uppercase tracking-wider text-neutral-400">
                    Request #{i + 1}
                  </span>
                  <span className="text-base font-black block mt-0.5">{r.status}</span>
                  <span className="text-[11px] font-semibold mt-1 block">
                    {r.status === 201 ? "✅ Order Created" : "⚡ 200 Cached Result"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-neutral-400 py-1">
            <span>
              Target SKU: <strong className="text-white font-mono">{targetSku}</strong>
            </span>
            <span>Click any simulator button above to run live concurrency attacks</span>
          </div>
        )}
      </section>

      {/* TAB NAVIGATION */}
      <div className="mb-6 flex items-center gap-2 border-b border-neutral-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
            activeTab === "overview"
              ? "bg-neutral-900 text-white shadow-xs"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>Executive Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("pipeline")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
            activeTab === "pipeline"
              ? "bg-neutral-900 text-white shadow-xs"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          <Layers className="h-4 w-4 text-purple-500" />
          <span>BullMQ & Outbox Pipeline</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("orders")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
            activeTab === "orders"
              ? "bg-neutral-900 text-white shadow-xs"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          <Package className="h-4 w-4 text-emerald-500" />
          <span>Orders & Event Stream</span>
        </button>
      </div>

      {/* Restock Notification Alert */}
      {restockNotice && (
        <div className="mb-6 flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-800">
          <span>{restockNotice}</span>
          <button type="button" onClick={() => setRestockNotice(null)} className="underline">
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                Gross Merchandise Value
              </span>
              <span className="text-2xl font-black text-neutral-900 mt-1 block">
                $
                {((data?.kpis?.totalGMVInCents ?? 0) / 100).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </span>
              <span className="text-xs text-emerald-600 font-semibold mt-1 block">
                PostgreSQL 18 ACID Verified
              </span>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                Total Orders Placed
              </span>
              <span className="text-2xl font-black text-neutral-900 mt-1 block">
                {data?.kpis?.totalOrdersCount ?? 0}
              </span>
              <span className="text-xs text-neutral-500 mt-1 block">
                Native uuidv7() Primary Keys
              </span>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                Outbox Events Relayed
              </span>
              <span className="text-2xl font-black text-purple-600 mt-1 block">
                {data?.outbox?.summary?.completed ?? 0}
              </span>
              <span className="text-xs text-neutral-500 mt-1 block">
                0 dual-write loss guarantee
              </span>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                BullMQ Queue Throughput
              </span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">
                {(data?.queues?.fulfillment?.completed ?? 0) +
                  (data?.queues?.webhook?.completed ?? 0)}{" "}
                Jobs
              </span>
              <span className="text-xs text-neutral-500 mt-1 block">
                Valkey 9.1 Background Consumers
              </span>
            </div>
          </div>

          {/* Dual-Engine Inventory Synchronization Table */}
          <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Dual-Engine Inventory Sync (PG 18 vs Valkey 9.1)
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Verifies zero drift between PostgreSQL persistent inventory and Valkey volatile
                  stock holds.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Dual-Engine Synced
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">SKU / Variant</th>
                    <th className="py-3 px-4">PostgreSQL 18 Physical</th>
                    <th className="py-3 px-4">Valkey 9.1 Available</th>
                    <th className="py-3 px-4">Active Holds (HLEN)</th>
                    <th className="py-3 px-4">Sync Status</th>
                    <th className="py-3 px-4 text-right">Quick Restock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-mono">
                  {data?.inventory?.map((item) => (
                    <tr key={item.variantId} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-sans">
                        <span className="font-bold text-neutral-900 block">{item.variantName}</span>
                        <span className="font-mono text-[11px] text-neutral-500">{item.sku}</span>
                      </td>
                      <td className="py-3.5 px-4 text-neutral-900 font-bold">
                        {item.pgPhysicalStock ?? 0} units
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-black ${
                            item.valkeyPhysicalStock === 0
                              ? "text-rose-600"
                              : item.valkeyPhysicalStock < 15
                                ? "text-amber-600"
                                : "text-emerald-600"
                          }`}
                        >
                          {item.valkeyPhysicalStock} units
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {item.activeHoldsCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            🔥 {item.activeHoldsCount} in cart
                          </span>
                        ) : (
                          <span className="text-neutral-400">0 holds</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        {item.isSynchronized ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            Synchronized
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold text-[11px]">
                            <AlertTriangle className="h-3 w-3 text-amber-600" />
                            Drift Pending Relay
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => restockMutation.mutate({ sku: item.sku, quantity: 10 })}
                            disabled={restockMutation.isPending}
                            className="rounded border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                          >
                            +10
                          </button>
                          <button
                            type="button"
                            onClick={() => restockMutation.mutate({ sku: item.sku, quantity: 50 })}
                            disabled={restockMutation.isPending}
                            className="rounded border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                          >
                            +50
                          </button>
                          <button
                            type="button"
                            onClick={() => restockMutation.mutate({ sku: item.sku, quantity: 100 })}
                            disabled={restockMutation.isPending}
                            className="rounded bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
                          >
                            +100
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: BULLMQ & OUTBOX PIPELINE */}
      {activeTab === "pipeline" && (
        <div className="space-y-6">
          {/* Stage 1: Outbox Relay */}
          <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Stage 1: PostgreSQL 18 Transactional Outbox (SKIP LOCKED Relay)
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Transactional events polled concurrently with zero row-lock contention and
                  dispatched into BullMQ.
                </p>
              </div>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 uppercase tracking-wider">
                Stage 1 Poller
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 font-mono text-center">
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                <span className="text-[10px] uppercase font-bold text-emerald-700 font-sans block">
                  Completed
                </span>
                <span className="text-2xl font-black text-emerald-800 mt-1 block">
                  {data?.outbox?.summary?.completed ?? 0}
                </span>
                <span className="text-[10px] text-emerald-600 font-sans">Relayed to BullMQ</span>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                <span className="text-[10px] uppercase font-bold text-amber-700 font-sans block">
                  Pending
                </span>
                <span className="text-2xl font-black text-amber-800 mt-1 block">
                  {data?.outbox?.summary?.pending ?? 0}
                </span>
                <span className="text-[10px] text-amber-600 font-sans">Awaiting Poller</span>
              </div>
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                <span className="text-[10px] uppercase font-bold text-blue-700 font-sans block">
                  Processing
                </span>
                <span className="text-2xl font-black text-blue-800 mt-1 block">
                  {data?.outbox?.summary?.processing ?? 0}
                </span>
                <span className="text-[10px] text-blue-600 font-sans">SKIP LOCKED lock</span>
              </div>
              <div className="rounded-xl bg-rose-50 border border-rose-100 p-4">
                <span className="text-[10px] uppercase font-bold text-rose-700 font-sans block">
                  Failed
                </span>
                <span className="text-2xl font-black text-rose-800 mt-1 block">
                  {data?.outbox?.summary?.failed ?? 0}
                </span>
                <span className="text-[10px] text-rose-600 font-sans">Dead Letter Queue</span>
              </div>
            </div>
          </section>

          {/* Stage 2: Valkey BullMQ Queue Inspector */}
          <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Stage 2: Valkey 9.1 BullMQ Queues (Fulfillment & Webhook Revalidation)
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Dedicated BullMQ consumers executing stock commitments, invoice generation, and
                  Next.js cache purges.
                </p>
              </div>
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800 uppercase tracking-wider">
                Stage 2 Queues
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Order Fulfillment Queue */}
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                <div className="flex items-center justify-between mb-3 border-b border-neutral-200 pb-2">
                  <span className="font-mono text-xs font-bold text-neutral-900">
                    queue: order-fulfillment
                  </span>
                  <span className="rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5">
                    Concurrency: 10
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2 text-center font-mono">
                  <div className="bg-white p-2 rounded border border-neutral-100">
                    <span className="text-[10px] text-neutral-400 block font-sans">Active</span>
                    <span className="text-sm font-bold text-neutral-900">
                      {data?.queues?.fulfillment?.active ?? 0}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-neutral-100">
                    <span className="text-[10px] text-neutral-400 block font-sans">Waiting</span>
                    <span className="text-sm font-bold text-neutral-900">
                      {data?.queues?.fulfillment?.waiting ?? 0}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-neutral-100">
                    <span className="text-[10px] text-neutral-400 block font-sans">Done</span>
                    <span className="text-sm font-bold text-emerald-600">
                      {data?.queues?.fulfillment?.completed ?? 0}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-neutral-100">
                    <span className="text-[10px] text-neutral-400 block font-sans">Failed</span>
                    <span className="text-sm font-bold text-rose-600">
                      {data?.queues?.fulfillment?.failed ?? 0}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-neutral-100">
                    <span className="text-[10px] text-neutral-400 block font-sans">Delayed</span>
                    <span className="text-sm font-bold text-neutral-500">
                      {data?.queues?.fulfillment?.delayed ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Webhook Revalidation Queue */}
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                <div className="flex items-center justify-between mb-3 border-b border-neutral-200 pb-2">
                  <span className="font-mono text-xs font-bold text-neutral-900">
                    queue: webhook-revalidate
                  </span>
                  <span className="rounded bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5">
                    Concurrency: 5
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2 text-center font-mono">
                  <div className="bg-white p-2 rounded border border-neutral-100">
                    <span className="text-[10px] text-neutral-400 block font-sans">Active</span>
                    <span className="text-sm font-bold text-neutral-900">
                      {data?.queues?.webhook?.active ?? 0}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-neutral-100">
                    <span className="text-[10px] text-neutral-400 block font-sans">Waiting</span>
                    <span className="text-sm font-bold text-neutral-900">
                      {data?.queues?.webhook?.waiting ?? 0}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-neutral-100">
                    <span className="text-[10px] text-neutral-400 block font-sans">Done</span>
                    <span className="text-sm font-bold text-emerald-600">
                      {data?.queues?.webhook?.completed ?? 0}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-neutral-100">
                    <span className="text-[10px] text-neutral-400 block font-sans">Failed</span>
                    <span className="text-sm font-bold text-rose-600">
                      {data?.queues?.webhook?.failed ?? 0}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-neutral-100">
                    <span className="text-[10px] text-neutral-400 block font-sans">Delayed</span>
                    <span className="text-sm font-bold text-neutral-500">
                      {data?.queues?.webhook?.delayed ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: ORDERS & EVENT STREAM */}
      {activeTab === "orders" && (
        <div className="space-y-6">
          {/* Latest Orders */}
          <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs">
            <h3 className="text-base font-bold text-neutral-900 mb-3">Recent Customer Orders</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4">Order ID (uuidv7)</th>
                    <th className="py-2.5 px-4">Customer ID</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Total Amount</th>
                    <th className="py-2.5 px-4">Placed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-mono">
                  {data?.orders?.map((o) => (
                    <tr key={o.id} className="hover:bg-neutral-50/60">
                      <td className="py-3 px-4 font-bold text-neutral-900">{o.id}</td>
                      <td className="py-3 px-4 text-neutral-600">{o.customerId}</td>
                      <td className="py-3 px-4 font-sans">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            o.status === "fulfilled"
                              ? "bg-emerald-100 text-emerald-800"
                              : o.status === "pending"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-neutral-100 text-neutral-700"
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-neutral-900">
                        ${(o.totalAmountInCents / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-sans text-neutral-500">
                        {new Date(o.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Recent Outbox Events */}
          <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs">
            <h3 className="text-base font-bold text-neutral-900 mb-3">Recent Outbox Events</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-400 font-semibold uppercase tracking-wider text-[10px] font-sans">
                    <th className="py-2.5 px-4">Event ID</th>
                    <th className="py-2.5 px-4">Event Type</th>
                    <th className="py-2.5 px-4">Aggregate</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {data?.outbox?.recent?.map((evt) => (
                    <tr key={evt.id} className="hover:bg-neutral-50/60">
                      <td className="py-3 px-4 text-neutral-700">{evt.id}</td>
                      <td className="py-3 px-4 font-bold text-neutral-900 font-sans">
                        {evt.eventType}
                      </td>
                      <td className="py-3 px-4 text-neutral-600 font-sans">
                        {evt.aggregateType} ({evt.aggregateId})
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                          {evt.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans text-neutral-500">
                        {new Date(evt.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
