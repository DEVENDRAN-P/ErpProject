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
  const [attributes, setAttributes] = useState([{
    key: "power",
    label: "Power",
    value: "15 kW",
    confidence: 95,
    source: "Source placeholder",
    evidence: "Extracted from document",
    status: "verified",
  }] as ProductCreateInput["attributes"]);
  const [reviewItems, setReviewItems] = useState([{
    title: "Missing dimensions",
    item_type: "missing",
    description: "Dimensions are not available in the source document.",
    action: "Review",
    status: "pending",
  }] as ProductCreateInput["review_items"]);
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
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Product workflow</h2>
          <p className="text-sm text-slate-400">Ingest product metadata and run the AI processing pipeline.</p>
        </div>
        <div className="text-sm text-slate-400">Steps completed: {summary.steps}</div>
      </div>

      <form onSubmit={handleWorkflow} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-slate-300">
            Product name
            <input value={productName} onChange={(event) => setProductName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500" />
          </label>
          <label className="block text-sm text-slate-300">
            Model number
            <input value={modelNumber} onChange={(event) => setModelNumber(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500" />
          </label>
          <label className="block text-sm text-slate-300 md:col-span-2">
            Category
            <input value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500" />
          </label>
          <label className="block text-sm text-slate-300 md:col-span-2">
            Description
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500" />
          </label>
          <label className="block text-sm text-slate-300 md:col-span-2">
            Upload product asset
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none file:mr-4 file:rounded-full file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:text-sm file:font-semibold"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <button type="button" onClick={handleIngest} className="rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
            Save product
          </button>
          <button type="submit" className="rounded-xl bg-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-600">
            Run processing workflow
          </button>
        </div>
      </form>

      {statusMessage ? <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-200">{statusMessage}</div> : null}

      {workflowResult ? (
        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
          <h3 className="text-lg font-semibold text-white">Pipeline output</h3>
          <pre className="mt-4 max-h-96 overflow-auto rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-300">
            {JSON.stringify(workflowResult, null, 2)}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
