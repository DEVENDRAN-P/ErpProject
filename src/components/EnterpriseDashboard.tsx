"use client";

import React from "react";


import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { ProductRead, DashboardStats, HealthBreakdown } from "@/lib/types";
import {
  fetchProducts, fetchDashboardStats, fetchProductHealth,
  executeReviewAction, queryRag, getProductJsonExportUrl, getProductCsvExportUrl,
} from "@/lib/api";
import {
  Search, RefreshCw, FileJson, Box, FileSpreadsheet, Upload, Plus,
  Package, Activity, AlertTriangle, CheckCircle, XCircle, Clock,
  ChevronRight, ExternalLink, ArrowLeft, MessageSquare, History,
  Shield, GitBranch, Database, Eye, Edit2, Network, Brain, BarChart3,
  FileUp, Bell
} from "lucide-react";
import { StatusBadgeFromStatus, HealthGauge, KpiCard, SkeletonDashboard, SkeletonTable,
  EmptyState, ErrorState, PageHeader } from "@/components/ui";
import KnowledgeGraphTab from "@/components/KnowledgeGraphTab";
import ExplainabilityTab from "@/components/ExplainabilityTab";
import NotificationBell from "@/components/NotificationBell";

// ─── Product Truth & Validation ────────────────────────────────────
function ValidationTab({ product }: { product: ProductRead }) {
  const conflicts = product.conflicts || [];
  const missing = product.attributes.filter(a => (a.status || "").toUpperCase() === "NOT_FOUND");
  const conflictAttrs = product.attributes.filter(a => (a.status || "").toUpperCase() === "CONFLICT");

  return (
    <div className="space-y-8">
      {/* Conflicts */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2 w-2 rounded-full" style={{ background: "var(--color-warning)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>ProductTruth Conflicts</h3>
          <span className="badge badge-warning">{conflicts.length}</span>
        </div>
        {conflicts.length === 0 && conflictAttrs.length === 0 ? (
          <div className="rounded-lg p-4 text-sm" style={{ background: "var(--color-success-light)", color: "var(--color-success)", border: `1px solid var(--color-success-border)` }}>
            <CheckCircle size={14} className="inline mr-1.5" />No conflicts detected. All data sources are consistent.
          </div>
        ) : (
          <div className="space-y-3">
            {conflicts.map(c => {
              let sources: any[] = [];
              try { sources = JSON.parse(c.sources_json); } catch {}
              return (
                <div key={c.id} className="rounded-lg border p-4" style={{ borderColor: "var(--color-warning-border)", background: "var(--color-warning-light)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{c.label}</span>
                    <StatusBadgeFromStatus status={c.status} />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 mb-3">
                    {sources.map((s, i) => (
                      <div key={i} className="rounded-lg border p-3 text-xs" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
                        <div className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Source {i + 1}: <span style={{ color: "var(--accent-primary)" }}>{s.source}</span></div>
                        <div style={{ color: "var(--text-secondary)" }}>Value: <span className="font-mono font-medium" style={{ color: "var(--text-primary)" }}>{s.value}</span></div>
                        <div style={{ color: "var(--text-secondary)" }}>Confidence: <span className="font-medium" style={{ color: "var(--color-warning)" }}>{Math.round(s.confidence * 100)}%</span></div>
                        <div className="mt-1 italic" style={{ color: "var(--text-muted)" }}>&ldquo;{s.evidence}&rdquo;</div>
                      </div>
                    ))}
                  </div>
                  {c.recommended_value && (
                    <div className="rounded-lg p-3 text-xs" style={{ borderColor: "var(--color-success-border)", background: "var(--color-success-light)" }}>
                      <div className="font-semibold mb-1" style={{ color: "var(--color-success)" }}>Recommended: {c.recommended_value}</div>
                      <div style={{ color: "var(--text-secondary)" }}>{c.reasoning}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Missing */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2 w-2 rounded-full" style={{ background: "var(--color-error)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Missing Data</h3>
          <span className="badge badge-error">{missing.length}</span>
        </div>
        {missing.length === 0 ? (
          <div className="rounded-lg p-4 text-sm" style={{ background: "var(--color-success-light)", color: "var(--color-success)", border: `1px solid var(--color-success-border)` }}>
            <CheckCircle size={14} className="inline mr-1.5" />All required attributes are present.
          </div>
        ) : (
          <div className="space-y-2">
            {missing.map(attr => (
              <div key={attr.id} className="flex items-center justify-between rounded-lg border p-3 text-xs"
                style={{ borderColor: "var(--color-error-border)", background: "var(--color-error-light)" }}>
                <div>
                  <div className="font-medium" style={{ color: "var(--text-primary)" }}>{attr.label}</div>
                  <div style={{ color: "var(--text-muted)" }}>{attr.evidence}</div>
                </div>
                <span className="font-medium" style={{ color: "var(--text-secondary)" }}>{attr.unit}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Health Score ──────────────────────────────────────────────────
function HealthTab({ product }: { product: ProductRead }) {
  const [health, setHealth] = useState<HealthBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    fetchProductHealth(product.id)
      .then((data: HealthBreakdown) => { if (!cancelled) setHealth(data); })
      .catch((e: any) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [product.id]);

  if (loading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-8 rounded-lg" />)}</div>;
  if (error || !health) return <ErrorState message={error || "Unable to load health breakdown."} />;

  const breakdown = [
    { label: "Completeness", value: Math.round(health.completeness), weight: "40%", color: "var(--accent-primary)" },
    { label: "Consistency", value: Math.round(health.consistency), weight: "30%", color: "#7C3AED" },
    { label: "Avg. Confidence", value: Math.round(health.confidence), weight: "20%", color: "var(--color-warning)" },
    { label: "Source Reliability", value: Math.round(health.source_reliability), weight: "10%", color: "var(--color-success)" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-8">
        <HealthGauge score={health.score} size={100} />
        <div>
          <div className="text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Overall Product Health</div>
          <div className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{health.score}<span className="text-lg font-normal" style={{ color: "var(--text-muted)" }}> / 100</span></div>
          <div className="text-sm font-medium mt-1" style={{ color: health.score >= 80 ? "var(--color-success)" : health.score >= 60 ? "var(--color-warning)" : "var(--color-error)" }}>
            {health.score >= 80 ? "Commerce-Ready" : health.score >= 60 ? "Needs Attention" : "Requires Review"}
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Score Breakdown</div>
        {breakdown.map(b => (
          <div key={b.label} className="space-y-1">
            <div className="flex justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
              <span>{b.label} <span style={{ color: "var(--text-muted)" }}>({b.weight})</span></span>
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{b.value}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--neutral-100)" }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${b.value}%`, background: b.color }} />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg p-4 text-xs" style={{ borderColor: "var(--border-default)", background: "var(--neutral-50)" }}>
        <div className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Scoring Formula</div>
        <div style={{ color: "var(--text-secondary)" }}>{health.explanation}</div>
        <div className="mt-1" style={{ color: "var(--text-muted)" }}>Score = 40% × Completeness + 30% × Consistency + 20% × Confidence + 10% × Source Reliability</div>
      </div>
    </div>
  );
}

// ─── Human Review ──────────────────────────────────────────────────
function HumanReviewTab({ product, onRefresh }: { product: ProductRead; onRefresh: () => void }) {
  const [loading, setLoading] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState("");

  const doAction = async (id: number, action: string, val?: string) => {
    setLoading(id); setMsg("");
    try {
      await executeReviewAction(id, action, val, comment || undefined);
      setMsg(`✓ Review item ${action}`); setEditId(null); setEditVal(""); setComment("");
      onRefresh();
    } catch (e: any) { setMsg(e.message); } finally { setLoading(null); }
  };

  const pending = product.review_items.filter(r => (r.status || "").toUpperCase() === "PENDING");
  const done = product.review_items.filter(r => (r.status || "").toUpperCase() !== "PENDING");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Human Review Queue</h3>
        <span className="badge badge-info">{pending.length} pending</span>
      </div>
      {msg && <div className="rounded-lg p-3 text-sm" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>{msg}</div>}
      {pending.length === 0 ? (
        <div className="rounded-lg p-4 text-sm" style={{ background: "var(--color-success-light)", color: "var(--color-success)", border: `1px solid var(--color-success-border)` }}>
          <CheckCircle size={14} className="inline mr-1.5" />All review items resolved.
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map(item => (
            <div key={item.id} className="rounded-lg border p-4" style={{
              borderColor: item.item_type === "conflict" ? "var(--color-warning-border)" : "var(--border-default)",
              background: item.item_type === "conflict" ? "var(--color-warning-light)" : "var(--bg-card)",
            }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{item.title}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{item.description}</div>
                </div>
                <StatusBadgeFromStatus status={item.item_type} />
              </div>
              {editId === item.id && (
                <div className="mb-3">
                  <label htmlFor={`review-edit-${item.id}`} className="sr-only">Corrected value</label>
                  <input id={`review-edit-${item.id}`} name={`review-edit-${item.id}`} value={editVal} onChange={e => setEditVal(e.target.value)} placeholder="Enter corrected value…"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }} />
                </div>
              )}
              <label htmlFor={`review-comment-${item.id}`} className="sr-only">Optional comment</label>
              <input id={`review-comment-${item.id}`} name={`review-comment-${item.id}`} value={editId === item.id ? comment : ""} onChange={e => setComment(e.target.value)} placeholder="Optional comment…"
                className={`mb-3 w-full rounded-lg border px-3 py-1.5 text-xs ${editId === item.id ? "" : "hidden"}`}
                style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }} />
              <div className="flex flex-wrap gap-2">
                <button disabled={loading === item.id} onClick={() => doAction(item.id, "approved")}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 transition"
                  style={{ background: "var(--color-success)" }}>✓ Approve</button>
                <button disabled={loading === item.id} onClick={() => doAction(item.id, "rejected")}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 transition"
                  style={{ background: "var(--color-error)" }}>✕ Reject</button>
                {editId === item.id ? (
                  <>
                    <button disabled={!editVal || loading === item.id} onClick={() => doAction(item.id, "edited", editVal)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 transition"
                      style={{ background: "var(--accent-primary)" }}>Save Edit</button>
                    <button onClick={() => { setEditId(null); setEditVal(""); }}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium transition"
                      style={{ background: "var(--neutral-100)", color: "var(--text-secondary)" }}>Cancel</button>
                  </>
                ) : (
                  <button onClick={() => setEditId(item.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition"
                    style={{ background: "var(--neutral-100)", color: "var(--text-secondary)" }}><Edit2 size={12} /> Edit</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {done.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Resolved</div>
          <div className="space-y-1.5">
            {done.map(item => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
                <span style={{ color: "var(--text-secondary)" }}>{item.title}</span>
                <StatusBadgeFromStatus status={item.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CatalogPilot / Version History ────────────────────────────────
function CatalogPilotTab({ product }: { product: ProductRead }) {
  const versions = [...(product.versions || [])].reverse();
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Version History</h3>
      {versions.length === 0 ? (
        <div className="rounded-lg p-4 text-sm" style={{ borderColor: "var(--border-default)", background: "var(--neutral-50)", color: "var(--text-secondary)" }}>No version history yet.</div>
      ) : (
        <div className="relative">
          <div className="absolute left-[18px] top-0 bottom-0 w-px" style={{ background: "var(--neutral-200)" }} />
          <div className="space-y-4 pl-10">
            {versions.map(ver => {
              let changes: any[] = [];
              try { changes = JSON.parse(ver.changes_json || "[]"); } catch {}
              return (
                <div key={ver.id} className="relative">
                  <div className="absolute -left-6 top-3 h-3 w-3 rounded-full border-2 border-white" style={{ background: "var(--accent-primary)" }} />
                  <div className="rounded-lg border p-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Version {ver.version_number}</span>
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{new Date(ver.created_at).toLocaleString()}</span>
                    </div>
                    <div className="space-y-2">
                      {changes.map((ch, i) => (
                        <div key={i} className="rounded-lg border p-3 text-xs" style={{ borderColor: "var(--border-subtle)", background: "var(--neutral-50)" }}>
                          <div className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{ch.field}</div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="rounded px-2 py-0.5 font-mono text-xs" style={{ background: "var(--color-error-light)", color: "var(--color-error)", border: `1px solid var(--color-error-border)` }}>Old: {ch.old}</span>
                            <span style={{ color: "var(--text-muted)" }}>→</span>
                            <span className="rounded px-2 py-0.5 font-mono text-xs" style={{ background: "var(--color-success-light)", color: "var(--color-success)", border: `1px solid var(--color-success-border)` }}>New: {ch.new}</span>
                          </div>
                          {ch.source && <div className="mt-1" style={{ color: "var(--text-secondary)" }}>Source: {ch.source}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Export ────────────────────────────────────────────────────────
function ExportTab({ product }: { product: ProductRead }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Export Commerce-Ready Data</h3>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Download structured product data for your e-commerce platform, ERP, or PIM system.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <a href={getProductJsonExportUrl(product.id)} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-4 rounded-lg border p-5 transition group"
          style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
          <div className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ background: "var(--accent-primary-light)", color: "var(--accent-primary)" }}><FileJson size={20} /></div>
          <div>
            <div className="font-semibold text-sm" style={{ color: "var(--accent-primary)" }}>Export JSON</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Commerce-ready structured spec</div>
          </div>
        </a>
        <a href={getProductCsvExportUrl(product.id)} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-4 rounded-lg border p-5 transition group"
          style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
          <div className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ background: "#F5F3FF", color: "#7C3AED" }}><FileSpreadsheet size={20} /></div>
          <div>
            <div className="font-semibold text-sm" style={{ color: "#7C3AED" }}>Export CSV</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Spreadsheet / ERP import</div>
          </div>
        </a>
      </div>
      <div className="rounded-lg border p-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
        <div className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Product Summary</div>
        <div className="grid gap-2 text-sm">
          {[["Name", product.name], ["Model", product.model_number || "–"], ["Category", product.category || "–"],
            ["Health", `${product.health_score}/100`], ["Attributes", `${product.attributes.length} specs`],
            ["Updated", product.updated_at ? new Date(product.updated_at).toLocaleString() : "–"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span style={{ color: "var(--text-secondary)" }}>{k}</span>
              <span className="font-medium" style={{ color: "var(--text-primary)" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── RAG Verification ──────────────────────────────────────────────
function RagTab({ product }: { product: ProductRead }) {
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    if (!question.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try { const res = await queryRag(question, context || undefined, product.id); setResult(res); }
    catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Evidence Verification</h3>
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Ask questions about <span className="font-medium" style={{ color: "var(--text-primary)" }}>{product.name}</span> and receive answers backed by source evidence.</p>
      </div>
      <div className="space-y-3">
        <div>
          <label htmlFor="rag-question" className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Question</label>
          <input id="rag-question" name="rag-question" value={question} onChange={e => setQuestion(e.target.value)} placeholder="e.g. What is the rated voltage and efficiency class?"
            className="w-full rounded-lg border px-4 py-3 text-sm"
            style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }} />
        </div>
        <div>
          <label htmlFor="rag-context" className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Optional: Document context for RAG indexing</label>
          <textarea id="rag-context" name="rag-context" value={context} onChange={e => setContext(e.target.value)} rows={3} placeholder="Paste extracted text from PDF or URL here…"
            className="w-full rounded-lg border px-4 py-2 text-xs"
            style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }} />
        </div>
        <button onClick={run} disabled={!question.trim() || loading}
          className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 transition"
          style={{ background: "var(--accent-primary)" }}>
          {loading ? "Searching…" : "Run Verification"}
        </button>
      </div>
      {error && <ErrorState message={error} />}
      {result && (
        <div className="rounded-lg border p-4 space-y-3" style={{
          borderColor: result.has_evidence ? "var(--color-success-border)" : "var(--border-default)",
          background: result.has_evidence ? "var(--color-success-light)" : "var(--neutral-50)",
        }}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold" style={{ color: result.has_evidence ? "var(--color-success)" : "var(--text-secondary)" }}>
              {result.has_evidence ? "✓ Evidence Found" : "✗ Insufficient Evidence"}
            </div>
            {result.has_evidence && (
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Confidence: <span className="font-semibold" style={{ color: "var(--color-success)" }}>{Math.round(result.confidence * 100)}%</span></div>
            )}
          </div>
          <div className="text-sm" style={{ color: "var(--text-primary)" }}>{result.answer}</div>
          {result.sources?.length > 0 && <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Sources: {result.sources.join(", ")}</div>}
          {result.evidence_snippets?.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Evidence Snippets</div>
              {result.evidence_snippets.map((s: string, i: number) => (
                <div key={i} className="rounded-lg border-l-2 pl-3 py-1.5 text-xs italic"
                  style={{ borderColor: "var(--accent-primary)", background: "var(--accent-primary-light)", color: "var(--text-secondary)" }}>
                  &ldquo;{s}&rdquo;
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────
const TABS = ["ProductTwin", "Validation", "Health Score", "Human Review", "CatalogPilot", "RAG", "Export", "Knowledge Graph", "Explainability"] as const;
type Tab = typeof TABS[number];

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  "ProductTwin": <Box size={14} />,
  "Validation": <Shield size={14} />,
  "Health Score": <Activity size={14} />,
  "Human Review": <AlertTriangle size={14} />,
  "CatalogPilot": <History size={14} />,
  "RAG": <MessageSquare size={14} />,
  "Export": <FileJson size={14} />,
  "Knowledge Graph": <Network size={14} />,
  "Explainability": <Brain size={14} />,
};

export default function EnterpriseDashboard({ initialProductId, initialTab }: { initialProductId?: number; initialTab?: string }) {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductRead[]>([]);
  const [selected, setSelected] = useState<ProductRead | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>((TABS.includes(initialTab as any) ? initialTab : "ProductTwin") as Tab || "ProductTwin");
  const [loading, setLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [error, setError] = useState("");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const loadProducts = useCallback(async (q = "", preselectId?: number) => {
    setLoading(true); setError("");
    try {
      const data = await fetchProducts(q);
      setProducts(data);
      const targetId = preselectId ?? selected?.id;
      setSelected(data.find(p => p.id === targetId) || data[0] || null);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [selected]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try { const data = await fetchDashboardStats(); setStats(data); }
    catch (e: any) { console.warn("Stats load failed:", e.message); } finally { setStatsLoading(false); }
  }, []);

  const onRefresh = () => { loadProducts(searchQ); loadStats(); };
  useEffect(() => { loadProducts("", initialProductId); loadStats(); }, [initialProductId]);

  // React to external tab changes (from sidebar navigation)
  useEffect(() => {
    if (initialTab && TABS.includes(initialTab as any)) {
      setActiveTab(initialTab as Tab);
    }
  }, [initialTab]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-6 page-enter">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{getGreeting()}, {user?.displayName?.split(" ")[0] || "User"}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Here&apos;s the current state of your product intelligence workspace.</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/reports" className="h-8 rounded-lg border px-3 text-xs font-medium flex items-center gap-1.5 transition"
            style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>
            <BarChart3 size={14} />Reports
          </a>
          <a href="/batch" className="h-8 rounded-lg border px-3 text-xs font-medium flex items-center gap-1.5 transition"
            style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>
            <FileUp size={14} />Batch
          </a>
          <NotificationBell />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Products" value={stats?.total_products} icon={<Package size={16} />} color="var(--accent-primary)" loading={statsLoading} />
        <KpiCard label="Avg Health" value={stats?.average_health_score ? `${stats.average_health_score}%` : undefined} icon={<Activity size={16} />} color="var(--color-success)" loading={statsLoading} />
        <KpiCard label="Needs Review" value={stats?.products_requiring_review} icon={<Eye size={16} />} color="var(--color-warning)" loading={statsLoading} />
        <KpiCard label="Missing Specs" value={stats?.missing_attributes} icon={<XCircle size={16} />} color="var(--color-error)" loading={statsLoading} />
        <KpiCard label="Conflicts" value={stats?.open_conflicts} icon={<AlertTriangle size={16} />} color="#7C3AED" loading={statsLoading} />
        <KpiCard label="Pending Reviews" value={stats?.pending_reviews} icon={<Clock size={16} />} color="var(--color-info)" loading={statsLoading} />
      </div>

      {/* Product list */}
      <div className="rounded-lg border p-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <label htmlFor="product-search" className="sr-only">Search products</label>
            <input id="product-search" name="product-search" value={searchQ} onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && loadProducts(searchQ)}
              placeholder="Search products…"
              className="w-full h-8 pl-8 pr-3 rounded-lg border text-[13px]"
              style={{ borderColor: "var(--border-default)", color: "var(--text-primary)", background: "var(--neutral-50)" }} />
          </div>
          <button onClick={() => loadProducts(searchQ)} className="h-8 rounded-lg px-3.5 text-xs font-medium text-white transition shrink-0"
            style={{ background: "var(--accent-primary)" }}>Search</button>
          <button onClick={onRefresh} className="h-8 rounded-lg border px-2.5 transition shrink-0"
            style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>
            <RefreshCw size={14} />
          </button>
        </div>
        {error && <ErrorState message={error} onRetry={onRefresh} />}
        {loading ? (
          <SkeletonTable rows={3} />
        ) : products.length === 0 ? (
          <EmptyState icon={<Package size={24} />} title="No products yet" description="Upload your first industrial datasheet to create your ProductTwin." action={{ label: "Upload Product", href: "/?view=upload" }} />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {products.map(p => (
              <button key={p.id} onClick={() => { setSelected(p); setActiveTab("ProductTwin"); }}
                className="rounded-lg border px-3 py-2 text-left text-xs transition"
                style={{
                  borderColor: selected?.id === p.id ? "var(--accent-primary)" : "var(--border-default)",
                  background: selected?.id === p.id ? "var(--accent-primary-light)" : "var(--bg-card)",
                  color: selected?.id === p.id ? "var(--accent-primary)" : "var(--text-secondary)",
                }}>
                <div className="font-semibold">{p.name}</div>
                <div className="mt-0.5" style={{ color: "var(--text-muted)" }}>{p.model_number} · Health {p.health_score}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail pane */}
      {selected && (
        <div className="rounded-lg border" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
          {/* Header */}
          <div className="border-b px-5 py-4 flex items-start gap-4" style={{ borderColor: "var(--border-default)" }}>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>{selected.category}</div>
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{selected.name}</h2>
              <div className="text-sm" style={{ color: "var(--text-secondary)" }}>{selected.model_number}</div>
            </div>
            <HealthGauge score={selected.health_score} size={80} />
          </div>
          {/* Tabs */}
          <div className="border-b px-4 flex gap-0.5 overflow-x-auto" style={{ borderColor: "var(--border-default)" }}>
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium transition border-b-2 -mb-px"
                style={{
                  borderColor: activeTab === tab ? "var(--accent-primary)" : "transparent",
                  color: activeTab === tab ? "var(--accent-primary)" : "var(--text-secondary)",
                }}>
                {TAB_ICONS[tab]}
                {tab}
              </button>
            ))}
          </div>
          {/* Tab content */}
          <div className="p-5">
            {activeTab === "ProductTwin" && (
              <div>
                <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>ProductTwin Specifications</h3>
                <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border-default)" }}>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: "var(--border-default)", background: "var(--neutral-50)" }}>
                        {["Attribute", "Value", "Confidence", "Source", "Status", "Evidence"].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selected.attributes.map((attr) => (
                        <React.Fragment key={attr.id}>
                          <tr className="border-b cursor-pointer transition"
                            style={{
                              borderColor: "var(--border-subtle)",
                              background: expanded === attr.id ? "var(--accent-primary-light)" : "transparent",
                            }}
                            onClick={() => setExpanded(expanded === attr.id ? null : attr.id)}
                            onMouseEnter={(e) => { if (expanded !== attr.id) e.currentTarget.style.background = "var(--bg-hover)"; }}
                            onMouseLeave={(e) => { if (expanded !== attr.id) e.currentTarget.style.background = expanded === attr.id ? "var(--accent-primary-light)" : "transparent"; }}>
                            <td className="px-3 py-2.5 font-medium" style={{ color: "var(--text-primary)" }}>{attr.label}</td>
                            <td className="px-3 py-2.5 font-mono text-xs">
                              {attr.value ? (
                                <span style={{ color: "var(--text-primary)" }}>{attr.value} {attr.unit && <span style={{ color: "var(--text-muted)" }}>{attr.unit}</span>}</span>
                              ) : (
                                <span className="italic" style={{ color: "var(--text-muted)" }}>–</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <div className="h-1 w-14 overflow-hidden rounded-full" style={{ background: "var(--neutral-200)" }}>
                                  <div className="h-full rounded-full" style={{
                                    width: `${Math.round(attr.confidence * 100)}%`,
                                    background: attr.confidence >= 0.9 ? "var(--color-success)" : attr.confidence >= 0.7 ? "var(--color-warning)" : "var(--color-error)",
                                  }} />
                                </div>
                                <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>{Math.round(attr.confidence * 100)}%</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 max-w-[140px] truncate text-xs" style={{ color: "var(--text-muted)" }}>{attr.source || "–"}</td>
                            <td className="px-3 py-2.5"><StatusBadgeFromStatus status={attr.status} /></td>
                            <td className="px-3 py-2.5 text-[11px]" style={{ color: "var(--text-muted)" }}>{expanded === attr.id ? "▲" : "▼"}</td>
                          </tr>
                          {expanded === attr.id && (
                            <tr style={{ background: "var(--neutral-50)" }}>
                              <td colSpan={6} className="px-5 pb-4 pt-3">
                                <div className="rounded-lg border p-4 text-xs space-y-2" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
                                  {attr.page && <div><span style={{ color: "var(--text-muted)" }}>Page:</span> <span className="font-medium" style={{ color: "var(--text-primary)" }}>Page {attr.page}</span></div>}
                                  {attr.evidence && <div><span style={{ color: "var(--text-muted)" }}>Evidence:</span> <span style={{ color: "var(--text-secondary)" }}>{attr.evidence}</span></div>}
                                  {attr.evidence_quote && (
                                    <div className="mt-2 rounded-lg border-l-2 pl-3 py-2 font-mono text-xs italic"
                                      style={{ borderColor: "var(--accent-primary)", background: "var(--accent-primary-light)", color: "var(--text-secondary)" }}>
                                      &ldquo;{attr.evidence_quote}&rdquo;
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {activeTab === "Validation" && <ValidationTab product={selected} />}
            {activeTab === "Health Score" && <HealthTab product={selected} />}
            {activeTab === "Human Review" && <HumanReviewTab product={selected} onRefresh={() => loadProducts(searchQ)} />}
            {activeTab === "CatalogPilot" && <CatalogPilotTab product={selected} />}
            {activeTab === "RAG" && <RagTab product={selected} />}
            {activeTab === "Export" && <ExportTab product={selected} />}
            {activeTab === "Knowledge Graph" && <KnowledgeGraphTab productId={selected.id} />}
            {activeTab === "Explainability" && <ExplainabilityTab productId={selected.id} />}
          </div>
        </div>
      )}
    </div>
  );
}
