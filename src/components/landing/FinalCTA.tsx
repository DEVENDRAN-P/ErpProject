"use client";

import Link from "next/link";
import { ChevronRight, Play } from "lucide-react";
import { useReveal } from "./useAnimations";

export default function FinalCTA() {
  const r1 = useReveal();

  return (
    <section className="relative py-24 overflow-hidden">
      {/* Blue gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-800 to-blue-900" />

      {/* Decorative grid */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      {/* Decorative orbs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl" />

      <div ref={r1.ref} className={`relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center ${r1.className}`} style={r1.style}>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
          Make Every Product Specification Trustworthy.
        </h2>
        <p className="text-lg text-blue-100/80 max-w-2xl mx-auto mb-10 leading-relaxed">
          Turn scattered industrial information into structured, validated, evidence-backed product intelligence.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 text-sm font-bold text-blue-700 bg-white hover:bg-blue-50 rounded-xl shadow-xl shadow-black/10 transition-all"
          >
            Get Started with ProductPilot
            <ChevronRight size={16} />
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 px-8 py-4 text-sm font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
          >
            <Play size={14} />
            See How It Works
          </a>
        </div>
      </div>
    </section>
  );
}
