import { NextRequest, NextResponse } from "next/server";
import { fetchTranscript } from "@/lib/transcript";
import { extractVideoId } from "@/lib/youtube-id";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const raw = searchParams.get("video") ?? searchParams.get("videoId") ?? "";
  const lang = searchParams.get("lang") ?? undefined;

  const videoId = extractVideoId(raw);
  if (!videoId) {
    return NextResponse.json(
      { error: "URL hoặc video id không hợp lệ." },
      { status: 400 },
    );
  }

  try {
    const data = await fetchTranscript(videoId, lang);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Không lấy được phụ đề.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
