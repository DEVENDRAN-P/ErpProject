"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { auth } from "@/lib/firebase";

type WsNotificationPayload = {
  id?: string;
  type: string;
  title: string;
  message: string;
  product_id?: number;
  timestamp?: string;
};

type WsMessage = {
  type: string;
  data?: WsNotificationPayload;
};

type UseWebSocketOptions = {
  userId?: string;
  autoReconnect?: boolean;
  heartbeatMs?: number;
};

type UseWebSocketReturn = {
  connected: boolean;
  lastNotification: WsNotificationPayload | null;
  notifications: WsNotificationPayload[];
  clearNotifications: () => void;
  send: (msg: unknown) => void;
};

function resolveWsUrl(): string {
  try {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";

    // Production: derive from NEXT_PUBLIC_BACKEND_URL
    const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (envUrl) {
      const u = new URL(envUrl);
      u.protocol = proto;
      u.pathname = "/api/ws/notifications";
      u.search = "";
      return u.toString();
    }

    // Same-host fallback (works in local dev)
    const host = window.location.hostname;
    const port = process.env.NEXT_PUBLIC_WS_PORT || "8000";
    return `${proto}//${host}:${port}/api/ws/notifications`;
  } catch {
    return "ws://localhost:8000/api/ws/notifications";
  }
}

/** Detect if we're on a platform known not to support WebSocket (e.g. Render free tier). */
function wsUnsupported(): boolean {
  try {
    const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
    if (envUrl.includes("onrender.com")) return true;
  } catch {}
  return false;
}

export function useWebSocket(opts: UseWebSocketOptions): UseWebSocketReturn {
  const { userId, autoReconnect = true, heartbeatMs = 30_000 } = opts;

  const [connected, setConnected] = useState(false);
  const [lastNotification, setLastNotification] = useState<WsNotificationPayload | null>(null);
  const [notifications, setNotifications] = useState<WsNotificationPayload[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);
  const wsUrl = resolveWsUrl();

  const cleanup = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, heartbeatMs);
  }, [heartbeatMs]);

  const connect = useCallback(() => {
    if (!userId) return;
    // Skip WebSocket on platforms that don't support it
    if (wsUnsupported()) return;

    cleanup();

    const url = `${wsUrl}?user_id=${encodeURIComponent(userId)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectAttempt.current = 0;
      startHeartbeat();
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        if (msg.type === "notification") {
          const payload = msg.data!;
          setLastNotification(payload);
          setNotifications((prev) => [payload, ...prev].slice(0, 100));
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      wsRef.current = null;

      if (autoReconnect && userId && reconnectAttempt.current < 3) {
        const delay = Math.min(5000 * 2 ** reconnectAttempt.current, 60_000);
        reconnectAttempt.current += 1;
        reconnectTimerRef.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      try { ws.close(); } catch {}
    };
  }, [userId, wsUrl, autoReconnect, cleanup, startHeartbeat]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  // Reconnect when page is restored from Back-Forward Cache
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted && userId) {
        cleanup();
        reconnectAttempt.current = 0;
        connect();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [userId, connect, cleanup]);

  const send = useCallback((msg: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const clearNotifications = useCallback(() => setNotifications([]), []);

  return { connected, lastNotification, notifications, clearNotifications, send };
}
