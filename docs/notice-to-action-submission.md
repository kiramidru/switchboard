# Notice → Action — submission draft

## Tagline
Everyday paperwork. A clearer next step.

## Project description
Notice → Action helps people turn dense notices into practical, reviewable next steps. Paste a school letter, housing notice, or appointment confirmation—or upload a photo—and the app organizes actions, explicit dates, required documents, and questions that still need an answer.

The important difference is traceability: each extracted action links to a matching quotation in the notice. Clicking it highlights the original words. Missing years and ambiguous dates are not guessed, and image transcriptions are explicitly marked for review. Users can edit checklist items, mark them complete, and download their plan or all-day calendar entries.

Three clearly labeled fictional examples make the app demonstrable without an API key. Real notices require live AI; the app never substitutes prewritten demo results for a custom notice.

## Why this problem
A missed line in an ordinary notice can mean a missed deadline, a forgotten document, or an unnecessary phone call. This project explores whether AI can reduce that reading burden while making it easier—not harder—to check the result.

## Built with
Python, FastAPI, Pydantic, OpenAI Responses API, Pillow, React, TypeScript, Vite, Manrope, Source Serif 4, Lucide, pytest, Node's test runner, and Playwright.

## Engineering challenges addressed
- Keeping extraction tied to source text rather than presenting an unsupported answer.
- Separating explicit dates from ambiguous or missing information.
- Showing honest boundaries between live analysis, AI transcription, user edits, and deterministic demo content.
- Exporting Unicode-safe calendar files with escaped values, all-day dates, and no invented appointment times.

## What we learned
Replace this section with the team's own experience. Possible topics to discuss truthfully: why schema validity is not factual correctness, what source matching can and cannot verify, and how reviewing the mobile interface changed the flow.

## Next steps
Potential directions—not implemented features:
- Independent OCR and per-region transcription review.
- Translation and locale-aware date parsing with explicit user confirmation.
- Timezone-aware events and opt-in reminders.
- Usability testing with people who regularly work through school, community, or housing notices.
- Public-hosting protections and configurable provider/data-residency options.

## Two-minute demo script

**0:00–0:15 — The problem**
Show the fictional school trip letter. “A simple school visit means two forms, a payment, packing, and travel details that aren't confirmed yet. It's easy to miss something.”

**0:15–0:40 — The working flow**
Click Try an example, then The school trip letter. State clearly: “This is a fictional demo with prewritten results. Custom notices use the live AI integration when a server key is configured.” Show the three extracted tasks and the date labels.

**0:40–1:05 — The differentiator**
Click Show source on the form action. Show the exact sentence highlighted in the original notice. Click a date to show its supporting quote. Explain: “Matched text helps you check the answer; it doesn't guarantee the interpretation.”

**1:05–1:25 — Honest uncertainty**
Point to the unconfirmed departure and return times. “We don't guess the missing details.” Mention that photo transcription also needs comparison with the original image.

**1:25–1:45 — Make it useful**
Check off a task. Edit a title or date and show the user-edit label. Download the checklist and calendar file. Explain that calendar downloads contain all-day events, not automatic alarms.

**1:45–2:00 — Wrap up**
Show the mobile view. “The goal isn't to replace the original notice. It's to make the next step easier to find—and easier to verify.”

If demonstrating live AI, add a brief custom-text or photo example only after testing your key/model locally. Do not portray a prewritten demo as live extraction.

## Submission checklist
- [ ] Public GitHub repository: **add URL**
- [ ] Team members and roles: **add actual names/roles**
- [ ] Recorded 1–3 minute demo: **add URL**
- [ ] Screenshots attached: `screenshots/workspace.png`, `screenshots/action-plan.png`, `screenshots/mobile.png`
- [ ] Setup instructions checked on a clean machine
- [ ] API keys and personal notices excluded from the repository
- [ ] Team's own challenges and learning added
- [ ] Event dates, build-window eligibility, and rules checked
