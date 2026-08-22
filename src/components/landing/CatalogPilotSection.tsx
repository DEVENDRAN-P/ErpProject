"use client";

import { useReveal, useInView } from "./useAnimations";
import { History, ArrowRight, GitBranch } from "lucide-react";

export default function CatalogPilotSection() {
  const r1 = useReveal();
  const r2 = useReveal(150);

  return (
    <section className="py-24 bg-gray-50/50" id="solutions">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={r1.ref} className={`text-center mb-16 ${r1.className}`} style={r1.style}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-100 mb-6">
            <History size={12} className="text-violet-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-600">CatalogPilot</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
            Know What Changed Between Product Versions.
          </h2>
        </div>

        <div className="max-w-3xl mx-auto">
          <div ref={r2.ref} className={`${r2.className}`} style={r2.style}>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden">
              {/* Change header */}
              <div className="px-6 py-4 bg-violet-50 border-b border-violet-100 flex items-center justify-center gap-3">
                <History size={16} className="text-violet-600" />
                <span className="text-sm font-bold text-violet-700 uppercase tracking-wider">Change Detected</span>
              </div>

              <div className="p-8">
                <div className="text-center mb-8">
                  <div className="text-sm font-bold text-gray-900 mb-1">Operating Temperature</div>
                </div>

                {/* Before / After */}
                <div className="flex items-center justify-center gap-6 mb-8">
                  <div className="text-center">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Version 1</div>
                    <div className="px-6 py-4 bg-gray-50 border border-gray-200 rounded-xl">
                      <div className="text-2xl font-extrabold text-gray-400">70 °C</div>
                    </div>
                  </div>

                  <ArrowRight size={24} className="text-violet-400 shrink-0" />

                  <div className="text-center">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-violet-600 mb-2">Version 2</div>
                    <div className="px-6 py-4 bg-violet-50 border-2 border-violet-200 rounded-xl">
                      <div className="text-2xl font-extrabold text-violet-700">80 °C</div>
                    </div>
                  </div>
                </div>

                {/* Change details */}
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Change</span>
                    <span className="font-semibold text-gray-900">70 °C → 80 °C</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Source</span>
                    <span className="font-semibold text-gray-900">Updated Datasheet</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Confidence</span>
                    <span className="font-semibold text-blue-600">96%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Timestamp</span>
                    <span className="font-semibold text-gray-900">Aug 21, 2026</span>
                  </div>
                </div>

                {/* Version timeline */}
                <div className="mt-8 flex items-center justify-center gap-0">
                  {["V1", "V2", "V3"].map((v, i) => (
                    <div key={v} className="flex items-center">
                      <div className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold ${
                        i === 1 ? "bg-violet-100 text-violet-700 border border-violet-200" : "bg-gray-100 text-gray-500 border border-gray-200"
                      }`}>
                        <GitBranch size={10} />
                        {v}
                      </div>
                      {i < 2 && (
                        <div className="w-8 h-px bg-gray-300 mx-1" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
