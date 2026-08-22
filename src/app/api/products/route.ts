import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json([
    {
      id: 101,
      name: "Siemens 1LE1001 15kW Industrial Motor",
      model_number: "1LE1001-1DB43-4AA4",
      category: "Industrial Automation",
      description: "High-efficiency 15 kW 3-phase AC induction motor with IP55 enclosure protection.",
      health_score: 92,
      attributes: [
        { key: "rated_power", label: "Rated Power", value: "15 kW", confidence: 0.98, status: "VERIFIED" },
        { key: "rated_voltage", label: "Rated Voltage", value: "415 V", confidence: 0.96, status: "VERIFIED" },
        { key: "efficiency_class", label: "Efficiency Class", value: "IE3", confidence: 0.95, status: "VERIFIED" },
        { key: "operating_speed", label: "Operating Speed", value: "1475 RPM", confidence: 0.94, status: "VERIFIED" },
        { key: "enclosure_rating", label: "Enclosure Protection", value: "IP55", confidence: 0.99, status: "VERIFIED" }
      ],
      review_items: []
    }
  ]);
}
