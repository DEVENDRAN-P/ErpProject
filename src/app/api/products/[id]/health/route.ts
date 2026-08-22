import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  return NextResponse.json({
    health_score: 87,
    breakdown: {
      completeness: 88,
      accuracy: 94,
      consistency: 80,
      recency: 90
    },
    recommendations: [
      "2 attributes verified against primary datasheet PDF.",
      "1 conflict requires human review (Max Temperature).",
      "1 mandatory specification missing (Total Weight)."
    ]
  });
}
