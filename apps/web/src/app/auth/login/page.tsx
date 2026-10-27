"use client";

import { ArrowLeft, Lock, Mail, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn, signUp } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await signIn.email({ email, password });
      if (res?.error) {
        setErrorMsg(res.error.message || "Invalid email or password");
        return;
      }
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPersona = async (role: "customer" | "admin") => {
    setIsLoading(true);
    setErrorMsg(null);

    const targetEmail = role === "admin" ? "admin@nexus.com" : "demo.customer@nexus.com";
    const targetPassword = role === "admin" ? "AdminPassword123!" : "DemoPassword123!";
    const targetName = role === "admin" ? "Sarah Admin" : "Alex Customer";

    try {
      const res = await signIn.email({ email: targetEmail, password: targetPassword });
      if (res?.error) {
        // Register if not yet seeded
        await signUp.email({
          email: targetEmail,
          password: targetPassword,
          name: targetName,
        });
      }
      window.location.href = "/";
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Demo sign in failed";
      setErrorMsg(message);
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-xl">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-neutral-900 mb-6 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Nexus Acoustics
        </Link>

        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-950 text-white font-black text-xl shadow-xs mb-3">
            ⚡
          </div>
          <h1 className="text-2xl font-black tracking-tight text-neutral-900">Welcome to Nexus</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Access your direct-to-consumer acoustic studio account
          </p>
        </div>

        {/* 1-Click Persona Quick Access */}
        <div className="mb-6 p-4 rounded-xl border border-neutral-200 bg-neutral-50/70">
          <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800 mb-2.5">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>1-Click Demo Profiles</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickPersona("customer")}
              disabled={isLoading}
              className="p-2.5 rounded-lg border border-neutral-200 bg-white hover:border-emerald-500 hover:bg-emerald-50/50 text-left transition-all disabled:opacity-50 group"
            >
              <div className="text-xs font-bold text-neutral-900 group-hover:text-emerald-700">
                Alex Customer
              </div>
              <div className="text-[10px] text-neutral-400 mt-0.5">Verified Shopper</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickPersona("admin")}
              disabled={isLoading}
              className="p-2.5 rounded-lg border border-neutral-200 bg-white hover:border-purple-500 hover:bg-purple-50/50 text-left transition-all disabled:opacity-50 group"
            >
              <div className="text-xs font-bold text-neutral-900 group-hover:text-purple-700">
                Sarah Admin
              </div>
              <div className="text-[10px] text-neutral-400 mt-0.5">Store Administrator</div>
            </button>
          </div>
        </div>

        <div className="relative mb-6 text-center text-xs text-neutral-400">
          <span className="relative z-10 bg-white px-2">or sign in with email</span>
          <div className="absolute inset-0 top-1/2 border-t border-neutral-100" />
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            {errorMsg}
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleManualLogin} className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-bold text-neutral-700 mb-1.5"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@nexus.com"
                className="w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-4 py-2.5 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-bold text-neutral-700 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-4 py-2.5 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-neutral-950 py-3 text-xs font-bold text-white shadow-xs hover:bg-neutral-800 transition-all disabled:opacity-50"
          >
            {isLoading ? "Authenticating..." : "Sign In to Nexus"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-neutral-400">
          Protected by Better Auth &bull; 256-bit encrypted session
        </div>
      </div>
    </main>
  );
}
