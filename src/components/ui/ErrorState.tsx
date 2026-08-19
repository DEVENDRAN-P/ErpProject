"use client";

import React from "react";

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-4" style={{ background: "var(--color-error-light)", color: "var(--color-error)" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      </div>
      <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{title}</h3>
      <p className="text-sm max-w-sm mb-4" style={{ color: "var(--text-secondary)" }}>{message}</p>
      {onRetry && (
        <button onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition"
          style={{ borderColor: "var(--border-default)", color: "var(--text-primary)", background: "var(--bg-card)" }}>
          Retry
        </button>
      )}
    </div>
  );
}
