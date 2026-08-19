"use client";

import React from "react";
import Link from "next/link";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}) {
  return (
    <div className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3">
          {breadcrumbs.map((b, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-xs" style={{ color: "var(--text-muted)" }}>/</span>}
              {b.href ? (
                <Link href={b.href} className="text-xs font-medium hover:underline" style={{ color: "var(--accent-primary)" }}>{b.label}</Link>
              ) : (
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{b.label}</span>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{title}</h1>
          {description && <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
