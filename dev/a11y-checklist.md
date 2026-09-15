# Accessibility verification — Tandem

Covers step 5 of the verification checklist in `.claude/rules/accessibility.md`.
Re-run everything here before any change to `shared/a11y.js`, `shared/tokens.css`, or
either demo's markup.

- **Date:** 2026-09-15
- **Target:** WCAG 2.2 AA
- **Scope:** `lifecycle-demo/` and `agent-demo/`
- **Result:** axe 0 violations · keyboard 28/28 · captions 20/20 · evals 268 · screen reader **not run — see §3**

## Scope note

The demos were **already** accessible before this pass: WCAG 2.2 AA shipped in `74b2e7e`,
and `evals/run-evals.js` Tier 1b holds **66** deterministic accessibility checks that gate
every commit. What did not exist was *verification against a rendered DOM* — Tier 1b is
static regex analysis and cannot see computed contrast, focus order, or dynamic inserts.
This pass adds that, and found two real defects.

## Tooling — never a project dependency

```bash
npm install --prefix dev playwright@1.49.1 axe-core@4.10.2   # dev/node_modules — gitignored
npx --yes -p playwright@1.49.1 playwright install chromium

npm run dev:lifecycle                 # :8321
PORT=8799 node agent-demo/server.js   # :8799

node dev/a11y-scan.mjs        # axe, incl. dynamic states
node dev/a11y-keyboard.mjs    # real key events, focus order
node dev/accname.mjs          # accessible names from the a11y tree
node dev/a11y-captions.mjs    # caption track mirrors the live regions
node dev/marker-split.mjs     # split-[src:] marker regression (no browser needed)
```

`package.json` has **no** new dependency and no build step. `dev/node_modules/`,
`dev/package*.json` are gitignored; the scripts and this file are committed, because an
audit nobody can reproduce is not an audit.

---

## 1. Automated — axe-core 4.10.2

Static axe only sees initial DOM, so the scan **drives each demo into its dynamic states**
first. Citation panels, action cards and metrics are all inserted at runtime and would
otherwise go unchecked.

| State | Lifecycle | Agent |
|---|---|---|
| initial load | 0 | 0 |
| chat view | 0 | — |
| after a turn (streamed, with citations) | 0 | 0 |
| citation disclosure **open** | 0 | 0 |
| presenter mode on | 0 | — |
| metrics tab | 0 | 0 |

**0 violations · 0 serious/critical**, across 10 states.

### Defects found and fixed in this pass

**1. `scrollable-region-focusable` — SERIOUS, both demos.** `#metricsWrap` is
`overflow-y:auto` with no focusable descendant, so a keyboard-only user could not scroll it
and could not read past the fold (WCAG 2.1.1). axe caught this; Tier 1b's regex checks
structurally could not.
Fixed via `makeScrollableRegion()` in `shared/a11y.js` — defined once, called by both
demos, naming the region from `A11Y_COPY.metricsRegionLabel`.

**2. Citation chip boundary — WCAG 1.4.11, both demos.** Computed contrast, not reported
by axe (it does not check control boundaries):

| | ratio | needs |
|---|---|---|
| chip fill `--blue-bg` on white bubble | **1.09:1** | — |
| chip border `#b9d3fb` | **1.40:1** | 3:1 |
| chip text vs surrounding body ink | **2.47:1** | — |

The chip's extent rested entirely on a 1.40:1 border. It passes 1.4.1 (Use of Color)
because the 📎 glyph is a non-color cue, but its *boundary* was effectively invisible to a
low-vision user — and this is the product's verification affordance, the surface the whole
trust thesis rests on. It does not get to be the least visible control on the page.

Fixed with two new shared tokens in `tokens.css`:
- `--cite-border:#4f86e8` — 3.55:1 on `--card`, 3.27:1 on `--blue-bg`
- `--line-control:#767676` — 4.54:1 on `--card`, 4.18:1 on `--bg`, for controls whose only
  visual boundary is their border (an inactive tab is `--card` on `--bg`, a 1.09:1
  difference). Applied to `.tabs button`, `.tabs a`, `.toggle-btn`, `.feedback button`,
  `.ac-btns button`.

`--line` is unchanged and remains decorative (dividers, card edges), which 1.4.11 exempts.

### Full contrast audit — 29 pairs, computed

All text pairs pass with margin: `.citation` 6.16:1 · `.cite-panel` 9.52:1 · `.ac-note` /
`.ac-row` / `.decay` / `.m-target` 7.61:1 · `header .sub` 7.01:1 · body ink 15.26:1 on
`--bg`, 16.56:1 on `--card` · amber 6.37:1 · red 5.30:1 · purple 4.83:1 · degraded bubble
7.27:1 · white-on-green 6.52:1.

**One flag was a false positive worth recording** so it is not "re-fixed" later: focus ring
vs `--green-solid` computes 1.02:1 as a naive pair, but `outline-offset:2px` places the ring
*outside* the element, so its adjacent color is the parent surface — 6.39:1 on `--card`,
5.88:1 on `--bg`. The comment at `tokens.css:46` is correct.

---

## 2. Keyboard-only — 28/28

Driven with real key events via `dev/a11y-keyboard.mjs` (reproducible; not a hand-waved
claim). Both demos:

| Check | Result |
|---|---|
| First Tab stop is the skip link | ✓ both |
| Skip link moves focus to `#main` | ✓ both |
| ArrowRight moves between tabs | ✓ `tab-demo → tab-story` / `→ tab-metrics` |
| Exactly one tab `aria-selected` | ✓ both |
| Roving tabindex — one tab in the sequence | ✓ both |
| Citation opens with **Enter** (`aria-expanded` false→true) | ✓ both |
| Panel `.open` tracks `aria-expanded` | ✓ both |
| Citation closes with **Space** | ✓ both |
| `aria-controls` resolves to a real panel | ✓ both |
| Feedback button has an accessible name | ✓ both |
| Feedback `aria-pressed` flips on Enter | ✓ both |
| Every focused control shows a focus ring | ✓ both |
| No focus trap | ✓ both |

**Focus is not stolen by a streamed response** — after a turn completes, tabbing resumes
from the transcript into the composer; focus was never yanked to the new message.

Accessible names confirmed from the a11y tree (`dev/accname.mjs`): `#freeInput` →
textbox *"Message the coach"* (via its `sr-only` `<label for>`), send → button *"Send"*,
presenter toggle → button *"Presenter mode"* with `aria-pressed`.

### Not covered by the automated keyboard pass

- 200% / 400% zoom reflow — **manual, not done this pass**
- `prefers-reduced-motion` — asserted by Tier 1b (`tokens.css` `@media` block, `a11y.js`
  honors it), not visually confirmed under the media query
- Action card approve/decline focus return — the scripted lifecycle path reaches the card,
  but the automated pass did not exercise the full approve → rollback focus cycle

---

## 3. Screen reader — NOT RUN

**I did not run a screen reader.** VoiceOver requires macOS + Safari with interactive
accessibility permissions granted to the terminal; it cannot be driven from this
environment. Reporting it as passed would be a fabricated result.

The repo has a real harness for this: **`.claude/skills/voiceover-audit/`**, which captures
what VoiceOver actually speaks during a streamed reply and asserts it against the streaming
rules. Run `/voiceover-audit` on macOS + Safari to close this gap. Note its own history —
`d08a839` made it report unsampled announcements as *inconclusive* rather than passed, so it
will not over-claim either.

### Expected output, to check the audit against

From `shared/a11y.js` (`createStreamAnnouncer`, `createStatusRegion`) and `A11Y_COPY`:

| Surface | Expected VoiceOver | NVDA note |
|---|---|---|
| Streamed reply | Coherent **clauses**, once each. Visible bubble is `aria-hidden` while streaming so words are never in the tree twice. `[src:x]` markers and tags stripped. | Same; NVDA is more likely to interrupt on rapid `role="log"` appends — verify no stutter |
| Turn end | *"Coach has finished replying."* then region clears | Same |
| Citation | *"Show source: {title}, collapsed"* → activate → *"expanded"* | NVDA announces state on the button; verify it does not double-read the panel |
| Feedback | *"Helpful reply, toggle button"* → *"pressed"* | Same |
| Action card | Group named *"Proposed action — requires your approval"*, then its rows and both buttons | Browse mode should enter the group cleanly |
| Escalation / degraded | Announced **assertively**, promptly, ahead of queued polite text | NVDA honors `role="alert"` reliably |
| State change | *"Conversation state is now Planning."* | Same |
| Memory edit | *"Memory updated."*, focus returns to the trigger | Same |

**Known divergence to watch:** VoiceOver + Safari sometimes drops the first polite
announcement if the region is created and written in the same tick. `createStatusRegion()`
already defends against this with a 60ms delay before writing
(`a11y.js:110`) — the audit should confirm the first clause of a reply is actually spoken.

---

## 4. Invariants intact

`npm run evals` — **248 checks**, including all 66 in Tier 1b. No behavior changed: the
fixes are two CSS tokens and one function that sets three attributes.

> One live-tier case, `plan-happy-on-track`, failed on a single run during this pass and was
> re-probed **5/5 fully grounded** (6/6, 10/10, 9/9, 14/14, 8/8). That is the n=1
> predictability artifact documented in `docs/BUILD_STORY.md` §3, not a regression — CSS
> tokens cannot affect grounding. It is a candidate for `repeat: 5`, since under
> `GROUNDING.faithfulnessTarget = 1.0` a single ungrounded figure is an incident.


---

## 5. Caption track — the affordances, made visible

Accessibility succeeds by being invisible, which makes it unshowable. Presenter mode
already exposes the other invisible machinery (eval labels, faithfulness, tool calls), so
it now also mirrors **what a screen reader hears**, via `createCaptionTrack()` in
`shared/a11y.js` — one definition, both demos, styled from `tokens.css`.

The demo frame that carries the argument: the transcript fills **token by token** while the
caption track fills **clause by clause**. That contrast is the lesson, and it is the single
most-missed thing in agentic UIs.

**The mount is `aria-hidden` and that is load-bearing.** The real announcement lives in the
`.sr-only` regions; a second copy in the accessibility tree would make a screen reader read
every clause twice. A demo of accessibility that breaks accessibility is worse than no demo.
Tier 1b asserts the mount is `aria-hidden`, carries no `role`, and has no `aria-live`.

Also added: a genuine **assertive** region. Previously every announcement went to one polite
region, so a caption badged "assertive" would have been a lie about the product. Write
outcomes (approve / decline / consent answered) and degraded turns now route to
`role="alert"`; everything else stays polite. Over-using assertive is its own defect, so the
kinds are deliberately few.

### Defect found by the caption track on its first run

Agent demo, verbatim caption: **`of plan-record].`**

`speechText()` strips whole `[src:x]` grounding markers, and its comment claimed the loose
pattern defended against a marker split across two flushes. It did not. When `[src:` went
out with chunk A, the residue `plan-record].` had no opening bracket left to match — so a
screen reader read **"of plan-record dot"** aloud, on the citation markers that carry this
product's entire grounding claim.

Pre-existing, invisible until the captions surfaced it. Fixed in `createStreamAnnouncer()`:

- `hasOpenMarker()` — a clause boundary inside an unclosed `[src` is not a boundary
- the debounce re-arms instead of flushing mid-marker
- `begin()` / `end()` flush with `force: true`, so a truncated turn still strips the stub
- punctuation-only residue is dropped (stripping a marker could strand a bare `"."`)

Proven by `dev/marker-split.mjs`, which needs no browser and no screen reader — it is pure
string logic, so it is a real regression gate rather than an observation:

```
✓ marker split across deltas, boundary mid-marker
✓ marker split mid-token
✓ marker split, no period inside
✓ intact marker (regression guard)
✓ turn ends mid-marker — forced flush must still strip the stub
```

Four Tier 1b checks now pin this behaviour.

### Residual, accepted

Short caption chunks still appear (`"Quick note:"`, `"So:"`). These are **correct** — `:` is
in `CLAUSE_BOUNDARY`. A 600ms debounce flush during a gap in the token stream can also
strand a short tail mid-sentence. That is pre-existing and **deliberately not fixed here**:
changing when the buffer flushes is exactly the change that needs a real screen reader to
validate, and validating it blind would be worse than leaving it. Carry it into the
`/voiceover-audit` run as the first thing to listen for.

### Eval-suite note

Two different happy-path grounding cases (`plan-happy-on-track`, `orient-happy`) each failed
once at n=1 during this pass and each re-probed **5/5** clean. Both are the predictability
artifact, not regressions — but two in consecutive runs is a signal that faithfulness cases
deserve `repeat: 5` like the boundary cases, since under
`GROUNDING.faithfulnessTarget = 1.0` a single ungrounded figure is an incident. Not changed
here; flagged.
