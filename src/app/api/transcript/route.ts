import { NextRequest, NextResponse } from "next/server";
import { fetchTranscript } from "@/lib/transcript";
import { extractVideoId } from "@/lib/youtube-id";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(
  raw: string,
  lang: string | undefined,
  cookies: string | undefined,
) {
  const videoId = extractVideoId(raw);
  if (!videoId) {
    return NextResponse.json(
      { error: "URL hoặc video id không hợp lệ." },
      { status: 400 },
    );
  }

  try {
    const data = await fetchTranscript(videoId, { preferredLang: lang, cookies });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Không lấy được phụ đề.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const raw = searchParams.get("video") ?? searchParams.get("videoId") ?? "";
  const lang = searchParams.get("lang") ?? undefined;
  const cookies = req.headers.get("x-yt-cookies") ?? undefined;
  return handle(raw, lang, cookies);
}

export async function POST(req: NextRequest) {
  let body: { video?: string; videoId?: string; lang?: string; cookies?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ." }, { status: 400 });
  }
  const raw = body.video ?? body.videoId ?? "";
  const lang = body.lang ?? undefined;
  const cookies = body.cookies ?? req.headers.get("x-yt-cookies") ?? undefined;
  return handle(raw, lang, cookies);
}
