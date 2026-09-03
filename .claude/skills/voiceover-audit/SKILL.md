---
name: voiceover-audit
description: Capture what VoiceOver actually speaks while a Tandem demo streams a reply, and assert it against the streaming rules in .claude/rules/accessibility.md. Use when verifying accessibility of streamed assistant output, when changing shared/a11y.js or any live-region behaviour, or when the user asks to test with a screen reader. macOS + Safari only.
---

# VoiceOver audit

Verifies the one accessibility claim DOM inspection cannot settle: that a
streamed reply is **announced once, coherently, at a readable pace**.

`shared/a11y.js` can be proven to mutate a polite live region on clause
boundaries and still fail in practice — screen readers coalesce, drop, or
re-read regions depending on how the mutation lands. The eval suite's Tier 1b
checks that the *code* is right. This checks that VoiceOver *behaves* right.

## Before you start

This needs three macOS settings that a tool must not change on its own. Run the
preflight; it names whichever is missing and changes nothing:

```bash
bash .claude/skills/voiceover-audit/scripts/preflight.sh
```

1. **VoiceOver running** (⌘F5). It speaks aloud and captures the keyboard.
2. **VoiceOver Utility → General → "Allow VoiceOver to be controlled with
   AppleScript."** Open with
   `/System/Library/CoreServices/VoiceOver.app/Contents/MacOS/VoiceOverUtility`
3. **System Settings → Privacy & Security → Automation** — the terminal running
   these commands needs permission to control VoiceOver.

Use **Safari**, not Chrome. The rule specifies VoiceOver + Safari because
WebKit's accessibility implementation is what the pairing is verified against;
a Chrome result does not transfer.

## Procedure

**1. Serve the demo and open it in Safari.**

```bash
npm run dev:agent      # http://localhost:8787 — the streaming case
```

The agent demo is the one that matters; the lifecycle demo's replies arrive
whole and exercise only `announcer.say()`.

**2. Start the capture, then trigger a reply.**

```bash
node .claude/skills/voiceover-audit/scripts/vo-capture.mjs --seconds 30 \
  --out /tmp/vo-transcript.jsonl
```

It prints phrases live as VoiceOver speaks them. Within those 30 seconds, click
a starter chip in Safari — "Am I on track for retirement?" is the best case
because it streams several clauses, calls tools, and ends with citations.

**3. Assert the transcript.**

```bash
node .claude/skills/voiceover-audit/scripts/vo-assert.mjs /tmp/vo-transcript.jsonl
```

Exit code is non-zero on any failure.

## What each check maps to

| Check | Rule it enforces |
|---|---|
| clause-sized phrases; not machine-gunned | "Do not announce token by token" |
| no immediate repeat; no later re-read | "announced once, coherently" |
| additions only, never the whole message again | `aria-relevant="additions text"` behaving |
| no markup, `[src:…]`, or entities spoken | `speechText()` sanitising correctly |
| turn note heard once, last | "Announce turn boundaries… the region should settle" |

## Reading the result honestly

A green run is **evidence, not proof**. Three limits, all real:

- `content of last phrase` is a single slot, not a queue. Two phrases inside one
  sampling interval leave only the second. Phrase count is a **floor**, never an
  exact tally — which under-samples the very stutter this hunts. It still
  detects it (rapid short phrases, or each phrase restating the last), but do
  not quote the count as precise.
- **Pace and prosody are not measured.** Gap timings approximate "readable
  pace"; they cannot tell you it sounds right.
- Passing means the plumbing works. It does not mean the experience is good.

For an artifact whose premise is accessibility expertise, this belongs
**alongside** a real listen-through, not instead of one. Automate it to catch
drift on later changes; do the first sign-off by ear.

## Also worth checking by hand while VoiceOver is on

The rules' checklist items this skill does not cover — all keyboard-only, no
mouse: open a 📎 source chip, edit a memory, approve a write, switch tabs with
arrow keys, and confirm focus lands somewhere sensible after each. Then zoom to
200% and 400% and re-run the turn.
