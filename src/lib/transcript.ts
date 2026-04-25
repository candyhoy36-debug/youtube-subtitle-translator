import type { CaptionTrackInfo, SubtitleSegment, TranscriptResponse } from "./types";

/**
 * Fetches caption tracks via the InnerTube `ANDROID_VR` (Oculus Quest)
 * client. Compared to the regular web client, this client is currently
 * exempt from the per-IP `pot` (proof-of-origin token) check that causes
 * `timedtext` to return empty bodies for datacenter / CI IPs.
 *
 * Reference: this is the same client `yt-dlp` falls back to by default.
 */

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

interface PlayerResponse {
  videoDetails?: { title?: string };
  playabilityStatus?: { status?: string; reason?: string };
  captions?: {
    playerCaptionsTracklistRenderer?: { captionTracks?: YtCaptionTrack[] };
  };
}

const ANDROID_VR_USER_AGENT =
  "com.google.android.apps.youtube.vr.oculus/1.62.27 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip";

const INNERTUBE_PLAYER_URL =
  "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";

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

async function fetchPlayerResponse(videoId: string): Promise<PlayerResponse> {
  const body = {
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
    context: {
      client: {
        clientName: "ANDROID_VR",
        clientVersion: "1.62.27",
        deviceMake: "Oculus",
        deviceModel: "Quest 3",
        androidSdkVersion: 32,
        userAgent: ANDROID_VR_USER_AGENT,
        hl: "en",
        gl: "US",
        timeZone: "UTC",
        utcOffsetMinutes: 0,
      },
    },
  };

  const res = await fetch(INNERTUBE_PLAYER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": ANDROID_VR_USER_AGENT,
      "X-Goog-Api-Format-Version": "2",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`InnerTube player API failed (${res.status}).`);
  }
  return (await res.json()) as PlayerResponse;
}

function pickBestTrack(
  tracks: YtCaptionTrack[],
  preferred?: string,
): YtCaptionTrack | null {
  if (tracks.length === 0) return null;
  const isManual = (t: YtCaptionTrack) => t.kind !== "asr";
  const byLang = (lang: string) =>
    tracks.find((t) => t.languageCode === lang && isManual(t)) ||
    tracks.find((t) => t.languageCode === lang);

  if (preferred) {
    const t = byLang(preferred);
    if (t) return t;
  }

  return (
    byLang("en") ||
    tracks.find(isManual) ||
    tracks.find((t) => t.languageCode === "en") ||
    tracks[0]
  );
}

function withFmt(baseUrl: string, fmt: string): string {
  return `${baseUrl.replace(/[?&]fmt=[^&]*/g, "")}&fmt=${fmt}`;
}

async function fetchTrackJson3(baseUrl: string): Promise<YtJson3Event[]> {
  const url = withFmt(baseUrl, "json3");
  const res = await fetch(url, {
    headers: { "User-Agent": ANDROID_VR_USER_AGENT },
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
  // collapsing entries whose text exactly matches the previous one.
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
  const player = await fetchPlayerResponse(videoId);

  const status = player.playabilityStatus?.status;
  if (status && status !== "OK") {
    throw new Error(
      player.playabilityStatus?.reason ?? `Video không phát được (${status}).`,
    );
  }

  const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
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
