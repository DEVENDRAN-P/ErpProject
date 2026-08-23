import { resolveBackendUrl } from "@/app/api/_lib/proxy";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const backendUrl = resolveBackendUrl();

    if (backendUrl) {
      const url = new URL(request.url);
      const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/notifications${url.search}`, {
        headers: {
          Authorization: request.headers.get("Authorization") || "",
        },
      });
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json([]);
  } catch (err: any) {
    return NextResponse.json([]);
  }
}
