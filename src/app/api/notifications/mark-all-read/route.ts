import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

    if (backendUrl && !backendUrl.includes("localhost") && !backendUrl.includes("127.0.0.1")) {
      const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/notifications/mark-all-read`, {
        method: "POST",
        headers: {
          Authorization: request.headers.get("Authorization") || "",
        },
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
      { error: err.message || "Failed to mark all notifications as read." },
      { status: 502 }
    );
  }
}
