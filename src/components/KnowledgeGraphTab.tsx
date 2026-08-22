"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { fetchFullKnowledgeGraph } from "@/lib/api";
import { KnowledgeGraphNode, KnowledgeGraphEdge } from "@/lib/types";
import { Filter, ZoomIn, ZoomOut, Maximize2, RefreshCw } from "lucide-react";

// ── Dynamically import ForceGraph2D (no SSR – it accesses the DOM) ─────
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] rounded-lg border flex items-center justify-center" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>Loading graph engine…</span>
    </div>
  ),
});

// ── Helpers ─────────────────────────────────────────────────────────────

type GraphData = {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  summary: {
    total_nodes: number;
    total_edges: number;
    node_types: string[];
    edge_types: string[];
  };
};

const NODE_COLORS: Record<string, string> = {
  product: "#2563EB",    // blue-600
  manufacturer: "#8B5CF6", // violet-500
  standard: "#10B981",   // emerald-500
  attribute: "#F59E0B",  // amber-500
};

const NODE_SIZES: Record<string, number> = {
  product: 12,
  manufacturer: 9,
  standard: 9,
  attribute: 6,
};

// ── Component ───────────────────────────────────────────────────────────

export default function KnowledgeGraphTab({ productId }: { productId: number }) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState<KnowledgeGraphNode | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [highlightNode, setHighlightNode] = useState<string | null>(null);
  const fgRef = useRef<any>(null);

  useEffect(() => {
    loadGraph();
  }, [productId]);

  const loadGraph = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchFullKnowledgeGraph();
      setGraphData(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Filter nodes/edges ──────────────────────────────────────────────

  const filteredData = useMemo(() => {
    if (!graphData) return { nodes: [] as any[], links: [] as any[] };

    const nodes =
      filterType === "all"
        ? graphData.nodes
        : graphData.nodes.filter((n) => n.type === filterType);

    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = graphData.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({
        ...e,
        // ForceGraph expects string source/target
        source: e.source,
        target: e.target,
      }));

    return { nodes, links };
  }, [graphData, filterType]);

  // ── Canvas node painting (richer than default) ──────────────────────

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.label || node.id;
      const fontSize = Math.max(10 / globalScale, 2);
      const size = NODE_SIZES[node.type] || 8;
      const color = NODE_COLORS[node.type] || "#888";
      const isSelected = selectedNode?.id === node.id;
      const isHighlighted = highlightNode === node.id;

      // Glow for selected/highlighted
      if (isSelected || isHighlighted) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI);
        ctx.fillStyle = color + "33";
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? color : color + "CC";
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#fff" : color;
      ctx.lineWidth = isSelected ? 2.5 : 1;
      ctx.stroke();

      // Label (only if large enough or selected)
      if (globalScale > 0.6 || isSelected || node.type === "product") {
        ctx.font = `${isSelected ? "bold " : ""}${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "var(--text-primary)";
        // Truncate long labels
        const displayLabel = label.length > 25 ? label.substring(0, 22) + "…" : label;
        ctx.fillText(displayLabel, node.x, node.y + size + 2);
      }
    },
    [selectedNode, highlightNode],
  );

  // ── Link label painting ─────────────────────────────────────────────

  const linkCanvasObject = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (globalScale < 0.5) return; // hide labels when zoomed out
      const fontSize = Math.max(8 / globalScale, 1.5);
      const label = (link.type || "").replace(/_/g, " ");

      // Midpoint
      const sx = typeof link.source === "object" ? link.source.x : 0;
      const sy = typeof link.source === "object" ? link.source.y : 0;
      const tx = typeof link.target === "object" ? link.target.x : 0;
      const ty = typeof link.target === "object" ? link.target.y : 0;
      const mx = (sx + tx) / 2;
      const my = (sy + ty) / 2;

      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "rgba(128,128,128,0.8)";
      ctx.fillText(label, mx, my - 3);
    },
    [],
  );

  // ── Link paint customization ────────────────────────────────────────

  const linkPointerAreaPaint = useCallback((link: any, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const halfW = 4 / globalScale;
    const getPos = (n: any) => (typeof n === "object" ? n : { x: 0, y: 0 });
    const s = getPos(link.source);
    const t = getPos(link.target);
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    ctx.beginPath();
    ctx.moveTo(s.x + nx * halfW, s.y + ny * halfW);
    ctx.lineTo(t.x + nx * halfW, t.y + ny * halfW);
    ctx.lineTo(t.x - nx * halfW, t.y - ny * halfW);
    ctx.lineTo(s.x - nx * halfW, s.y - ny * halfW);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }, []);

  // ── Node click handler ──────────────────────────────────────────────

  const handleNodeClick = useCallback(
    (node: any) => {
      setSelectedNode((prev) => (prev?.id === node.id ? null : node));
    },
    [],
  );

  const handleNodeHover = useCallback((node: any) => {
    setHighlightNode(node?.id ?? null);
  }, []);

  // ── Zoom controls ───────────────────────────────────────────────────

  const handleZoom = useCallback((factor: number) => {
    if (!fgRef.current) return;
    const g = fgRef.current;
    const zoom = g.zoom() || 1;
    g.zoom(zoom * factor, 400);
  }, []);

  const handleResetView = useCallback(() => {
    if (!fgRef.current) return;
    fgRef.current.zoom(1, 400);
    fgRef.current.centerAt(0, 0, 400);
  }, []);

  // ── Rendering ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton h-8 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg p-4 text-sm" style={{ background: "var(--color-error-light)", color: "var(--color-error)" }}>
        {error}
      </div>
    );
  }

  if (!graphData) return null;

  return (
    <div className="space-y-4">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Product Knowledge Graph
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {graphData.summary?.total_nodes ?? graphData.nodes?.length ?? 0} nodes, {graphData.summary?.total_edges ?? graphData.edges?.length ?? 0} relationships
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadGraph} className="h-7 w-7 rounded border flex items-center justify-center" style={{ borderColor: "var(--border-default)" }} title="Refresh">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => handleZoom(1.3)} className="h-7 w-7 rounded border flex items-center justify-center" style={{ borderColor: "var(--border-default)" }}>
            <ZoomIn size={14} />
          </button>
          <button onClick={() => handleZoom(0.7)} className="h-7 w-7 rounded border flex items-center justify-center" style={{ borderColor: "var(--border-default)" }}>
            <ZoomOut size={14} />
          </button>
          <button onClick={handleResetView} className="h-7 w-7 rounded border flex items-center justify-center" style={{ borderColor: "var(--border-default)" }}>
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={12} style={{ color: "var(--text-muted)" }} />
        {["all", "product", "manufacturer", "standard", "attribute"].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className="rounded-full px-2.5 py-1 text-[11px] font-medium transition"
            style={{
              background: filterType === type ? (NODE_COLORS[type] || "var(--accent-primary)") : "var(--neutral-100)",
              color: filterType === type ? "white" : "var(--text-secondary)",
            }}
          >
            {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Force-directed graph ─────────────────────────────────────── */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}
      >
        <ForceGraph2D
          ref={fgRef}
          graphData={filteredData}
          width={800}
          height={420}
          backgroundColor="var(--neutral-50)"
          nodeCanvasObject={nodeCanvasObject}
          nodeCanvasObjectMode={() => "replace"}
          linkCanvasObject={linkCanvasObject}
          linkCanvasObjectMode={() => "replace"}
          linkPointerAreaPaint={linkPointerAreaPaint}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          linkColor={() => "rgba(128,128,128,0.25)"}
          linkWidth={0.8}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          nodeRelSize={6}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
          warmupTicks={50}
          cooldownTicks={100}
          enableZoomInteraction={true}
          enablePanInteraction={true}
        />
      </div>

      {/* ── Node detail sidebar ──────────────────────────────────────── */}
      {selectedNode && (
        <div
          className="rounded-lg border p-4"
          style={{ borderColor: "var(--accent-primary)", background: "var(--accent-primary-light)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ background: NODE_COLORS[selectedNode.type] }} />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                {selectedNode.type}
              </span>
            </div>
            <button onClick={() => setSelectedNode(null)} className="text-xs" style={{ color: "var(--text-muted)" }}>
              ✕
            </button>
          </div>
          <div className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            {selectedNode.label}
          </div>
          {selectedNode.model && (
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Model: {selectedNode.model}
            </div>
          )}
          {selectedNode.category && (
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Category: {selectedNode.category}
            </div>
          )}
          {selectedNode.health_score !== undefined && (
            <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              Health: {selectedNode.health_score}/100
            </div>
          )}

          {/* Connected edges */}
          <div className="mt-3 space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Connections
            </div>
            {graphData.edges
              .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
              .map((edge, i) => (
                <div key={i} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: "var(--neutral-100)" }}>
                    {edge.type}
                  </span>
                  <span>{edge.label}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Legend ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
