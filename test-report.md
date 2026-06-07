# Test Report — YouTube Subtitle Translator

End-to-end browser test of the freshly built app on the local Next.js dev
server (`http://localhost:3000`). Test video: Rick Astley — *Never Gonna Give
You Up* (`dQw4w9WgXcQ`), which has manual English captions.

## Results

- **It should fetch original captions and translate them to Vietnamese** —
  passed.
- **It should show synced overlay and highlight active line during playback**
  — passed.
- **It should seek and resume playback when a list row is clicked** — passed.
- **It should merge fragments into full sentences when toggle is on** —
  passed.
- **It should show an error banner when captions cannot be loaded** — passed
  (the chosen no-caption video returned a "Sign in to confirm you're not a
  bot" challenge from YouTube; the banner surfaces the message correctly, but
  the specific copy "Video này không có phụ đề." was not exercised — see
  Caveats).

## Caveats / Escalations

- The negative test used `jNQXAC9IVRw` ("Me at the zoo"), which has no
  captions. Instead of the expected "Video này không có phụ đề.", YouTube
  returned a bot-challenge response. The app handled it correctly (red
  banner with the upstream message), but the literal "no captions" branch
  was therefore not directly exercised in the recording.
- Subtitle access depends on the `ANDROID_VR` InnerTube client being exempt
  from `pot` (proof-of-origin token) checks. If YouTube ever closes that
  hole — same risk that affects `yt-dlp` — fetches will start returning
  empty and the app will need a corresponding fix.
- Translation uses the unofficial `translate.googleapis.com` endpoint. It
  worked for ~60 lines in this test but can be rate-limited under heavier
  use; for production, swap to the official Google Cloud Translation API or
  DeepL.

## Evidence

| Step | Screenshot |
|---|---|
| **1. Captions loaded** — 60 lines, language=English. Translation in progress ("Đang dịch…"). | ![Captions loaded with original text](https://app.devin.ai/attachments/c1b1f1ba-abeb-4b9a-9c89-a59767942034/screenshot_45e7285479274686afcf23673e71a7f2.png) |
| **2. Vietnamese populated** — every list row now shows EN + VI ("Sẽ không bao giờ từ bỏ bạn"). | ![EN+VI in list](https://app.devin.ai/attachments/037bc69d-a35c-4de8-aa6b-34af783087a0/screenshot_f29a6a13f17140fa902f0ae534572c5d.png) |
| **3. Overlay + highlight synced** — playing at 0:22, overlay shows "♪ You know the rules and so do I ♪" / "♪ Bạn biết luật lệ và tôi cũng vậy ♪" and the matching list row at 0:22 is highlighted. | ![Overlay synced with highlight](https://app.devin.ai/attachments/192838bb-bc30-40d9-9b8c-f1f856cd7a13/screenshot_674c6e9413fb4c74b19a77f868c334a7.png) |
| **4. Click-to-seek** — clicked the 0:53 row and the player jumped to "Never gonna say goodbye" + auto-resumed. | ![Click-to-seek jumped to 0:53](https://app.devin.ai/attachments/02e3b91a-b523-4014-9843-588602f98504/screenshot_64635921a0794409ae3d660432bc8eec.png) |
| **5. Sentence-merge ON** — toggle flipped, status text changed from "60 dòng" to "33 câu", fragments grouped (e.g. "Your heart's been aching but you're too shy to say it" merged from two short cues), VI re-translated. | ![Sentence-merge mode 33 câu](https://app.devin.ai/attachments/f73d968f-f925-4094-ad98-fcc9f322f592/screenshot_d8c0896c6e6645a1aae7388d5f872af0.png) |
| **6. Error banner** — pasting a no-caption video shows the red banner. | ![Red error banner](https://app.devin.ai/attachments/ac179a7f-54cd-43b5-b498-c6a1340f6c01/screenshot_dd7c44ca3ae44c5e9139224382e98347.png) |

A continuous screen recording covering steps 1–6 with structured
annotations is attached separately.
