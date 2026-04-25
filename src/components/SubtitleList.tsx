"use client";

import { useEffect, useRef } from "react";

export interface SubtitleListItem {
  start: number;
  end: number;
  original: string;
  translated?: string;
}

interface SubtitleListProps {
  items: SubtitleListItem[];
  activeIndex: number;
  onSeek: (time: number) => void;
  emptyMessage?: string;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SubtitleList({
  items,
  activeIndex,
  onSeek,
  emptyMessage,
}: SubtitleListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (activeIndex < 0) return;
    const el = itemRefs.current[activeIndex];
    const container = containerRef.current;
    if (!el || !container) return;
    const elTop = el.offsetTop - container.offsetTop;
    const target = elTop - container.clientHeight / 2 + el.clientHeight / 2;
    container.scrollTo({ top: target, behavior: "smooth" });
  }, [activeIndex]);

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-zinc-500">
        {emptyMessage ?? "Chưa có phụ đề."}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto scroll-smooth divide-y divide-zinc-800/60"
    >
      {items.map((item, i) => {
        const isActive = i === activeIndex;
        return (
          <button
            key={i}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            type="button"
            onClick={() => onSeek(item.start)}
            className={
              "flex w-full gap-3 px-3 py-2.5 text-left transition-colors " +
              (isActive
                ? "bg-yellow-500/15 border-l-4 border-yellow-400"
                : "border-l-4 border-transparent hover:bg-white/5")
            }
          >
            <span
              className={
                "shrink-0 font-mono text-xs tabular-nums pt-0.5 " +
                (isActive ? "text-yellow-300" : "text-zinc-500")
              }
            >
              {formatTime(item.start)}
            </span>
            <span className="flex-1 min-w-0">
              <span
                className={
                  "block text-sm leading-snug " +
                  (isActive
                    ? "text-white font-medium"
                    : "text-zinc-200")
                }
              >
                {item.original}
              </span>
              {item.translated ? (
                <span
                  className={
                    "mt-1 block text-sm leading-snug " +
                    (isActive ? "text-yellow-200" : "text-zinc-400")
                  }
                >
                  {item.translated}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
