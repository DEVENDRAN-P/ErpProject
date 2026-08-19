"use client";

import React from "react";
import Link from "next/link";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl mb-4" style={{ background: "var(--neutral-100)", color: "var(--neutral-400)" }}>
        {icon}
      </div>
      <h3 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{title}</h3>
      <p className="text-sm max-w-sm mb-6" style={{ color: "var(--text-secondary)" }}>{description}</p>
      {action && (
        <Link href={action.href}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition"
          style={{ background: "var(--accent-primary)" }}>
          {action.label}
        </Link>
      )}
    </div>
  );
}
