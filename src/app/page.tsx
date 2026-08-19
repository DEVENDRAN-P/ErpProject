"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import EnterpriseDashboard from "@/components/EnterpriseDashboard";
import UploadCenter from "@/components/UploadCenter";

/** Maps sidebar ?view= param to EnterpriseDashboard tab names */
function viewToTab(view: string | null): string | undefined {
  if (!view) return undefined;
  const map: Record<string, string> = {
    twin: "ProductTwin",
    validation: "Validation",
    health: "Health Score",
    review: "Human Review",
    catalog: "CatalogPilot",
    rag: "RAG",
    conflicts: "Validation", // conflicts are shown in Validation tab
    export: "Export",
  };
  return map[view];
}

function HomeContent() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const productParam = searchParams.get("product");

  const [initialProductId, setInitialProductId] = useState<number | undefined>(undefined);
  const [initialTab, setInitialTab] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (productParam) {
      const id = Number(productParam);
      if (Number.isFinite(id)) setInitialProductId(id);
    }
    const tab = viewToTab(view);
    if (tab) setInitialTab(tab);
  }, [view, productParam]);

  // Upload Center view
  if (view === "upload") {
    return (
      <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
        <UploadCenter />
      </div>
    );
  }

  // Settings view — redirect to /settings page
  if (view === "settings") {
    return (
      <div className="p-4 lg:p-6 max-w-[1600px] mx-auto space-y-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Settings</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Manage your account and workspace preferences.</p>
          </div>
          <div className="rounded-lg border p-6" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
            <h2 className="text-base font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Account</h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>Account settings are managed through Firebase Authentication.</p>
            <Link href="/settings" className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white" style={{ background: "var(--accent-primary)" }}>
              Open Full Settings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Help view
  if (view === "help") {
    return (
      <div className="p-4 lg:p-6 max-w-[1600px] mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Help & Support</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>ProductPilot AI — AI-Powered Product Intelligence for Industrial Commerce</p>
        </div>
        <div className="rounded-lg border p-6 space-y-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Getting Started</h2>
          <div className="space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <p><strong style={{ color: "var(--text-primary)" }}>1. Upload a datasheet</strong> — Go to Upload Center and drop a PDF, CSV, or enter a URL. The AI pipeline will extract product specifications automatically.</p>
            <p><strong style={{ color: "var(--text-primary)" }}>2. Review your ProductTwin</strong> — Each product gets a digital twin with extracted attributes, confidence scores, and source evidence.</p>
            <p><strong style={{ color: "var(--text-primary)" }}>3. Validate data quality</strong> — The validation engine checks LOV compliance, UOM consistency, and cross-attribute plausibility.</p>
            <p><strong style={{ color: "var(--text-primary)" }}>4. Resolve conflicts</strong> — When sources disagree, conflicts are flagged for human review. Your decision creates a new version.</p>
            <p><strong style={{ color: "var(--text-primary)" }}>5. Export commerce-ready data</strong> — Download structured JSON or CSV for your ERP, PIM, or e-commerce platform.</p>
          </div>
          <h2 className="text-base font-semibold pt-2" style={{ color: "var(--text-primary)" }}>Health Score</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>The Product Health Score (0–100) is calculated as: 40% Completeness + 30% Consistency + 20% Confidence + 10% Source Reliability.</p>
          <h2 className="text-base font-semibold pt-2" style={{ color: "var(--text-primary)" }}>Non-Hallucination Principle</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>ProductPilot AI never invents specifications. If a value cannot be found in your source documents, it is marked as &ldquo;Insufficient Evidence&rdquo; rather than generating a plausible value.</p>
        </div>
      </div>
    );
  }

  // Default: Dashboard / Products / product-specific tabs
  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Welcome banner — only show on default dashboard view */}
      {!view && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-5 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563EB]/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
          </div>
          <span className="text-sm text-gray-600">
            Upload a product datasheet or select an existing product below.
          </span>
        </div>
      )}

      <EnterpriseDashboard
        initialProductId={initialProductId}
        initialTab={initialTab}
      />
    </div>
  );
}

export default function Home() {
  return (
    <ProtectedRoute>
      <HomeContent />
    </ProtectedRoute>
  );
}
