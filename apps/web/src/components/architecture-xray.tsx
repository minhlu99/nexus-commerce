"use client";

import { Activity, ChevronDown, ChevronUp, ExternalLink, Zap } from "lucide-react";
import { useState } from "react";

export function ArchitectureXRay() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <aside aria-label="Architecture X-Ray Telemetry" className="fixed bottom-4 right-4 z-40">
      {isOpen && (
        <div className="mb-3 w-80 sm:w-96 rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl backdrop-blur-md transition-all">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600 animate-pulse" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                Architecture X-Ray Telemetry
              </h4>
            </div>
            <a
              href="http://localhost:16686"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800"
            >
              Open Jaeger UI
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Telemetry Breakdown */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 border border-neutral-100">
              <span className="font-medium text-neutral-600">Auth Validation</span>
              <span className="font-mono font-bold text-emerald-600">~0.74ms (Valkey)</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 border border-neutral-100">
              <span className="font-medium text-neutral-600">Stock Hold (HEXPIRE)</span>
              <span className="font-mono font-bold text-amber-600">~4.30ms (Lua HVALS)</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 border border-neutral-100">
              <span className="font-medium text-neutral-600">ACID Transaction</span>
              <span className="font-mono font-bold text-blue-600">~29.09ms (PG 18 uuidv7)</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 border border-neutral-100">
              <span className="font-medium text-neutral-600">BullMQ Relay & Fulfillment</span>
              <span className="font-mono font-bold text-purple-600">~25.27ms (Valkey Worker)</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
            <span>Trace Context: W3C traceparent</span>
            <span className="font-bold text-emerald-700">BatchSpanProcessor</span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-neutral-800 transition-transform active:scale-95"
      >
        <Zap className="h-3.5 w-3.5 text-amber-400" />
        <span>Architecture X-Ray</span>
        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
      </button>
    </aside>
  );
}
