"use client";

import { useReveal } from "./useAnimations";
import { Download, ArrowRight, Code, Table } from "lucide-react";

export default function ExportSection() {
  const r1 = useReveal();
  const r2 = useReveal(150);

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: Explanation */}
          <div ref={r1.ref} className={`${r1.className}`} style={r1.style}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-50 border border-cyan-100 mb-6">
              <Download size={12} className="text-cyan-600" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-600">Export</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
              From Product Intelligence to Your Commerce Stack.
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-8">
              Export structured, validated, evidence-backed product data in JSON or CSV format
              for your ERP, PIM, e-commerce, or catalog systems.
            </p>

            {/* Flow */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg">ProductPilot AI</div>
              <ArrowRight size={16} className="text-gray-300" />
              <div className="px-4 py-2 bg-gray-100 border border-gray-200 text-gray-700 text-sm font-bold rounded-lg">JSON / CSV</div>
              <ArrowRight size={16} className="text-gray-300" />
              <div className="flex gap-2">
                {["ERP", "PIM", "E-Commerce", "Catalog"].map((d) => (
                  <span key={d} className="px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg">{d}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Right: JSON preview */}
          <div ref={r2.ref} className={`${r2.className}`} style={r2.style}>
            <div className="bg-gray-900 rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                </div>
                <span className="text-[10px] font-medium text-gray-500 ml-2">product_export.json</span>
              </div>
              <pre className="p-5 text-sm text-gray-300 font-mono leading-relaxed overflow-x-auto">
{`{
  "product": "Siemens 1LE1001",
  "category": "Industrial Motors",
  "attributes": {
    "rated_power": {
      "value": "15 kW",
      "confidence": 0.98,
      "status": "VERIFIED",
      "source": "Official Datasheet",
      "evidence": "Rated power: 15 kW"
    },
    "supply_voltage": {
      "value": "415 V",
      "confidence": 0.96,
      "status": "VERIFIED"
    },
    "efficiency_class": {
      "value": "IE3",
      "confidence": 0.94,
      "status": "VERIFIED"
    }
  },
  "health_score": 87,
  "version": "V2",
  "exported_at": "2026-08-21T14:32:00Z"
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
