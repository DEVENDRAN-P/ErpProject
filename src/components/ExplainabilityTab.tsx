"use client";

import React, { useState, useEffect } from "react";
import { fetchExplainability, fetchAttributeExplanation } from "@/lib/api";
import { ExplainabilityResponse, AttributeExplanation } from "@/lib/types";
import { Eye, ChevronDown, ChevronRight, FileText, Cpu, Layers, AlertTriangle, CheckCircle } from "lucide-react";

const METHOD_LABELS: Record<string, { label: string; color: string }> = {
  rule_based: { label: "Rule-Based", color: "var(--color-success)" },
  llm: { label: "LLM", color: "var(--color-purple)" },
  hybrid: { label: "Hybrid", color: "var(--accent-primary)" },
};

function ConfidenceBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? "var(--color-success)" : pct >= 70 ? "var(--color-warning)" : "var(--color-error)";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]" style={{ color: "var(--text-secondary)" }}>
        <span>{label}</span>
        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{pct}%</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--neutral-100)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function ExplanationCard({ explanation }: { explanation: AttributeExplanation }) {
  const [expanded, setExpanded] = useState(false);
  const method = METHOD_LABELS[explanation.extraction_method] || { label: explanation.extraction_method, color: "var(--text-muted)" };

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition"
        style={{ background: expanded ? "var(--accent-primary-light)" : "transparent" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{explanation.attribute_label || explanation.attribute_key}</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{explanation.chosen_value || "No value"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `${method.color}20`, color: method.color }}>
            {method.label}
          </span>
          <span className="text-xs font-semibold" style={{
            color: explanation.confidence_score >= 0.9 ? "var(--color-success)" : explanation.confidence_score >= 0.7 ? "var(--color-warning)" : "var(--color-error)"
          }}>
            {Math.round(explanation.confidence_score * 100)}%
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 py-4 space-y-4" style={{ borderColor: "var(--border-subtle)" }}>
          {/* Source */}
          <div className="flex items-start gap-2">
            <FileText size={14} style={{ color: "var(--text-muted)", marginTop: 2 }} />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Source Document</div>
              <div className="text-xs" style={{ color: "var(--text-primary)" }}>
                {explanation.source_document || "Unknown"} {explanation.source_page ? `(Page ${explanation.source_page})` : ""}
              </div>
            </div>
          </div>

          {/* Confidence Breakdown */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Confidence Breakdown</div>
            <div className="space-y-2">
              <ConfidenceBar value={explanation.confidence_breakdown.unit_match} label="Unit Match" />
              <ConfidenceBar value={explanation.confidence_breakdown.context_match} label="Context Match" />
              <ConfidenceBar value={explanation.confidence_breakdown.plausibility} label="Plausibility" />
            </div>
          </div>

          {/* Evidence Quote */}
          {explanation.evidence_quote && (
            <div className="rounded-lg border-l-2 pl-3 py-2 text-xs italic" style={{ borderColor: "var(--accent-primary)", background: "var(--accent-primary-light)", color: "var(--text-secondary)" }}>
              &ldquo;{explanation.evidence_quote}&rdquo;
            </div>
          )}

          {/* Alternative Values */}
          {explanation.alternative_values.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Alternatives Considered</div>
              <div className="space-y-1.5">
                {explanation.alternative_values.map((alt, i) => (
                  <div key={i} className="rounded-lg border p-2.5 text-xs" style={{ borderColor: "var(--border-default)", background: "var(--neutral-50)" }}>
                    <div className="flex items-center justify-between">
                      <span style={{ color: "var(--text-primary)" }}>{alt.value || "N/A"}</span>
                      <span style={{ color: "var(--text-muted)" }}>{Math.round(alt.confidence * 100)}%</span>
                    </div>
                    {alt.reason_rejected && <div className="mt-0.5" style={{ color: "var(--text-muted)" }}>{alt.reason_rejected}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reasoning Chain */}
          {explanation.reasoning_chain.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Reasoning Chain</div>
              <div className="space-y-2">
                {explanation.reasoning_chain.map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: "var(--accent-primary)", color: "white" }}>
                      {step.step}
                    </div>
                    <div>
                      <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{step.action}</div>
                      <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{step.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ExplainabilityTab({ productId }: { productId: number }) {
  const [data, setData] = useState<ExplainabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, [productId]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchExplainability(productId);
      setData(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>;
  if (error) return <div className="rounded-lg p-4 text-sm" style={{ background: "var(--color-error-light)", color: "var(--color-error)" }}>{error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
          <div className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>Total Attributes</div>
          <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{data.total_attributes}</div>
        </div>
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--color-success-border)", background: "var(--color-success-light)" }}>
          <div className="text-[11px] font-medium" style={{ color: "var(--color-success)" }}>High Confidence</div>
          <div className="text-lg font-bold" style={{ color: "var(--color-success)" }}>{data.summary.high_confidence_count}</div>
        </div>
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--color-warning-border)", background: "var(--color-warning-light)" }}>
          <div className="text-[11px] font-medium" style={{ color: "var(--color-warning)" }}>Medium</div>
          <div className="text-lg font-bold" style={{ color: "var(--color-warning)" }}>{data.summary.medium_confidence_count}</div>
        </div>
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--color-error-border)", background: "var(--color-error-light)" }}>
          <div className="text-[11px] font-medium" style={{ color: "var(--color-error)" }}>Low</div>
          <div className="text-lg font-bold" style={{ color: "var(--color-error)" }}>{data.summary.low_confidence_count}</div>
        </div>
      </div>

      {/* Extraction methods */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Layers size={12} style={{ color: "var(--color-success)" }} />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{data.summary.rule_based_extractions} rule-based</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Cpu size={12} style={{ color: "var(--color-purple)" }} />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{data.summary.llm_extractions} LLM</span>
        </div>
      </div>

      {/* Explanation Cards */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>AI Decision Explanations</h3>
        <div className="space-y-2">
          {data.explanations.map((explanation) => (
            <ExplanationCard key={explanation.attribute_key} explanation={explanation} />
          ))}
        </div>
      </div>
    </div>
  );
}
