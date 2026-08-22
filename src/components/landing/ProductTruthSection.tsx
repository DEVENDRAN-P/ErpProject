"use client";

import { useReveal, useInView } from "./useAnimations";
import { AlertTriangle, CheckCircle2, Shield } from "lucide-react";

export default function ProductTruthSection() {
  const r1 = useReveal();
  const r2 = useReveal(150);

  return (
    <section className="py-24 bg-white" id="features">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={r1.ref} className={`text-center mb-16 ${r1.className}`} style={r1.style}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 mb-6">
            <AlertTriangle size={12} className="text-amber-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">ProductTruth</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
            Know Which Specification to Trust.
          </h2>
        </div>

        <div ref={r2.ref} className={`${r2.className}`} style={r2.style}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden">
            {/* Conflict header */}
            <div className="px-8 py-4 bg-amber-50 border-b border-amber-100 flex items-center justify-center gap-3">
              <AlertTriangle size={16} className="text-amber-600" />
              <span className="text-sm font-bold text-amber-700 uppercase tracking-wider">Conflict Detected</span>
              <AlertTriangle size={16} className="text-amber-600" />
            </div>

            <div className="p-8">
              <div className="text-center mb-8">
                <div className="text-sm font-bold text-gray-900 mb-1">Maximum Temperature</div>
              </div>

              {/* Two sources */}
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* Source A */}
                <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/30 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Official Datasheet</span>
                  </div>
                  <div className="text-3xl font-extrabold text-gray-900 mb-2">155 °C</div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Confidence</span>
                      <span className="font-semibold text-emerald-700">96%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Source Reliability</span>
                      <span className="font-semibold text-emerald-700">High</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-emerald-100">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Evidence</div>
                      <div className="text-xs text-gray-600 italic">&ldquo;Maximum operating temperature: 155°C&rdquo;</div>
                    </div>
                  </div>
                </div>

                {/* Source B */}
                <div className="rounded-xl border border-gray-200 bg-gray-50/30 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-600">Legacy Web Catalog</span>
                  </div>
                  <div className="text-3xl font-extrabold text-gray-900 mb-2">130 °C</div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Confidence</span>
                      <span className="font-semibold text-gray-600">72%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Source Reliability</span>
                      <span className="font-semibold text-gray-600">Medium</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Evidence</div>
                      <div className="text-xs text-gray-600 italic">&ldquo;Operating temperature: 130°C&rdquo;</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendation */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center">
                <div className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-2">Recommended Value</div>
                <div className="text-2xl font-extrabold text-blue-700 mb-2">155 °C</div>
                <p className="text-sm text-blue-600 max-w-md mx-auto">
                  Official datasheet has higher source reliability and stronger evidence.
                </p>
              </div>

              {/* Trust note */}
              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
                <Shield size={12} />
                <span>NexGen NEVER silently overwrites conflicting values.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
