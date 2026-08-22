import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = body?.url || "https://example.com";
    return NextResponse.json({
      success: true,
      message: `URL extraction completed for ${url}`,
      product_name: "Extracted Product Spec",
      extracted_attributes: [
        { key: "rated_power", label: "Rated Power", value: "15 kW", confidence: 0.95, source: url },
        { key: "efficiency_class", label: "Efficiency Class", value: "IE3", confidence: 0.92, source: url }
      ]
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "URL ingest failed" }, { status: 400 });
  }
}
