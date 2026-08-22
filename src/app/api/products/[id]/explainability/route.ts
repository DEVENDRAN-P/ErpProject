import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  return NextResponse.json({
    overall_confidence: 0.96,
    attributes_breakdown: [
      { key: "rated_power", label: "Rated Power", value: "15 kW", confidence: 0.98, source: "Siemens_1LE1001_Datasheet.pdf", evidence: "Rated power output: 15 kW @ 50 Hz", rationale: "Extracted directly from technical spec sheet table section 1." },
      { key: "rated_voltage", label: "Rated Voltage", value: "415 V", confidence: 0.96, source: "Siemens_1LE1001_Datasheet.pdf", evidence: "Supply voltage: 400V/415V 50Hz", rationale: "Matched electrical operating standard for 3-phase delta config." },
      { key: "efficiency_class", label: "Efficiency Class", value: "IE3", confidence: 0.95, source: "Siemens_1LE1001_Datasheet.pdf", evidence: "Efficiency class IE3 according to IEC 60034-30-1", rationale: "Validated against international IEC standard compliance register." }
    ]
  });
}
