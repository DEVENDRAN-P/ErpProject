"use client";

import { FileText, AlertTriangle, Search, Link2, ArrowRight } from "lucide-react";
import { useReveal } from "./useAnimations";

const PROBLEMS = [
  {
    icon: <FileText size={20} />,
    title: "Scattered Sources",
    desc: "Product specifications live across PDFs, websites, spreadsheets, images, and manual entries.",
  },
  {
    icon: <AlertTriangle size={20} />,
    title: "Conflicting Specifications",
    desc: "Different sources often contain contradictory values, outdated information, or inconsistent units.",
  },
  {
    icon: <Search size={20} />,
    title: "Missing Information",
    desc: "Critical specifications are frequently missing, forcing engineering teams to manually investigate.",
  },
  {
    icon: <Link2 size={20} />,
    title: "No Traceability",
    desc: "Without source evidence, teams cannot confidently determine where a product value came from.",
  },
];

const SOURCES = ["PDF", "CSV", "Website", "Image", "Manual Entry"];

export default function ProblemSection() {
  const r1 = useReveal();
  const r2 = useReveal(100);
  const r3 = useReveal(200);

  return (
    <section className="py-24 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={r1.ref} className={r1.className} style={r1.style}>
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">The Problem</p>
          <h2 className="text-center text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
            Industrial Product Data Is Everywhere.<br />
            Trustworthy Product Data Is Not.
          </h2>
        </div>

        <div ref={r2.ref} className={`grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-14 ${r2.className}`} style={r2.style}>
          {PROBLEMS.map((p, i) => (
            <div
              key={i}
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

        {/* Transformation visual */}
        <div ref={r3.ref} className={`mt-16 ${r3.className}`} style={r3.style}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 md:p-10">
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8">
              {/* Sources */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                {SOURCES.map((s) => (
                  <span key={s} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg border border-gray-200">
                    {s}
                  </span>
                ))}
              </div>

              <ArrowRight size={20} className="text-blue-400 rotate-90 md:rotate-0 shrink-0" />

              {/* ProductPilot */}
              <div className="px-5 py-3 bg-blue-600 rounded-xl text-white text-sm font-bold shadow-lg shadow-blue-500/20">
                ProductPilot AI
              </div>

              <ArrowRight size={20} className="text-blue-400 rotate-90 md:rotate-0 shrink-0" />

              {/* Result */}
              <div className="px-5 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-bold">
                Trusted Product Intelligence
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
