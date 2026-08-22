"use client";

import Link from "next/link";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "ProductTwin", href: "#product" },
      { label: "ProductTruth", href: "#features" },
      { label: "RAG Verification", href: "#features" },
      { label: "Health Score", href: "#features" },
      { label: "CatalogPilot", href: "#solutions" },
      { label: "Versioning", href: "#solutions" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Industrial Commerce", href: "#solutions" },
      { label: "Engineering", href: "#solutions" },
      { label: "ERP", href: "#solutions" },
      { label: "PIM", href: "#solutions" },
      { label: "Catalog Management", href: "#solutions" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "/?view=help" },
      { label: "Sign In", href: "/login" },
      { label: "Architecture", href: "#technology" },
      { label: "API", href: "/api/docs" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#about" },
      { label: "Contact", href: "#about" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-400 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 pb-12 border-b border-gray-800">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1 mb-4 lg:mb-0">
            <div className="flex items-center gap-2 mb-4">
              <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
                <rect x="2" y="2" width="96" height="96" rx="24" fill="#2563EB" />
                <path d="M50 25 L75 39 L75 63 L50 77 L25 63 L25 39 Z" fill="none" stroke="white" strokeWidth="3" strokeLinejoin="round" opacity="0.35" />
                <circle cx="50" cy="51" r="5" fill="white" opacity="0.95" />
                <line x1="50" y1="46" x2="50" y2="30" stroke="#60A5FA" strokeWidth="2" opacity="0.6" strokeLinecap="round" />
                <circle cx="50" cy="28" r="2.5" fill="white" opacity="0.8" />
                <circle cx="72" cy="42" r="2.5" fill="white" opacity="0.7" />
                <circle cx="28" cy="42" r="2.5" fill="white" opacity="0.7" />
              </svg>
              <span className="font-bold text-white text-sm">
                NexGen
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 uppercase">AI</span>
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed max-w-xs">
              AI-powered product intelligence for industrial commerce.
            </p>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-bold uppercase tracking-widest text-gray-300 mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">
            &copy; 2026 NexGen. All rights reserved.
          </p>
          <p className="text-xs text-gray-600">
            AI-powered product intelligence for industrial commerce.
          </p>
        </div>
      </div>
    </footer>
  );
}
