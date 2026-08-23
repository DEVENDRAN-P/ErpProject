import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

    if (backendUrl && !backendUrl.includes("localhost") && !backendUrl.includes("127.0.0.1")) {
      const body = await request.json();
      const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/products/knowledge-graph/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: request.headers.get("Authorization") || "",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(
      { error: "Backend not configured. Set BACKEND_URL to your Render deployment URL (e.g. https://your-app.onrender.com) in Vercel environment variables." },
      { status: 503 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to query knowledge graph." },
      { status: 502 }
    );
  }
}
