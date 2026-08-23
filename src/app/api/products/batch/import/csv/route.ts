import { resolveBackendUrl } from "@/app/api/_lib/proxy";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const backendUrl = resolveBackendUrl();

    if (backendUrl) {
      const formData = await request.formData();
      const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/products/batch/import/csv`, {
        method: "POST",
        headers: {
          Authorization: request.headers.get("Authorization") || "",
        },
        body: formData,
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
      { error: err.message || "Failed to import CSV." },
      { status: 502 }
    );
  }
}
