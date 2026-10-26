import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CartDrawer } from "@/components/cart-drawer";
import { Navbar } from "@/components/navbar";
import { Providers } from "@/components/providers";
import { CartProvider } from "@/context/cart-context";

export const metadata: Metadata = {
  title: "Nexus Commerce | High-Concurrency Modern E-Commerce",
  description: "Next.js 16 + Hono RPC + PostgreSQL 18 AIO + Valkey 9.1",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50/50 text-neutral-900 antialiased">
        <Providers>
          <CartProvider>
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <div className="flex-1">{children}</div>
              <CartDrawer />
            </div>
          </CartProvider>
        </Providers>
      </body>
    </html>
  );
}
