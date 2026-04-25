"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import YouTubePlayer, { type YTPlayer } from "@/components/YouTubePlayer";
import SubtitleOverlay from "@/components/SubtitleOverlay";
import SubtitleList, { type SubtitleListItem } from "@/components/SubtitleList";
import { extractVideoId } from "@/lib/youtube-id";
import {
  findActiveIndex,
  mergeSegmentsIntoSentences,
  type SentenceUnit,
} from "@/lib/sentences";
import type { TranscriptResponse } from "@/lib/types";

interface LoadedTranscript {
  data: TranscriptResponse;
  segmentTranslations: string[];
}

export default function Home() {
  const [urlInput, setUrlInput] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<LoadedTranscript | null>(null);
  const [translatingSegments, setTranslatingSegments] = useState(false);

  const [sentenceMode, setSentenceMode] = useState(false);
  const [sentenceTranslations, setSentenceTranslations] = useState<string[] | null>(null);
  const [translatingSentences, setTranslatingSentences] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef<YTPlayer | null>(null);

  const sentences: SentenceUnit[] = useMemo(() => {
    if (!loaded) return [];
    return mergeSegmentsIntoSentences(loaded.data.segments);
  }, [loaded]);

  // Derived translations for sentences from segment translations as a fallback
  // until we get a higher-quality sentence-level translation.
  const fallbackSentenceTranslations = useMemo(() => {
    if (!loaded) return [];
    return sentences.map((s) =>
      s.segmentIndexes
        .map((i) => loaded.segmentTranslations[i] ?? "")
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    );
  }, [loaded, sentences]);

  const items: SubtitleListItem[] = useMemo(() => {
    if (!loaded) return [];
    if (sentenceMode) {
      const translations = sentenceTranslations ?? fallbackSentenceTranslations;
      return sentences.map((s, i) => ({
        start: s.start,
        end: s.end,
        original: s.text,
        translated: translations[i],
      }));
    }
    return loaded.data.segments.map((s, i) => ({
      start: s.start,
      end: s.end,
      original: s.text,
      translated: loaded.segmentTranslations[i],
    }));
  }, [
    loaded,
    sentenceMode,
    sentences,
    sentenceTranslations,
    fallbackSentenceTranslations,
  ]);

  const activeIndex = useMemo(
    () => findActiveIndex(items, currentTime),
    [items, currentTime],
  );

  const activeItem = activeIndex >= 0 ? items[activeIndex] : undefined;

  const translateSegments = useCallback(async (data: TranscriptResponse) => {
    setTranslatingSegments(true);
    try {
      const texts = data.segments.map((s) => s.text);
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts, target: "vi" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Dịch thất bại.");
      const translations = (json.translations as string[]) ?? [];
      setLoaded((prev) =>
        prev
          ? {
              ...prev,
              segmentTranslations: translations,
            }
          : prev,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Dịch thất bại.";
      setErrorMessage((current) => current ?? message);
    } finally {
      setTranslatingSegments(false);
    }
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const id = extractVideoId(urlInput);
      if (!id) {
        setErrorMessage("URL không hợp lệ. Hãy paste link YouTube đầy đủ.");
        return;
      }
      setErrorMessage(null);
      setLoaded(null);
      setSentenceTranslations(null);
      setSentenceMode(false);
      setVideoId(id);
      setLoadingTranscript(true);
      try {
        const res = await fetch(`/api/transcript?video=${encodeURIComponent(id)}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error ?? "Không lấy được phụ đề.");
        }
        const data = json as TranscriptResponse;
        setLoaded({
          data,
          segmentTranslations: data.segments.map(() => ""),
        });
        // Kick off translation immediately.
        translateSegments(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Lỗi không xác định.";
        setErrorMessage(message);
        setVideoId(null);
      } finally {
        setLoadingTranscript(false);
      }
    },
    [urlInput, translateSegments],
  );

  // When sentence mode is toggled on the first time, fetch sentence-level
  // translations for higher quality. Cached afterwards.
  useEffect(() => {
    if (!sentenceMode || !loaded || sentenceTranslations) return;
    if (sentences.length === 0) return;
    let cancelled = false;
    (async () => {
      setTranslatingSentences(true);
      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texts: sentences.map((s) => s.text),
            target: "vi",
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Dịch thất bại.");
        if (!cancelled) {
          setSentenceTranslations((json.translations as string[]) ?? []);
        }
      } catch {
        // Silent fallback: we already have per-segment translations stitched.
      } finally {
        if (!cancelled) setTranslatingSentences(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sentenceMode, loaded, sentenceTranslations, sentences]);

  const handleSeek = useCallback((time: number) => {
    if (!playerRef.current) return;
    try {
      playerRef.current.seekTo(time, true);
      playerRef.current.playVideo();
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800/80">
        <div className="mx-auto max-w-7xl px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
              YouTube Subtitle Translator
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              Paste link video YouTube có sẵn phụ đề → xem phụ đề gốc + bản dịch Tiếng Việt.
            </p>
          </div>
          <form
            onSubmit={handleSubmit}
            className="flex w-full sm:w-auto items-center gap-2"
          >
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              className="flex-1 sm:w-96 rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/60"
            />
            <button
              type="submit"
              disabled={loadingTranscript}
              className="rounded-md bg-yellow-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-yellow-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingTranscript ? "Đang tải…" : "Tải"}
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {errorMessage ? (
          <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        {!videoId ? (
          <EmptyState />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section>
              <div className="relative w-full overflow-hidden rounded-xl bg-black aspect-video">
                <YouTubePlayer
                  videoId={videoId}
                  onReady={(player) => {
                    playerRef.current = player;
                  }}
                  onTimeUpdate={(t) => setCurrentTime(t)}
                />
                <SubtitleOverlay
                  original={activeItem?.original}
                  translated={activeItem?.translated}
                  loadingTranslation={
                    !!activeItem?.original &&
                    !activeItem?.translated &&
                    (translatingSegments || translatingSentences)
                  }
                />
              </div>

              {loaded ? (
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-yellow-500 focus:ring-yellow-500"
                      checked={sentenceMode}
                      onChange={(e) => setSentenceMode(e.target.checked)}
                    />
                    <span>Ghép thành câu hoàn chỉnh</span>
                  </label>
                  <span className="text-zinc-500">
                    {sentenceMode
                      ? `${sentences.length} câu`
                      : `${loaded.data.segments.length} dòng`}
                  </span>
                  <span className="text-zinc-500">
                    Phụ đề gốc:{" "}
                    <span className="text-zinc-300">
                      {loaded.data.track.languageName}
                      {loaded.data.track.kind === "asr" ? " (auto)" : ""}
                    </span>
                  </span>
                  {translatingSegments ? (
                    <span className="text-yellow-300">Đang dịch…</span>
                  ) : null}
                </div>
              ) : null}
            </section>

            <aside className="rounded-xl border border-zinc-800 bg-zinc-900/40 h-[60vh] lg:h-[78vh] overflow-hidden">
              {loadingTranscript ? (
                <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                  Đang tải phụ đề…
                </div>
              ) : (
                <SubtitleList
                  items={items}
                  activeIndex={activeIndex}
                  onSeek={handleSeek}
                  emptyMessage="Chưa có phụ đề được tải."
                />
              )}
            </aside>
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-7xl px-4 py-6 text-xs text-zinc-500">
        Dịch thuật dùng endpoint Google Translate miễn phí — chất lượng có thể
        khác bản trả phí. Chỉ hoạt động với video có sẵn phụ đề.
      </footer>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
      <h2 className="text-base font-semibold text-zinc-200">
        Bắt đầu bằng cách paste link YouTube
      </h2>
      <p className="mt-2 text-sm text-zinc-400">
        Hỗ trợ các dạng link: <code>youtube.com/watch?v=…</code>,{" "}
        <code>youtu.be/…</code>, <code>youtube.com/shorts/…</code>.
      </p>
      <p className="mt-1 text-sm text-zinc-500">
        Video phải có sẵn phụ đề (manual hoặc auto-generated).
      </p>
    </div>
  );
}
