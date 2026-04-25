/**
 * Translate texts to a target language using the unofficial Google Translate
 * endpoint (`translate.googleapis.com/translate_a/single`).
 *
 * Free, no API key, but rate-limited. We translate items concurrently with a
 * small pool to balance speed and rate-limit risk.
 */

const ENDPOINT = "https://translate.googleapis.com/translate_a/single";

async function translateOne(
  text: string,
  source: string,
  target: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!text.trim()) return text;
  const params = new URLSearchParams({
    client: "gtx",
    sl: source,
    tl: target,
    dt: "t",
    q: text,
  });
  const url = `${ENDPOINT}?${params.toString()}`;

  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Translate failed (${res.status}).`);
  }
  const data = (await res.json()) as unknown;
  // Shape: [[[ "translated", "original", null, null, ... ], ...], ...]
  if (
    Array.isArray(data) &&
    Array.isArray((data as unknown[])[0])
  ) {
    const sentences = (data as unknown[])[0] as unknown[];
    return sentences
      .map((row) => {
        if (Array.isArray(row) && typeof row[0] === "string") return row[0] as string;
        return "";
      })
      .join("");
  }
  return text;
}

async function translateOneWithRetry(
  text: string,
  source: string,
  target: string,
  signal?: AbortSignal,
  attempts = 3,
): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await translateOne(text, source, target, signal);
    } catch (err) {
      lastErr = err;
      // Exponential backoff: 250ms, 500ms, 1s
      await new Promise((r) => setTimeout(r, 250 * 2 ** i));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Translate failed");
}

export interface TranslateOptions {
  source?: string;
  target?: string;
  concurrency?: number;
  signal?: AbortSignal;
}

export async function translateBatch(
  texts: string[],
  options: TranslateOptions = {},
): Promise<string[]> {
  const { source = "auto", target = "vi", concurrency = 6, signal } = options;
  const results = new Array<string>(texts.length);

  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= texts.length) return;
      results[i] = await translateOneWithRetry(texts[i], source, target, signal);
    }
  }

  const workerCount = Math.min(concurrency, texts.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
