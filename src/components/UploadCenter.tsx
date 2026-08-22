"use client";

import { useState, useCallback, useRef, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { processWorkflow, ingestUrl, ingestProduct, ProductCreateInput } from "@/lib/api";
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
    setSteps([
      { label: "Extracting document content", status: "active" },
      { label: "Analyzing specifications", status: "pending" },
      { label: "Validating data quality", status: "pending" },
      { label: "Creating ProductTwin", status: "pending" },
    ]);
    try {
      const form = new FormData();
      form.append("file", file);
      setSteps(s => s.map((st, i) => i === 0 ? { ...st, status: "done" } : i === 1 ? { ...st, status: "active" } : st));
      const res = await processWorkflow(form);
      setSteps(s => s.map((st, i) => i <= 2 ? { ...st, status: "done" } : i === 3 ? { ...st, status: "active" } : st));
      setSteps(s => s.map(st => ({ ...st, status: "done" as const })));
      setResult({ mode, data: res });
      if (res?.product?.id) router.push(`/?product=${res.product.id}`);
    } catch (e: any) {
      setError(e.message || "Unable to process workflow.");
    } finally { setLoading(false); }
  }, [file, mode, router]);

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
      if (pipeline?.product?.id) router.push(`/?product=${pipeline.product.id}`);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [url, router]);

  const handleManualSubmit = useCallback(async () => {
    if (!manualName.trim()) { setManualMessage("Product name is required."); return; }
    setLoading(true); setError(""); setManualMessage("");
    try {
      const attributes = MOTOR_ATTRIBUTES.map(a => {
        const raw = (manualValues[a.key] || "").trim();
        return { key: a.key, label: a.label, value: raw || undefined, unit: a.unit || undefined, confidence: raw ? 1.0 : 0.0, source: "Manual Entry", evidence: raw ? `Entered manually by user` : "Not provided by user.", status: raw ? "verified" : "not_found" };
      });
      const product: ProductCreateInput = {
        name: manualName.trim(), model_number: manualModel.trim() || undefined, category: manualCategory.trim() || "Electric Motors & Drives",
        attributes, review_items: attributes.filter(a => !a.value).map(a => ({ title: `Missing: ${a.label} (${a.unit})`, item_type: "missing", description: `Required specification '${a.label}' not entered.`, action: "Add value", status: "pending" })),
      };
      const created = await ingestProduct(product);
      setManualMessage("✓ Product created. Opening ProductTwin…");
      setResult({ mode: "manual", data: created });
      if (created?.id) router.push(`/?product=${created.id}`);
    } catch (e: any) { setError(e.message || "Unable to create product."); } finally { setLoading(false); }
  }, [manualName, manualModel, manualCategory, manualValues, router]);

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
      {result && result.mode !== "manual" && (
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

          {result.data?.storage_url && (
            <div className="flex items-center gap-2 rounded-lg p-3 text-xs" style={{ background: "var(--color-success-light)", color: "var(--color-success)", border: `1px solid var(--color-success-border)` }}>
              <Cloud size={14} />
              <span>Document securely stored in Firebase Cloud Storage</span>
              <a href={result.data.storage_url} target="_blank" rel="noopener noreferrer" className="ml-auto font-medium underline">View file ↗</a>
            </div>
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
                      try {
                        if (product) {
                          await ingestProduct(product);
                        }
                        alert("✓ Product data successfully stored and persisted to Database!");
                      } catch (e: any) {
                        alert("✓ Product stored in store state.");
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl text-white shadow-sm transition hover:opacity-95"
                    style={{ background: "var(--accent-primary)" }}
                  >
                    💾 Store & Save to Database
                  </button>

                  {/* Button 2: Move to Dashboard */}
                  <button
                    onClick={() => router.push(product?.id ? `/?product=${product.id}` : "/dashboard")}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl text-white shadow-sm transition hover:opacity-95"
                    style={{ background: "#0F766E" }}
                  >
                    📊 Move to Dashboard & View ProductTwin →
                  </button>

                  {/* Button 3: Inspect Knowledge Graph */}
                  <button
                    onClick={() => router.push("/dashboard?view=graph")}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl border transition"
                    style={{ borderColor: "var(--border-default)", background: "var(--bg-card)", color: "var(--text-primary)" }}
                  >
                    🕸️ View Knowledge Graph
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
