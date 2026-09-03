---
paths:
  - "**/*.html"
  - "**/*.js"
  - "**/*.css"
---

# Accessibility invariants

Tandem is a portfolio artifact by someone whose signature expertise is mobile and web
accessibility. An inaccessible demo is a credibility failure, not a polish gap. Treat
these as design invariants on the same footing as the guardrail rules in `CLAUDE.md`.

Target: **WCAG 2.2 AA**, verified with VoiceOver on macOS/Safari and with keyboard only.

## Streaming assistant output

- The assistant message container is a **polite** live region: `aria-live="polite"`,
  `aria-atomic="false"`, `aria-relevant="additions text"`.
- **Do not announce token by token.** Buffer streamed tokens and flush to the live region
  on sentence or clause boundaries, or on a debounce of roughly 400–800ms. A raw
  token stream makes VoiceOver stutter and re-announce, which is worse than silence.
- Announce turn boundaries, not just content: when a turn completes, the live region
  should settle so the user knows the coach has finished.
- Tool-call and "thinking" indicators are `aria-live="polite"` status text
  (`role="status"`), never a decorative spinner alone.
- Streaming must respect `prefers-reduced-motion`: no caret animation, no typewriter
  effect, no auto-scroll easing when reduced motion is set.

## Structure and semantics

- One `<h1>` per demo page; headings descend without skipping.
- Landmarks: `<header>`, `<main>`, `<nav>`, and the memory panel as a labelled
  `<aside aria-labelledby="...">` or `role="complementary"`.
- The conversation transcript is a `<ol>`/`<li>` list, not a stack of `<div>`s; each turn
  is labelled with its speaker so a screen reader user can navigate turn by turn.
- Tabs (Build story / Metrics / presenter mode) use the full tab pattern:
  `role="tablist"`, `role="tab"` with `aria-selected` and `aria-controls`,
  `role="tabpanel"` with `aria-labelledby`, arrow-key navigation, roving tabindex.
- Every interactive element is a real `<button>`, `<a>`, or form control. No clickable
  `<div>`s.

## Controls, labels, and focus

- Every control has an accessible name. Icon-only controls (📎 source chips, 👍/👎,
  delete, edit) need `aria-label` text that names the target, not the icon: e.g.
  "Delete memory: retirement is my main concern".
- `:focus-visible` must be defined for every interactive element with a visible indicator
  meeting 3:1 contrast against its background. Never `outline: none` without a replacement.
- Focus order follows visual order. Focus is moved deliberately and never trapped except
  in a modal, which must trap and restore focus on close.
- Source chips (📎) open a disclosure, not a new context; use `aria-expanded` and place
  the revealed content immediately after the trigger in the DOM.

## Never use blocking browser dialogs

`prompt()`, `alert()` and `confirm()` are prohibited. They are unstyleable, hostile to
screen readers, and block the page. The memory editor must be an **inline accessible
edit**: a labelled `<input>`/`<textarea>` rendered in place, with Save and Cancel
buttons, focus moved to the field on entry and returned to the trigger on exit, and the
result announced via a `role="status"` region ("Memory updated").

The same applies to the write-confirmation flow: the approve/decline action card is a
labelled group with real buttons and an announced outcome, never a native dialog.

## Color, contrast, and motion

- Text meets 4.5:1; large text and UI component boundaries meet 3:1.
- Never encode meaning in color alone — the trust battery, faithfulness ratio, guardrail
  and escalation states each need a text or shape cue alongside the color.
- Respect `prefers-reduced-motion: reduce` for every transition and animation.
- Design tokens for focus rings and state colors live in `shared/tokens.css` like every
  other token. Do not hard-code them in a demo.

## Forms and input

- The composer textarea has a visible or programmatically associated label.
- Errors are announced and programmatically associated (`aria-describedby`), not just
  colored red.
- Starter chips are buttons in a labelled group, reachable and operable by keyboard.

## Ship this as one commit

The accessibility work lands as a **single atomic commit** on `main` (work on
`a11y/wcag-aa-pass`, then squash). A partially accessible demo is a worse signal than an
inaccessible one — it reads as started and abandoned. Do not commit item-by-item.

Shared concerns — focus tokens, motion rules, non-color state cues — go in `shared/`, not
duplicated per demo. If the same fix appears in both demos, it is in the wrong place.

## Verification before any accessibility change is considered done

1. Keyboard only, no mouse: complete a full turn, open a source chip, edit a memory,
   approve a write, and switch tabs.
2. VoiceOver + Safari: a streamed reply is announced once, coherently, at a readable pace.
3. Zoom to 200% and 400%: no loss of content or function, no horizontal scrolling of the
   main column.
4. `prefers-reduced-motion: reduce` set: no animation runs.
5. Automated pass (axe or equivalent) reports zero violations — necessary, not sufficient.

Add an accessibility tier to `evals/` where a check is mechanizable: presence of the live
region and its attributes, accessible names on all interactive elements, no
`prompt(`/`alert(`/`confirm(` anywhere in the source, and a `:focus-visible` rule present.
These are cheap regression gates and they belong in the same suite as the policy tier.
