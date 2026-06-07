# Test Plan: YouTube Subtitle Translator

App built from scratch in this session. Next.js 16 dev server running at
`http://localhost:3000`.

## What changed (vs empty starter)
A new app that takes a YouTube URL, fetches the original captions via the
ANDROID_VR InnerTube client, translates each line to Vietnamese with the free
Google Translate endpoint, and renders:
- An overlay at the bottom of the player with **two lines** — original (white)
  on top, Vietnamese (yellow) below.
- A scrollable subtitle list to the right that **highlights the active line**,
  auto-scrolls it into view, and **seeks the player on click**.
- A "Ghép thành câu hoàn chỉnh" toggle that **merges fragments into full
  sentences** based on punctuation in the original captions, then
  re-translates the merged sentences.

## Primary end-to-end flow

Test video: `https://www.youtube.com/watch?v=dQw4w9WgXcQ` (Rick Astley, has
manual English captions; verified the API returns 6 caption tracks).

1. **Load video and verify subtitles fetch.**
   - Action: paste the URL into the input, click **Tải**.
   - Expected: within ~10s the player iframe appears in the left column, the
     right column shows a list of English subtitle lines, the status bar below
     the player reads `… dòng` with a non-zero count and `Phụ đề gốc:
     English`. No red error banner.
   - Adversarial: if the ANDROID_VR bypass were broken, the right column
     would say "Phụ đề rỗng hoặc không thể đọc được."

2. **Verify Vietnamese translations populate.**
   - Action: wait for the "Đang dịch…" indicator to disappear (≤ ~10s after
     load).
   - Expected: each list item now shows two lines — the English original on
     top in light gray and a Vietnamese translation underneath in a dimmer
     gray. Concretely the line "♪ Never gonna give you up ♪" should have a
     Vietnamese translation containing the word "bao giờ" or "không" (i.e.
     not English).
   - Adversarial: if the translate API were broken, the second line would be
     missing entirely (current code shows nothing rather than the original).

3. **Verify overlay tracks playback.**
   - Action: click **Play** on the YouTube player. Let it play 5–10 seconds.
   - Expected: a dark rounded box appears at the bottom of the video with two
     stacked lines — the English caption (white) on top, the Vietnamese
     translation (yellow) under it. The text changes as the audio progresses
     (every few seconds for this song).
   - Adversarial: if `findActiveIndex` were broken the overlay would either
     (a) stay stuck on the first line or (b) not appear at all.

4. **Verify list highlight + auto-scroll while playing.**
   - Action: while still playing, watch the right-hand list.
   - Expected: exactly one row at a time has a yellow left-border + yellow
     background tint, that row matches the overlay's English text, and the
     list scrolls so the active row stays centered.
   - Adversarial: if the active-index calc or the `scrollTo` effect were
     broken, multiple rows would highlight or the list would not scroll.

5. **Verify click-to-seek.**
   - Action: pause the video. Scroll the right list down, click a row that is
     well past the current time (e.g. the row at around `2:30`).
   - Expected: the player jumps to that timestamp (visible in the player's
     scrubber) **and resumes playback automatically**. The overlay updates
     immediately to show that line's text. The same row in the list is
     highlighted.
   - Adversarial: if `seekTo` were misconfigured or the active-index
     recalculation were broken, the player would not move or the highlight
     would not follow.

6. **Verify sentence-merge mode.**
   - Action: click the **"Ghép thành câu hoàn chỉnh"** checkbox below the
     player.
   - Expected: the list immediately re-renders with **fewer, longer rows**
     (the status text changes from "N dòng" to "M câu" with M < N). Each row
     ends with sentence-terminating punctuation (`.`, `!`, `?`, `…`, `♪`-only
     fragments are merged via the gap fallback). The overlay's English line
     also becomes the longer merged sentence. Within a few seconds a fresh
     Vietnamese translation appears on each merged row (sentences are
     re-translated via the API).
   - Adversarial: if `mergeSegmentsIntoSentences` were broken, the row count
     would be unchanged or the rows would be cut at the wrong spots.

7. **Negative test: non-existent / no-captions video.**
   - Action: paste `https://www.youtube.com/watch?v=jNQXAC9IVRw` (the very
     first YouTube video — confirmed via API to have no captions).
   - Expected: a red banner appears reading "Video này không có phụ đề." The
     player iframe does not load (or loads with no subtitle list / overlay).
   - Adversarial: if error handling were broken, the page would silently
     show an empty list with no banner.

## Out of scope
- Performance under very long videos (only sanity-check that translation
  finishes for a ~3-min song).
- Cross-browser checks (only Chrome on the box).
- Mobile responsive layout.

## Evidence to capture
Screen recording of the full flow above (one continuous take), plus a
final screenshot of the negative test error banner.
