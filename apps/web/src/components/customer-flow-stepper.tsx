"use client";

import {
  CheckCircle2,
  Clock,
  Code2,
  Database,
  Layers,
  Lock,
  ShieldCheck,
  Sparkles,
  Truck,
  UserCheck,
} from "lucide-react";
import { useState } from "react";
import { useCart } from "@/context/cart-context";
import { useSession } from "@/lib/auth-client";

export function CustomerFlowStepper() {
  const { data: session } = useSession();
  const { totalItemCount } = useCart();
  const [showTech, setShowTech] = useState(false);

  const isAuthenticated = !!session?.user;
  const hasItemsInCart = totalItemCount > 0;

  const consumerSteps = [
    {
      num: 1,
      name: "Verified Studio Pass",
      subtitle: isAuthenticated
        ? `Signed in as ${session.user.name}`
        : "Member access & 2-year warranty",
      desc: "Fast-pass checkout with saved addresses and exclusive drop privileges.",
      active: isAuthenticated,
      icon: UserCheck,
    },
    {
      num: 2,
      name: "Guaranteed Hold",
      subtitle: hasItemsInCart
        ? `${totalItemCount} item(s) reserved`
        : "Real-time stock allocation",
      desc: "Your pair is held in our distribution center the moment it enters your bag.",
      active: hasItemsInCart,
      icon: Clock,
    },
    {
      num: 3,
      name: "Encrypted Checkout",
      subtitle: "Zero-duplicate payment shield",
      desc: "Bank-grade 256-bit encryption ensuring zero duplicate or ghost charges.",
      active: hasItemsInCart,
      icon: Lock,
    },
    {
      num: 4,
      name: "Express Dispatch",
      subtitle: "Automated warehouse pick & pack",
      desc: "Instant digital receipt generation and priority courier handoff.",
      active: true,
      icon: Truck,
    },
  ];

  const techSteps = [
    {
      num: 1,
      name: "Authentication Gate",
      subtitle: "Valkey 9.1 Session Cache (0.7ms)",
      desc: "Sub-millisecond RBAC check served directly from secondaryStorage RAM.",
      active: isAuthenticated,
      icon: ShieldCheck,
    },
    {
      num: 2,
      name: "Valkey Stock Hold",
      subtitle: "Dynamic Lua HVALS + HEXPIRE",
      desc: "10-minute hold with zero sweeper overhead and zero overselling race condition.",
      active: hasItemsInCart,
      icon: Clock,
    },
    {
      num: 3,
      name: "ACID Outbox Insert",
      subtitle: "PostgreSQL 18 uuidv7()",
      desc: "Transactional event write with SKIP LOCKED guaranteeing zero dual-write loss.",
      active: hasItemsInCart,
      icon: Database,
    },
    {
      num: 4,
      name: "Stage 2 BullMQ Worker",
      subtitle: "LISTEN/NOTIFY + OTLP Traces",
      desc: "Async worker daemon commits inventory and triggers Next.js ISR tag purges.",
      active: true,
      icon: Layers,
    },
  ];

  const steps = showTech ? techSteps : consumerSteps;

  return (
    <div className="mb-12 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-neutral-100 pb-4 mb-5 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 text-white text-xs font-bold">
            {showTech ? (
              <Code2 className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4 text-amber-400" />
            )}
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900">
              {showTech
                ? "Engineered Infrastructure Architecture"
                : "The Nexus Direct-to-Consumer Promise"}
            </h3>
            <p className="text-[11px] text-neutral-500">
              {showTech
                ? "Live telemetry across Valkey 9.1, PostgreSQL 18 AIO, and BullMQ worker daemons"
                : "Real-time inventory locks, bank-grade transaction shields, and priority courier handoff"}
            </p>
          </div>
        </div>

        {/* Toggle between Consumer View and Tech Architecture */}
        <button
          type="button"
          onClick={() => setShowTech(!showTech)}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700 transition-all shadow-2xs"
        >
          <Code2 className="h-3.5 w-3.5 text-neutral-500" />
          <span>{showTech ? "Show Consumer Journey" : "View Technical Architecture"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.num}
              className={`relative rounded-xl border p-4 transition-all ${
                step.active
                  ? "border-neutral-900/10 bg-neutral-50/70 shadow-2xs"
                  : "border-neutral-100 bg-white opacity-75"
              }`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-950 text-[10px] font-black text-white">
                    {step.num}
                  </span>
                  <Icon className="h-4 w-4 text-neutral-500" />
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    step.active
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-neutral-100 text-neutral-500"
                  }`}
                >
                  {step.active ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      Active
                    </>
                  ) : (
                    "Ready"
                  )}
                </span>
              </div>
              <h4 className="text-xs font-bold text-neutral-900">{step.name}</h4>
              <p className="text-[11px] font-semibold text-neutral-600 mt-0.5">{step.subtitle}</p>
              <p className="text-[11px] text-neutral-400 mt-1 leading-snug">{step.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
