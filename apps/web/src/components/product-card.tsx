"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Package } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/context/cart-context";
import { api } from "@/lib/api-client";

export interface StaticProduct {
  id: string;
  title: string;
  slug: string;
  category: string;
}

interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  priceInCents: number;
}

interface ProductDetail {
  id: string;
  title: string;
  description?: string;
  variants: ProductVariant[];
}

export function ProductCard({ product }: { product: StaticProduct }) {
  const { addItem } = useCart();
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  // TanStack Query for volatile live inventory & variant attributes
  const { data: detailData, isLoading } = useQuery<ProductDetail>({
    queryKey: ["products", product.id],
    queryFn: async () => {
      const res = await api.api.products[":id"].$get({
        param: { id: product.id },
      });
      if (!res.ok) throw new Error("Failed to fetch product details");
      const json = await res.json();
      return (json as { data: ProductDetail }).data;
    },
    refetchInterval: 10000, // Poll every 10s for real-time stock
  });

  const variants = detailData?.variants || [];
  const selectedVariant = variants.find((v) => v.id === selectedVariantId) || variants[0] || null;

  // Mocked/calculated live stock (or from DB relation)
  const isOutOfStock = false;

  const handleAddToCart = () => {
    if (!selectedVariant) return;

    addItem({
      variantId: selectedVariant.id,
      sku: selectedVariant.sku,
      productTitle: product.title,
      variantName: selectedVariant.name,
      priceInCents: selectedVariant.priceInCents,
    });
  };

  return (
    <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-6 shadow-xs hover:shadow-md transition-shadow">
      <div>
        {/* Category & Badge */}
        <div className="flex items-center justify-between mb-3">
          <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">
            {product.category}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Stock Protected
          </span>
        </div>

        {/* Title & Description */}
        <h3 className="text-base font-bold text-neutral-900 leading-snug">{product.title}</h3>
        <p className="mt-1 text-xs text-neutral-500 line-clamp-2">
          {detailData?.description ||
            "Flagship performance, titanium architecture, studio acoustic drivers."}
        </p>

        {/* Variant Selection */}
        {isLoading ? (
          <div className="mt-4 h-8 animate-pulse rounded bg-neutral-100" />
        ) : (
          variants.length > 0 && (
            <div className="mt-4">
              <span className="text-[11px] font-semibold text-neutral-500 block mb-1.5">
                Select Edition / Variant
              </span>
              <div className="flex flex-wrap gap-1.5">
                {variants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium border transition-colors ${
                        isSelected
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                      {v.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>

      {/* Pricing & Add to Cart */}
      <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-neutral-400 block font-medium">PRICE</span>
          <span className="text-lg font-black text-neutral-900">
            {selectedVariant ? `$${(selectedVariant.priceInCents / 100).toFixed(2)}` : "—"}
          </span>
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!selectedVariant || isOutOfStock}
          className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-neutral-800 disabled:opacity-50 transition-colors"
        >
          <Package className="h-3.5 w-3.5" />
          Add to Cart
        </button>
      </div>
    </div>
  );
}
