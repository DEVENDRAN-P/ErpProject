"use client";

import { useState } from "react";
import { useReveal } from "./useAnimations";
import {
  Shield, CheckCircle2, AlertTriangle, HelpCircle, FileText,
  Share2, Eye, Sparkles, ChevronRight, Layers, Database, ExternalLink, Activity
} from "lucide-react";

type Attribute = {
  key: string;
  name: string;
  value: string;
  unit: string;
  status: "VERIFIED" | "CONFLICT" | "MISSING";
  conf: number;
  source: string;
  evidence: string;
  rationale: string;
};

const ATTRS: Attribute[] = [
  {
    key: "voltage",
    name: "Voltage",
    value: "415 V",
    unit: "V",
    status: "VERIFIED",
    conf: 96,
    source: "Siemens_1LE1001_Datasheet.pdf",
    evidence: "Supply voltage: 400V/415V Delta, 690V Star 50Hz",
    rationale: "Validated against 3-phase AC induction motor standard IEC 60034-1."
  },
  {
    key: "power",
    name: "Power",
    value: "15 kW",
    unit: "kW",
    status: "VERIFIED",
    conf: 98,
    source: "Siemens_1LE1001_Datasheet.pdf",
    evidence: "Rated power output: 15 kW @ 50 Hz, 4-pole continuous duty.",
    rationale: "Extracted directly from Siemens nameplate specification table."
  },
  {
    key: "efficiency",
    name: "Efficiency",
    value: "IE3",
    unit: "",
    status: "VERIFIED",
    conf: 94,
    source: "Siemens_1LE1001_Datasheet.pdf",
    evidence: "Efficiency class IE3 (92.6% efficiency according to IEC 60034-30-1).",
    rationale: "Cross-referenced with International Energy Efficiency Standards register."
  },
  {
    key: "temperature",
    name: "Max Temperature",
    value: "155 °C",
    unit: "°C",
    status: "CONFLICT",
    conf: 82,
    source: "Web Catalog vs Datasheet PDF",
    evidence: "Web catalog claims 130°C max rise limit vs Datasheet Class F (155°C limit).",
    rationale: "Discrepancy detected between 3rd-party vendor site and primary manufacturer spec sheet."
  },
  {
    key: "weight",
    name: "Total Weight",
    value: "Insufficient evidence",
    unit: "",
    status: "MISSING",
    conf: 0,
    source: "Datasheet PDF",
    evidence: "No net weight specification present in ingested document pages 1-4.",
    rationale: "Attribute flagged for human review or catalog supplement."
  },
];

const GRAPH_NODES = [
  { id: "p1", label: "Siemens 1LE1001 Motor", type: "product", x: 200, y: 150, color: "#2563EB" },
  { id: "a1", label: "Voltage: 415 V", type: "attribute", x: 60, y: 70, color: "#10B981" },
  { id: "a2", label: "Power: 15 kW", type: "attribute", x: 340, y: 70, color: "#10B981" },
  { id: "a3", label: "Efficiency: IE3", type: "attribute", x: 60, y: 230, color: "#10B981" },
  { id: "a4", label: "Temp: 155 °C (Conflict)", type: "attribute", x: 340, y: 230, color: "#F59E0B" },
  { id: "s1", label: "Siemens_1LE1001_Datasheet.pdf", type: "source", x: 200, y: 40, color: "#8B5CF6" },
  { id: "std1", label: "IEC 60034-30-1 Standard", type: "standard", x: 200, y: 260, color: "#06B6D4" },
];

const GRAPH_EDGES = [
  { from: "p1", to: "a1", label: "HAS_RATED_VOLTAGE" },
  { from: "p1", to: "a2", label: "HAS_RATED_POWER" },
  { from: "p1", to: "a3", label: "HAS_EFFICIENCY" },
  { from: "p1", to: "a4", label: "HAS_TEMP_LIMIT" },
  { from: "a1", to: "s1", label: "VERIFIED_BY" },
  { from: "a2", to: "s1", label: "VERIFIED_BY" },
  { from: "a3", to: "std1", label: "COMPLIANT_WITH" },
];

export default function ProductTwinSection() {
  const r1 = useReveal();
  const r2 = useReveal(150);
  const [activeTab, setActiveTab] = useState<"twin" | "graph">("twin");
  const [selectedAttr, setSelectedAttr] = useState<Attribute>(ATTRS[0]);
  const [selectedNode, setSelectedNode] = useState<typeof GRAPH_NODES[0] | null>(GRAPH_NODES[0]);

  return (
    <section className="py-20 bg-gray-50/50" id="product">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Badge */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-4">
            <Shield size={14} className="text-blue-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">ProductTwin & Knowledge Graph</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
            Playable ProductTwin & Evidence Graph
          </h2>
          <p className="mt-3 text-base text-gray-600">
            Click any attribute or node below to inspect real-time evidence quotes, confidence scores, and knowledge graph links.
          </p>

          {/* Interactive View Selector */}
          <div className="mt-6 inline-flex rounded-xl bg-gray-200/80 p-1 border border-gray-200">
            <button
              onClick={() => setActiveTab("twin")}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "twin"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Database size={14} />
              ProductTwin Spec Card
            </button>
            <button
              onClick={() => setActiveTab("graph")}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "graph"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Share2 size={14} />
              Interactive Knowledge Graph
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Card View (Left Column 7 cols) */}
          <div ref={r1.ref} className={`lg:col-span-7 ${r1.className}`} style={r1.style}>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xl shadow-gray-200/50 overflow-hidden">
              
              {/* Product Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-wider border border-blue-400/30">
                      ProductTwin #101
                    </span>
                    <span className="text-[10px] text-gray-300 font-mono">1LE1001-1DB43-4AA4</span>
                  </div>
                  <h3 className="text-base font-bold text-white">Siemens 1LE1001</h3>
                  <p className="text-xs text-gray-300">15 kW Industrial Motor</p>
                </div>

                {/* Health Score Gauge */}
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur px-4 py-2 rounded-xl border border-white/10">
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-wider text-gray-300 font-semibold">Health Score</div>
                    <div className="text-xl font-black text-emerald-400">87 <span className="text-xs font-normal text-gray-300">/ 100</span></div>
                  </div>
                  <div className="w-10 h-10 rounded-full border-4 border-emerald-400 border-t-amber-400 flex items-center justify-center text-[10px] font-bold text-white">
                    87%
                  </div>
                </div>
              </div>

              {/* VIEW 1: PRODUCT TWIN SPEC LIST */}
              {activeTab === "twin" && (
                <div className="divide-y divide-gray-100">
                  {ATTRS.map((a) => {
                    const isSelected = selectedAttr.key === a.key;
                    return (
                      <button
                        key={a.key}
                        onClick={() => setSelectedAttr(a)}
                        className={`w-full px-6 py-4 flex items-center justify-between text-left transition-all ${
                          isSelected ? "bg-blue-50/60 border-l-4 border-blue-600" : "hover:bg-gray-50/80"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {a.status === "VERIFIED" ? (
                            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                          ) : a.status === "CONFLICT" ? (
                            <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                          ) : (
                            <HelpCircle size={16} className="text-gray-400 shrink-0" />
                          )}
                          <div>
                            <div className="text-xs font-semibold text-gray-500">{a.name}</div>
                            <div className="text-sm font-bold text-gray-900">{a.value}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-[11px] font-extrabold text-blue-600">
                              {a.conf > 0 ? `${a.conf}%` : "—"}
                            </div>
                            <div className="text-[9px] text-gray-400 font-medium">Confidence</div>
                          </div>
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md border ${
                              a.status === "VERIFIED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : a.status === "CONFLICT"
                                ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                                : "bg-gray-100 text-gray-500 border-gray-200"
                            }`}
                          >
                            {a.status}
                          </span>
                          <ChevronRight size={14} className={`text-gray-400 transition-transform ${isSelected ? "rotate-90 text-blue-600" : ""}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* VIEW 2: PLAYABLE KNOWLEDGE GRAPH CANVAS */}
              {activeTab === "graph" && (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3 text-xs text-gray-500">
                    <span className="font-semibold text-gray-700">Interactive Node Topology (Click nodes to inspect)</span>
                    <span className="flex items-center gap-1.5"><Sparkles size={12} className="text-blue-600" /> 7 Nodes · 7 Relationships</span>
                  </div>
                  
                  {/* Graph Playground Container */}
                  <div className="relative w-full h-[320px] rounded-xl bg-gray-900 border border-gray-800 p-4 overflow-hidden select-none">
                    
                    {/* SVG Connector Lines */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      {GRAPH_EDGES.map((e, idx) => {
                        const fromNode = GRAPH_NODES.find(n => n.id === e.from);
                        const toNode = GRAPH_NODES.find(n => n.id === e.to);
                        if (!fromNode || !toNode) return null;
                        const isConnected = selectedNode && (selectedNode.id === e.from || selectedNode.id === e.to);
                        return (
                          <g key={idx}>
                            <line
                              x1={fromNode.x}
                              y1={fromNode.y}
                              x2={toNode.x}
                              y2={toNode.y}
                              stroke={isConnected ? "#60A5FA" : "#374151"}
                              strokeWidth={isConnected ? "2.5" : "1.5"}
                              strokeDasharray={isConnected ? "none" : "3,3"}
                            />
                            <text
                              x={(fromNode.x + toNode.x) / 2}
                              y={(fromNode.y + toNode.y) / 2 - 4}
                              fill={isConnected ? "#93C5FD" : "#6B7280"}
                              fontSize="8"
                              fontWeight="600"
                              textAnchor="middle"
                            >
                              {e.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>

                    {/* Nodes */}
                    {GRAPH_NODES.map((n) => {
                      const isSelected = selectedNode?.id === n.id;
                      return (
                        <button
                          key={n.id}
                          onClick={() => setSelectedNode(n)}
                          style={{ left: n.x - 50, top: n.y - 20 }}
                          className={`absolute px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-lg transition-all duration-200 flex items-center gap-1.5 border ${
                            isSelected
                              ? "scale-110 ring-4 ring-blue-500/40 border-white text-white z-10"
                              : "hover:scale-105 border-gray-700 text-gray-200"
                          }`}
                          style={{
                            left: n.x - 60,
                            top: n.y - 15,
                            backgroundColor: n.color,
                            boxShadow: isSelected ? `0 0 20px ${n.color}` : "none",
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          {n.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> Product</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Attribute</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" /> Source PDF</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" /> Standard</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Card Footer */}
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <FileText size={12} className="text-blue-600" />
                  <span>No hallucinated specifications · 100% evidence-backed</span>
                </div>
                <span className="font-semibold text-blue-600">Verified by Antigravity AI</span>
              </div>
            </div>
          </div>

          {/* Right Column: Evidence Inspector Panel (5 cols) */}
          <div ref={r2.ref} className={`lg:col-span-5 ${r2.className}`} style={r2.style}>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xl shadow-gray-200/40 space-y-5">
              
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Eye size={16} className="text-blue-600" />
                  <h4 className="text-sm font-bold text-gray-900">Evidence Inspector</h4>
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                  Live Audit
                </span>
              </div>

              {activeTab === "twin" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Selected Specification</label>
                    <div className="text-base font-extrabold text-gray-900 mt-0.5">{selectedAttr.name}</div>
                    <div className="text-xl font-black text-blue-600">{selectedAttr.value}</div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Verbatim Datasheet Evidence Quote</div>
                    <p className="text-xs italic text-gray-800 font-serif leading-relaxed">
                      "{selectedAttr.evidence}"
                    </p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">Primary Source Document</span>
                      <span className="font-semibold text-gray-900 flex items-center gap-1">
                        <FileText size={10} className="text-purple-600" />
                        {selectedAttr.source}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">Confidence Score</span>
                      <span className="font-bold text-emerald-600">{selectedAttr.conf > 0 ? `${selectedAttr.conf}%` : "0% (Missing)"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">Verification Status</span>
                      <span className={`font-bold ${
                        selectedAttr.status === "VERIFIED" ? "text-emerald-600" :
                        selectedAttr.status === "CONFLICT" ? "text-amber-600" : "text-gray-400"
                      }`}>{selectedAttr.status}</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Audit Rationale</div>
                    <p className="text-xs text-gray-600 leading-relaxed bg-blue-50/50 p-3 rounded-lg border border-blue-100/50">
                      {selectedAttr.rationale}
                    </p>
                  </div>

                  <div className="pt-2">
                    <a
                      href="/dashboard?view=twin"
                      className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all"
                    >
                      <Sparkles size={14} />
                      Open Full ProductTwin Console
                    </a>
                  </div>
                </div>
              )}

              {activeTab === "graph" && (
                <div className="space-y-4">
                  {selectedNode ? (
                    <>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Selected Graph Node</label>
                        <div className="text-base font-extrabold text-gray-900 mt-0.5">{selectedNode.label}</div>
                        <span className="inline-block mt-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase text-white" style={{ backgroundColor: selectedNode.color }}>
                          {selectedNode.type}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-gray-900 text-gray-200 text-xs space-y-2">
                        <div className="text-[10px] font-bold uppercase text-blue-400">Graph Relationships</div>
                        {GRAPH_EDGES.filter(e => e.from === selectedNode.id || e.to === selectedNode.id).map((e, idx) => (
                          <div key={idx} className="flex items-center gap-2 font-mono text-[11px]">
                            <span className="text-gray-400">{e.from}</span>
                            <span className="text-emerald-400 font-bold">-[{e.label}]-&gt;</span>
                            <span className="text-gray-400">{e.to}</span>
                          </div>
                        ))}
                      </div>

                      <div className="text-xs text-gray-500 leading-relaxed">
                        Knowledge Graph links guarantee zero hallucination by explicitly grounding every product attribute node to verified source PDF documents and standards.
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-gray-400 text-center py-8">
                      Click any node on the graph canvas to inspect its relationships.
                    </div>
                  )}

                  <div className="pt-2">
                    <a
                      href="/dashboard?view=graph"
                      className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-purple-500/20 transition-all"
                    >
                      <Share2 size={14} />
                      Open Full 2D/3D Knowledge Graph
                    </a>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
