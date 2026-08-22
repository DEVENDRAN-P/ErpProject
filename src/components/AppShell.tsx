"use client";

import { useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Package, Upload, Box, CheckCircle, MessageSquare,
  Activity, History, AlertTriangle, Settings, HelpCircle, Search,
  Bell, ChevronDown, LogOut, Menu, X, Database, FileText, Shield, FileSpreadsheet,
  Sun, Moon, Monitor
} from "lucide-react";
import Logo from "@/components/ui/Logo";
import { useTheme } from "@/context/ThemeContext";

type NavItem = {
  label: string;
  icon: ReactNode;
  href: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Workspace",
    items: [
      { label: "Dashboard", icon: <LayoutDashboard size={16} />, href: "/dashboard" },
      { label: "Products Catalog", icon: <Package size={16} />, href: "/dashboard?view=products" },
      { label: "Upload Center", icon: <Upload size={16} />, href: "/dashboard?view=upload" },
    ],
  },
  {
    title: "Intelligence & AI",
    items: [
      { label: "ProductTwin", icon: <Box size={16} />, href: "/dashboard?view=twin" },
      { label: "Validation Engine", icon: <Shield size={16} />, href: "/dashboard?view=validation" },
      { label: "Knowledge Graph", icon: <Database size={16} />, href: "/dashboard?view=graph" },
      { label: "Explainability AI", icon: <Activity size={16} />, href: "/dashboard?view=explainability" },
      { label: "RAG Verification", icon: <MessageSquare size={16} />, href: "/dashboard?view=rag" },
      { label: "Health Analytics", icon: <Activity size={16} />, href: "/dashboard?view=health" },
    ],
  },
  {
    title: "Operations & Tools",
    items: [
      { label: "Human Review", icon: <AlertTriangle size={16} />, href: "/dashboard?view=review" },
      { label: "CatalogPilot", icon: <History size={16} />, href: "/dashboard?view=catalog" },
      { label: "Conflicts", icon: <Database size={16} />, href: "/dashboard?view=conflicts" },
      { label: "Batch Operations", icon: <FileSpreadsheet size={16} />, href: "/batch" },
      { label: "Reports & Compliance", icon: <FileText size={16} />, href: "/reports" },
    ],
  },
];

const BOTTOM_NAV: NavItem[] = [
  { label: "Settings", icon: <Settings size={16} />, href: "/settings" },      { label: "Help", icon: <HelpCircle size={16} />, href: "/dashboard?view=help" },
];

const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];
const PUBLIC_PAGES = ["/"];

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout, loading } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams?.get("view");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isAuthPage = AUTH_PAGES.includes(pathname);
  const isPublicPage = PUBLIC_PAGES.includes(pathname);

  useEffect(() => { setSidebarOpen(false); }, [pathname, currentView]);

  useEffect(() => {
    const handler = () => setUserMenuOpen(false);
    if (userMenuOpen) document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [userMenuOpen]);

  const handleLogout = async () => {
    try { await logout(); router.push("/login"); } catch {}
  };

  const isActive = (href: string) => {      if (href === "/dashboard") return pathname === "/dashboard" && !currentView;
    if (href.startsWith("/dashboard?view=")) {
      const param = href.split("?view=")[1];
      return pathname === "/dashboard" && currentView === param;
    }
    return pathname === href;
  };

  const getInitials = () => {
    if (user?.displayName) return user.displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return "U";
  };

  useEffect(() => {
    if (!loading && !user && !isAuthPage && !isPublicPage) {
      router.replace("/login");
    }
  }, [user, loading, isAuthPage, isPublicPage, router]);

  // Auth pages — no shell
  if (isAuthPage || isPublicPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-page)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="animate-pulse">
            <Logo size={36} />
          </div>
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Loading NexGen…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-page)" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`fixed lg:sticky top-0 z-50 h-screen w-[240px] flex flex-col border-r transition-transform duration-200 lg:translate-x-0 shrink-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: "var(--bg-sidebar)", borderColor: "var(--border-default)" }}>

        {/* Subtle top gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none opacity-60" style={{ background: "var(--sidebar-gradient-top)" }} />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none opacity-40" style={{ background: "var(--sidebar-gradient-bottom)" }} />

        {/* Logo */}
        <div className="relative flex items-center px-4 h-14 border-b shrink-0" style={{ borderColor: "var(--border-default)" }}>
          <Logo size={32} showText />
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto" style={{ color: "var(--text-muted)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Nav sections */}
        <nav className="relative flex-1 overflow-y-auto py-3 px-3">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="mb-4">
              <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                {section.title}
              </div>
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link key={item.label} href={item.href}
                    className="relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px] font-medium transition-all mb-0.5"
                    style={{
                      color: active ? "var(--accent-primary)" : "var(--text-secondary)",
                      background: active ? "var(--accent-primary-light)" : "transparent",
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--bg-hover)"; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full" style={{ background: "var(--accent-primary-gradient)" }} />
                    )}
                    <span style={{ color: active ? "var(--accent-primary)" : "var(--text-muted)" }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom nav */}
        <div className="relative border-t py-2 px-3" style={{ borderColor: "var(--border-default)" }}>
          {/* Theme toggle */}
          <div className="flex items-center gap-1 px-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider mr-auto" style={{ color: "var(--text-muted)" }}>Theme</span>
            <div className="flex items-center rounded-lg border p-0.5" style={{ borderColor: "var(--border-default)", background: "var(--bg-hover)" }}>
              {([
                { value: "light" as const, icon: <Sun size={12} />, label: "Light" },
                { value: "system" as const, icon: <Monitor size={12} />, label: "System" },
                { value: "dark" as const, icon: <Moon size={12} />, label: "Dark" },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  title={opt.label}
                  className="flex items-center justify-center w-6 h-6 rounded-md transition-all"
                  style={{
                    background: theme === opt.value ? "var(--bg-card)" : "transparent",
                    color: theme === opt.value ? "var(--accent-primary)" : "var(--text-muted)",
                    boxShadow: theme === opt.value ? "var(--shadow-xs)" : "none",
                  }}
                >
                  {opt.icon}
                </button>
              ))}
            </div>
          </div>

          {BOTTOM_NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.label} href={item.href}
                className="relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px] font-medium transition-all mb-0.5"
                style={{
                  color: active ? "var(--accent-primary)" : "var(--text-secondary)",
                  background: active ? "var(--accent-primary-light)" : "transparent",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--bg-hover)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full" style={{ background: "var(--accent-primary-gradient)" }} />
                )}
                <span style={{ color: active ? "var(--accent-primary)" : "var(--text-muted)" }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Topbar ── */}
        <header className="sticky top-0 z-40 h-14 flex items-center justify-between px-4 lg:px-6 gap-4 border-b shrink-0"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}>
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden" style={{ color: "var(--text-muted)" }}>
              <Menu size={18} />
            </button>

            {/* Search */}
            <div className="w-full">
              <div className="relative">
                <label htmlFor="global-search" className="sr-only">Search products, attributes, conflicts</label>
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input id="global-search" name="global-search" placeholder="Search products, attributes, conflicts…"
                  className="w-full h-8 pl-8 pr-3 rounded-lg border text-[13px]"
                  style={{
                    background: "var(--neutral-50)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }} />
              </div>
            </div>
          </div>

          {/* Profile & Notifications positioned on the right side */}
          <div className="flex items-center gap-2.5 ml-auto shrink-0">
            {/* Notifications */}
            <button className="relative p-2 rounded-lg transition border" 
              style={{ color: "var(--text-muted)", borderColor: "var(--border-default)", background: "var(--bg-card)" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-card)"}>
              <Bell size={16} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full" style={{ background: "var(--accent-primary)" }} />
            </button>

            {/* User Profile Menu */}
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setUserMenuOpen(!userMenuOpen); }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition shadow-sm"
                style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-card)"}>
                <div className="h-7 w-7 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-white text-[10px] font-bold"
                  style={{ background: user?.photoURL ? "transparent" : "var(--accent-primary)" }}>
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
                  ) : (
                    getInitials()
                  )}
                </div>
                <span className="text-[13px] font-medium hidden sm:block" style={{ color: "var(--text-primary)" }}>
                  {user?.displayName || user?.email?.split("@")[0] || "User"}
                </span>
                <ChevronDown size={12} style={{ color: "var(--text-muted)" }} className="hidden sm:block" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border shadow-lg py-1 z-50"
                  style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}>
                  <div className="px-3 py-2.5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-white text-[10px] font-bold"
                        style={{ background: user?.photoURL ? "transparent" : "var(--accent-primary)" }}>
                        {user?.photoURL ? (
                          <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
                        ) : (
                          getInitials()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{user?.displayName || "User"}</div>
                        <div className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{user?.email}</div>
                      </div>
                    </div>
                  </div>
                  <Link href="/settings" className="flex items-center gap-2 px-3 py-2 text-[13px] transition"
                    style={{ color: "var(--text-secondary)" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <Settings size={14} /> Settings
                  </Link>
                  <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] transition"
                    style={{ color: "var(--color-error)" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-error-light)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Content ── */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
