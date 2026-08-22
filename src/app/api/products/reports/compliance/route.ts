import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    overall_compliance_rate: 96,
    total_products: 156,
    by_category: {
      "Industrial Automation": { total_products: 60, compliant: 58, pending: 1, non_compliant: 1 },
      "Electrical Components": { total_products: 96, compliant: 92, pending: 2, non_compliant: 2 },
    },
  });
}
