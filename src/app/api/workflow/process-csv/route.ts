import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_TIMEOUT_MS = 120_000; // 2 minutes for large CSVs

export async function POST(request: Request) {
  try {
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

    if (backendUrl && !backendUrl.includes("localhost") && !backendUrl.includes("127.0.0.1")) {
      const formData = await request.formData();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

      try {
        const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/workflow/process-csv`, {
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
            { error: "CSV processing timed out. The file may be too large — try splitting it into smaller batches." },
            { status: 504 }
          );
        }
        throw fetchErr;
      }
    }

    return NextResponse.json(
      { error: "Backend not configured. Set BACKEND_URL to your Render deployment URL in Vercel environment variables." },
      { status: 503 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "CSV processing failed. The backend may be temporarily unavailable." },
      { status: 502 }
    );
  }
}
