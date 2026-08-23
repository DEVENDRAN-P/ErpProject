/**
 * Resolve the backend URL for proxy routes.
 *
 * In production (Vercel), BACKEND_URL is set to the Render URL.
 * In local dev, BACKEND_URL may be unset or set to localhost:8000.
 */
export function resolveBackendUrl(): string | null {
  const url = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
  if (url) return url.replace(/\/$/, "");
  // Auto-detect local backend
  return "http://localhost:8000";
}
