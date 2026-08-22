import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const idNum = parseInt(params.id, 10) || 101;
  return NextResponse.json({
    id: idNum,
    name: "Siemens 1LE1001 15kW Industrial Motor",
    model_number: "1LE1001-1DB43-4AA4",
    category: "Industrial Automation",
    description: "High-efficiency 15 kW 3-phase AC induction motor with IP55 enclosure protection.",
    health_score: 87,
    attributes: [
      { id: 1, key: "rated_voltage", label: "Voltage", value: "415 V", confidence: 0.96, status: "VERIFIED", source: "Siemens_1LE1001_Datasheet.pdf", evidence: "Supply voltage: 400V/415V 50Hz" },
      { id: 2, key: "rated_power", label: "Power", value: "15 kW", confidence: 0.98, status: "VERIFIED", source: "Siemens_1LE1001_Datasheet.pdf", evidence: "Rated power output: 15 kW @ 50 Hz" },
      { id: 3, key: "efficiency_class", label: "Efficiency", value: "IE3", confidence: 0.94, status: "VERIFIED", source: "Siemens_1LE1001_Datasheet.pdf", evidence: "Efficiency class IE3 according to IEC 60034-30-1" },
      { id: 4, key: "max_temperature", label: "Max Temperature", value: "155 °C", confidence: 0.82, status: "CONFLICT", source: "Web Catalog vs Datasheet", evidence: "Web catalog claims 130°C rise limit vs Datasheet Class F (155°C)." },
      { id: 5, key: "total_weight", label: "Total Weight", value: undefined, confidence: 0.0, status: "MISSING", source: "Datasheet PDF", evidence: "Insufficient evidence in ingested documents." }
    ],
    review_items: [
      { id: 1, title: "Conflict: Max Temperature", item_type: "conflict", description: "Web catalog lists 130°C while datasheet specifies 155°C.", action: "Resolve Conflict", status: "pending" }
    ],
    conflicts: [],
    versions: []
  });
}
