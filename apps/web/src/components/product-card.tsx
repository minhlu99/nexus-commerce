"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Headphones, Package, Star } from "lucide-react";
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
  availableStock?: number;
  activeHolds?: number;
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
  const [isAdded, setIsAdded] = useState(false);

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

    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
    }, 1800);
  };

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs hover:shadow-xl transition-all duration-300 group">
      <div>
        {/* Product Visual Showcase Box */}
        <div className="relative mb-5 flex h-48 w-full items-center justify-center rounded-xl bg-gradient-to-b from-neutral-900 to-neutral-950 p-6 text-white overflow-hidden shadow-inner">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.08),transparent_70%)]" />
          <div className="relative flex flex-col items-center justify-center transform group-hover:scale-105 transition-transform duration-500">
            <Headphones className="h-20 w-20 text-neutral-200 stroke-[1.25] drop-shadow-md" />
            <span className="mt-2 text-[10px] font-mono tracking-widest text-neutral-400 uppercase">
              {selectedVariant?.name || "Studio Master Edition"}
            </span>
          </div>

          <div className="absolute top-3 left-3 rounded-full bg-black/40 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold text-neutral-300 border border-white/10 uppercase tracking-wider">
            {product.category}
          </div>

          <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-emerald-950/80 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            In Stock
          </div>
        </div>

        {/* Rating & Social Proof */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center text-amber-400">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className="h-3.5 w-3.5 fill-amber-400" />
            ))}
          </div>
          <span className="text-xs font-bold text-neutral-900">4.9</span>
          <span className="text-xs text-neutral-400">(1,240 Verified Listeners)</span>
        </div>

        {/* Title & Description */}
        <h3 className="text-lg font-black text-neutral-900 tracking-tight leading-snug">
          {product.title}
        </h3>
        <p className="mt-1.5 text-xs text-neutral-500 line-clamp-2 leading-relaxed">
          {detailData?.description ||
            "Custom 40mm titanium drivers, lossless LDAC streaming, and 50-hour continuous playback."}
        </p>

        {/* Variant Selection */}
        {isLoading ? (
          <div className="mt-4 h-9 animate-pulse rounded-lg bg-neutral-100" />
        ) : (
          variants.length > 0 && (
            <div className="mt-4">
              <span className="text-[11px] font-bold text-neutral-700 block mb-2">
                Color Finish & Edition
              </span>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all ${
                        isSelected
                          ? "border-neutral-900 bg-neutral-950 text-white shadow-xs"
                          : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-emerald-400" />}
                      {v.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )
        )}

        {/* Direct Inventory Batch Meter */}
        {selectedVariant && (
          <div className="mt-4 rounded-xl bg-neutral-50 p-3 border border-neutral-100">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-neutral-700">Studio Batch Availability</span>
              <span className="font-mono font-bold text-neutral-900">
                {selectedVariant.availableStock ?? 0} units remaining
              </span>
            </div>
            <div className="h-1.5 w-full bg-neutral-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  (selectedVariant.availableStock ?? 0) < 10
                    ? "bg-rose-500"
                    : (selectedVariant.availableStock ?? 0) < 30
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
                style={{
                  width: `${Math.min(100, Math.max(5, ((selectedVariant.availableStock ?? 0) / 100) * 100))}%`,
                }}
              />
            </div>
            {(selectedVariant.activeHolds ?? 0) > 0 ? (
              <p className="mt-2 text-[11px] font-semibold text-amber-700 flex items-center gap-1.5">
                <span>🔥</span>
                <span>High demand: {selectedVariant.activeHolds} listener(s) holding in cart</span>
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] text-neutral-400">
                Guaranteed immediate factory allocation
              </p>
            )}
          </div>
        )}
      </div>

      {/* Pricing & Add to Cart */}
      <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-neutral-400 block font-semibold uppercase tracking-wider">
            Direct Studio Price
          </span>
          <span className="text-xl font-black text-neutral-900">
            {selectedVariant ? `$${(selectedVariant.priceInCents / 100).toFixed(2)}` : "—"}
          </span>
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!selectedVariant || isOutOfStock}
          className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all duration-200 ${
            isAdded
              ? "bg-emerald-600 text-white scale-[1.03] shadow-md shadow-emerald-600/20"
              : "bg-neutral-950 text-white shadow-xs hover:bg-neutral-800 hover:scale-[1.02] active:scale-[0.98]"
          } disabled:opacity-50`}
        >
          {isAdded ? (
            <>
              <Check className="h-3.5 w-3.5 text-white" />
              <span>Added to Bag</span>
            </>
          ) : (
            <>
              <Package className="h-3.5 w-3.5" />
              <span>Add to Bag</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
