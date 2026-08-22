"use client";

import { useMemo, useState } from "react";
import { ProductCreateInput, ingestProduct, processWorkflow } from "@/lib/api";

type ProcessResult = {
  document?: Record<string, unknown>;
  vision?: Record<string, unknown>;
  enrichment?: Record<string, unknown>;
  validation?: Record<string, unknown>;
  explainability?: Record<string, unknown>;
  knowledge_graph?: Record<string, unknown>;
  export?: Record<string, unknown>;
};

export default function ProductWorkflow() {
  const [productName, setProductName] = useState("");
  const [modelNumber, setModelNumber] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [attributes, setAttributes] = useState([] as ProductCreateInput["attributes"]);
  const [reviewItems, setReviewItems] = useState([] as ProductCreateInput["review_items"]);
  const [workflowResult, setWorkflowResult] = useState<ProcessResult | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const handleIngest = async () => {
    setStatusMessage("Saving product…");
    try {
      const product: ProductCreateInput = {
        name: productName,
        model_number: modelNumber,
        category,
        description,
        attributes,
        review_items: reviewItems,
      };
      await ingestProduct(product);
      setStatusMessage("Product ingested successfully.");
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Unable to ingest product.");
    }
  };

  const handleWorkflow = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("Processing workflow…");
    const formData = new FormData();
    formData.append("text", `${productName} ${description}`);
    if (file) {
      formData.append("file", file);
    }
    try {
      const result = await processWorkflow(formData);
      setWorkflowResult(result);
      setStatusMessage("Workflow completed.");
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Workflow failed.");
    }
  };

  const summary = useMemo(() => {
    if (!workflowResult) return { steps: 0 };
    return { steps: Object.keys(workflowResult).length };
  }, [workflowResult]);

  return (
    <section className="rounded-3xl border p-8" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Product workflow</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Ingest product metadata and run the AI processing pipeline.</p>
        </div>
        <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Steps completed: {summary.steps}</div>
      </div>

      <form onSubmit={handleWorkflow} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm" style={{ color: "var(--text-secondary)" }}>
            Product name
            <input value={productName} onChange={(event) => setProductName(event.target.value)}
              className="mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none"
              style={{ borderColor: "var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)" }} />
          </label>
          <label className="block text-sm" style={{ color: "var(--text-secondary)" }}>
            Model number
            <input value={modelNumber} onChange={(event) => setModelNumber(event.target.value)}
              className="mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none"
              style={{ borderColor: "var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)" }} />
          </label>
          <label className="block text-sm md:col-span-2" style={{ color: "var(--text-secondary)" }}>
            Category
            <input value={category} onChange={(event) => setCategory(event.target.value)}
              className="mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none"
              style={{ borderColor: "var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)" }} />
          </label>
          <label className="block text-sm md:col-span-2" style={{ color: "var(--text-secondary)" }}>
            Description
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4}
              className="mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none"
              style={{ borderColor: "var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)" }} />
          </label>
          <label className="block text-sm md:col-span-2" style={{ color: "var(--text-secondary)" }}>
            Upload product asset
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none file:mr-4 file:rounded-full file:border-0 file:px-4 file:py-2 file:text-sm file:font-semibold"
              style={{ borderColor: "var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)" } as any}
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <button type="button" onClick={handleIngest}
            className="rounded-xl px-4 py-3 text-sm font-semibold transition"
            style={{ background: "var(--accent-primary)", color: "var(--text-inverse)" }}>
            Save product
          </button>
          <button type="submit"
            className="rounded-xl border px-4 py-3 text-sm font-semibold transition"
            style={{ borderColor: "var(--border-default)", background: "var(--bg-card)", color: "var(--text-secondary)" }}>
            Run processing workflow
          </button>
        </div>
      </form>

      {statusMessage ? (
        <div className="mt-6 rounded-2xl border px-4 py-3 text-sm"
          style={{ borderColor: "var(--border-default)", background: "var(--neutral-50)", color: "var(--text-primary)" }}>
          {statusMessage}
        </div>
      ) : null}

      {workflowResult ? (
        <div className="mt-6 rounded-3xl border p-6 space-y-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>✓ Pipeline Output & Verified Data</h3>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Data Analyzed & Ready
            </span>
          </div>

          <pre className="max-h-96 overflow-auto rounded-2xl border p-4 text-xs font-mono"
            style={{ borderColor: "var(--border-default)", background: "var(--neutral-50)", color: "var(--text-secondary)" }}>
            {JSON.stringify(workflowResult, null, 2)}
          </pre>

          {/* Action Buttons: Store and Move to Dashboard */}
          <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center gap-3">
            <button
              onClick={handleIngest}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl text-white shadow-sm transition hover:opacity-95"
              style={{ background: "var(--accent-primary)" }}
            >
              💾 Store & Save Product Data
            </button>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl text-white shadow-sm transition hover:opacity-95"
              style={{ background: "#0F766E" }}
            >
              📊 Move to Dashboard & View ProductTwin →
            </a>
            <a
              href="/dashboard?view=graph"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl border transition"
              style={{ borderColor: "var(--border-default)", background: "var(--bg-card)", color: "var(--text-primary)" }}
            >
              🕸️ View Knowledge Graph
            </a>
          </div>
        </div>
      ) : null}
    </section>
  );
}
