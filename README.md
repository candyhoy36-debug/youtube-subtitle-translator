# YouTube Subtitle Translator

Paste a YouTube URL → watch the video with the original subtitles overlaid on
top of a Vietnamese translation, plus a scrollable list of every line and a
"merge into sentences" mode that re-groups subtitle fragments into full
sentences.

Only videos that already have subtitles on YouTube are supported (manual or
auto-generated).

## Features

- Original (line 1) + Vietnamese (line 2) overlay synced to the player time.
- Scrollable subtitle list that highlights the active line and auto-scrolls
  to it. Click any line to seek the player.
- "Ghép thành câu hoàn chỉnh" toggle: merges short subtitle fragments into
  natural sentences (using punctuation when present, falling back to silence
  gaps for auto-generated tracks). Sentences are re-translated for higher
  fluency.
- Free, no API key — translations go through the unofficial
  `translate.googleapis.com` endpoint. Rate limits are best-effort.

## Tech stack

- Next.js 16 (App Router) + React 19
- TypeScript
- Tailwind CSS v4
- YouTube IFrame Player API for playback

## How subtitles are fetched

YouTube's regular `timedtext` endpoint now returns empty bodies when called
from datacenter / CI IPs without a valid `pot` (proof-of-origin token). This
project sidesteps that the same way `yt-dlp` does: it calls the InnerTube
`/youtubei/v1/player` endpoint with the `ANDROID_VR` (Oculus Quest) client
context, which is currently exempt from the `pot` check, then fetches the
returned `baseUrl` with the matching VR User-Agent.

The implementation lives in `src/lib/transcript.ts`.

## Development

```bash
npm install
npm run dev   # http://localhost:3000
```

```bash
npm run lint
npm run build
```

## Notes

- The free Google Translate endpoint can be rate-limited; for production
  traffic switch to the official Google Cloud Translation API or DeepL.
- Subtitle fetching depends on YouTube's internal client behaviour — if the
  `ANDROID_VR` client ever starts requiring `pot` tokens too, this app will
  need to be updated alongside `yt-dlp`'s upstream fix.
