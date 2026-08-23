import { resolveBackendUrl } from "@/app/api/_lib/proxy";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const backendUrl = resolveBackendUrl();

    if (backendUrl) {
      const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/products/${params.id}/export/csv`, {
        headers: {
          Authorization: request.headers.get("Authorization") || "",
        },
      });
      const data = await res.text();
      return new NextResponse(data, {
        status: res.status,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="product_${params.id}_export.csv"`,
        },
      });
    }

    return NextResponse.json(
      { error: "Backend not configured. Please set BACKEND_URL environment variable." },
      { status: 503 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to export product data." },
      { status: 502 }
    );
  }
}
