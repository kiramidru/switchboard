# Switchboard — three-minute film

## Editorial direction
A restrained full-HD product walkthrough: crisp real footage, large branded opening/closing typography, a consistent chapter rail, human-readable captions, a neutral synthetic narrator, and quiet original procedural background music. No stock disability imagery, fabricated testimonials, fake success states, or unsupported speed claims.

## Exact running order
- 00:00–00:09 — Brand / premise
- 00:09–00:23 — The original form and its demands
- 00:23–00:38 — Installed extension / form sections
- 00:38–00:56 — One-switch navigation
- 00:56–01:22 — Row-column text entry and real synchronization
- 01:22–01:40 — Choices, checkboxes, and explicit review
- 01:40–01:56 — Actual server rejection
- 01:56–02:12 — Correction and fresh review
- 02:12–02:26 — Actual server receipt
- 02:26–02:40 — Local processing and host-site boundaries
- 02:40–02:52 — Test evidence and limitations
- 02:52–03:00 — Closing statement

## Recording integrity
The footage uses the unpacked Chromium extension and the local fictional Common Ground site. A temporary recording-only manifest grants the local fixture origin, allowing automation to invoke the same content-script injection without physically clicking Chromium's toolbar. The distributed extension still requests only activeTab + scripting.

The core text-entry and form-completion sequences use actual Space-key events and the row/character keyboard, not a pasted mockup. A recording-only deterministic scanner clock in the extension's isolated world controls interval callbacks; the recorded edit stretches the action phases for legibility and condenses idle waits. Actual selections are still real Space-key events. No field values, validation messages or network responses are fabricated. Scan timing/waiting periods are edited and clearly labeled. Camera framing and scroll positioning are editorial, not additional input-method functionality. Source responses come from the actual practice API. Captions identify that the receipt is fictional and creates no booking or email.

## Motion
Purpose: explanation and editorial continuity, not changing the application's keyboard behavior. Only film titles/callouts animate. Restrained 500ms opacity/position entrances use the documented cubic-bezier(0.23, 1, 0.32, 1) ease-out. The application is not modified to add distracting animation.

## Audio and captions
Narration is synthetic using the Andrew Multilingual voice via edge-tts. Only the public narration script is submitted to that service; no form contents, credentials or private user data are sent. No real person's voice is cloned. The music is generated mathematically by the included rendering script; no copyrighted recording is sampled. Captions are derived from narration timing, not guessed by word count.

## Production sources
- `scripts/demo/storyboard.json` — editable narrative/timing
- `scripts/demo/narrate.py` — speech and sentence timing
- `scripts/demo/capture.mjs` — real browser recording and interaction markers
- `scripts/demo/render.py` — visual edit, original music, captions, MP4, poster
- `scripts/demo/serve.py` — optional local playback/download server (`uv run uvicorn scripts.demo.serve:app --port 8004`)
- `.build/demo/` — ignored intermediate assets

## Reproduce
Install the application's dependencies and build first. Start the app on port 8000. Ensure ffmpeg/ffprobe with libx264 and libass are installed, plus Chromium (or a Playwright Chromium installation).

```bash
uv run scripts/demo/narrate.py
node scripts/demo/capture.mjs
uv run scripts/demo/render.py
```

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, `FFMPEG_PATH`, and `FFPROBE_PATH` when those tools are not on PATH. The scripts can also discover the already installed native tools on this NixOS host. Render-only dependencies use uv's isolated script environment and do not change the application's dependency set.

## Not claimed
This is not a usability study, a physical-switch hardware test, a universal accessibility repair, or proof of competitive placement. Test-time acceleration is not human task-completion speed. The final video must retain those boundaries.
