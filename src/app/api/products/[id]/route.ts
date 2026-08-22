import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const idNum = parseInt(params.id, 10) || 101;
  return NextResponse.json({
    id: idNum,
    name: "Siemens 1LE1001 15kW Industrial Motor",
    model_number: "1LE1001-1DB43-4AA4",
    category: "Industrial Automation",
    description: "High-efficiency 15 kW 3-phase AC induction motor with IP55 enclosure protection.",
    health_score: 92,
    attributes: [
      { id: 1, key: "rated_power", label: "Rated Power", value: "15 kW", confidence: 0.98, status: "VERIFIED", source: "Datasheet PDF", evidence: "Rated power output: 15 kW @ 50 Hz" },
      { id: 2, key: "rated_voltage", label: "Rated Voltage", value: "415 V", confidence: 0.96, status: "VERIFIED", source: "Datasheet PDF", evidence: "Supply voltage: 400V/415V 50Hz" },
      { id: 3, key: "efficiency_class", label: "Efficiency Class", value: "IE3", confidence: 0.95, status: "VERIFIED", source: "Datasheet PDF", evidence: "Efficiency class IE3 according to IEC 60034-30-1" },
      { id: 4, key: "operating_speed", label: "Operating Speed", value: "1475 RPM", confidence: 0.94, status: "VERIFIED", source: "Datasheet PDF", evidence: "Nominal speed: 1475 r/min" },
      { id: 5, key: "enclosure_rating", label: "Enclosure Protection", value: "IP55", confidence: 0.99, status: "VERIFIED", source: "Datasheet PDF", evidence: "Degree of protection IP55" }
    ],
    review_items: [],
    conflicts: [],
    versions: []
  });
}
