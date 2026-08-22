import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    total_products: 156,
    overall_quality_score: 91,
    total_attributes: 1240,
    filled_attributes: 1165,
    completeness_rate: 94,
    total_conflicts: 5,
    resolved_conflicts: 4,
    conflict_rate: 3.2,
    resolution_rate: 92,
    health_distribution: { excellent: 110, attention: 38, needs_review: 8 },
    completeness_by_category: {
      "Industrial Automation": { total: 60, filled: 57, completeness_pct: 95 },
      "Electrical Components": { total: 96, filled: 88, completeness_pct: 92 },
    },
    missing_by_attribute: { "Warranty Period": 5, "Certifications": 3 },
  });
}
