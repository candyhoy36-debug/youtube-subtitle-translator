"use client";

import { useEffect, useRef } from "react";

interface YTPlayer {
  destroy(): void;
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  loadVideoById(videoId: string): void;
}

interface YTPlayerEvent {
  target: YTPlayer;
}

interface YT {
  Player: new (
    element: HTMLElement | string,
    options: {
      videoId?: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: YTPlayerEvent) => void;
        onStateChange?: (e: YTPlayerEvent & { data: number }) => void;
      };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YT> | null = null;

function loadYouTubeApi(): Promise<YT> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API requires a browser."));
  }
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YT>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      if (window.YT) resolve(window.YT);
    };
    // If the API loaded before our handler was attached.
    if (window.YT && window.YT.Player) resolve(window.YT);
  });
  return apiPromise;
}

interface YouTubePlayerProps {
  videoId: string;
  onReady?: (player: YTPlayer) => void;
  onTimeUpdate?: (time: number) => void;
  onPlayerStateChange?: (state: number) => void;
  className?: string;
}

export default function YouTubePlayer({
  videoId,
  onReady,
  onTimeUpdate,
  onPlayerStateChange,
  className,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const tickRef = useRef<number | null>(null);
  const onReadyRef = useRef(onReady);
  const onTimeRef = useRef(onTimeUpdate);
  const onStateRef = useRef(onPlayerStateChange);

  useEffect(() => {
    onReadyRef.current = onReady;
    onTimeRef.current = onTimeUpdate;
    onStateRef.current = onPlayerStateChange;
  }, [onReady, onTimeUpdate, onPlayerStateChange]);

  // Create the player once. Switch videos via loadVideoById on prop changes.
  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current) return;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !containerRef.current) return;
        const player = new YT.Player(containerRef.current, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            playsinline: 1,
            modestbranding: 1,
            rel: 0,
            cc_load_policy: 0,
            iv_load_policy: 3,
          },
          events: {
            onReady: (e) => {
              playerRef.current = e.target;
              onReadyRef.current?.(e.target);
              const tick = () => {
                if (playerRef.current) {
                  try {
                    const t = playerRef.current.getCurrentTime();
                    onTimeRef.current?.(t);
                  } catch {
                    // ignore
                  }
                }
                tickRef.current = window.setTimeout(tick, 200);
              };
              tick();
            },
            onStateChange: (e) => {
              onStateRef.current?.(e.data);
            },
          },
        });
        playerRef.current = player;
      })
      .catch(() => {
        // Surface via no-op; the parent can show a fallback.
      });

    return () => {
      cancelled = true;
      if (tickRef.current !== null) {
        clearTimeout(tickRef.current);
        tickRef.current = null;
      }
      try {
        playerRef.current?.destroy();
      } catch {
        // ignore
      }
      playerRef.current = null;
    };
  }, [videoId]);

  return (
    <div
      className={
        className ??
        "relative w-full overflow-hidden rounded-xl bg-black aspect-video"
      }
    >
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}

export type { YTPlayer };
