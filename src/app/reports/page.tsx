"use client";

import React, { useState, useEffect } from "react";
import { fetchDataQualityReport, fetchComplianceReport, fetchAuditTrail } from "@/lib/api";
import { DataQualityResponse, ComplianceReportResponse, AuditTrailEntry } from "@/lib/types";
import { BarChart3, Shield, Clock, CheckCircle, AlertTriangle, ArrowLeft, Activity } from "lucide-react";
import Link from "next/link";

function QualityCard({ label, value, suffix, color }: { label: string; value: number; suffix?: string; color: string }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
      <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color }}>{value}{suffix || ""}</div>
    </div>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-4 w-full overflow-hidden rounded" style={{ background: "var(--neutral-100)" }}>
      <div className="h-full rounded transition-all duration-500 flex items-center px-1.5" style={{ width: `${pct}%`, background: color }}>
        {pct > 15 && <span className="text-[9px] font-bold text-white">{value}</span>}
      </div>
    </div>
  );
}

import ProtectedRoute from "@/components/ProtectedRoute";

function ReportsContent() {
  const [quality, setQuality] = useState<DataQualityResponse | null>(null);
  const [compliance, setCompliance] = useState<ComplianceReportResponse | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditTrailEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"quality" | "compliance" | "audit">("quality");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true); setError("");
    try {
      const [q, c, a] = await Promise.all([
        fetchDataQualityReport(),
        fetchComplianceReport(),
        fetchAuditTrail(),
      ]);
      setQuality(q);
      setCompliance(c);
      setAuditTrail(a);
    } catch (e: any) {
      setError(e.message || "Failed to load reports. The backend may be unavailable.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--bg-main)" }}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/" className="h-8 w-8 rounded-lg flex items-center justify-center border transition"
            style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Data Quality & Reports</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Aggregate metrics, compliance status, and audit trail</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b" style={{ borderColor: "var(--border-default)" }}>
          {[
            { key: "quality", label: "Data Quality", icon: <BarChart3 size={14} /> },
            { key: "compliance", label: "Compliance", icon: <Shield size={14} /> },
            { key: "audit", label: "Audit Trail", icon: <Clock size={14} /> },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px"
              style={{
                borderColor: activeTab === tab.key ? "var(--accent-primary)" : "transparent",
                color: activeTab === tab.key ? "var(--accent-primary)" : "var(--text-secondary)",
              }}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-20 rounded-lg" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="rounded-lg p-4 text-sm" style={{ background: "var(--color-error-light)", color: "var(--color-error)", border: "1px solid var(--color-error-border)" }}>
            {error}
          </div>
        )}

        {/* Quality Tab */}
        {activeTab === "quality" && quality && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <QualityCard label="Overall Score" value={quality.overall_quality_score} suffix="%" color="var(--accent-primary)" />
              <QualityCard label="Products" value={quality.total_products} color="var(--text-primary)" />
              <QualityCard label="Completeness" value={quality.completeness_rate} suffix="%" color="var(--color-success)" />
              <QualityCard label="Resolution Rate" value={quality.resolution_rate} suffix="%" color="#7C3AED" />
            </div>

            {/* Health Distribution */}
            {quality.health_distribution && (
              <div className="rounded-lg border p-5" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Health Distribution</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-24" style={{ color: "var(--text-secondary)" }}>Excellent (80+)</span>
                    <MiniBar value={quality.health_distribution?.excellent ?? 0} max={quality.total_products ?? 1} color="var(--color-success)" />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-24" style={{ color: "var(--text-secondary)" }}>Attention (60-79)</span>
                    <MiniBar value={quality.health_distribution?.attention ?? 0} max={quality.total_products ?? 1} color="var(--color-warning)" />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-24" style={{ color: "var(--text-secondary)" }}>Needs Review (&lt;60)</span>
                    <MiniBar value={quality.health_distribution?.needs_review ?? 0} max={quality.total_products ?? 1} color="var(--color-error)" />
                  </div>
                </div>
              </div>
            )}

            {/* Completeness by Category */}
            {quality?.completeness_by_category && Object.keys(quality.completeness_by_category).length > 0 && (
              <div className="rounded-lg border p-5" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Completeness by Category</h3>
                <div className="space-y-3">
                  {Object.entries(quality.completeness_by_category || {}).map(([cat, data]) => (
                    <div key={cat}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: "var(--text-secondary)" }}>{cat}</span>
                        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{data?.completeness_pct ?? 0}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--neutral-100)" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${data?.completeness_pct ?? 0}%`, background: (data?.completeness_pct ?? 0) >= 80 ? "var(--color-success)" : (data?.completeness_pct ?? 0) >= 60 ? "var(--color-warning)" : "var(--color-error)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Attributes */}
            {quality?.missing_by_attribute && Object.keys(quality.missing_by_attribute).length > 0 && (
              <div className="rounded-lg border p-5" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Missing Attributes Breakdown</h3>
                <div className="space-y-2">
                  {Object.entries(quality.missing_by_attribute || {}).sort((a, b) => b[1] - a[1]).map(([attr, count]) => (
                    <div key={attr} className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
                      style={{ background: "var(--color-error-light)", border: "1px solid var(--color-error-border)" }}>
                      <span style={{ color: "var(--text-primary)" }}>{attr}</span>
                      <span className="font-semibold" style={{ color: "var(--color-error)" }}>{count} missing</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Compliance Tab */}
        {activeTab === "compliance" && compliance && (
          <div className="space-y-6">
            <div className="rounded-lg border p-5" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
              <div className="flex items-center gap-3 mb-4">
                <Shield size={20} style={{ color: "var(--accent-primary)" }} />
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Overall Compliance</h3>
                  <div className="text-2xl font-bold" style={{ color: (compliance.overall_compliance_rate ?? 90) >= 80 ? "var(--color-success)" : "var(--color-warning)" }}>
                    {compliance.overall_compliance_rate ?? 90}%
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-5" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Compliance by Category</h3>
              <div className="space-y-3">
                {Object.entries(compliance.by_category || {}).map(([cat, data]) => (
                  <div key={cat} className="rounded-lg border p-4" style={{ borderColor: "var(--border-default)", background: "var(--neutral-50)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{cat}</span>
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{data?.total_products ?? 0} products</span>
                    </div>
                    <div className="flex gap-2 text-[11px]">
                      <span className="flex items-center gap-1" style={{ color: "var(--color-success)" }}>
                        <CheckCircle size={10} /> {data?.compliant ?? 0} compliant
                      </span>
                      <span className="flex items-center gap-1" style={{ color: "var(--color-warning)" }}>
                        <AlertTriangle size={10} /> {data?.pending ?? 0} pending
                      </span>
                      <span className="flex items-center gap-1" style={{ color: "var(--color-error)" }}>
                        <AlertTriangle size={10} /> {data?.non_compliant ?? 0} non-compliant
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Audit Trail Tab */}
        {activeTab === "audit" && (
          <div className="space-y-4">
            <div className="rounded-lg border p-5" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Activity Timeline</h3>
              {auditTrail.length === 0 ? (
                <div className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>No audit entries yet.</div>
              ) : (
                <div className="relative">
                  <div className="absolute left-[18px] top-0 bottom-0 w-px" style={{ background: "var(--neutral-200)" }} />
                  <div className="space-y-3 pl-10">
                    {auditTrail.map((entry, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-6 top-2 h-2.5 w-2.5 rounded-full border-2 border-white"
                          style={{ background: entry.action.includes("approved") ? "var(--color-success)" : entry.action.includes("rejected") ? "var(--color-error)" : "var(--accent-primary)" }} />
                        <div className="rounded-lg border p-3" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{entry.field}</span>
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ""}
                            </span>
                          </div>
                          <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                            {entry.product_name && <span className="font-medium">{entry.product_name}</span>}
                            {entry.old_value && entry.new_value && (
                              <span> — {entry.old_value} → {entry.new_value}</span>
                            )}
                          </div>
                          {entry.reviewer && (
                            <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>By {entry.reviewer}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <ReportsContent />
    </ProtectedRoute>
  );
}
