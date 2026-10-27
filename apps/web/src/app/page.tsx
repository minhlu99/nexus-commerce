import {
  Award,
  Clock,
  Headphones,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Truck,
  Zap,
} from "lucide-react";
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
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Brand Luxury Hero Section */}
      <section className="relative mb-12 overflow-hidden rounded-3xl border border-neutral-200 bg-linear-to-b from-neutral-900 via-neutral-950 to-black text-white p-8 sm:p-14 shadow-2xl">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-700/60 bg-neutral-800/60 backdrop-blur-md px-3.5 py-1 text-xs font-semibold text-neutral-300 shadow-xs mb-6">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            FLAGSHIP STUDIO SERIES &bull; AUTUMN 2026 DROP
          </div>

          <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl leading-[1.08]">
            Sound Engineered Without Compromise.
          </h1>

          <p className="mt-5 text-sm sm:text-base leading-relaxed text-neutral-300 max-w-2xl font-normal">
            Precision-milled acoustic titanium, custom 40mm beryllium drivers, and lossless spatial
            latency. Handcrafted for studio purists, producers, and discerning audiophiles.
          </p>

          {/* Quick Pillars */}
          <div className="mt-8 flex flex-wrap gap-5 text-xs font-semibold text-neutral-300">
            <div className="flex items-center gap-2">
              <Headphones className="h-4 w-4 text-emerald-400" />
              <span>24-bit Lossless Studio Master</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <span>50-Hour Continuous Playback</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-400" />
              <span>2-Year Global Studio Warranty</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-purple-400" />
              <span>Complimentary 2-Day Express</span>
            </div>
          </div>
        </div>

        {/* Ambient Glow */}
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
      </section>

      {/* Customer Journey Stepper (Consumer-First with Tech Toggle) */}
      <CustomerFlowStepper />

      {/* Product Catalog Grid */}
      <section className="mb-16">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Current Flagship Drop
            </div>
            <h2 className="text-2xl font-black tracking-tight text-neutral-900 sm:text-3xl">
              Precision Acoustic Instruments
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              Select your finish below. Real-time stock locks exclusively reserve your pair during
              checkout.
            </p>
          </div>
          <span className="self-start sm:self-auto rounded-full border border-neutral-200 bg-white px-3.5 py-1 text-xs font-bold text-neutral-700 shadow-2xs">
            {products.length} Editions Available
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Direct-to-Consumer Trust Pillars */}
      <section className="mb-16 rounded-2xl border border-neutral-200 bg-white p-8 shadow-xs">
        <h3 className="text-center text-xs font-black uppercase tracking-wider text-neutral-400 mb-2">
          The Nexus Direct Standard
        </h3>
        <h4 className="text-center text-xl font-black text-neutral-900 mb-8 sm:text-2xl">
          Why Discerning Listeners Buy Direct
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white mb-3">
              <Award className="h-4 w-4" />
            </div>
            <h5 className="text-sm font-bold text-neutral-900">Direct From Acoustic Lab</h5>
            <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
              No retail markups or middleman markdowns. Hand-assembled in calibrated batches with
              serialized acoustic measurement certificates.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white mb-3">
              <RotateCcw className="h-4 w-4" />
            </div>
            <h5 className="text-sm font-bold text-neutral-900">30-Day In-Studio Trial</h5>
            <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
              Listen in your own creative space. If they don't surpass your studio references,
              return them in original packaging for a full refund.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white mb-3">
              <Clock className="h-4 w-4" />
            </div>
            <h5 className="text-sm font-bold text-neutral-900">Guaranteed Inventory Accuracy</h5>
            <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
              Our live allocation engine ensures you never receive a "cancelled due to overselling"
              email. What you order is reserved for you.
            </p>
          </div>
        </div>
      </section>

      {/* Floating Architecture X-Ray Drawer (Dedicated to technical reviewers & developers) */}
      <ArchitectureXRay />
    </main>
  );
}
