"use client";

import { useEffect, useState } from "react";
import { ProductRead } from "@/lib/types";
import { fetchProducts } from "@/lib/api";

export default function ProductDashboard() {
  const [products, setProducts] = useState<ProductRead[]>([]);
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadProducts();
  }, []);

  const loadProducts = async (search = "") => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProducts(search);
      setProducts(data);
      if (data.length > 0 && !selectedProduct) {
        setSelectedProduct(data[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Product dashboard</h2>
          <p className="text-sm text-slate-400">Browse ingested products and search by category or name.</p>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products"
            className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500 sm:w-72"
          />
          <button
            onClick={() => void loadProducts(query)}
            className="rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            Search
          </button>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          {loading ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 text-slate-400">Loading products…</div>
          ) : products.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 text-slate-400">No products ingested yet.</div>
          ) : (
            products.map((product) => (
              <button
                type="button"
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="w-full rounded-3xl border border-slate-800 bg-slate-950/70 p-6 text-left transition hover:border-cyan-500"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{product.name}</h3>
                    <p className="text-sm text-slate-400">{product.category || "Uncategorized"}</p>
                  </div>
                  <div className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300">Health {product.health_score}/100</div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-300">{product.description || "No description available."}</p>
              </button>
            ))
          )}
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
          <h3 className="text-xl font-semibold text-white">Selected product</h3>
          {!selectedProduct ? (
            <p className="mt-4 text-sm text-slate-400">Select a product to see details.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-sm uppercase tracking-[0.24em] text-slate-500">Summary</div>
                <p className="mt-2 text-base text-slate-200">{selectedProduct.description || "No description available."}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-900/90 p-4">
                  <div className="text-sm text-slate-500">Category</div>
                  <div className="mt-2 text-base text-white">{selectedProduct.category || "Uncategorized"}</div>
                </div>
                <div className="rounded-2xl bg-slate-900/90 p-4">
                  <div className="text-sm text-slate-500">Health score</div>
                  <div className="mt-2 text-base text-white">{selectedProduct.health_score}/100</div>
                </div>
              </div>
              <div className="rounded-2xl bg-slate-900/90 p-4">
                <div className="text-sm text-slate-500">Attributes</div>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  {selectedProduct.attributes.length > 0 ? (
                    selectedProduct.attributes.map((attribute) => (
                      <li key={attribute.id} className="rounded-2xl bg-slate-950/80 p-3">
                        <div className="font-semibold text-white">{attribute.label}</div>
                        <div className="text-slate-400">{attribute.value || "No value"}</div>
                        <div className="mt-1 text-xs text-slate-500">{attribute.status || "unknown"}</div>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-500">No product attributes available.</li>
                  )}
                </ul>
              </div>
              <div className="rounded-2xl bg-slate-900/90 p-4">
                <div className="text-sm text-slate-500">Review checklist</div>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  {selectedProduct.review_items.length > 0 ? (
                    selectedProduct.review_items.map((item) => (
                      <li key={item.id} className="rounded-2xl bg-slate-950/80 p-3">
                        <div className="font-semibold text-white">{item.title}</div>
                        <div className="text-slate-400">{item.description || "No description."}</div>
                        <div className="mt-1 text-xs text-slate-500">{item.status || "pending"}</div>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-500">No review items available.</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
