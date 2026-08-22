"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, ChevronRight } from "lucide-react";

const NAV_LINKS = [
  { label: "Product", href: "#product" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Solutions", href: "#solutions" },
  { label: "Technology", href: "#technology" },
  { label: "About", href: "#about" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "backdrop-blur-md shadow-sm border-b border-gray-100"
            : "bg-transparent"
        }`}
        style={scrolled ? { backgroundColor: 'color-mix(in srgb, var(--bg-card) 95%, transparent)' } : undefined}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
                <defs>
                  <linearGradient id="pp-grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#0F766E" />
                    <stop offset="100%" stopColor="#115E59" />
                  </linearGradient>
                </defs>
                <rect x="2" y="2" width="96" height="96" rx="24" fill="url(#pp-grad)" />
                <path d="M50 25 L75 39 L75 63 L50 77 L25 63 L25 39 Z" fill="none" stroke="white" strokeWidth="3" strokeLinejoin="round" opacity="0.35" />
                <path d="M50 25 L75 39 L50 53 L25 39 Z" fill="white" opacity="0.15" />
                <path d="M75 39 L50 53 L50 77 L75 63 Z" fill="white" opacity="0.2" />
                <circle cx="50" cy="51" r="5" fill="white" opacity="0.95" />
                <line x1="50" y1="46" x2="50" y2="30" stroke="#99F6E4" strokeWidth="2" opacity="0.8" strokeLinecap="round" />
                <line x1="55" y1="51" x2="70" y2="43" stroke="#99F6E4" strokeWidth="2" opacity="0.8" strokeLinecap="round" />
                <line x1="45" y1="51" x2="30" y2="43" stroke="#99F6E4" strokeWidth="2" opacity="0.8" strokeLinecap="round" />
                <circle cx="50" cy="28" r="2.5" fill="white" opacity="0.8" />
                <circle cx="72" cy="42" r="2.5" fill="white" opacity="0.7" />
                <circle cx="28" cy="42" r="2.5" fill="white" opacity="0.7" />
              </svg>
              <div className="flex flex-col">
                <span className="font-bold tracking-tight text-[15px] leading-tight text-[#0F172A]">
                  NexGen
                  <span className="ml-1 font-extrabold text-xs px-1.5 py-0.5 rounded-md bg-[#F0FDF4] text-[#0F766E] border border-[#CCFBF1] uppercase">
                    AI
                  </span>
                </span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="px-3 py-2 text-[13px] font-semibold text-[#64748B] hover:text-[#0F172A] rounded-lg hover:bg-slate-100/60 transition-all"
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center gap-3">
              <Link
                href="/login"
                className="px-4 py-2 text-[13px] font-semibold text-[#64748B] hover:text-[#0F172A] rounded-lg hover:bg-slate-100/60 transition-all"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-[13px] font-extrabold tracking-wide uppercase text-white bg-[#0F766E] hover:bg-[#115E59] rounded-xl shadow-md shadow-[#0F766E]/20 transition-all"
              >
                Get Started
                <ChevronRight size={14} />
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute top-16 left-0 right-0 border-b border-gray-100 shadow-lg animate-in slide-in-from-top duration-200" style={{ background: 'var(--bg-card)' }}>
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-3 mt-3 border-t border-gray-100 space-y-2">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition text-center"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition text-center"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
