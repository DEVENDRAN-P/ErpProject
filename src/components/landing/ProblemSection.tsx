"use client";

import { useReveal } from "./useAnimations";
import { AlertTriangle, Search, ArrowRight } from "lucide-react";

const PROBLEMS = [
  {
    icon: <Search size={20} />,
    title: "Scattered Data",
    desc: "Product specs live in PDFs, spreadsheets, websites, and emails — never in one place.",
  },
  {
    icon: <AlertTriangle size={20} />,
    title: "Conflicting Sources",
    desc: "Different sources list different values for the same attribute with no way to tell which is correct.",
  },
];

export default function ProblemSection() {
  const r1 = useReveal();

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={r1.ref} className={`text-center mb-16 ${r1.className}`} style={r1.style}>
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">The Problem</p>
          <h2 className="text-center text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
            Industrial Product Data Is Broken.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {PROBLEMS.map((p, i) => (
            <div key={i}
              className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg hover:border-gray-200 transition-all duration-300 group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-100 transition-colors">
                {p.icon}
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2">{p.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 md:p-10">
          <h3 className="text-lg font-bold text-gray-900 mb-4">The Result?</h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Teams spend hours manually reconciling conflicting product data, missing attributes go unnoticed,
            and commerce-ready specifications never make it to ERP or PIM systems on time.
          </p>
          <div className="flex flex-wrap gap-2">
            {["Manual Reconciliation", "Missing Attributes", "Delayed Time-to-Market", "Revenue Loss"].map((s) => (
              <span key={s} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg border border-gray-200">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
