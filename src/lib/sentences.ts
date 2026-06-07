import type { SubtitleSegment } from "./types";

export interface SentenceUnit {
  /** Start time of the first segment included. */
  start: number;
  /** End time of the last segment included. */
  end: number;
  /** Combined original text. */
  text: string;
  /** Indexes of the source segments that were merged in. */
  segmentIndexes: number[];
}

const SENTENCE_END = /[.!?…。！？]["')\]]?\s*$/;

/**
 * Merge raw subtitle segments into sentence-shaped chunks.
 *
 * Strategy: append segments one by one. Whenever the running buffer ends in a
 * sentence-terminating punctuation mark, emit it as a sentence. Segments that
 * never close a sentence (e.g. auto-captions without punctuation) get flushed
 * at the end as a single trailing sentence.
 *
 * If no segment in the entire input contains terminating punctuation we fall
 * back to grouping by silence gap so the user still gets sensibly sized
 * chunks.
 */
export function mergeSegmentsIntoSentences(segments: SubtitleSegment[]): SentenceUnit[] {
  if (segments.length === 0) return [];

  const hasPunct = segments.some((s) => SENTENCE_END.test(s.text.trim()));
  if (!hasPunct) {
    return groupByGap(segments);
  }

  const out: SentenceUnit[] = [];
  let buf: SentenceUnit | null = null;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const cleanText = seg.text.trim();
    if (!cleanText) continue;
    if (!buf) {
      buf = {
        start: seg.start,
        end: seg.end,
        text: cleanText,
        segmentIndexes: [i],
      };
    } else {
      buf.text = `${buf.text} ${cleanText}`.replace(/\s+/g, " ").trim();
      buf.end = seg.end;
      buf.segmentIndexes.push(i);
    }
    if (SENTENCE_END.test(buf.text)) {
      out.push(buf);
      buf = null;
    }
  }

  if (buf) out.push(buf);
  return out;
}

const GAP_THRESHOLD_SECONDS = 1.2;
const MAX_GROUP_SECONDS = 8;

function groupByGap(segments: SubtitleSegment[]): SentenceUnit[] {
  const out: SentenceUnit[] = [];
  let buf: SentenceUnit | null = null;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const cleanText = seg.text.trim();
    if (!cleanText) continue;
    if (!buf) {
      buf = {
        start: seg.start,
        end: seg.end,
        text: cleanText,
        segmentIndexes: [i],
      };
      continue;
    }
    const gap = seg.start - buf.end;
    const length = seg.end - buf.start;
    if (gap > GAP_THRESHOLD_SECONDS || length > MAX_GROUP_SECONDS) {
      out.push(buf);
      buf = {
        start: seg.start,
        end: seg.end,
        text: cleanText,
        segmentIndexes: [i],
      };
    } else {
      buf.text = `${buf.text} ${cleanText}`.replace(/\s+/g, " ").trim();
      buf.end = seg.end;
      buf.segmentIndexes.push(i);
    }
  }
  if (buf) out.push(buf);
  return out;
}

/**
 * Find the index of the unit whose [start, end) contains `time`.
 * If no unit contains the time, returns the index of the most recent unit
 * that started before `time`, or -1 if `time` is before the first unit.
 */
export function findActiveIndex<T extends { start: number; end: number }>(
  units: T[],
  time: number,
): number {
  if (units.length === 0) return -1;
  // Binary search for the last unit with start <= time.
  let lo = 0;
  let hi = units.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (units[mid].start <= time) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (ans === -1) return -1;
  // If time is past the active unit's end and the next one has already started,
  // ans is still correct (we treat the last started unit as active until the
  // next one starts).
  return ans;
}
