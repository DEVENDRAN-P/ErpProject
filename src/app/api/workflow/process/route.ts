import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

    // Proxy request to the Render FastAPI backend
    if (backendUrl && !backendUrl.includes("localhost") && !backendUrl.includes("127.0.0.1")) {
      const formData = await request.formData();
      const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/workflow/process`, {
        method: "POST",
        body: formData,
        headers: {
          Authorization: request.headers.get("Authorization") || "",
        },
      });
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
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
