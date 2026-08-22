"use client";

import Link from "next/link";
import { ChevronRight, Play, Shield, Zap, CheckCircle2 } from "lucide-react";
import { useInView, useCountUp } from "./useAnimations";

function FloatingNode({
  label,
  value,
  confidence,
  status,
  style,
  delay,
}: {
  label: string;
  value: string;
  confidence?: string;
  status?: "verified" | "conflict" | "missing";
  style: string;
  delay: number;
}) {
  const { ref, inView } = useInView(0.2);
  const statusColor =
    status === "verified"
      ? "text-emerald-600 bg-emerald-50 border-emerald-200"
      : status === "conflict"
      ? "text-amber-600 bg-amber-50 border-amber-200"
      : "text-gray-400 bg-gray-50 border-gray-200";

  return (
    <div
      ref={ref}
      className={`absolute ${style} transition-all duration-700 ease-out ${
        inView ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="bg-white rounded-xl border border-gray-100 shadow-lg shadow-gray-200/50 px-4 py-3 min-w-[140px]">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">{label}</div>
        <div className="text-base font-bold text-gray-900">{value}</div>
        <div className="flex items-center gap-2 mt-1.5">
          {confidence && (
            <span className="text-[10px] font-medium text-blue-600">{confidence}</span>
          )}
          {status && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${statusColor}`}>
              {status === "verified" ? "VERIFIED" : status === "conflict" ? "CONFLICT" : "MISSING"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function HealthScoreCircle() {
  const { ref, count } = useCountUp(87, 1500);
  return (
    <div
      ref={ref}
      className="absolute bottom-8 right-8 transition-all duration-700 delay-700 ease-out"
    >
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="#E5E7EB" strokeWidth="6" />
          <circle
            cx="50" cy="50" r="42"
            fill="none"
            stroke="#2563EB"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${(count / 100) * 264} 264`}
            className="transition-all duration-100"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-gray-900">{count}</span>
          <span className="text-[8px] font-semibold uppercase tracking-wider text-gray-400">/ 100</span>
        </div>
      </div>
      <div className="text-center mt-1 text-[9px] font-bold uppercase tracking-widest text-blue-600">
        Commerce Ready
      </div>
    </div>
  );
}

export default function Hero() {
  const { ref: heroRef, inView: heroVisible } = useInView(0.1);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-white pt-20">




      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-20 lg:py-0">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Text */}
          <div ref={heroRef} className={`transition-all duration-700 ease-out ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-6">
              <Zap size={12} className="text-blue-600" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                AI-Powered Industrial Product Intelligence
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold leading-[1.1] tracking-tight text-gray-900 mb-6">
              Turn Scattered Industrial Data Into{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-500">
                Trusted Product Intelligence.
              </span>
            </h1>

            {/* Description */}
            <p className="text-lg text-gray-500 leading-relaxed max-w-xl mb-8">
              NexGen transforms PDFs, web catalogs, images, CSVs, and manual data
              into structured, validated, evidence-backed product information ready for
              commerce, ERP, and PIM systems.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 mb-8">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:shadow-xl hover:shadow-blue-500/30"
              >
                Start Building Product Intelligence
                <ChevronRight size={16} />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-all"
              >
                <Play size={14} className="text-blue-600" />
                Explore How It Works
              </a>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center gap-4 text-[12px] text-gray-400">
              <div className="flex items-center gap-1.5">
                <Shield size={12} className="text-emerald-500" />
                <span>No hallucinated specifications</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-gray-300" />
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span>Evidence-backed</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-gray-300" />
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span>Human verified</span>
              </div>
            </div>
          </div>

          {/* Right: Visualization */}
          <div className="relative h-[480px] lg:h-[520px]">
            {/* Connection lines SVG */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 500 500">
              <defs>
                <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#1E40AF" stopOpacity="0.08" />
                </linearGradient>
              </defs>
              <line x1="250" y1="200" x2="80" y2="80" stroke="url(#line-grad)" strokeWidth="1.5" />
              <line x1="250" y1="200" x2="420" y2="100" stroke="url(#line-grad)" strokeWidth="1.5" />
              <line x1="250" y1="200" x2="420" y2="280" stroke="url(#line-grad)" strokeWidth="1.5" />
              <line x1="250" y1="200" x2="80" y2="340" stroke="url(#line-grad)" strokeWidth="1.5" />
              <line x1="250" y1="200" x2="250" y2="420" stroke="url(#line-grad)" strokeWidth="1" strokeDasharray="4 4" />
            </svg>

            {/* Central product card */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px]">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/40 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">ProductTwin</div>
                    <div className="text-sm font-bold text-gray-900">Siemens 1LE1001</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mb-3">15 kW Industrial Motor</div>
                <div className="space-y-2">
                  {[
                    { name: "Voltage", val: "415 V", conf: "96%", ok: true },
                    { name: "Power", val: "15 kW", conf: "98%", ok: true },
                    { name: "Efficiency", val: "IE3", conf: "94%", ok: true },
                  ].map((a) => (
                    <div key={a.name} className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{a.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{a.val}</span>
                        <span className="text-[10px] font-medium text-blue-600">{a.conf}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating nodes */}
            <FloatingNode label="Voltage" value="415 V" confidence="96%" status="verified"
              style="top-[5%] left-[2%]" delay={200} />
            <FloatingNode label="Power" value="15 kW" confidence="98%" status="verified"
              style="top-[5%] right-[2%]" delay={400} />
            <FloatingNode label="Temperature" value="155 °C" status="conflict"
              style="top-[50%] right-[0%]" delay={600} />
            <FloatingNode label="Weight" value="Insufficient evidence" status="missing"
              style="bottom-[20%] left-[2%]" delay={800} />

            {/* Health score circle */}
            <HealthScoreCircle />
          </div>
        </div>
      </div>
    </section>
  );
}
