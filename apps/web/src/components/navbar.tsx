"use client";

import {
  ChevronDown,
  LogOut,
  Package,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  User,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/context/cart-context";
import { signIn, signOut, signUp, useSession } from "@/lib/auth-client";

export function Navbar() {
  const { totalItemCount, openCart } = useCart();
  const { data: session, isPending } = useSession();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [animateBag, setAnimateBag] = useState(false);
  const prevCountRef = useRef(totalItemCount);

  // Trigger bounce effect on shopping bag whenever item count increases
  useEffect(() => {
    if (totalItemCount > prevCountRef.current) {
      setAnimateBag(true);
      const timer = setTimeout(() => setAnimateBag(false), 900);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = totalItemCount;
  }, [totalItemCount]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleQuickLogin = async (role: "customer" | "admin") => {
    setIsAuthenticating(true);
    setDropdownOpen(false);

    const email = role === "admin" ? "admin@nexus.com" : "demo.customer@nexus.com";
    const password = role === "admin" ? "AdminPassword123!" : "DemoPassword123!";
    const name = role === "admin" ? "Sarah Admin" : "Alex Customer";

    try {
      // 1. Attempt login
      const res = await signIn.email({ email, password });

      // 2. If user doesn't exist, register them
      if (res?.error) {
        await signUp.email({ email, password, name });
      }

      // 3. Reload window so all client & server components update instantly
      window.location.reload();
    } catch (err) {
      console.error("Demo login failed:", err);
      window.location.reload();
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await signOut();
    window.location.reload();
  };

  const user = session?.user;
  const userRole = (user as { role?: string })?.role || "customer";
  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "U";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-950 text-white font-black shadow-xs group-hover:scale-105 transition-transform">
            ⚡
          </div>
          <div>
            <span className="text-lg font-black tracking-tighter text-neutral-900 block leading-none">
              NEXUS
            </span>
            <span className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase mt-0.5 block">
              Acoustic Labs
            </span>
          </div>
        </Link>

        {/* Navigation & Controls */}
        <div className="flex items-center gap-3">
          {/* User Account / Auth Dropdown */}
          <div className="relative" ref={dropdownRef}>
            {isPending ? (
              <div className="h-9 w-28 animate-pulse rounded-full bg-neutral-100" />
            ) : user ? (
              // LOGGED IN STATE
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50/80 hover:bg-neutral-100/80 px-3 py-1.5 transition-all text-left shadow-2xs"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-bold text-white">
                  {userInitials}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold text-neutral-900 leading-tight">
                    {user.name}
                  </div>
                  <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">
                    {userRole === "admin" ? "Store Admin" : "Verified Shopper"}
                  </div>
                </div>
                <ChevronDown className="h-3 w-3 text-neutral-400 ml-1" />
              </button>
            ) : (
              // LOGGED OUT STATE
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                disabled={isAuthenticating}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-bold text-neutral-800 shadow-xs hover:bg-neutral-50 transition-all disabled:opacity-50"
              >
                <User className="h-3.5 w-3.5 text-neutral-500" />
                <span>{isAuthenticating ? "Signing In..." : "Account & Demo"}</span>
                <ChevronDown className="h-3 w-3 text-neutral-400" />
              </button>
            )}

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {user ? (
                  // Logged In Menu
                  <div>
                    <div className="border-b border-neutral-100 pb-3 mb-2 px-2">
                      <div className="text-[11px] text-neutral-400 uppercase font-bold tracking-wider">
                        Signed in as
                      </div>
                      <div className="text-xs font-bold text-neutral-900 mt-0.5 truncate">
                        {user.email}
                      </div>
                      <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        <UserCheck className="h-3 w-3" />
                        {userRole === "admin" ? "Administrator Access" : "Customer Tier"}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Link
                        href="/orders"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                      >
                        <Package className="h-3.5 w-3.5 text-neutral-500" />
                        <span>My Order History</span>
                      </Link>

                      {userRole === "admin" && (
                        <Link
                          href="/admin"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-purple-700 hover:bg-purple-50 transition-colors"
                        >
                          <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />
                          <span>Admin War Room</span>
                        </Link>
                      )}

                      <div className="border-t border-neutral-100 pt-2 mt-2">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 px-2.5 mb-1.5">
                          Switch Persona
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleQuickLogin(userRole === "admin" ? "customer" : "admin")
                          }
                          className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 text-left"
                        >
                          <span>Switch to {userRole === "admin" ? "Customer" : "Admin"}</span>
                          <Sparkles className="h-3 w-3 text-amber-500" />
                        </button>
                      </div>

                      <div className="border-t border-neutral-100 pt-1 mt-1">
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 text-left transition-colors"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Logged Out Menu
                  <div>
                    <div className="px-2 pb-2.5 mb-2 border-b border-neutral-100">
                      <div className="text-xs font-bold text-neutral-900">
                        Select a Demo Persona
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5 leading-snug">
                        Test instant Better Auth session validation and role-based permissions:
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => handleQuickLogin("customer")}
                        className="w-full flex items-center justify-between gap-2 rounded-xl p-2.5 text-left hover:bg-neutral-50 transition-colors group border border-transparent hover:border-neutral-200/60"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">
                            AC
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-neutral-900 group-hover:text-emerald-700 truncate">
                              Alex Customer
                            </div>
                            <div className="text-[10px] text-neutral-400 truncate">
                              demo.customer@nexus.com
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                          Customer
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickLogin("admin")}
                        className="w-full flex items-center justify-between gap-2 rounded-xl p-2.5 text-left hover:bg-neutral-50 transition-colors group border border-transparent hover:border-neutral-200/60"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-800 text-xs font-bold">
                            SA
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-neutral-900 group-hover:text-purple-700 truncate">
                              Sarah Admin
                            </div>
                            <div className="text-[10px] text-neutral-400 truncate">
                              admin@nexus.com
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-full">
                          Admin
                        </span>
                      </button>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-neutral-100 text-center">
                      <Link
                        href="/auth/login"
                        onClick={() => setDropdownOpen(false)}
                        className="text-xs font-bold text-neutral-700 hover:text-neutral-900 hover:underline inline-block"
                      >
                        Manual Email & Password Login &rarr;
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Orders Link */}
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-bold text-neutral-700 shadow-2xs hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
          >
            <Package className="h-3.5 w-3.5 text-neutral-500" />
            <span className="hidden sm:inline">Orders</span>
          </Link>

          {/* Admin Control Center Link */}
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-bold text-neutral-700 shadow-2xs hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-neutral-500" />
            <span className="hidden sm:inline">War Room</span>
          </Link>

          {/* Shopping Bag Trigger with Dynamic Addition Animation */}
          <button
            type="button"
            onClick={openCart}
            className={`relative flex h-9 w-9 items-center justify-center rounded-full bg-neutral-950 text-white shadow-xs transition-all ${
              animateBag
                ? "scale-125 ring-4 ring-emerald-500/40 bg-emerald-950"
                : "hover:bg-neutral-800 hover:scale-105 active:scale-95"
            }`}
            aria-label="Shopping Cart"
          >
            <ShoppingBag
              className={`h-4 w-4 transition-transform ${animateBag ? "scale-110 text-emerald-400" : ""}`}
            />
            {totalItemCount > 0 && (
              <span
                className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white shadow-xs transition-all ${
                  animateBag ? "scale-125 bg-emerald-400 ring-2 ring-white" : ""
                }`}
              >
                {totalItemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
