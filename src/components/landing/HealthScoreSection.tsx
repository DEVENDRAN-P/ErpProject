"use client";

import { useReveal, useCountUp, useProgress } from "./useAnimations";
import { Activity } from "lucide-react";

const METRICS = [
  { label: "Completeness", value: 87.5, weight: "40%", barColor: "bg-blue-500" },
  { label: "Consistency", value: 80, weight: "30%", barColor: "bg-blue-400" },
  { label: "Confidence", value: 82.8, weight: "20%", barColor: "bg-violet-500" },
  { label: "Source Reliability", value: 90, weight: "10%", barColor: "bg-cyan-500" },
];

export default function HealthScoreSection() {
  const r1 = useReveal();

  return (
    <section className="py-24 bg-white" id="features">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={r1.ref} className={`text-center mb-16 ${r1.className}`} style={r1.style}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 mb-6">
            <Activity size={12} className="text-emerald-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Health Score</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
            Measure Product Data Quality at a Glance.
          </h2>
        </div>

        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/40 p-8 md:p-10">
          <div className="flex flex-col md:flex-row items-center gap-10">
            {/* Circular score */}
            <div className="shrink-0">
              <ScoreCircle />
            </div>

            {/* Metrics */}
            <div className="flex-1 w-full space-y-5">
              {METRICS.map((m, i) => (
                <MetricBar key={m.label} metric={m} index={i} />
              ))}
            </div>
          </div>

          <div className="mt-8 text-center text-sm text-gray-400">
            Product health is recalculated dynamically as data changes.
          </div>
        </div>
      </div>
    </section>
  );
}

function ScoreCircle() {
  const { ref, count } = useCountUp(87, 1500);

  return (
    <div ref={ref} className="relative w-36 h-36">
      <svg className="w-36 h-36 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#E5E7EB" strokeWidth="7" />
        <circle
          cx="50" cy="50" r="42"
          fill="none"
          stroke="url(#score-gradient)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(count / 100) * 264} 264`}
          className="transition-all duration-100"
        />
        <defs>
          <linearGradient id="score-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1E40AF" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold text-gray-900">{count}</span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">/ 100</span>
      </div>
      <div className="text-center mt-2 text-[10px] font-bold uppercase tracking-widest text-blue-600">
        Commerce Ready
      </div>
    </div>
  );
}

function MetricBar({ metric, index }: { metric: typeof METRICS[0]; index: number }) {
  const { ref, width } = useProgress(metric.value, 1200);

  return (
    <div
      ref={ref}
      className="transition-all duration-500"
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{metric.label}</span>
          <span className="text-[10px] font-medium text-gray-400">Weight: {metric.weight}</span>
        </div>
        <span className="text-sm font-bold text-gray-900">{metric.value}%</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${metric.barColor} transition-all duration-100`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
