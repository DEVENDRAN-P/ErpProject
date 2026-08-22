"use client";

import React, { useState, useEffect } from "react";

type LogoProps = {
  size?: number;
  showText?: boolean;
  className?: string;
  /** Override dark mode. If omitted, auto-detects from system preference. */
  dark?: boolean;
};

/**
 * Custom SVG logo for ProductPilot AI.
 * A stylized cube representing "product" with a neural-network accent representing "AI".
 * Automatically adapts to dark mode via `prefers-color-scheme` or manual `dark` prop.
 */
export default function Logo({ size = 32, showText = false, className = "", dark: darkProp }: LogoProps) {
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const isDark = darkProp ?? systemDark;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Icon */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <defs>
          <linearGradient
            id={`pp-bg-${isDark ? "dark" : "light"}`}
            x1="0" y1="0" x2="100" y2="100"
            gradientUnits="userSpaceOnUse"
          >
            {isDark ? (
              <>
                <stop offset="0%" stopColor="#60A5FA" />
                <stop offset="100%" stopColor="#2563EB" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#1E40AF" />
              </>
            )}
          </linearGradient>
          <linearGradient id="pp-accent" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>

        {/* Rounded square background */}
        <rect
          x="2" y="2" width="96" height="96" rx="24"
          fill={`url(#pp-bg-${isDark ? "dark" : "light"})`}
        />

        {/* Isometric cube — front face */}
        <path
          d="M50 25 L75 39 L75 63 L50 77 L25 63 L25 39 Z"
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinejoin="round"
          opacity={isDark ? 0.4 : 0.35}
        />
        {/* Cube — top face */}
        <path
          d="M50 25 L75 39 L50 53 L25 39 Z"
          fill="white"
          opacity={isDark ? 0.18 : 0.15}
        />
        {/* Cube — left face */}
        <path
          d="M25 39 L50 53 L50 77 L25 63 Z"
          fill="white"
          opacity={isDark ? 0.1 : 0.08}
        />
        {/* Cube — right face */}
        <path
          d="M75 39 L50 53 L50 77 L75 63 Z"
          fill="white"
          opacity={isDark ? 0.25 : 0.2}
        />

        {/* Central dot — AI core */}
        <circle cx="50" cy="51" r="5" fill="white" opacity={isDark ? 1 : 0.95} />

        {/* Neural connection lines */}
        <line x1="50" y1="46" x2="50" y2="30" stroke="url(#pp-accent)" strokeWidth="2" opacity={isDark ? 0.7 : 0.6} strokeLinecap="round" />
        <line x1="55" y1="51" x2="70" y2="43" stroke="url(#pp-accent)" strokeWidth="2" opacity={isDark ? 0.7 : 0.6} strokeLinecap="round" />
        <line x1="45" y1="51" x2="30" y2="43" stroke="url(#pp-accent)" strokeWidth="2" opacity={isDark ? 0.7 : 0.6} strokeLinecap="round" />
        <line x1="50" y1="56" x2="50" y2="70" stroke="url(#pp-accent)" strokeWidth="2" opacity={isDark ? 0.6 : 0.5} strokeLinecap="round" />
        <line x1="55" y1="48" x2="68" y2="36" stroke="url(#pp-accent)" strokeWidth="1.5" opacity={isDark ? 0.5 : 0.4} strokeLinecap="round" />
        <line x1="45" y1="48" x2="32" y2="36" stroke="url(#pp-accent)" strokeWidth="1.5" opacity={isDark ? 0.5 : 0.4} strokeLinecap="round" />

        {/* Node dots */}
        <circle cx="50" cy="28" r="2.5" fill="white" opacity={isDark ? 0.9 : 0.8} />
        <circle cx="72" cy="42" r="2.5" fill="white" opacity={isDark ? 0.8 : 0.7} />
        <circle cx="28" cy="42" r="2.5" fill="white" opacity={isDark ? 0.8 : 0.7} />
        <circle cx="50" cy="72" r="2" fill="white" opacity={isDark ? 0.7 : 0.6} />
        <circle cx="70" cy="34" r="2" fill="white" opacity={isDark ? 0.6 : 0.5} />
        <circle cx="30" cy="34" r="2" fill="white" opacity={isDark ? 0.6 : 0.5} />

        {/* Sparkle accent — top right */}
        <path
          d="M80 16 L82 20 L86 18 L82 22 L84 26 L80 24 L76 26 L78 22 L74 18 L78 20 Z"
          fill="white"
          opacity={isDark ? 0.7 : 0.6}
        />
      </svg>

      {/* Text */}
      {showText && (
        <div className="flex flex-col min-w-0">
          <div
            className="font-bold tracking-tight leading-tight flex items-center gap-1.5"
            style={{ fontSize: Math.max(11, size * 0.42), color: "var(--text-primary)" }}
          >
            ProductPilot
            <span
              className="font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:bg-blue-400/10 dark:text-blue-400 dark:border-blue-400/20"
              style={{ fontSize: Math.max(8, size * 0.28) }}
            >
              AI
            </span>
          </div>
          <div
            className="font-medium leading-tight"
            style={{ fontSize: Math.max(9, size * 0.32), color: "var(--text-muted)" }}
          >
            Enterprise Intelligence
          </div>
        </div>
      )}
    </div>
  );
}
