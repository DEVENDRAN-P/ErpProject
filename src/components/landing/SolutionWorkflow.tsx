"use client";

import { Upload, Cpu, ShieldCheck, Eye, UserCheck, Download } from "lucide-react";
import { useReveal, useInView } from "./useAnimations";

const STEPS = [
  {
    num: "01",
    title: "Ingest",
    icon: <Upload size={18} />,
    items: ["PDF", "URL", "Image", "CSV", "Manual Data"],
    color: "from-blue-500 to-blue-600",
    bgColor: "bg-blue-50",
    textColor: "text-blue-600",
    borderColor: "border-blue-100",
  },
  {
    num: "02",
    title: "Extract",
    icon: <Cpu size={18} />,
    items: ["Document Intelligence", "OCR", "Tables", "AI Extraction"],
    color: "from-blue-400 to-blue-500",
    bgColor: "bg-blue-50",
    textColor: "text-blue-500",
    borderColor: "border-blue-100",
  },
  {
    num: "03",
    title: "Validate",
    icon: <ShieldCheck size={18} />,
    items: ["Conflict Detection", "Missing Attributes", "Unit Normalization"],
    color: "from-violet-500 to-violet-600",
    bgColor: "bg-violet-50",
    textColor: "text-violet-600",
    borderColor: "border-violet-100",
  },
  {
    num: "04",
    title: "Verify",
    icon: <Eye size={18} />,
    items: ["Evidence", "Confidence", "RAG Retrieval"],
    color: "from-cyan-500 to-cyan-600",
    bgColor: "bg-cyan-50",
    textColor: "text-cyan-600",
    borderColor: "border-cyan-100",
  },
  {
    num: "05",
    title: "Review",
    icon: <UserCheck size={18} />,
    items: ["Human Approval", "Edit", "Reject", "Audit Trail"],
    color: "from-emerald-500 to-emerald-600",
    bgColor: "bg-emerald-50",
    textColor: "text-emerald-600",
    borderColor: "border-emerald-100",
  },
  {
    num: "06",
    title: "Export",
    icon: <Download size={18} />,
    items: ["JSON", "CSV", "ERP", "PIM"],
    color: "from-amber-500 to-amber-600",
    bgColor: "bg-amber-50",
    textColor: "text-amber-600",
    borderColor: "border-amber-100",
  },
];

export default function SolutionWorkflow() {
  const r1 = useReveal();

  return (
    <section className="py-24 bg-white" id="how-it-works">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={r1.ref} className={`text-center mb-16 ${r1.className}`} style={r1.style}>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">How It Works</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
            From Raw Documents to Commerce-Ready Product Data
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {STEPS.map((step, i) => (
            <StepCard key={i} step={step} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StepCard({ step, index }: { step: typeof STEPS[0]; index: number }) {
  const { ref, inView } = useInView(0.2);

  return (
    <div
      ref={ref}
      className={`relative bg-white rounded-xl border ${step.borderColor} p-5 text-center hover:shadow-lg transition-all duration-500 group ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      {/* Step number */}
      <div className={`w-10 h-10 mx-auto mb-3 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white shadow-sm`}>
        {step.icon}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{step.num}</div>
      <h3 className="text-base font-bold text-gray-900 mb-3">{step.title}</h3>
      <div className="space-y-1.5">
        {step.items.map((item) => (
          <div key={item} className={`text-xs ${step.textColor} font-medium ${step.bgColor} rounded-md px-2 py-1`}>
            {item}
          </div>
        ))}
      </div>
      {/* Arrow connector (hidden on mobile) */}
      {index < STEPS.length - 1 && (
        <div className="hidden lg:block absolute top-1/2 -right-3 -translate-y-1/2 z-10">
          <svg width="12" height="12" viewBox="0 0 12 12" className="text-gray-300">
            <path d="M2 6h8m0 0L7 3m3 3L7 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  );
}
