"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/api";
import { Notification } from "@/lib/types";
import { useWebSocket } from "@/lib/useWebSocket";
import { auth } from "@/lib/firebase";
import { Bell, CheckCheck, X } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";

const TYPE_COLORS: Record<string, string> = {
  conflict: "var(--color-warning)",
  review: "var(--accent-primary)",
  system: "var(--color-info)",
  batch: "#7C3AED",
  quality: "var(--color-success)",
};

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; message?: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Firebase auth listener ────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });
    return () => unsub();
  }, []);

  // ── WebSocket for real-time push ─────────────────────────────────────
  const { connected, lastNotification } = useWebSocket({ userId });

  // When a WS notification arrives: refresh list, bump unread, show toast
  useEffect(() => {
    if (!lastNotification) return;

    // Show toast
    setToast({ title: lastNotification.title, message: lastNotification.message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);

    // Refresh unread count immediately
    fetchUnreadCount()
      .then((d) => setUnreadCount(d.unread_count || 0))
      .catch(() => {});

    // If the dropdown is open, refresh the list
    if (isOpen) loadNotifications();
  }, [lastNotification, isOpen]);

  // ── Poll fallback while WS is disconnected ──────────────────────────
  useEffect(() => {
    // Don't poll until user is authenticated
    if (!userId) return;

    loadUnreadCount();
    // Only poll as fallback when WS is not connected
    if (connected) return;
    const interval = setInterval(loadUnreadCount, 30_000);
    return () => clearInterval(interval);
  }, [connected, userId]);

  useEffect(() => {
    if (isOpen) loadNotifications();
  }, [isOpen, filter]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadUnreadCount = async () => {
    try {
      const data = await fetchUnreadCount();
      setUnreadCount(data.unread_count || 0);
    } catch {
      // Silently fail
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const typeFilter = filter === "all" ? undefined : filter;
      const data = await fetchNotifications(typeFilter);
      setNotifications(data);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  };

  return (
    <>
      {/* ── Toast notification ──────────────────────────────────────────── */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-[9999] max-w-sm rounded-xl border px-4 py-3 shadow-xl animate-in slide-in-from-top-4"
          style={{
            borderColor: "var(--border-default)",
            background: "var(--bg-card)",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div className="flex items-start gap-3">
            <div className="h-2 w-2 rounded-full mt-1.5 shrink-0" style={{ background: "var(--accent-primary)" }} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{toast.title}</div>
              {toast.message && <div className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{toast.message}</div>}
            </div>
            <button onClick={() => setToast(null)} className="shrink-0 rounded p-0.5 hover:bg-black/5">
              <X size={12} style={{ color: "var(--text-muted)" }} />
            </button>
          </div>
        </div>
      )}

      <div className="relative" ref={dropdownRef}>
        {/* ── Bell button ─────────────────────────────────────────────── */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative h-9 w-9 rounded-lg flex items-center justify-center transition"
          style={{
            background: isOpen ? "var(--accent-primary-light)" : "transparent",
            color: "var(--text-secondary)",
          }}
        >
          <Bell size={18} />
          {/* Connection indicator dot */}
          <span
            className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-white"
            style={{ background: connected ? "var(--color-success)" : "var(--text-muted)" }}
            title={connected ? "Real-time connected" : "Polling mode"}
          />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1"
              style={{ background: "var(--color-error)" }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* ── Dropdown panel ──────────────────────────────────────────── */}
        {isOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-80 rounded-xl border shadow-xl z-50"
            style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: "var(--border-default)" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ background: "var(--color-error)", color: "white" }}
                  >
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: connected ? "var(--color-success-light)" : "var(--neutral-100)",
                    color: connected ? "var(--color-success)" : "var(--text-muted)",
                  }}
                >
                  {connected ? "Live" : "Polling"}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="rounded p-1 transition hover:bg-black/5"
                    title="Mark all as read"
                  >
                    <CheckCheck size={14} style={{ color: "var(--accent-primary)" }} />
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="rounded p-1 transition hover:bg-black/5">
                  <X size={14} style={{ color: "var(--text-muted)" }} />
                </button>
              </div>
            </div>

            {/* Filters */}
            <div
              className="flex items-center gap-1.5 px-3 py-2 border-b overflow-x-auto"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              {["all", "conflict", "review", "system"].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium transition"
                  style={{
                    background: filter === type ? "var(--accent-primary)" : "var(--neutral-100)",
                    color: filter === type ? "white" : "var(--text-secondary)",
                  }}
                >
                  {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            {/* Notification list */}
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                  Loading…
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell size={20} style={{ color: "var(--text-muted)", margin: "0 auto" }} />
                  <div className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                    No notifications
                  </div>
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (!n.is_read) handleMarkRead(n.id);
                    }}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left transition border-b last:border-b-0"
                    style={{
                      borderColor: "var(--border-subtle)",
                      background: n.is_read ? "transparent" : "var(--accent-primary-light)",
                    }}
                  >
                    <div
                      className="h-2 w-2 rounded-full mt-1.5 shrink-0"
                      style={{
                        background: n.is_read ? "transparent" : TYPE_COLORS[n.type] || "var(--text-muted)",
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                        {n.title}
                      </div>
                      {n.message && (
                        <div className="text-[11px] mt-0.5 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                          {n.message}
                        </div>
                      )}
                      <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                        {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                      </div>
                    </div>
                    {!n.is_read && (
                      <div className="h-1.5 w-1.5 rounded-full mt-1.5 shrink-0" style={{ background: "var(--accent-primary)" }} />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
