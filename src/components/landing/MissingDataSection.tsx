"use client";

import { useReveal } from "./useAnimations";
import { HelpCircle, Shield } from "lucide-react";

export default function MissingDataSection() {
  const r1 = useReveal();
  const r2 = useReveal(150);

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div ref={r1.ref} className={`${r1.className}`} style={r1.style}>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">Trust Feature</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
              If There Is No Evidence,<br />NexGen Says So.
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-6">
              NexGen does not invent technical specifications. Missing information
              remains explicitly unresolved until supporting evidence is found.
            </p>
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
              <Shield size={16} />
              <span>A core trust principle of NexGen</span>
            </div>
          </div>

          <div ref={r2.ref} className={`${r2.className}`} style={r2.style}>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Product Attribute</div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-gray-900">Total Weight</div>
                  <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                    MISSING
                  </span>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                  <div className="flex items-start gap-3">
                    <HelpCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-amber-800">Insufficient evidence.</div>
                      <div className="text-xs text-amber-600 mt-1">
                        No source document contains a weight specification for this product.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-gray-100 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Value</span>
                    <span className="font-medium text-gray-400">null</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Confidence</span>
                    <span className="font-medium text-gray-400">0%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Status</span>
                    <span className="font-medium text-gray-400">NOT_FOUND</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Source</span>
                    <span className="font-medium text-gray-400">—</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
