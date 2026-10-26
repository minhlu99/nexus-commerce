import { db, eq, products, productVariants } from "@nexus/db";
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

    return c.json({ data: { ...product, variants } });
  });
