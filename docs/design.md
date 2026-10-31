# Notice → Action — MVP design

## Product
A review-first assistant for people trying to understand school, housing, community, and appointment notices. Its primary job is to turn one notice into an actionable checklist while keeping every extracted action next to its supporting source text.

## Visual direction: a working document, not an AI chat
- **Paper** `#FFFFFF`: the original notice and reading surfaces.
- **Workspace** `#F2F4F8`: a calm desk around the document.
- **Ink** `#202A43`: primary text, wordmark, and navigation.
- **Indigo** `#4546CF`: user actions and source-selection highlights.
- **Teal** `#197463`: completed items and grounded evidence.
- **Amber** `#916013`: information requiring human review.
- **Type:** locally bundled Manrope for interface copy and Source Serif 4 for the source notice. The contrast is functional: a familiar document on the left, plain-language tasks on the right.
- **Layout:** a compact wordmark/navigation bar, short left-aligned introduction, and an asymmetric source/work-plan split. On mobile the notice precedes the checklist. A narrow left accent on the source connects highlighted quotations to selected tasks. The source/result relationship is the one memorable visual device; avoid decorative gradients, generic KPI cards, and chat bubbles.

```text
Notice → Action                         How it works  [Try an example]

Less reading between the lines.
A clear next step, straight from your notice.

[Your notice                          ]  [Your action plan                ]
[Paste text / Upload photo            ]  [summary + clear demo/live label ]
[                                     ]  [checklist with dates + evidence ]
[Readable source / image + transcript  ]  [required documents              ]
[                                     ]  [uncertainties + export           ]
[Analyze notice                       ]  [                               ]
```

## Design review before implementation
A generic AI dashboard would hide the input behind a form and present identical result cards. This design instead keeps the notice visible as a real document, ties source selection to evidence buttons, and uses a structured checklist rather than a conversation. No all-caps labels or ornamental numbering. Status colors must carry text labels as well. Every important control has a visible keyboard focus state. No essential animation.

## Architecture
- React + TypeScript + Vite frontend; FastAPI + Pydantic backend.
- OpenAI Responses API, configurable model (default `gpt-4.1-mini`) and server-side API key. Structured JSON output; document contents are untrusted data, not instructions.
- Text or one JPEG/PNG/WebP image. No PDF, accounts, database, or notice history in this MVP.
- Example notices have deterministic, labeled demo results. They may fall back to those results when AI is not configured or fails. Custom notices never receive fabricated fallback results.
- Exact/whitespace-equivalent source quotes are mapped to source offsets server-side. Unsupported actions/documents are omitted with a warning. Dates must have source evidence containing an explicit full date matching the proposed date; ambiguous dates are not calendar-exportable. Image transcription is explicitly unverified.
- Checklist state stays in React memory. No document text in local storage or server logs. Live analysis sends notices to the configured AI provider; users are told before submitting.
- Editable checklist titles/dates are visibly marked as user edits. Calendar exports are all-day events, not time-specific reminders; no invented times or alarms.

## Demo and verification
Three fictional sample notices cover school, housing, and appointment scenarios. Each has actionable requirements, explicit dates, and something that requires clarification. Tests cover fallback boundaries, uploads, AI failure/refusal, malformed outputs, evidence grounding, ambiguous dates, and exports. Browser smoke tests cover examples, highlights, check/edit/export, narrow screens, and keyboard access.
