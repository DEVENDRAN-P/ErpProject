"use client";

import { useState, useCallback, useRef, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { processWorkflow, processCsvWorkflow, ingestUrl, ingestProduct, ProductCreateInput } from "@/lib/api";
import { saveUserProduct } from "@/lib/firestoreService";
import {
  FileText, Globe, FileSpreadsheet, Camera, Keyboard, Upload, CheckCircle,
  Cloud, Circle, Loader2, ArrowRight, X
} from "lucide-react";
import { StatusBadgeFromStatus, EmptyState, ErrorState } from "@/components/ui";

type Mode = "pdf" | "csv" | "url" | "image" | "manual";
type UploadResult = { mode: Mode; data: any };

const MOTOR_ATTRIBUTES = [
  { key: "rated_power", label: "Rated Power", unit: "kW" },
  { key: "supply_voltage", label: "Supply Voltage", unit: "V" },
  { key: "rated_current", label: "Rated Current", unit: "A" },
  { key: "efficiency_class", label: "Efficiency Class", unit: "" },
  { key: "rated_speed", label: "Rated Speed", unit: "rpm" },
  { key: "max_temperature", label: "Max Temperature", unit: "°C" },
  { key: "frame_size", label: "Frame Size", unit: "" },
  { key: "total_weight", label: "Total Weight", unit: "kg" },
];

const MODES: { key: Mode; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: "pdf", label: "PDF", icon: <FileText size={20} />, desc: "Datasheet or catalog" },
  { key: "csv", label: "CSV", icon: <FileSpreadsheet size={20} />, desc: "Bulk catalog import" },
  { key: "url", label: "Website URL", icon: <Globe size={20} />, desc: "Manufacturer page" },
  { key: "image", label: "Image", icon: <Camera size={20} />, desc: "Nameplate / label OCR" },
  { key: "manual", label: "Manual", icon: <Keyboard size={20} />, desc: "Hand-enter specs" },
];

function ProcessingStepper({ steps }: { steps: { label: string; status: "done" | "active" | "pending" }[] }) {
  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-3 text-sm">
          {step.status === "done" ? (
            <CheckCircle size={16} style={{ color: "var(--color-success)" }} />
          ) : step.status === "active" ? (
            <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent-primary)" }} />
          ) : (
            <Circle size={16} style={{ color: "var(--neutral-300)" }} />
          )}
          <span style={{ color: step.status === "pending" ? "var(--text-muted)" : "var(--text-primary)" }}>{step.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function UploadCenter() {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [steps, setSteps] = useState<{ label: string; status: "done" | "active" | "pending" }[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualModel, setManualModel] = useState("");
  const [manualCategory, setManualCategory] = useState("Electric Motors & Drives");
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [manualMessage, setManualMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const reset = () => { setResult(null); setError(""); setManualMessage(""); setSteps([]); };

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }, []);

  const handleFileUpload = useCallback(async () => {
    if (!file) return;
    setLoading(true); setError(""); setResult(null);
    
    const isCSV = file.name.toLowerCase().endsWith(".csv");
    
    setSteps([
      { label: isCSV ? "Parsing CSV rows" : "Extracting document content", status: "active" },
      { label: isCSV ? "Creating individual products" : "Analyzing specifications", status: "pending" },
      { label: "Validating data quality", status: "pending" },
      { label: isCSV ? "Persisting products" : "Creating ProductTwin", status: "pending" },
    ]);
    try {
      const form = new FormData();
      form.append("file", file);
      setSteps(s => s.map((st, i) => i === 0 ? { ...st, status: "done" } : i === 1 ? { ...st, status: "active" } : st));
      
      // Route CSV files to the CSV-specific endpoint
      const res = isCSV ? await processCsvWorkflow(form) : await processWorkflow(form);
      
      setSteps(s => s.map((st, i) => i <= 2 ? { ...st, status: "done" } : i === 3 ? { ...st, status: "active" } : st));
      setSteps(s => s.map(st => ({ ...st, status: "done" as const })));
      setResult({ mode, data: res });
    } catch (e: any) {
      setError(e.message || "Unable to process workflow.");
    } finally { setLoading(false); }
  }, [file, mode]);

  const handleUrlIngest = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true); setError(""); setResult(null);
    setSteps([
      { label: "Fetching web page…", status: "active" },
      { label: "Extracting content", status: "pending" },
      { label: "Analyzing specifications", status: "pending" },
      { label: "Creating ProductTwin", status: "pending" },
    ]);
    try {
      const res = await ingestUrl(url.trim());
      setSteps(s => s.map((st, i) => i === 0 ? { ...st, status: "done" } : i === 1 ? { ...st, status: "active" } : st));
      const form = new FormData();
      form.append("url", url.trim());
      const pipeline = await processWorkflow(form);
      setSteps(s => s.map(st => ({ ...st, status: "done" as const })));
      setResult({ mode: "url", data: { ...res, pipeline } });
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [url]);

  const handleManualSubmit = useCallback(async () => {
    if (!manualName.trim()) { setManualMessage("Product name is required."); return; }
    setLoading(true); setError(""); setManualMessage("");
    try {
      const uid = user?.uid;
      const attributes = MOTOR_ATTRIBUTES.map(a => {
        const raw = (manualValues[a.key] || "").trim();
        return { key: a.key, label: a.label, value: raw || undefined, unit: a.unit || undefined, confidence: raw ? 1.0 : 0.0, source: "Manual Entry", evidence: raw ? `Entered manually by user` : "Not provided by user.", status: raw ? "verified" : "not_found" };
      });
      const product: ProductCreateInput = {
        name: manualName.trim(), model_number: manualModel.trim() || undefined, category: manualCategory.trim() || "Electric Motors & Drives",
        attributes, review_items: attributes.filter(a => !a.value).map(a => ({ title: `Missing: ${a.label} (${a.unit})`, item_type: "missing", description: `Required specification '${a.label}' not entered.`, action: "Add value", status: "pending" })),
      };
      const created = await ingestProduct(product);
      // Also persist to Firestore
      if (uid && created) {
        const attrsWithIds = attributes.map((a, i) => ({ ...a, id: (created as any).attributes?.[i]?.id ?? i + 1 }));
        const reviewWithIds = (product.review_items || []).map((r: any, i: number) => ({ ...r, id: r.id ?? i + 1 }));
        await saveUserProduct(uid, {
          id: created.id,
          name: created.name || product.name,
          model_number: created.model_number || product.model_number || "",
          category: created.category || product.category || "General",
          description: created.description || product.description || "",
          health_score: created.health_score ?? 0,
          created_by: uid,
          created_at: created.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          attributes: attrsWithIds as any,
          review_items: reviewWithIds as any,
          conflicts: (created.conflicts || []) as any,
          versions: (created.versions || []) as any,
        });
      }
      setManualMessage("✓ Product created and persisted to Firebase Firestore!");
      setResult({ mode: "manual", data: { product: created, validated_attributes: attributes } });
    } catch (e: any) { setError(e.message || "Unable to create product."); } finally { setLoading(false); }
  }, [manualName, manualModel, manualCategory, manualValues, user]);

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Upload Center</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Ingest product data from multiple sources. Files are securely stored in Firebase Cloud Storage.</p>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {MODES.map(m => (
          <button key={m.key} onClick={() => { setMode(m.key); setFile(null); reset(); }}
            className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition"
            style={{
              borderColor: mode === m.key ? "var(--accent-primary)" : "var(--border-default)",
              background: mode === m.key ? "var(--accent-primary-light)" : "var(--bg-card)",
              color: mode === m.key ? "var(--accent-primary)" : "var(--text-secondary)",
            }}>
            {m.icon}
            <div className="text-[13px] font-medium">{m.label}</div>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{m.desc}</div>
          </button>
        ))}
      </div>

      {/* File upload with drag-drop */}
      {(mode === "pdf" || mode === "csv" || mode === "image") && (
        <div className="space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 cursor-pointer transition"
            style={{
              borderColor: dragOver ? "var(--accent-primary)" : "var(--border-default)",
              background: dragOver ? "var(--accent-primary-light)" : "var(--bg-card)",
            }}>
            <Upload size={28} className="mb-3" style={{ color: dragOver ? "var(--accent-primary)" : "var(--text-muted)" }} />
            <div className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
              {file ? file.name : "Drop your file here or click to browse"}
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {mode === "pdf" ? "PDF documents" : mode === "csv" ? "CSV files" : "PNG, JPG, or WebP images"}
            </div>
            <label htmlFor="file-upload" className="sr-only">Upload file</label>
            <input ref={fileInputRef} id="file-upload" name="file-upload" type="file" accept={mode === "pdf" ? ".pdf" : mode === "csv" ? ".csv" : ".png,.jpg,.jpeg,.webp"}
              onChange={e => setFile(e.target.files?.[0] ?? null)} className="hidden" />
          </div>
          {file && (
            <div className="flex items-center gap-3 rounded-lg border px-4 py-3" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
              <Cloud size={16} style={{ color: "var(--accent-primary)" }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{file.name}</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{(file.size / 1024).toFixed(1)} KB → Firebase Storage</div>
              </div>
              <button onClick={() => setFile(null)} style={{ color: "var(--text-muted)" }}><X size={14} /></button>
            </div>
          )}
          {loading && steps.length > 0 && (
            <div className="rounded-lg border p-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
              <ProcessingStepper steps={steps} />
            </div>
          )}
          <button onClick={handleFileUpload} disabled={!file || loading}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 transition"
            style={{ background: "var(--accent-primary)" }}>
            {loading ? "Processing…" : "Upload & Process"} <ArrowRight size={14} />
          </button>
        </div>
      )}

      {mode === "url" && (
        <div className="space-y-3">
          <label htmlFor="url-input" className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Website URL</label>
          <div className="flex gap-2">
            <input id="url-input" name="url-input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.siemens.com/product/1le1001"
              className="flex-1 rounded-lg border px-4 py-3 text-sm"
              style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }} />
            <button onClick={handleUrlIngest} disabled={!url.trim() || loading}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-medium text-white disabled:opacity-50 transition"
              style={{ background: "var(--accent-primary)" }}>
              {loading ? "Fetching…" : "Fetch & Extract"} <ArrowRight size={14} />
            </button>
          </div>
          {loading && steps.length > 0 && (
            <div className="rounded-lg border p-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
              <ProcessingStepper steps={steps} />
            </div>
          )}
        </div>
      )}

      {mode === "manual" && (
        <div className="rounded-lg border p-5 space-y-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="manual-name" className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Product name *</label>
              <input id="manual-name" name="manual-name" value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Product name *"
                className="mt-1 w-full rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label htmlFor="manual-model" className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Model number</label>
              <input id="manual-model" name="manual-model" value={manualModel} onChange={e => setManualModel(e.target.value)} placeholder="Model number"
                className="mt-1 w-full rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label htmlFor="manual-category" className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Category</label>
              <input id="manual-category" name="manual-category" value={manualCategory} onChange={e => setManualCategory(e.target.value)} placeholder="Category"
                className="mt-1 w-full rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {MOTOR_ATTRIBUTES.map(a => (
              <label key={a.key} className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                {a.label} {a.unit && <span style={{ color: "var(--text-muted)" }}>({a.unit})</span>}
                <input id={`attr-${a.key}`} name={`attr-${a.key}`} value={manualValues[a.key] || ""} onChange={e => setManualValues({ ...manualValues, [a.key]: e.target.value })} placeholder="—"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }} />
              </label>
            ))}
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Manually entered values are marked as verified. Empty fields are persisted as NOT_FOUND.</p>
          <button onClick={handleManualSubmit} disabled={loading || !manualName.trim()}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 transition"
            style={{ background: "var(--accent-primary)" }}>
            {loading ? "Creating…" : "Create Product"} <ArrowRight size={14} />
          </button>
          {manualMessage && <div className="rounded-lg p-3 text-sm" style={{ background: "var(--color-success-light)", color: "var(--color-success)", border: `1px solid var(--color-success-border)` }}>{manualMessage}</div>}
        </div>
      )}

      {error && <ErrorState message={error} />}

      {/* Results */}
      {result && (
        <div className="rounded-xl border p-6 space-y-4 shadow-sm" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
          
          {/* Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2 text-sm font-extrabold text-emerald-600">
              <CheckCircle size={18} />
              <span>Data Processed & Extracted Successfully!</span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              ✓ Ready for Store & Dashboard
            </span>
          </div>

          {/* CSV Ingestion Statistics */}
          {result.data?.total_rows !== undefined && (
            <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: "var(--border-default)", background: "var(--neutral-50)" }}>
              <div className="text-xs font-bold mb-2" style={{ color: "var(--text-primary)" }}>CSV Ingestion Statistics</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total Rows", value: result.data.total_rows, color: "var(--text-primary)" },
                  { label: "Valid Products", value: result.data.valid_products, color: "var(--color-success)" },
                  { label: "Invalid Rows", value: result.data.invalid_rows, color: result.data.invalid_rows > 0 ? "var(--color-error)" : "var(--text-muted)" },
                  { label: "Products Created", value: result.data.products_created, color: "var(--accent-primary)" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center">
                    <div className="text-lg font-bold" style={{ color }}>{value ?? 0}</div>
                    <div className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>{label}</div>
                  </div>
                ))}
              </div>
              {result.data.products_needing_review > 0 && (
                <div className="text-xs" style={{ color: "var(--color-warning)" }}>
                  ⚠ {result.data.products_needing_review} products need review
                </div>
              )}
              {result.data.product_type && (
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Detected product type: <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{result.data.product_type.replace(/_/g, " ")}</span>
                </div>
              )}
              {result.data.errors?.length > 0 && (
                <div className="text-xs" style={{ color: "var(--color-error)" }}>
                  {result.data.errors.length} rows had errors (first: {result.data.errors[0]?.error})
                </div>
              )}
            </div>
          )}

          {result.data?.storage_url && (
            <div className="flex items-center gap-2 rounded-lg p-3 text-xs" style={{ background: "var(--color-success-light)", color: "var(--color-success)", border: `1px solid var(--color-success-border)` }}>
              <Cloud size={14} />
              <span>Document securely stored in Firebase Cloud Storage</span>
              <a href={result.data.storage_url} target="_blank" rel="noopener noreferrer" className="ml-auto font-medium underline">View file ↗</a>
            </div>
          )}

          {/* CSV: Persist to Firestore button */}
          {result.mode === "csv" && result.data?.products?.length > 0 && (
            <button
              onClick={async () => {
                const uid = user?.uid;
                if (!uid) { alert("⚠️ You must be logged in to save products."); return; }
                try {
                  const products = result.data.products;
                  let saved = 0;
                  for (const p of products) {
                    await saveUserProduct(uid, {
                      id: p.id,
                      name: p.name || "Unnamed Product",
                      model_number: p.model_number || p.mpn || "",
                      category: p.category || "General",
                      description: p.description || "",
                      health_score: p.health_score ?? 0,
                      created_by: uid,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      attributes: (p.attributes || []).map((a: any, i: number) => ({ ...a, id: a.id ?? i + 1 })) as any,
                      review_items: (p.review_items || []).map((r: any, i: number) => ({ ...r, id: r.id ?? i + 1 })) as any,
                      conflicts: (p.conflicts || []) as any,
                      versions: (p.versions || []) as any,
                    });
                    saved++;
                  }
                  alert(`✓ ${saved}/${products.length} CSV products persisted to Firebase Firestore!`);
                } catch (e: any) {
                  console.error("CSV Firestore persist failed:", e);
                  alert(`❌ Failed to persist CSV products: ${e?.message || "Unknown error"}.`);
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl text-white shadow-sm transition hover:opacity-95"
              style={{ background: "var(--accent-primary)" }}
            >
              <Cloud size={14} />
              Persist {result.data.products.length} Products to Firebase Firestore
            </button>
          )}

          {result.mode === "url" && result.data?.result?.text && (
            <div>
              <div className="text-xs mb-1 font-semibold" style={{ color: "var(--text-muted)" }}>Extracted Web Catalog Content Preview</div>
              <div className="max-h-40 overflow-auto rounded-lg border p-3 text-xs font-mono whitespace-pre-wrap"
                style={{ borderColor: "var(--border-default)", background: "var(--neutral-50)", color: "var(--text-secondary)" }}>
                {result.data.result.text.substring(0, 1500)}…
              </div>
            </div>
          )}

          {(() => {
            const attrs = result.mode === "url" ? result.data?.pipeline?.validated_attributes : result.data?.validated_attributes;
            const product = result.mode === "url" ? result.data?.pipeline?.product : result.data?.product;
            const rag = result.mode === "url" ? result.data?.pipeline?.rag_verification : result.data?.rag_verification;
            return (
              <>
                {attrs?.length > 0 && (
                  <div>
                    <div className="text-xs mb-2 font-semibold" style={{ color: "var(--text-muted)" }}>Extracted ProductTwin Attributes ({attrs.length}):</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {attrs.map((attr: any, i: number) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
                          style={{ borderColor: "var(--border-subtle)", background: "var(--neutral-50)" }}>
                          <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>{attr.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-mono" style={{ color: "var(--text-primary)" }}>{attr.normalized_value ?? "–"} {attr.unit}</span>
                            <StatusBadgeFromStatus status={attr.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {product?.id && (
                  <div className="rounded-lg p-3 text-xs font-semibold flex items-center justify-between" style={{ background: "var(--color-info-light)", color: "var(--color-info)", border: `1px solid var(--color-info-border)` }}>
                    <span>✓ Product persisted to database — Health Score: {product.health_score}/100</span>
                    <span className="font-bold">ID: #{product.id}</span>
                  </div>
                )}

                {rag && (
                  <div className="rounded-lg border p-3 text-xs" style={{
                    borderColor: rag.has_evidence ? "var(--color-success-border)" : "var(--border-default)",
                    background: rag.has_evidence ? "var(--color-success-light)" : "var(--neutral-50)",
                  }}>
                    <div className="font-bold mb-1" style={{ color: "var(--text-primary)" }}>RAG Auto-Verification Result</div>
                    <div className="italic" style={{ color: "var(--text-secondary)" }}>{rag.answer}</div>
                  </div>
                )}

                {/* ── ACTION BUTTONS: STORE & MOVE TO DASHBOARD ── */}
                <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center gap-3">
                  
                  {/* Button 1: Store & Save */}
                  <button
                    onClick={async () => {
                      if (!product) return;
                      const uid = user?.uid;
                      if (!uid) { alert("⚠️ You must be logged in to save products."); return; }
                      try {
                        // Product already saved to SQLite by the workflow pipeline.
                        // Only persist to Firestore for user-scoped fallback storage.
                        const attrs = (product.attributes || []).map((a: any, i: number) => ({ ...a, id: a.id ?? i + 1 }));
                        const reviews = (product.review_items || []).map((r: any, i: number) => ({ ...r, id: r.id ?? i + 1 }));
                        await saveUserProduct(uid, {
                          id: product.id,
                          name: product.name,
                          model_number: product.model_number || "",
                          category: product.category || "General",
                          description: product.description || "",
                          health_score: product.health_score ?? 0,
                          created_by: uid,
                          created_at: product.created_at || new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                          attributes: attrs as any,
                          review_items: reviews as any,
                          conflicts: (product.conflicts || []) as any,
                          versions: (product.versions || []) as any,
                        });
                        alert("✓ Product persisted to Firebase Firestore!");
                      } catch (e: any) {
                        console.error("Store & Save failed:", e);
                        alert(`❌ Failed to save product: ${e?.message || "Unknown error"}.\nPlease try again.`);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4.5 py-2.5 text-xs font-bold rounded-xl text-white shadow-sm transition hover:opacity-95"
                    style={{ background: "var(--accent-primary)" }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                      <polyline points="17 21 17 13 7 13 7 21"/>
                      <polyline points="7 3 7 8 15 8"/>
                    </svg>
                    <span>Store & Save to Database</span>
                  </button>

                  {/* Button 2: Move to Dashboard */}
                  <button
                    onClick={() => router.push("/")}
                    className="inline-flex items-center gap-2 px-4.5 py-2.5 text-xs font-bold rounded-xl text-white shadow-sm transition hover:opacity-95"
                    style={{ background: "#0F766E" }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="9" rx="1"/>
                      <rect x="14" y="3" width="7" height="5" rx="1"/>
                      <rect x="14" y="12" width="7" height="9" rx="1"/>
                      <rect x="3" y="16" width="7" height="5" rx="1"/>
                    </svg>
                    <span>Move to Dashboard & View ProductTwin</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>

                  {/* Button 3: Inspect Knowledge Graph */}
                  <button
                    onClick={() => router.push("/dashboard?view=graph")}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl border transition hover:bg-gray-50"
                    style={{ borderColor: "var(--border-default)", background: "var(--bg-card)", color: "var(--text-primary)" }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="18" cy="5" r="3"/>
                      <circle cx="6" cy="12" r="3"/>
                      <circle cx="18" cy="19" r="3"/>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                    <span>View Knowledge Graph</span>
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
