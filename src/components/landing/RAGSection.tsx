"use client";

import { useReveal } from "./useAnimations";
import { MessageSquare, FileText, ChevronRight } from "lucide-react";

export default function RAGSection() {
  const r1 = useReveal();
  const r2 = useReveal(150);

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: Explanation */}
          <div ref={r1.ref} className={`${r1.className}`} style={r1.style}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-6">
              <MessageSquare size={12} className="text-blue-600" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">RAG Verification</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
              Ask Your Product Data a Question.
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-6">
              ProductPilot retrieves supporting evidence from indexed product documents
              before generating answers. Every response is backed by traceable source material.
            </p>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="text-xs font-semibold text-blue-700 mb-1">Evidence-backed retrieval</div>
              <div className="text-xs text-blue-600">
                RAG queries are resolved against TF-IDF indexed documents, returning
                source-verified answers with page-level citations.
              </div>
            </div>
          </div>

          {/* Right: Chat UI */}
          <div ref={r2.ref} className={`${r2.className}`} style={r2.style}>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden">
              {/* Chat header */}
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
                  <MessageSquare size={12} className="text-white" />
                </div>
                <span className="text-sm font-bold text-gray-900">RAG Verification</span>
              </div>

              {/* Chat messages */}
              <div className="p-6 space-y-4">
                {/* User query */}
                <div className="flex justify-end">
                  <div className="bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%]">
                    <div className="text-sm">What is the rated voltage and efficiency class?</div>
                  </div>
                </div>

                {/* AI response */}
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 max-w-[90%]">
                    <div className="text-sm text-gray-800 mb-3">
                      Rated voltage is <strong>415 V</strong> and the efficiency class is <strong>IE3</strong>.
                    </div>

                    {/* Evidence cards */}
                    <div className="space-y-2">
                      <div className="bg-white rounded-lg border border-gray-200 p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <FileText size={12} className="text-blue-500" />
                          <span className="text-[10px] font-medium text-gray-500">Siemens_1LE1001_Datasheet.pdf — Page 3</span>
                        </div>
                        <div className="text-xs text-gray-700 italic mb-1">&ldquo;Rated voltage: 415 V&rdquo;</div>
                        <div className="text-[10px] font-semibold text-blue-600">Confidence: 96%</div>
                      </div>
                      <div className="bg-white rounded-lg border border-gray-200 p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <FileText size={12} className="text-blue-500" />
                          <span className="text-[10px] font-medium text-gray-500">Siemens_1LE1001_Datasheet.pdf — Page 5</span>
                        </div>
                        <div className="text-xs text-gray-700 italic mb-1">&ldquo;Efficiency class: IE3&rdquo;</div>
                        <div className="text-[10px] font-semibold text-blue-600">Confidence: 94%</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Second query */}
                <div className="flex justify-end">
                  <div className="bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%]">
                    <div className="text-sm">What is the total weight?</div>
                  </div>
                </div>

                {/* AI response: insufficient */}
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 max-w-[90%]">
                    <div className="text-sm text-gray-800">
                      Insufficient evidence.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
