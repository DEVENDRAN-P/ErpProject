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
    <section className="rounded-3xl border p-8" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Product dashboard</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Browse ingested products and search by category or name.</p>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products"
            className="w-full rounded-xl border px-4 py-3 text-sm outline-none sm:w-72"
            style={{ borderColor: "var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)" }}
          />
          <button
            onClick={() => void loadProducts(query)}
            className="rounded-xl px-4 py-3 text-sm font-semibold transition"
            style={{ background: "var(--accent-primary)", color: "var(--text-inverse)" }}
          >
            Search
          </button>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          {loading ? (
            <div className="rounded-3xl border p-6" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)", color: "var(--text-muted)" }}>Loading products…</div>
          ) : products.length === 0 ? (
            <div className="rounded-3xl border p-6" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)", color: "var(--text-muted)" }}>No products ingested yet.</div>
          ) : (
            products.map((product) => (
              <button
                type="button"
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="w-full rounded-3xl border p-6 text-left transition"
                style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{product.name}</h3>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{product.category || "Uncategorized"}</p>
                  </div>
                  <div className="rounded-full px-3 py-1 text-sm" style={{ background: "var(--neutral-100)", color: "var(--text-secondary)" }}>Health {product.health_score}/100</div>
                </div>
                <p className="mt-4 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{product.description || "No description available."}</p>
              </button>
            ))
          )}
        </div>

        <div className="rounded-3xl border p-6" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
          <h3 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Selected product</h3>
          {!selectedProduct ? (
            <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>Select a product to see details.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-sm uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>Summary</div>
                <p className="mt-2 text-base" style={{ color: "var(--text-secondary)" }}>{selectedProduct.description || "No description available."}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl p-4" style={{ background: "var(--neutral-50)" }}>
                  <div className="text-sm" style={{ color: "var(--text-muted)" }}>Category</div>
                  <div className="mt-2 text-base" style={{ color: "var(--text-primary)" }}>{selectedProduct.category || "Uncategorized"}</div>
                </div>
                <div className="rounded-2xl p-4" style={{ background: "var(--neutral-50)" }}>
                  <div className="text-sm" style={{ color: "var(--text-muted)" }}>Health score</div>
                  <div className="mt-2 text-base" style={{ color: "var(--text-primary)" }}>{selectedProduct.health_score}/100</div>
                </div>
              </div>
              <div className="rounded-2xl p-4" style={{ background: "var(--neutral-50)" }}>
                <div className="text-sm" style={{ color: "var(--text-muted)" }}>Attributes</div>
                <ul className="mt-3 space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {selectedProduct.attributes.length > 0 ? (
                    selectedProduct.attributes.map((attribute) => (                        <li key={attribute.id} className="rounded-2xl p-3" style={{ background: "var(--bg-card)" }}>
                        <div className="font-semibold" style={{ color: "var(--text-primary)" }}>{attribute.label}</div>
                        <div style={{ color: "var(--text-secondary)" }}>{attribute.value || "No value"}</div>
                        <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{attribute.status || "unknown"}</div>
                      </li>
                    ))
                  ) : (
                    <li style={{ color: "var(--text-muted)" }}>No product attributes available.</li>
                  )}
                </ul>
              </div>
              <div className="rounded-2xl p-4" style={{ background: "var(--neutral-50)" }}>
                <div className="text-sm" style={{ color: "var(--text-muted)" }}>Review checklist</div>
                <ul className="mt-3 space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {selectedProduct.review_items.length > 0 ? (
                    selectedProduct.review_items.map((item) => (                        <li key={item.id} className="rounded-2xl p-3" style={{ background: "var(--bg-card)" }}>
                        <div className="font-semibold" style={{ color: "var(--text-primary)" }}>{item.title}</div>
                        <div style={{ color: "var(--text-secondary)" }}>{item.description || "No description."}</div>
                        <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{item.status || "pending"}</div>
                      </li>
                    ))
                  ) : (
                    <li style={{ color: "var(--text-muted)" }}>No review items available.</li>
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
