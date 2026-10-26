import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Nexus Commerce | High-Concurrency Modern E-Commerce",
  description: "Next.js 16 + Hono RPC + PostgreSQL 18 AIO + Valkey 9.1",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, -apple-system, sans-serif", margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
