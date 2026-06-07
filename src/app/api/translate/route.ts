import { NextRequest, NextResponse } from "next/server";
import { translateBatch } from "@/lib/translate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

interface TranslateRequest {
  texts?: unknown;
  source?: unknown;
  target?: unknown;
}

export async function POST(req: NextRequest) {
  let body: TranslateRequest;
  try {
    body = (await req.json()) as TranslateRequest;
  } catch {
    return NextResponse.json({ error: "Body JSON không hợp lệ." }, { status: 400 });
  }

  const texts = Array.isArray(body.texts) ? body.texts.filter((t): t is string => typeof t === "string") : null;
  if (!texts || texts.length === 0) {
    return NextResponse.json({ error: "Thiếu mảng `texts`." }, { status: 400 });
  }
  if (texts.length > 2000) {
    return NextResponse.json({ error: "Quá nhiều dòng (tối đa 2000)." }, { status: 400 });
  }

  const source = typeof body.source === "string" ? body.source : "auto";
  const target = typeof body.target === "string" ? body.target : "vi";

  try {
    const translations = await translateBatch(texts, { source, target });
    return NextResponse.json({ translations });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Dịch thất bại.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
