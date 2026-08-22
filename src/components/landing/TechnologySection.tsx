"use client";

import { useReveal, useInView } from "./useAnimations";
import { Layers } from "lucide-react";

const STACK = [
  {
    category: "Frontend",
    items: ["Next.js", "React", "TypeScript", "Tailwind"],
    color: "from-blue-500 to-blue-600",
  },
  {
    category: "Backend",
    items: ["FastAPI", "Python", "SQLAlchemy"],
    color: "from-blue-400 to-blue-500",
  },
  {
    category: "Document Intelligence",
    items: ["PyMuPDF", "OCR", "Table Detection"],
    color: "from-violet-500 to-violet-600",
  },
  {
    category: "AI",
    items: ["OpenAI", "Gemini", "Rule-based Fallback"],
    color: "from-cyan-500 to-cyan-600",
  },
  {
    category: "RAG",
    items: ["TF-IDF", "Vector Index", "Evidence Retrieval"],
    color: "from-emerald-500 to-emerald-600",
  },
  {
    category: "Security",
    items: ["JWT", "Password Hashing", "Environment Config"],
    color: "from-amber-500 to-amber-600",
  },
];

export default function TechnologySection() {
  const r1 = useReveal();

  return (
    <section className="py-24 bg-white" id="technology">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={r1.ref} className={`text-center mb-14 ${r1.className}`} style={r1.style}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 border border-gray-200 mb-6">
            <Layers size={12} className="text-gray-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-600">Technology</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
            Built on a Reliable AI Data Pipeline.
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {STACK.map((s, i) => (
            <TechCard key={s.category} stack={s} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TechCard({ stack, index }: { stack: typeof STACK[0]; index: number }) {
  const { ref, inView } = useInView(0.1);

  return (
    <div
      ref={ref}
      className={`bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg hover:border-gray-200 transition-all duration-300 ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stack.color} flex items-center justify-center mb-3`}>
        <Layers size={14} className="text-white" />
      </div>
      <h3 className="text-sm font-bold text-gray-900 mb-2">{stack.category}</h3>
      <div className="flex flex-wrap gap-1.5">
        {stack.items.map((item) => (
          <span key={item} className="text-[11px] font-medium text-gray-500 bg-gray-50 border border-gray-100 rounded-md px-2 py-1">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
