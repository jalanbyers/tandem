# Defend it — the six decisions in `shared/a11y.js`

Study aid for narrating the accessibility work. Each item: the question, the answer in one
sentence, the thing you traded away, and what breaks if you'd gone the other way.

The rule underneath all of it: **say what you verified and what you didn't.** The strongest
line available is that the screen-reader pass is recorded as *not run* rather than claimed.
Don't lose that by overselling the rest.

---

## 1. Why clause boundaries, not sentences?

**`CLAUSE_BOUNDARY = /^([\s\S]*[.!?…;:]["')\]]*\s)/`**

> Sentence-level buffering means three to six seconds of silence while the screen is visibly
> filling, so the user can't tell whether it's working — and in this domain sentence
> detection is unreliable anyway, because `$48,200.` and `8.5%` both contain a period that
> isn't a sentence end.

**Traded away:** clause chunks can be fragments — `"So:"`, `"Quick note:"` appear in the
captions. Less rhetorically complete than a sentence.

**If you'd chosen sentences:** long silences read as a broken app, and the first `.` inside a
currency figure splits mid-number anyway — the failure is *worse* and harder to see.

**The honest caveat:** whether those short fragments sound choppy is exactly what VoiceOver
settles, and it hasn't been run.

---

## 2. Why `aria-hidden` on the visible bubble during the stream?

> Without it the same words exist twice in the accessibility tree — once in the live region
> being announced, once in the DOM the user can browse — so anyone navigating the transcript
> mid-reply hears the text duplicated.

**Traded away:** for the duration of the turn the bubble is unreachable to assistive tech.

**Why that's safe:** `end()` always removes the attribute, including on the degraded path,
and the visible transcript remains the canonical copy the moment the turn settles.

**The failure it prevents** is the classic one: teams put `aria-live` on the transcript
container itself, and every token mutation re-announces the whole growing bubble.

---

## 3. Why a 60ms delay before writing to the status region?

> VoiceOver on Safari drops an announcement when a region is cleared and rewritten in the
> same tick — the AT never observes a mutation, so nothing is spoken. Clearing, yielding, then
> writing guarantees a change it can see.

**Traded away:** 60ms of latency on every announcement, and two announcements less than
60ms apart coalesce — the later one wins.

**Why the coalescing is a feature:** rapid-fire announcements are worse than one. If state
changes twice in a frame, the user wants the end state, not both.

---

## 4. Why do the live regions self-clear (8s status, 4s stream)?

> Live-region text is real DOM. Left in place it becomes stale content a user meets while
> browsing — they'd hear the previous turn's reply while exploring the page, with no cue that
> it's old.

**Traded away:** a slow user can have the text vanish before they navigate to it.

**Why that's acceptable:** the visible transcript is the durable copy. The live region's job
is *notification*, not storage — conflating the two is what produces the stale-content bug.

---

## 5. Why hold the flush on an unclosed `[src:` marker?

**`hasOpenMarker()` — the one to know cold, because it's the subtlest.**

> `speechText()` strips whole `[src:x]` grounding markers, but it can't repair one split
> across two flushes: `[src:` goes out with chunk A and the residue `plan-record].` has no
> opening bracket left to match, so the screen reader reads *"plan-record dot"* aloud. Once a
> chunk is emitted it has already been spoken — the only place to fix it is before the flush.

**Traded away:** a turn that dies mid-marker would hold text forever, so `begin()` and
`end()` flush with `force: true` and let `speechText` strip the stub.

**Where it was found:** the caption track surfaced it on its first run. Worth saying plainly
— it was a pre-existing bug that 66 passing eval checks and a clean axe run both missed,
because neither can hear. That's the argument for the caption track in one sentence.

**Proof:** `dev/marker-split.mjs`, five cases, no browser and no screen reader needed —
it's pure string logic, so it's a regression gate rather than an observation.

---

## 6. Why a separate caption track instead of un-hiding the live region?

> Un-hiding `.sr-only` would put the same text in the accessibility tree twice, so every
> clause gets read twice — the demo of accessibility would itself be the accessibility bug.
> The mirror is `aria-hidden`, carries no role and no `aria-live`, and is fed from the same
> `emit()` path so it can't drift from what was actually spoken.

**Traded away:** two code paths that must stay in sync.

**How that's held:** a Tier 1b check asserts the captions mirror the flushed clause
*verbatim* rather than paraphrasing, and three more assert the mount stays inert.

---

## If they push further

**"Why polite for streaming and assertive only for writes and degraded?"**
Assertive interrupts whatever the user is currently hearing. Streamed text interrupting
continuously would make the app unusable, so assertive is reserved for the cases where
silence would let someone keep acting on a false belief — a write that just executed, or a
coach that can no longer verify anything. Over-using assertive is its own defect.

**"Why is the citation a `<button>` and not a link or a div?"**
It toggles a disclosure in place rather than navigating, so it's a button with
`aria-expanded` / `aria-controls`, and the panel sits immediately after the trigger in the
DOM. Keyboard operability then comes free from the native element — Enter *and* Space both
work, which is exactly what a `role="button"` on a div would have forced you to reimplement.

**"What did automated testing miss?"**
The two defects that mattered most. axe found `scrollable-region-focusable`, but computed
contrast on the citation chip's *boundary* (1.09:1 fill, 1.40:1 border) needed a manual
audit, and the split-marker bug needed something that could hear. Automated checks are
necessary and not sufficient — that phrase is in the rules file for a reason.

**"Why is `prompt()` banned when it's technically accessible?"**
It blocks the page, can't be styled, and drops the user out of the app's context with no
way to announce the outcome. It's replaced by an inline editor with a labelled field,
managed focus, and a `role="status"` confirmation. There's an eval that fails the build if
`prompt(`, `alert(` or `confirm(` reappears anywhere in the sources.

---

## Own the gaps

Say these before you're asked:

1. **VoiceOver has not been run.** Everything green is automated plus keyboard — proxies for
   the claim, not the claim. `/voiceover-audit` closes it.
2. **The debounce tail is open.** A 600ms flush during a gap in the token stream can strand a
   short tail mid-sentence. It's documented, not fixed, because changing *when* the buffer
   flushes needs a real screen reader to validate and doing it blind would be worse.
3. **Approve announces assertively; rollback announces politely.** Both reverse money. The
   asymmetry is real and is a judgement to make by ear, since routing rollback through both
   the toast and the alert region would double-announce.
