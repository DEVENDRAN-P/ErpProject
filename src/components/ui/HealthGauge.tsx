"use client";

import React from "react";

export function HealthGauge({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 80 ? "#059669" : score >= 60 ? "#D97706" : "#DC2626";
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Needs Attention" : "Critical";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--neutral-200)" strokeWidth="5" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${circ}`} strokeDashoffset={`${offset}`}
            strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)" }} />
        </svg>
        <span className="absolute text-xl font-bold" style={{ color: "var(--text-primary)" }}>{score}</span>
      </div>
      <span className="text-[10px] font-medium" style={{ color: color }}>{label}</span>
    </div>
  );
}
