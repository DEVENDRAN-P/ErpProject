import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Vercel serverless timeout is 60s (Pro) or 10s (Hobby).
// Render free tier may take 30-60s for LLM processing.
// Set a generous timeout but still leave room for Vercel's own limit.
const BACKEND_TIMEOUT_MS = 55_000; // 55 seconds

export async function POST(request: Request) {
  try {
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

    // Proxy request to the Render FastAPI backend
    if (backendUrl && !backendUrl.includes("localhost") && !backendUrl.includes("127.0.0.1")) {
      const formData = await request.formData();

      // Use AbortController for timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

      try {
        const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/workflow/process`, {
          method: "POST",
          body: formData,
          headers: {
            Authorization: request.headers.get("Authorization") || "",
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
      } catch (fetchErr: any) {
        clearTimeout(timeout);
        if (fetchErr.name === "AbortError") {
          return NextResponse.json(
            { error: "Document analysis timed out. The backend is processing a large document — try again with a smaller file, or wait a moment and retry." },
            { status: 504 }
          );
        }
        throw fetchErr;
      }
    }

    // Backend not configured
    return NextResponse.json(
      { error: "Backend not configured. Please set BACKEND_URL environment variable to connect to the Render FastAPI backend." },
      { status: 503 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Document analysis failed. The backend may be temporarily unavailable." },
      { status: 502 }
    );
  }
}
