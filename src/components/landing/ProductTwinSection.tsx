"use client";

import { useReveal, useInView } from "./useAnimations";
import { Shield, CheckCircle2, AlertTriangle, HelpCircle, FileText } from "lucide-react";

const ATTRS = [
  { name: "Voltage", value: "415 V", unit: "", status: "VERIFIED", conf: 96, icon: <CheckCircle2 size={14} className="text-emerald-500" /> },
  { name: "Power", value: "15 kW", unit: "", status: "VERIFIED", conf: 98, icon: <CheckCircle2 size={14} className="text-emerald-500" /> },
  { name: "Efficiency", value: "IE3", unit: "", status: "VERIFIED", conf: 94, icon: <CheckCircle2 size={14} className="text-emerald-500" /> },
  { name: "Max Temperature", value: "155 °C", unit: "", status: "CONFLICT", conf: 82, icon: <AlertTriangle size={14} className="text-amber-500" /> },
  { name: "Total Weight", value: "Insufficient evidence", unit: "", status: "MISSING", conf: 0, icon: <HelpCircle size={14} className="text-gray-400" /> },
];

export default function ProductTwinSection() {
  const r1 = useReveal();
  const r2 = useReveal(150);

  return (
    <section className="py-24 bg-gray-50/50" id="product">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: UI mockup */}
          <div ref={r1.ref} className={`${r1.className}`} style={r1.style}>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">ProductTwin</span>
                </div>
                <div className="text-sm font-bold text-gray-900">Siemens 1LE1001</div>
                <div className="text-xs text-gray-500">Industrial Motor</div>
              </div>

              {/* Attributes */}
              <div className="divide-y divide-gray-50">
                {ATTRS.map((a) => (
                  <div key={a.name} className="px-6 py-3.5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      {a.icon}
                      <div>
                        <div className="text-xs font-medium text-gray-500">{a.name}</div>
                        <div className="text-sm font-bold text-gray-900">{a.value}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <div className="text-right">
                        <div className="text-[10px] font-semibold text-blue-600">{a.conf > 0 ? `${a.conf}%` : "—"}</div>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        a.status === "VERIFIED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        a.status === "CONFLICT" ? "bg-amber-50 text-amber-700 border-amber-200" :
                        "bg-gray-100 text-gray-500 border-gray-200"
                      }`}>
                        {a.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center gap-2 text-[10px] text-gray-400">
                <FileText size={10} />
                <span>Every value is traceable to evidence</span>
              </div>
            </div>
          </div>

          {/* Right: Explanation */}
          <div ref={r2.ref} className={`${r2.className}`} style={r2.style}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-6">
              <Shield size={12} className="text-blue-600" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">ProductTwin</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
              Every Product Gets a Digital Twin.
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-8">
              ProductTwin creates a structured digital profile for every industrial product and every specification.
              Each attribute includes value, unit, confidence, status, source, and evidence.
            </p>
            <div className="space-y-4">
              {[
                { label: "Value + Unit", desc: "Extracted or entered with full precision" },
                { label: "Confidence Score", desc: "0–100% based on source quality and extraction method" },
                { label: "Status Tracking", desc: "VERIFIED, CONFLICT, MISSING, LOW_CONFIDENCE" },
                { label: "Source Evidence", desc: "Page number, exact quote, and document reference" },
              ].map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 size={12} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{f.label}</div>
                    <div className="text-xs text-gray-500">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm font-semibold text-blue-600">Every value is traceable to evidence.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
