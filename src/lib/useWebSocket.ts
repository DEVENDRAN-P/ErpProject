"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WsNotificationPayload = {
  type: string; // conflict | review | system | batch | quality
  title: string;
  message?: string;
  product_id?: number;
  timestamp?: string;
};

type WsMessage =
  | { type: "connected"; data: { user_id: string; message: string } }
  | { type: "notification"; data: WsNotificationPayload }
  | { type: "pong"; data: Record<string, never> }
  | { type: "ack"; data: { notification_id?: number } };

export type UseWebSocketOptions = {
  /** Firebase user ID to authenticate the WebSocket connection. */
  userId: string | null;
  /** Backend WebSocket URL. Falls back to same-origin with /api prefix. */
  wsUrl?: string;
  /** Auto-reconnect on drop (default true). */
  autoReconnect?: boolean;
  /** Heartbeat interval in ms (default 30 000). */
  heartbeatMs?: number;
};

export type UseWebSocketReturn = {
  /** Whether the WebSocket is currently connected. */
  connected: boolean;
  /** The most recent notification pushed via WS. */
  lastNotification: WsNotificationPayload | null;
  /** All notifications received since mount. */
  notifications: WsNotificationPayload[];
  /** Clear the notifications array. */
  clearNotifications: () => void;
  /** Send an arbitrary message to the server. */
  send: (msg: unknown) => void;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWebSocket(opts: UseWebSocketOptions): UseWebSocketReturn {
  const { userId, autoReconnect = true, heartbeatMs = 30_000 } = opts;

  const [connected, setConnected] = useState(false);
  const [lastNotification, setLastNotification] = useState<WsNotificationPayload | null>(null);
  const [notifications, setNotifications] = useState<WsNotificationPayload[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);

  // Resolve the WS URL once per userId change
  const wsUrl = (() => {
    if (opts.wsUrl) return opts.wsUrl;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    // In dev Next.js proxies /api → FastAPI, so go direct to backend
    const host = window.location.hostname;
    const port = process.env.NEXT_PUBLIC_WS_PORT || "8000";
    return `${proto}//${host}:${port}/api/ws/notifications`;
  })();

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
    const isRemoteHost = typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
    if (isRemoteHost && !process.env.NEXT_PUBLIC_WS_URL) {
      // Skip WebSocket connection on remote Vercel preview when WS server is not configured
      return;
    }
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
          const payload = msg.data;
          setLastNotification(payload);
          setNotifications((prev) => [payload, ...prev].slice(0, 100)); // keep last 100
        }
        // "connected" and "pong" are silently handled
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      wsRef.current = null;

      const isRemoteHost = typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
      if (autoReconnect && userId && (!isRemoteHost || reconnectAttempt.current < 2)) {
        const delay = Math.min(2000 * 2 ** reconnectAttempt.current, 30_000);
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
        // Page was restored from BFCache — force reconnect
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
