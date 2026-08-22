import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  return NextResponse.json({
    score: 87,
    health_score: 87,
    completeness: 88,
    consistency: 80,
    confidence: 85,
    source_reliability: 90,
    weights: {
      completeness: 40,
      consistency: 30,
      confidence: 20,
      source_reliability: 10
    },
    explanation: "Product health score calculated using weighted attribute completeness, consistency checks, model confidence, and document provenance reliability.",
    breakdown: {
      completeness: 88,
      consistency: 80,
      confidence: 85,
      source_reliability: 90
    },
    recommendations: [
      "2 attributes verified against primary datasheet PDF.",
      "1 conflict requires human review (Max Temperature).",
      "1 mandatory specification missing (Total Weight)."
    ]
  });
}
