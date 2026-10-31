# Switchboard implementation plan

## Job and scope
A user-controlled task view for supported, native HTML forms. People who use a single switch should be able to select a form section, edit text with a row/column keyboard, choose options, recover from validation errors, review the actual page's current values, and explicitly submit. This is not a universal accessibility overlay or an autonomous browser agent.

The extension and page demo use the SAME DOM adapter and panel bundle. The independent practice site is a normal React form and registration API, with no special event channel or backdoor for Switchboard. A separate plain HTML fixture proves the adapter is not hardcoded to React or one particular form.

## Visual plan
Switchboard is a compact control surface with a stable header, one large interaction area, and a persistent switch/status rail. One visual emphasis: the current scanning target has a large blue outline and a readable label. It is functional rather than decorative.

- Paper `#ffffff`, ice `#eef3f8`, ink `#17324a`, action blue `#2459ca`, scan blue `#dce9ff`, review amber `#8a5515`, success teal `#197260`.
- Manrope for interface text, >=14px for primary instructions and values. Large switch targets with explicit focus states.
- The source practice site, Common Ground workshops, uses white, pale sage, and deep green. Its interface remains visually separate from the blue Switchboard surface, so synchronization is visible rather than an illusion of a single app.
- Desktop: actual source form left, 420px panel right. Narrow viewports: panel fills available width and offers a reversible 'Show website' view.
- No ornamental metrics cards or animated marketing hero. Counters represent actual switch activations and writes, not claimed impact.

```text
Common Ground workshops                 | Switchboard            [Close]
Make something with your Saturday.      | This page's native form
                                        | [Your details          0/2]
Your details                            | [Your workshop         0/2]
Name   [actual controlled React input]   | [A little more         0/3]
Email  [actual controlled React input]   | [Review before sending     ]
                                        | [Settings] [Undo]
Your workshop                           | ----------------------------
Session [actual native select]          | Space selects · Esc pauses
Experience [actual radio group]         | Start / pause · scan speed
```

## Review against generic defaults
A dashboard full of accessibility scores would be unrelated to the user's task. Replace that with real controls and actual page state. A standalone head-tracking cursor is not the product: task completion and recovery are. One-switch scanning itself already exists in OS tools; no novelty or improvement claims without user testing and measurements.

## Adapter and safety
- Discover visible top-document forms, explicitly labeled native text/email/tel/url/search/number/date inputs, textareas, selects, checkboxes and radio groups. Exclude hidden, disabled, readonly, file, password and payment-autocomplete fields. Report unsupported controls instead of guessing their semantics.
- Form identifiers and control identifiers use WeakMaps, not guessed selectors. Remap on DOM changes; removed/replaced controls cannot be edited or submitted using stale references.
- Native prototype setters and ordinary bubbling input/change events synchronize supported React/native controls. Checkbox/radio changes use click events. No site-specific hooks.
- Read labels, values, constraints and aria-invalid/aria-describedby messages. No AI-inferred labels, remote services, analytics or persistent form storage.
- Validate without submitting, then capture a review fingerprint. Explicit final confirmation calls native requestSubmit on the real form with its submitter only if the form fingerprint still matches. Page changes require another review. Forms containing unsupported/sensitive interactive controls are not submitted by Switchboard.
- Show page feedback as 'Website says', not invented success. Server field errors return the user to the corresponding source-backed control.
- Extension permissions: activeTab + scripting, injection only after toolbar activation, no broad host permissions. Top frame only; cross-origin frames, shadow-root forms, custom ARIA widgets, CAPTCHAs and restricted browser pages are unsupported.

## One-switch interaction
Space selects the current target while automatic scanning runs. Escape pauses as an additional emergency keyboard option. Scanning is opt-in and can be paused/resumed or closed using the switch itself. Selection is grouped: section → field → choice or keyboard row → character. Text can also be entered with a conventional keyboard when scanning is paused. No sample autofill shortcut is used to claim one-switch completion.

Values and undo history remain in memory until the panel closes. Metrics count real switch presses and applied edits. They are not comparative performance results.

## Verification
Prove setters and validation with browser tests before UI polish. Test native and React forms, DOM replacement, disabled controls, stale reviews, server rejection/recovery, radio/select/checkbox behavior, one-switch text entry, and explicit submission. Run the actual unpacked extension in Chromium's isolated world in addition to the page demo. A test-only manifest may grant the fixture origin to allow automation to inject without a physical browser toolbar click; shipped manifest retains activeTab-only permissions.

Preserve Notice → Action at /notice with its tests and setup notes; it is not part of the Switchboard submission.
