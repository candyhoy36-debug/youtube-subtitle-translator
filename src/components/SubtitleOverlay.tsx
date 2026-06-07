"use client";

interface SubtitleOverlayProps {
  original?: string;
  translated?: string;
  loadingTranslation?: boolean;
}

export default function SubtitleOverlay({
  original,
  translated,
  loadingTranslation,
}: SubtitleOverlayProps) {
  if (!original && !translated) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4 pb-4 sm:pb-6">
      <div className="max-w-3xl w-full rounded-lg bg-black/70 backdrop-blur-sm px-4 py-2 text-center shadow-lg">
        {original ? (
          <div className="text-base sm:text-lg font-medium leading-snug text-white drop-shadow">
            {original}
          </div>
        ) : null}
        {translated ? (
          <div className="mt-1 text-sm sm:text-base leading-snug text-yellow-300 drop-shadow">
            {translated}
          </div>
        ) : loadingTranslation ? (
          <div className="mt-1 text-sm sm:text-base italic text-zinc-400">
            đang dịch…
          </div>
        ) : null}
      </div>
    </div>
  );
}
