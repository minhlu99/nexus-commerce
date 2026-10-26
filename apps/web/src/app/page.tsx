import { api } from "@/lib/api-client";

interface CatalogProduct {
  id: string;
  title: string;
  slug: string;
  category: string;
}

export default async function HomePage() {
  let products: CatalogProduct[] = [];
  try {
    const res = await api.api.products.$get();
    if (res.ok) {
      const json = await res.json();
      products = json.data;
    }
  } catch {
    // API server may be offline during initial bootstrap
  }

  return (
    <main style={{ padding: "48px", maxWidth: "900px", margin: "0 auto" }}>
      <header
        style={{ marginBottom: "32px", borderBottom: "1px solid #eaeaea", paddingBottom: "16px" }}
      >
        <h1 style={{ fontSize: "2.2rem", margin: "0 0 8px 0" }}>⚡ Nexus Commerce</h1>
        <p style={{ color: "#666", margin: 0 }}>
          High-Concurrency TypeScript Architecture (Next.js 16 + Hono RPC + PostgreSQL 18 AIO +
          Valkey 9.1)
        </p>
      </header>

      <section style={{ display: "grid", gap: "24px" }}>
        <div
          style={{
            padding: "20px",
            background: "#f8f9fa",
            borderRadius: "8px",
            border: "1px solid #e9ecef",
          }}
        >
          <h2 style={{ margin: "0 0 8px 0", fontSize: "1.2rem" }}>Architecture Status</h2>
          <ul style={{ margin: 0, paddingLeft: "20px", color: "#333", lineHeight: 1.8 }}>
            <li>
              <strong>Frontend:</strong> Next.js 16 App Router (RSC & Hono RPC)
            </li>
            <li>
              <strong>API:</strong> Hono Server (ACID Checkout + Transactional Outbox)
            </li>
            <li>
              <strong>Worker:</strong> Standalone Outbox Processor with SKIP LOCKED
            </li>
            <li>
              <strong>Database:</strong> PostgreSQL 18 (Native AIO worker + uuidv7)
            </li>
            <li>
              <strong>Cache/Locks:</strong> Valkey 9.1 (HEXPIRE Dynamic Holds + AOF Persistence)
            </li>
          </ul>
        </div>

        <div>
          <h2 style={{ fontSize: "1.4rem", margin: "0 0 16px 0" }}>Live Product Catalog</h2>
          {products.length === 0 ? (
            <p style={{ color: "#777", fontStyle: "italic" }}>
              Catalog is ready. Start the API server and run seed script to view products.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "16px",
              }}
            >
              {products.map((p) => (
                <div
                  key={p.id}
                  style={{ border: "1px solid #ddd", padding: "16px", borderRadius: "8px" }}
                >
                  <h3 style={{ margin: "0 0 8px 0", fontSize: "1.1rem" }}>{p.title}</h3>
                  <span
                    style={{
                      fontSize: "0.85rem",
                      background: "#eee",
                      padding: "3px 8px",
                      borderRadius: "4px",
                    }}
                  >
                    {p.category}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
