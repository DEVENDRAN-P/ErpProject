import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

    if (backendUrl && !backendUrl.includes("localhost") && !backendUrl.includes("127.0.0.1")) {
      const url = new URL(request.url);
      const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/products/batch/export${url.search}`, {
        headers: {
          Authorization: request.headers.get("Authorization") || "",
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: "Export failed" }));
        return NextResponse.json(data, { status: res.status });
      }

      const contentType = res.headers.get("content-type") || "application/json";
      const body = await res.arrayBuffer();
      return new NextResponse(body, {
        status: res.status,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": res.headers.get("Content-Disposition") || `attachment; filename="products_export.json"`,
        },
      });
    }

    return NextResponse.json(
      { error: "Backend not configured. Set BACKEND_URL to your Render deployment URL (e.g. https://your-app.onrender.com) in Vercel environment variables." },
      { status: 503 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to export products." },
      { status: 502 }
    );
  }
}
