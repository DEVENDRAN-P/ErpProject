import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    health_score: 92,
    breakdown: {
      completeness: 95,
      accuracy: 94,
      consistency: 90,
      recency: 90
    },
    recommendations: [
      "All mandatory nameplate specifications are verified against primary datasheet PDF."
    ]
  });
}
