# Switchboard — submission draft

## Tagline
The same website. A more manageable next step.

## What it does
Switchboard is a browser extension that presents supported native web forms as a structured task view. A person using one switch can choose a section, choose a field, enter text using a row-column keyboard, select options, review current values, and explicitly authorize submission.

It is not a disconnected copy of a form: edits update the actual page. When a website rejects a field, Switchboard reads its validation message and makes the affected section available for correction. If the page changes after review, another review is required before submission.

## The problem
Completing a form involves more than moving a cursor. Users must discover controls, enter text, understand errors, recover their place, and decide whether to submit. Switchboard explores a consistent, user-controlled path through those steps for people who use limited input.

One-switch scanning, voice access, and alternative input tools already exist. We do not claim to have invented them. Our hypothesis is that a structured task view and explicit recovery workflow may help on supported forms. Usability and comparative performance still need validation with people who use assistive input.

## What is implemented
- Manifest V3 extension, activated by the user with activeTab + scripting permissions only.
- Shared extension/page-demo code with a Shadow DOM control surface.
- Native form discovery, real page synchronization, fieldset grouping, and supported select/radio/checkbox/text controls.
- One-switch automatic scanning and row-column text entry; scan speed and pause controls.
- Buffered entry for date/number controls, with explicit application to the page.
- Native/ARIA error reading, server-error recovery, stale-reference and stale-review checks.
- Review and explicit requestSubmit on the real form.
- Session-only metrics, field-action activity, and supported undo; no persistent form storage or AI service.
- An independent React practice site and plain HTML fixture, with an actual Python validation/receipt endpoint.

## What makes the demo credible
The practice site is explicitly fictional. It is an ordinary controlled React form, not a Switchboard-specific API. Choosing its full laser-cutting workshop produces a real server rejection. The extension reads the resulting page error; choosing another workshop, reviewing again, and confirming produces a server receipt.

Automated browser tests complete that entire journey using only Space presses after opening the panel, including text entry. Another test loads the actual unpacked extension and verifies controlled React synchronization from its isolated world. Test scan timers are accelerated; no human speed claims are drawn from that.

## Built with
React, TypeScript, Vite, Chrome Extensions Manifest V3, native DOM APIs, Shadow DOM, Python, FastAPI, Pydantic, Playwright, axe-core, pytest, and Node's test runner. Manrope and Lucide are used for presentation.

## Engineering challenges addressed
- Updating controlled inputs without inventing an autofill backdoor into the host app.
- Distinguishing labels, hints, required state, and real error messages.
- Keeping scanning stable while the website re-renders.
- Avoiding stale submissions when page state changes after review.
- Handling incomplete native number/date values without silently discarding characters.
- Separating source-site confirmation from Switchboard's own interpretation.

## Honest limitations
Supported native top-document forms only—not arbitrary websites, custom widgets, CAPTCHAs, iframe/shadow-root forms, sensitive transactions, or WCAG-compliance repair. The scanning keyboard is English/ASCII-oriented. Hardware switches, additional browsers, assistive-technology combinations, and actual user benefits need further testing. The prototype is not a replacement for established OS accessibility tools.

Editing triggers the website's ordinary events; a website may autosave or transmit edits. Switchboard itself has no remote service or persistent form history, but it cannot control host-site behavior.

## What we learned
Replace this with the team's actual experience. Potential topics: why a successful click isn't successful task completion; the difference between native and controlled inputs; why preserving user authorization matters; how testing error recovery changed the implementation.

## Next steps
- Co-design and test with people who use switch input.
- Measure completion success, errors, switch activations, fatigue, and preference against appropriate existing tools.
- Improve text entry and international input before making broad accessibility claims.
- Add carefully tested site adapters only when semantics cannot be reliably read from native controls.
- Test physical switches, screen readers, zoom, and operating-system access tools together.

## A 2–3 minute demo

**0:00–0:20 — Show the task, not a hypothetical miracle.**
“This is an ordinary workshop registration form. Switchboard gives it a structured, user-controlled view for limited input.” Show the source site and open the installed extension. If using the embedded panel, call it the page demo instead.

**0:20–0:55 — Demonstrate actual one-switch text entry.**
Start scanning and use Space to choose a section, field, keyboard row, and character. Show the source input changing. If shortening the video, label cuts/accelerated waiting times. Do not portray pasted or prefilled information as having been entered through a switch.

**0:55–1:25 — Show a real rejection.**
Using clearly disclosed fictional/prepared form data, choose the laser-cutting workshop, review the values, and confirm. Show the actual server-side availability error on the original page and Switchboard's marked section.

**1:25–1:55 — Recover and authorize.**
Choose sewing or repair. Review again. Explicitly confirm. Show the source site's practice receipt and quoted website response in the panel.

**1:55–2:20 — Show trust boundaries.**
“Switchboard doesn't declare success for the website, doesn't guess unsupported controls, and doesn't send data to an AI. The website still controls its own data handling.”

**2:20–2:40 — Close honestly.**
Mention the separate plain HTML fixture and actual-extension tests. “This is a tested engineering prototype, not a universal accessibility solution. Our next step is co-design and evaluation with switch users.”

## Submission checklist
- [ ] Team members and actual roles
- [ ] Public repository URL; setup verified on a clean machine
- [ ] Recorded 1–3 minute demo URL
- [ ] Screenshots: `screenshots/switchboard-workspace.png`, `screenshots/switchboard-keyboard.png`, `screenshots/switchboard-recovery.png`, optionally `screenshots/switchboard-mobile.png`
- [ ] Team's own learning/challenges included
- [ ] No API keys, private form data, or fabricated usability results
- [ ] Hackathon build-window and reuse rules checked; pre-existing libraries/scaffold disclosed
- [ ] Earlier Notice → Action prototype clearly separated from this submission
