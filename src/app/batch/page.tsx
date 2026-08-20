"use client";

import React, { useState, useRef } from "react";
import { batchImportCsv, getBatchExportUrl } from "@/lib/api";
import { ArrowLeft, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, X } from "lucide-react";
import Link from "next/link";

export default function BatchPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [exportFormat, setExportFormat] = useState("json");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setImportResult(null);
    setError("");

    // Parse CSV preview
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) {
        setError("CSV file must have a header row and at least one data row.");
        return;
      }

      const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
      const rows = lines.slice(1, 11).map(line => {
        const values = line.split(",").map(v => v.trim().replace(/"/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = values[i] || ""; });
        return row;
      });
      setPreview(rows);
    };
    reader.readAsText(selected);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setError("");
    try {
      const result = await batchImportCsv(file);
      setImportResult(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview([]);
    setImportResult(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--bg-main)" }}>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/" className="h-8 w-8 rounded-lg flex items-center justify-center border transition"
            style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Batch Import / Export</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Import products from CSV or export your catalog</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Import */}
          <div className="rounded-lg border p-5 space-y-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
            <div className="flex items-center gap-2">
              <Upload size={16} style={{ color: "var(--accent-primary)" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Import Products</h2>
            </div>

            {!file ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition hover:border-current"
                style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}
              >
                <FileSpreadsheet size={32} style={{ margin: "0 auto", opacity: 0.5 }} />
                <div className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>Click to upload CSV</div>
                <div className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>Columns: name, model_number, category, key, label, value, unit, confidence, source, evidence</div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "var(--accent-primary-light)" }}>
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet size={14} style={{ color: "var(--accent-primary)" }} />
                    <span className="text-xs font-medium" style={{ color: "var(--accent-primary)" }}>{file.name}</span>
                  </div>
                  <button onClick={clearFile} className="rounded p-1" style={{ color: "var(--text-muted)" }}>
                    <X size={14} />
                  </button>
                </div>

                {preview.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border-default)" }}>
                    <table className="min-w-full text-[11px]">
                      <thead>
                        <tr style={{ background: "var(--neutral-50)" }}>
                          {Object.keys(preview[0]).slice(0, 5).map(h => (
                            <th key={h} className="px-2 py-1.5 text-left font-semibold" style={{ color: "var(--text-muted)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row, i) => (
                          <tr key={i} className="border-t" style={{ borderColor: "var(--border-subtle)" }}>
                            {Object.values(row).slice(0, 5).map((val, j) => (
                              <td key={j} className="px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>{String(val).substring(0, 30)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <button onClick={handleImport} disabled={importing}
                  className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 transition"
                  style={{ background: "var(--accent-primary)" }}>
                  {importing ? "Importing…" : `Import ${preview.length > 0 ? "Products" : "CSV"}`}
                </button>
              </div>
            )}

            {/* Import result */}
            {importResult && (
              <div className="rounded-lg p-3 text-xs space-y-1" style={{
                background: importResult.failed === 0 ? "var(--color-success-light)" : "var(--color-warning-light)",
                border: `1px solid ${importResult.failed === 0 ? "var(--color-success-border)" : "var(--color-warning-border)"}`,
              }}>
                <div className="flex items-center gap-1.5 font-semibold" style={{ color: importResult.failed === 0 ? "var(--color-success)" : "var(--color-warning)" }}>
                  {importResult.failed === 0 ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                  {importResult.succeeded} imported, {importResult.failed} failed
                </div>
                {importResult.errors?.map((err: any, i: number) => (
                  <div key={i} style={{ color: "var(--color-error)" }}>{err.name}: {err.error}</div>
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-lg p-3 text-xs" style={{ background: "var(--color-error-light)", color: "var(--color-error)" }}>
                {error}
              </div>
            )}
          </div>

          {/* Export */}
          <div className="rounded-lg border p-5 space-y-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
            <div className="flex items-center gap-2">
              <Download size={16} style={{ color: "#7C3AED" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Export Products</h2>
            </div>

            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Download all products with full provenance metadata, timestamps, and source evidence.
            </p>

            <div className="space-y-3">
              <div>
                <label htmlFor="export-format" className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Format</label>
                <select id="export-format" name="export-format" value={exportFormat} onChange={e => setExportFormat(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border-default)", color: "var(--text-primary)", background: "var(--bg-card)" }}>
                  <option value="json">JSON (structured)</option>
                  <option value="csv">CSV (spreadsheet)</option>
                </select>
              </div>

              <a
                href={getBatchExportUrl(exportFormat)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition"
                style={{ background: "#7C3AED" }}
              >
                <Download size={14} />
                Download {exportFormat.toUpperCase()}
              </a>
            </div>

            <div className="rounded-lg border p-3" style={{ borderColor: "var(--border-default)", background: "var(--neutral-50)" }}>
              <div className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Export includes:</div>
              <ul className="text-[11px] space-y-0.5" style={{ color: "var(--text-secondary)" }}>
                <li>• All product attributes with confidence scores</li>
                <li>• Source documents and page references</li>
                <li>• Evidence quotes and extraction methods</li>
                <li>• Conflict data and resolution status</li>
                <li>• Version history and audit timestamps</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
