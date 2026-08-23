import { resolveBackendUrl } from "@/app/api/_lib/proxy";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Proxy for POST /api/workflow/process
 *
 * The backend performs PyMuPDF extraction + Gemini AI + database writes
 * in a single synchronous request. Large PDFs (100K+ chars) can take
 * 60-90s. We do NOT impose an artificial timeout here — the platform's
 * own request-duration limit (Vercel 60s Hobby / 300s Pro, Render ~30s
 * free / 120s paid) is the natural ceiling.
 *
 * If the platform times out, the client receives a 504/502 from the
 * platform itself, which is a truthful signal the user can act on.
 */
export async function POST(request: Request) {
  const backendUrl = resolveBackendUrl();

  if (!backendUrl) {
    return NextResponse.json(
      { error: "Backend not configured. Set BACKEND_URL to your Render deployment URL (e.g. https://your-app.onrender.com) in Vercel environment variables." },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();

    const res = await fetch(`${backendUrl}/api/workflow/process`, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: request.headers.get("Authorization") || "",
      },
      // No AbortController timeout — let the platform enforce its own limit.
      // This avoids cutting off a legitimate Gemini request at 55s.
    });

    // Read response as text first so we can handle non-JSON gracefully.
    const text = await res.text();

    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: res.status });
    } catch {
      // Backend returned non-JSON (HTML error page, plain text, etc.)
      return NextResponse.json(
        { error: `Backend returned unexpected response (HTTP ${res.status}): ${text.substring(0, 300)}` },
        { status: res.status >= 400 ? res.status : 502 }
      );
    }
  } catch (err: any) {
    // Network error, connection refused, platform timeout, etc.
    const isTimeout =
      err?.name === "AbortError" ||
      err?.code === "ABORT_ERR" ||
      err?.message?.includes("abort") ||
      err?.message?.includes("timeout") ||
      err?.message?.includes("TIMED_OUT");

    if (isTimeout) {
      return NextResponse.json(
        {
          error: "Document analysis timed out. The backend may be processing a large document. Wait a moment and try again, or try with a smaller file.",
          error_type: "timeout",
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: err?.message || "Document analysis failed. The backend may be temporarily unavailable." },
      { status: 502 }
    );
  }
}
