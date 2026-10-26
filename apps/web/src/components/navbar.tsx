"use client";

import { ShieldCheck, ShoppingBag, Sparkles, UserCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/context/cart-context";
import { signIn, signOut, signUp, useSession } from "@/lib/auth-client";

export function Navbar() {
  const { totalItemCount, openCart } = useCart();
  const { data: session, isPending } = useSession();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleDemoSignIn = async () => {
    setIsAuthenticating(true);
    try {
      // Try signing in first
      const res = await signIn.email({
        email: "demo.customer@nexus.com",
        password: "DemoPassword123!",
      });

      // If user doesn't exist, register demo account
      if (res.error) {
        await signUp.email({
          email: "demo.customer@nexus.com",
          password: "DemoPassword123!",
          name: "Alex Customer",
        });
      }
    } catch (err) {
      console.error("Demo login failed:", err);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white font-black">
            ⚡
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-neutral-900">
              Nexus Commerce
            </span>
            <span className="hidden ml-2 rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 sm:inline">
              Next.js 16 + Hono RPC
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Auth Bar */}
          {isPending ? (
            <div className="h-8 w-24 animate-pulse rounded bg-neutral-100" />
          ) : session?.user ? (
            <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs">
              <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span className="font-semibold text-neutral-800">{session.user.name}</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800 uppercase tracking-wider text-[10px]">
                {(session.user as { role?: string }).role || "Customer"}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="ml-1 text-neutral-500 hover:text-neutral-900"
                title="Sign Out"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDemoSignIn}
              disabled={isAuthenticating}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-xs hover:bg-neutral-50 hover:text-neutral-900 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              {isAuthenticating ? "Authenticating..." : "1-Click Demo Login"}
            </button>
          )}

          {/* Admin Control Center Link */}
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
            <span>Admin</span>
          </Link>

          {/* Cart Trigger */}
          <button
            type="button"
            onClick={openCart}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-xs hover:bg-neutral-50 hover:text-neutral-900"
            aria-label="Shopping Cart"
          >
            <ShoppingBag className="h-4 w-4" />
            {totalItemCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-bold text-white">
                {totalItemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
