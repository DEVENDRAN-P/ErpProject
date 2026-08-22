import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    nodes: [
      { id: "p-101", label: "Siemens 1LE1001", type: "product" },
      { id: "a-power", label: "15 kW", type: "attribute" },
      { id: "a-voltage", label: "415 V", type: "attribute" },
      { id: "a-eff", label: "IE3", type: "attribute" },
      { id: "s-pdf", label: "Siemens_1LE1001_Datasheet.pdf", type: "source" }
    ],
    edges: [
      { source: "p-101", target: "a-power", relation: "HAS_RATED_POWER" },
      { source: "p-101", target: "a-voltage", relation: "HAS_RATED_VOLTAGE" },
      { source: "p-101", target: "a-eff", relation: "HAS_EFFICIENCY_CLASS" },
      { source: "a-power", target: "s-pdf", relation: "VERIFIED_BY" },
      { source: "a-voltage", target: "s-pdf", relation: "VERIFIED_BY" },
      { source: "a-eff", target: "s-pdf", relation: "VERIFIED_BY" }
    ]
  });
}
