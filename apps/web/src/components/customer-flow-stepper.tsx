"use client";

import { CheckCircle2, Clock, Database, Layers, ShieldCheck, Zap } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { useSession } from "@/lib/auth-client";

export function CustomerFlowStepper() {
  const { data: session } = useSession();
  const { totalItemCount } = useCart();

  const isAuthenticated = !!session?.user;
  const hasItemsInCart = totalItemCount > 0;

  const steps = [
    {
      num: 1,
      name: "Authentication",
      tech: "Valkey 9.1 Session (0.7ms)",
      desc: "Sub-millisecond RBAC check served from secondaryStorage",
      active: isAuthenticated,
      icon: ShieldCheck,
      color: "emerald",
    },
    {
      num: 2,
      name: "Stock Hold",
      tech: "HEXPIRE Dynamic HVALS",
      desc: "10-minute hold with zero sweeper overhead & zero race condition",
      active: hasItemsInCart,
      icon: Clock,
      color: "amber",
    },
    {
      num: 3,
      name: "ACID Outbox",
      tech: "PG 18 uuidv7() + SKIP LOCKED",
      desc: "Transactional event insert guaranteeing zero dual-write traps",
      active: hasItemsInCart,
      icon: Database,
      color: "blue",
    },
    {
      num: 4,
      name: "Queue Fulfillment",
      tech: "BullMQ + OTLP Tracing",
      desc: "Async workers commit stock & trigger Next.js cache purge",
      active: true,
      icon: Layers,
      color: "purple",
    },
  ];

  return (
    <div className="mb-10 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
            End-to-End Architectural Customer Journey
          </h3>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Reactive Pipeline
        </span>
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
                  : "border-neutral-100 bg-white opacity-70"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-black text-white">
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
              <h4 className="text-sm font-bold text-neutral-900">{step.name}</h4>
              <p className="font-mono text-[11px] font-bold text-neutral-700 mt-0.5">{step.tech}</p>
              <p className="text-[11px] text-neutral-500 mt-1 leading-snug">{step.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
