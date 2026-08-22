import { NextResponse } from "next/server";
import { evaluateRagQuery } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { question, document_context, product_id } = body || {};
    const result = evaluateRagQuery(question || "", document_context, product_id);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to evaluate RAG query" },
      { status: 400 }
    );
  }
}
