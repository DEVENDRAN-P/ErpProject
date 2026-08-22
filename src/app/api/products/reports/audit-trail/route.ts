import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json([
    {
      product_id: 101,
      product_name: "Siemens 1LE1001 15kW Motor",
      action: "attribute_approved",
      field: "rated_power",
      old_value: "14 kW",
      new_value: "15 kW",
      source: "Siemens_1LE1001_Datasheet.pdf",
      reviewer: "DEVENDRAN P",
      timestamp: new Date().toISOString()
    },
    {
      product_id: 101,
      product_name: "Siemens 1LE1001 15kW Motor",
      action: "conflict_resolved",
      field: "supply_voltage",
      old_value: "400 V",
      new_value: "415 V",
      source: "Siemens_1LE1001_Datasheet.pdf",
      reviewer: "DEVENDRAN P",
      timestamp: new Date(Date.now() - 3600000).toISOString()
    }
  ]);
}
