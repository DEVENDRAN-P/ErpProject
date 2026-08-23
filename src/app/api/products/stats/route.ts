import { resolveBackendUrl } from "@/app/api/_lib/proxy";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const backendUrl = resolveBackendUrl();

    if (backendUrl) {
      const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/products/stats`, {
        headers: {
          Authorization: request.headers.get("Authorization") || "",
        },
      });
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(
      { error: "Backend not configured. Please set BACKEND_URL environment variable." },
      { status: 503 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch dashboard stats." },
      { status: 502 }
    );
  }
}
