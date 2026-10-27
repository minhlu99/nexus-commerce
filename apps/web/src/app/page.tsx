import { Lock, ShieldCheck, Zap } from "lucide-react";
import { ArchitectureXRay } from "@/components/architecture-xray";
import { CustomerFlowStepper } from "@/components/customer-flow-stepper";
import { ProductCard, type StaticProduct } from "@/components/product-card";
import { api } from "@/lib/api-client";

async function getCachedCatalog(): Promise<StaticProduct[]> {
  try {
    const res = await api.api.products.$get();
    if (res.ok) {
      const json = await res.json();
      return json.data as StaticProduct[];
    }
  } catch {
    // Graceful fallback if backend is offline during static build
  }

  // Fallback demo data matching seed values for instant preview
  return [
    {
      id: "01940000-0000-7000-8000-000000000002",
      title: "Nexus Pro ANC Studio Headphones",
      slug: "nexus-pro-anc",
      category: "Audio",
    },
    {
      id: "01940000-0000-7000-8000-000000000003",
      title: "Apex Mechanical Keyboard (Hall Effect)",
      slug: "apex-keyboard-he",
      category: "Peripherals",
    },
  ];
}

export default async function HomePage() {
  const products = await getCachedCatalog();

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <section className="mb-12 rounded-2xl border border-neutral-200 bg-linear-to-b from-white to-neutral-50/50 p-8 shadow-xs sm:p-12">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-800 shadow-2xs mb-4">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Valkey 9.1 HEXPIRE + PostgreSQL 18 AIO Active
          </div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900 sm:text-5xl">
            Zero-Oversell High Concurrency Commerce.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-neutral-600 sm:text-base">
            Engineered with a strict cache boundary: React Server Components with Next.js 16 cache
            tags for static catalog delivery, paired with client-side TanStack Query and Hono RPC
            for millisecond-accurate stock reservations.
          </p>

          <div className="mt-6 flex flex-wrap gap-4 text-xs font-medium text-neutral-600">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Transactional Outbox (SKIP LOCKED)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-amber-500" />
              <span>Idempotency Spin-Wait Lock</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-blue-600" />
              <span>Better Auth + Valkey Secondary Storage</span>
            </div>
          </div>
        </div>
      </section>

      {/* End-to-End Architectural Stepper */}
      <CustomerFlowStepper />

      {/* Product Catalog Grid */}
      <section className="mb-16">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-900">
              Featured Flagship Releases
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Add variants to cart to test live inventory holds and deterministic idempotency
            </p>
          </div>
          <span className="rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700">
            {products.length} Products Available
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Architecture Architecture Telemetry Panel */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs">
        <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-4">
          Active Production Telemetry
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-neutral-50 p-4 border border-neutral-100">
            <span className="text-[11px] font-semibold text-neutral-500 block">
              DATABASE ENGINE
            </span>
            <span className="text-sm font-bold text-neutral-900 mt-1 block">PostgreSQL 18</span>
            <span className="text-xs text-neutral-500">io_method=worker (AIO enabled)</span>
          </div>
          <div className="rounded-lg bg-neutral-50 p-4 border border-neutral-100">
            <span className="text-[11px] font-semibold text-neutral-500 block">STOCK ENGINE</span>
            <span className="text-sm font-bold text-neutral-900 mt-1 block">Valkey 9.1</span>
            <span className="text-xs text-neutral-500">HEXPIRE Dynamic Holds (noeviction)</span>
          </div>
          <div className="rounded-lg bg-neutral-50 p-4 border border-neutral-100">
            <span className="text-[11px] font-semibold text-neutral-500 block">
              EVENT DISPATCHER
            </span>
            <span className="text-sm font-bold text-neutral-900 mt-1 block">BullMQ Outbox</span>
            <span className="text-xs text-neutral-500">Zero dual-write loss guarantee</span>
          </div>
        </div>
      </section>

      {/* Floating Architecture X-Ray Drawer */}
      <ArchitectureXRay />
    </main>
  );
}
