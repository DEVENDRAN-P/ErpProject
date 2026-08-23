import { resolveBackendUrl } from "@/app/api/_lib/proxy";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Proxy for POST /api/workflow/process-csv
 *
 * CSV processing iterates each row, calling Gemini for product type
 * detection, normalization, and enrichment. Large CSVs (200+ rows)
 * can take 60-120s. We do NOT impose an artificial timeout — the
 * platform's own request-duration limit is the natural ceiling.
 */
export async function POST(request: Request) {
  const backendUrl = resolveBackendUrl();

  if (!backendUrl) {
    return NextResponse.json(
      { error: "Backend not configured. Set BACKEND_URL to your Render deployment URL in Vercel environment variables." },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();

    const res = await fetch(`${backendUrl}/api/workflow/process-csv`, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: request.headers.get("Authorization") || "",
      },
    });

    const text = await res.text();

    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: res.status });
    } catch {
      return NextResponse.json(
        { error: `Backend returned unexpected response (HTTP ${res.status}): ${text.substring(0, 300)}` },
        { status: res.status >= 400 ? res.status : 502 }
      );
    }
  } catch (err: any) {
    const isTimeout =
      err?.name === "AbortError" ||
      err?.code === "ABORT_ERR" ||
      err?.message?.includes("abort") ||
      err?.message?.includes("timeout") ||
      err?.message?.includes("TIMED_OUT");

    if (isTimeout) {
      return NextResponse.json(
        {
          error: "CSV processing timed out. The file may be too large — try splitting it into smaller batches.",
          error_type: "timeout",
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: err?.message || "CSV processing failed. The backend may be temporarily unavailable." },
      { status: 502 }
    );
  }
}
