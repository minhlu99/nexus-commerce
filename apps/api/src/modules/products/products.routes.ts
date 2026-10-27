import { db, eq, products, productVariants } from "@nexus/db";
import { getActiveHoldsCount, getPhysicalStock } from "@nexus/kv";
import { Hono } from "hono";

export const productsRoutes = new Hono()
  .get("/", async (c) => {
    const allProducts = await db
      .select({
        id: products.id,
        title: products.title,
        slug: products.slug,
        category: products.category,
      })
      .from(products)
      .where(eq(products.isPublished, true))
      .limit(50);

    return c.json({ data: allProducts });
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");

    const product = await db.query.products.findFirst({
      where: eq(products.id, id),
    });

    if (!product) {
      return c.json({ error: "Product not found" }, 404);
    }

    const variants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, id));

    const variantsWithStock = await Promise.all(
      variants.map(async (v) => {
        const availableStock = await getPhysicalStock(v.sku);
        const activeHolds = await getActiveHoldsCount(v.sku);
        return {
          ...v,
          availableStock,
          activeHolds,
        };
      }),
    );

    return c.json({ data: { ...product, variants: variantsWithStock } });
  });
