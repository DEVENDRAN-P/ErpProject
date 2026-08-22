"use client";

import Link from "next/link";
import { ChevronRight, Play, Shield, Zap, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
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
      ? "text-[#059669] bg-[#ECFDF5] border-[#A7F3D0]"
      : status === "conflict"
      ? "text-[#D97706] bg-[#FFFBEB] border-[#FDE68A]"
      : "text-[#64748B] bg-slate-50 border-slate-200";

  return (
    <div
      ref={ref}
      className={`absolute ${style} transition-all duration-700 ease-out ${
        inView ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-lg shadow-slate-200/50 px-4 py-3 min-w-[150px]">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-1">{label}</div>
        <div className="text-base font-extrabold text-[#0F172A]">{value}</div>
        <div className="flex items-center gap-2 mt-1.5">
          {confidence && (
            <span className="text-[10px] font-bold text-[#0F766E]">{confidence}</span>
          )}
          {status && (
            <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${statusColor}`}>
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
      className="absolute bottom-6 right-6 transition-all duration-700 delay-700 ease-out"
    >
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="#E2E8F0" strokeWidth="6" />
          <circle
            cx="50" cy="50" r="42"
            fill="none"
            stroke="#0F766E"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${(count / 100) * 264} 264`}
            className="transition-all duration-100"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-[#0F172A]">{count}</span>
          <span className="text-[8px] font-bold uppercase tracking-wider text-[#64748B]">/ 100</span>
        </div>
      </div>
      <div className="text-center mt-1.5 text-[9px] font-extrabold uppercase tracking-widest text-[#0F766E]">
        Commerce Ready
      </div>
    </div>
  );
}

export default function Hero() {
  const { ref: heroRef, inView: heroVisible } = useInView(0.1);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#F8FAFC] pt-20">
      
      {/* Background Subtle Mesh */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#14B8A6]/10 blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 rounded-full bg-[#0F766E]/5 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-16 lg:py-0">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          
          {/* Left: Headline & Copy */}
          <div ref={heroRef} className={`transition-all duration-700 ease-out ${heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F0FDF4] border border-[#CCFBF1] mb-6">
              <Zap size={12} className="text-[#0F766E]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F766E]">
                TRUSTED PRODUCT INTELLIGENCE
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold leading-[1.12] tracking-tight text-[#0F172A] mb-6">
              Turn Scattered Industrial Data Into{" "}
              <span className="text-[#0F766E] block mt-1">
                Trusted Product Intelligence.
              </span>
            </h1>

            {/* Description */}
            <p className="text-base sm:text-lg text-[#64748B] leading-relaxed max-w-xl mb-8 font-normal">
              NexGen transforms PDFs, web catalogs, images, CSVs, and manual specs
              into structured, validated, evidence-backed product information ready for
              commerce, ERP, and PIM systems.
            </p>

            {/* Main CTAs */}
            <div className="flex flex-wrap items-center gap-4 mb-10">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-7 py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-white bg-[#0F766E] hover:bg-[#115E59] rounded-xl shadow-lg shadow-[#0F766E]/20 transition-all hover:shadow-xl hover:shadow-[#0F766E]/30"
              >
                START BUILDING PRODUCT INTELLIGENCE
                <ChevronRight size={16} />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-6 py-3.5 text-xs sm:text-sm font-bold text-[#0F172A] bg-white hover:bg-slate-50 border border-[#E2E8F0] rounded-xl transition-all shadow-sm"
              >
                <Play size={14} className="text-[#0F766E]" />
                Explore How It Works
              </a>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[#64748B]">
              <div className="flex items-center gap-1.5">
                <Shield size={14} className="text-[#059669]" />
                <span>No hallucinated specifications</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-[#CBD5E1]" />
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-[#059669]" />
                <span>Evidence-backed</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-[#CBD5E1]" />
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-[#059669]" />
                <span>Human verified</span>
              </div>
            </div>
          </div>

          {/* Right: Interactive ProductTwin Card & Floating Nodes */}
          <div className="relative h-[480px] lg:h-[520px]">
            
            {/* SVG Connector Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 500 500">
              <defs>
                <linearGradient id="teal-line" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0F766E" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              <line x1="250" y1="200" x2="80" y2="80" stroke="url(#teal-line)" strokeWidth="1.5" />
              <line x1="250" y1="200" x2="420" y2="100" stroke="url(#teal-line)" strokeWidth="1.5" />
              <line x1="250" y1="200" x2="420" y2="280" stroke="url(#teal-line)" strokeWidth="1.5" />
              <line x1="250" y1="200" x2="80" y2="340" stroke="url(#teal-line)" strokeWidth="1.5" />
              <line x1="250" y1="200" x2="250" y2="420" stroke="url(#teal-line)" strokeWidth="1.5" strokeDasharray="4 4" />
            </svg>

            {/* Central ProductTwin Card */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[290px]">
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl shadow-slate-200/60 p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#0F766E] flex items-center justify-center text-white font-bold">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#0F766E]">ProductTwin</div>
                    <div className="text-sm font-extrabold text-[#0F172A]">Siemens 1LE1001</div>
                  </div>
                </div>
                <div className="text-xs text-[#64748B] mb-3.5">15 kW Industrial Motor</div>
                
                {/* Specifications List */}
                <div className="space-y-2">
                  {[
                    { name: "Voltage", val: "415 V", conf: "96%", ok: true },
                    { name: "Power", val: "15 kW", conf: "98%", ok: true },
                    { name: "Efficiency", val: "IE3", conf: "94%", ok: true },
                  ].map((a) => (
                    <div key={a.name} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                      <span className="text-[#64748B] font-medium">{a.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#0F172A]">{a.val}</span>
                        <span className="text-[10px] font-bold text-[#0F766E]">{a.conf}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating Spec Nodes */}
            <FloatingNode label="Voltage" value="415 V" confidence="96%" status="verified"
              style="top-[5%] left-[2%]" delay={200} />
            <FloatingNode label="Power" value="15 kW" confidence="98%" status="verified"
              style="top-[5%] right-[2%]" delay={400} />
            <FloatingNode label="Temperature" value="155 °C" status="conflict"
              style="top-[50%] right-[0%]" delay={600} />
            <FloatingNode label="Weight" value="Insufficient evidence" status="missing"
              style="bottom-[20%] left-[2%]" delay={800} />

            {/* Health Score Circle */}
            <HealthScoreCircle />
          </div>

        </div>
      </div>
    </section>
  );
}
