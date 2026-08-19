"use client";

import React from "react";

export function KpiCard({
  label,
  value,
  icon,
  color = "var(--accent-primary)",
  loading = false,
}: {
  label: string;
  value: number | string | undefined;
  icon: React.ReactNode;
  color?: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-4 hover:shadow-[var(--shadow-sm)] transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${color}10`, color }}>
          {icon}
        </div>
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
        {loading ? <div className="h-7 w-16 skeleton" /> : value ?? "–"}
      </div>
    </div>
  );
}
