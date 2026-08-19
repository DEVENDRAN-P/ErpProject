import React from "react";

type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral" | "purple";

const VARIANT_MAP: Record<BadgeVariant, string> = {
  success: "badge-success",
  warning: "badge-warning",
  error: "badge-error",
  info: "badge-info",
  neutral: "badge-neutral",
  purple: "badge-purple",
};

export function StatusBadge({ label, variant }: { label: string; variant: BadgeVariant }) {
  return <span className={`badge ${VARIANT_MAP[variant]}`}>{label}</span>;
}

/* ── Status from string ── */
const STATUS_MAP: Record<string, BadgeVariant> = {
  verified: "success",
  approved: "success",
  resolved: "success",
  conflict: "error",
  not_found: "error",
  rejected: "error",
  missing: "error",
  needs_review: "warning",
  pending: "warning",
  open: "warning",
  extracted: "info",
  normalized: "purple",
  edited: "purple",
  insufficient_evidence: "neutral",
};

export function StatusBadgeFromStatus({ status }: { status?: string }) {
  const s = (status || "").toLowerCase();
  const variant = STATUS_MAP[s] || "neutral";
  const label = (status || "unknown").replace(/_/g, " ");
  return <StatusBadge label={label} variant={variant} />;
}
