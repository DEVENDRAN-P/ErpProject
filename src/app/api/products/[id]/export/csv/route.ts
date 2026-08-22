import { NextResponse } from "next/server";

export async function GET() {
  const csvContent = [
    "Key,Label,Value,Confidence,Status",
    "rated_power,Rated Power,15 kW,0.98,VERIFIED",
    "rated_voltage,Rated Voltage,415 V,0.96,VERIFIED",
    "efficiency_class,Efficiency Class,IE3,0.95,VERIFIED",
    "operating_speed,Operating Speed,1475 RPM,0.94,VERIFIED",
    "enclosure_rating,Enclosure Protection,IP55,0.99,VERIFIED"
  ].join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="product_101_export.csv"'
    }
  });
}
