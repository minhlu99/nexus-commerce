import { setPhysicalStock } from "@nexus/kv";
import { db, inventory, products, productVariants, stores } from "./src/index.js";

async function seed() {
  console.log("🌱 Seeding Nexus Commerce Database...");

  try {
    // 1. Create Demo Store
    const [store] = await db
      .insert(stores)
      .values({
        name: "Apex Electronics Flagship",
        slug: "apex-electronics",
        description: "Official Flagship store for premium gear",
        ownerId: "user_owner_001",
      })
      .onConflictDoNothing()
      .returning();

    if (!store) {
      console.log("Store already exists, skipping seed.");
      process.exit(0);
    }

    // 2. Create Flagship Product
    const [product] = await db
      .insert(products)
      .values({
        storeId: store.id,
        title: "Nexus Pro ANC Studio Headphones",
        slug: "nexus-pro-anc",
        description: "Studio-grade wireless active noise cancelling headphones.",
        category: "Audio",
        isPublished: true,
      })
      .returning();

    // 3. Create Variants (SKUs)
    const [variantBlack] = await db
      .insert(productVariants)
      .values({
        productId: product!.id,
        sku: "NEX-PRO-BLK",
        name: "Matte Black",
        priceInCents: 34900, // $349.00
        attributes: { color: "Matte Black", edition: "Standard" },
      })
      .returning();

    const [variantSilver] = await db
      .insert(productVariants)
      .values({
        productId: product!.id,
        sku: "NEX-PRO-SLV",
        name: "Silver Frost",
        priceInCents: 34900,
        attributes: { color: "Silver Frost", edition: "Standard" },
      })
      .returning();

    // 4. Initialize Inventory (PostgreSQL & Valkey)
    await db.insert(inventory).values([
      {
        variantId: variantBlack!.id,
        totalPhysicalStock: 100,
        lowStockThreshold: 10,
      },
      {
        variantId: variantSilver!.id,
        totalPhysicalStock: 50,
        lowStockThreshold: 5,
      },
    ]);

    await setPhysicalStock("NEX-PRO-BLK", 100);
    await setPhysicalStock("NEX-PRO-SLV", 50);

    console.log(
      "✅ Seed completed successfully! Created store, product, variants, and stock in PG & Valkey.",
    );
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  }
}

seed();
