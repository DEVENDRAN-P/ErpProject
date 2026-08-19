"use client";

import React from "react";

export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-4 ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-5 space-y-3">
      <SkeletonLine className="w-1/3" />
      <SkeletonLine className="w-2/3" />
      <SkeletonLine className="w-1/2" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-3">
          <SkeletonLine className="w-32 h-3" />
          <SkeletonLine className="flex-1 h-3" />
          <SkeletonLine className="w-16 h-3" />
          <SkeletonLine className="w-20 h-5 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6 page-enter">
      <div className="space-y-2">
        <SkeletonLine className="w-48 h-7" />
        <SkeletonLine className="w-72 h-4" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-4 space-y-3">
            <SkeletonLine className="w-20 h-3" />
            <SkeletonLine className="w-16 h-7" />
          </div>
        ))}
      </div>
      <SkeletonCard />
    </div>
  );
}
