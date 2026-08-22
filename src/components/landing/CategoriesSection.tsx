"use client";

import { useReveal, useInView } from "./useAnimations";
import { Grid3X3 } from "lucide-react";

const CATEGORIES = [
  "Electric Motors", "Pumps", "Bearings", "Gearboxes",
  "Sensors", "Valves", "Compressors", "Industrial Automation",
  "Electrical Components", "Power Equipment", "Hydraulics", "Pneumatics",
];

export default function CategoriesSection() {
  const r1 = useReveal();

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={r1.ref} className={`text-center mb-14 ${r1.className}`} style={r1.style}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-6">
            <Grid3X3 size={12} className="text-blue-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">Categories</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
            Built Beyond Motors.
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            NexGen is category-agnostic and designed to scale across industrial product catalogs.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {CATEGORIES.map((cat, i) => (
            <CategoryCard key={cat} name={cat} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoryCard({ name, index }: { name: string; index: number }) {
  const { ref, inView } = useInView(0.1);

  return (
    <div
      ref={ref}
      className={`bg-white rounded-xl border border-gray-100 p-4 text-center hover:shadow-lg hover:border-blue-200 hover:-translate-y-0.5 transition-all duration-300 cursor-default group ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
      style={{ transitionDelay: `${index * 40}ms` }}
    >
      <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400 group-hover:text-blue-500 transition-colors">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
      </div>
      <div className="text-xs font-semibold text-gray-700 group-hover:text-blue-700 transition-colors">{name}</div>
    </div>
  );
}
