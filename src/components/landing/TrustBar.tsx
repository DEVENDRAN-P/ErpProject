"use client";

import { useReveal } from "./useAnimations";

const INDUSTRIES = [
  { name: "Industrial Manufacturing" },
  { name: "Engineering" },
  { name: "Distribution" },
  { name: "ERP / PIM" },
  { name: "Industrial Automation" },
];

export default function TrustBar() {
  const r = useReveal();
  return (
    <section className="py-16 border-t border-gray-100 bg-white" id="about">
      <div ref={r.ref} className={r.className} style={r.style}>
        <p className="text-center text-sm font-medium text-gray-400 uppercase tracking-wider mb-10">
          Built for the future of industrial commerce
        </p>
        <div className="max-w-5xl mx-auto px-4 flex flex-wrap items-center justify-center gap-8 md:gap-16">
          {INDUSTRIES.map((ind) => (
            <div key={ind.name} className="flex items-center gap-2 opacity-40 hover:opacity-70 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-gray-600 whitespace-nowrap">{ind.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
