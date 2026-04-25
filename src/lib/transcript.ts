import type { CaptionTrackInfo, SubtitleSegment, TranscriptResponse } from "./types";

interface YtCaptionTrack {
  baseUrl: string;
  name?: { simpleText?: string; runs?: { text: string }[] };
  vssId?: string;
  languageCode: string;
  kind?: string;
}

interface YtJson3Event {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: { utf8?: string }[];
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function readableLanguageName(track: YtCaptionTrack): string {
  const name = track.name?.simpleText ?? track.name?.runs?.map((r) => r.text).join("") ?? "";
  return name || track.languageCode;
}

async function fetchWatchPage(videoId: string): Promise<string> {
  const url = `https://www.youtube.com/watch?v=${videoId}&hl=en`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch YouTube watch page (${res.status}).`);
  }
  return res.text();
}

function extractCaptionTracks(html: string): YtCaptionTrack[] {
  // ytInitialPlayerResponse may be assigned via `var ytInitialPlayerResponse = {...};`
  // or embedded as `ytInitialPlayerResponse":{...}` inside a larger blob.
  const match =
    html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});/) ||
    html.match(/ytInitialPlayerResponse"\s*:\s*(\{.+?\})\s*,\s*"/);
  if (!match) return [];
  const jsonText = match[1];
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  const captions = (parsed as {
    captions?: {
      playerCaptionsTracklistRenderer?: { captionTracks?: YtCaptionTrack[] };
    };
  })?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  return Array.isArray(captions) ? captions : [];
}

function pickBestTrack(tracks: YtCaptionTrack[], preferred?: string): YtCaptionTrack | null {
  if (tracks.length === 0) return null;
  const isManual = (t: YtCaptionTrack) => t.kind !== "asr";
  const byLang = (lang: string) =>
    tracks.find((t) => t.languageCode === lang && isManual(t)) ||
    tracks.find((t) => t.languageCode === lang);

  if (preferred) {
    const t = byLang(preferred);
    if (t) return t;
  }

  // Prefer English manual, then any manual, then English asr, then first.
  return (
    byLang("en") ||
    tracks.find(isManual) ||
    tracks.find((t) => t.languageCode === "en") ||
    tracks[0]
  );
}

async function fetchTrackJson3(baseUrl: string): Promise<YtJson3Event[]> {
  const url = baseUrl.includes("fmt=") ? baseUrl : `${baseUrl}&fmt=json3`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch caption track (${res.status}).`);
  }
  const text = await res.text();
  if (!text.trim()) return [];
  let json: { events?: YtJson3Event[] };
  try {
    json = JSON.parse(text) as { events?: YtJson3Event[] };
  } catch {
    return [];
  }
  return json.events ?? [];
}

function eventsToSegments(events: YtJson3Event[]): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];
  for (const e of events) {
    if (typeof e.tStartMs !== "number" || !e.segs) continue;
    const text = e.segs
      .map((s) => s.utf8 ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    const start = e.tStartMs / 1000;
    const duration = (e.dDurationMs ?? 0) / 1000;
    segments.push({
      start,
      duration,
      end: start + duration,
      text: decodeHtmlEntities(text),
    });
  }
  // Some auto-caption tracks emit overlapping rolling events. Deduplicate by
  // collapsing entries whose text is fully contained in the previous one.
  const cleaned: SubtitleSegment[] = [];
  for (const seg of segments) {
    const last = cleaned[cleaned.length - 1];
    if (last && last.text === seg.text) continue;
    cleaned.push(seg);
  }
  return cleaned;
}

export async function fetchTranscript(
  videoId: string,
  preferredLang?: string,
): Promise<TranscriptResponse> {
  const html = await fetchWatchPage(videoId);
  const tracks = extractCaptionTracks(html);
  if (tracks.length === 0) {
    throw new Error("Video này không có phụ đề.");
  }

  const chosen = pickBestTrack(tracks, preferredLang);
  if (!chosen) {
    throw new Error("Không tìm được track phụ đề phù hợp.");
  }

  const events = await fetchTrackJson3(chosen.baseUrl);
  const segments = eventsToSegments(events);
  if (segments.length === 0) {
    throw new Error("Phụ đề rỗng hoặc không thể đọc được.");
  }

  const trackInfo: CaptionTrackInfo = {
    languageCode: chosen.languageCode,
    languageName: readableLanguageName(chosen),
    kind: chosen.kind,
  };

  const availableTracks: CaptionTrackInfo[] = tracks.map((t) => ({
    languageCode: t.languageCode,
    languageName: readableLanguageName(t),
    kind: t.kind,
  }));

  return {
    videoId,
    track: trackInfo,
    availableTracks,
    segments,
  };
}
