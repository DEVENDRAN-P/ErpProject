import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    total_products: 1,
    average_health_score: 92,
    products_requiring_review: 0,
    missing_attributes: 0,
    open_conflicts: 0,
    total_attributes: 5,
    pending_reviews: 0,
    recent_changes: [],
    quality_overview: { excellent: 1, attention: 0, needs_review: 0 }
  });
}
