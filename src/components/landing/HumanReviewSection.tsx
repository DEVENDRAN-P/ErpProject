"use client";

import { useReveal } from "./useAnimations";
import { Users, AlertTriangle, HelpCircle, TrendingDown } from "lucide-react";

const REVIEW_ITEMS = [
  { type: "Conflict", icon: <AlertTriangle size={14} className="text-amber-500" />, label: "Maximum Temperature", detail: "155 °C vs 130 °C", bg: "bg-amber-50 border-amber-100" },
  { type: "Missing", icon: <HelpCircle size={14} className="text-gray-400" />, label: "Total Weight", detail: "Insufficient evidence", bg: "bg-gray-50 border-gray-100" },
  { type: "Low Confidence", icon: <TrendingDown size={14} className="text-orange-500" />, label: "Efficiency", detail: "82%", bg: "bg-orange-50 border-orange-100" },
];

export default function HumanReviewSection() {
  const r1 = useReveal();
  const r2 = useReveal(150);

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: Review UI */}
          <div ref={r1.ref} className={`${r1.className}`} style={r1.style}>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-blue-600" />
                  <span className="text-sm font-bold text-gray-900">Review Center</span>
                </div>
                <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                  3 items require review
                </span>
              </div>

              {/* Queue items */}
              <div className="divide-y divide-gray-50">
                {REVIEW_ITEMS.map((item, i) => (
                  <div key={i} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {item.icon}
                        <div>
                          <div className="text-xs font-medium text-gray-400">{item.type}</div>
                          <div className="text-sm font-bold text-gray-900">{item.label}</div>
                          <div className="text-xs text-gray-500">{item.detail}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors">
                          Approve
                        </button>
                        <button className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                          Edit
                        </button>
                        <button className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-white border border-gray-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Audit footer */}
              <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Audit Trail</div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span><strong className="text-gray-700">Admin</strong> APPROVED Voltage</span>
                  <span className="text-gray-300">|</span>
                  <span>Aug 21, 2026 14:32</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Explanation */}
          <div ref={r2.ref} className={`${r2.className}`} style={r2.style}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-6">
              <Users size={12} className="text-blue-600" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">Human Review</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
              AI Finds the Problem.<br />Humans Make the Final Call.
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-6">
              ProductPilot flags conflicts, missing data, and low-confidence values for human review.
              Every decision is recorded in an audit trail.
            </p>
            <div className="space-y-3">
              {[
                { action: "Approve", desc: "Mark as verified, update health score" },
                { action: "Edit", desc: "Accept corrected value, preserve evidence" },
                { action: "Reject", desc: "Invalidate value, update status" },
              ].map((a, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${i === 0 ? "bg-emerald-500" : i === 1 ? "bg-blue-500" : "bg-red-500"}`} />
                  <span className="text-sm font-semibold text-gray-900">{a.action}</span>
                  <span className="text-sm text-gray-500">— {a.desc}</span>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm font-semibold text-blue-600">
              Every decision is recorded in an audit trail.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
