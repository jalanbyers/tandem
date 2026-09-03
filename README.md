# Tandem — dual-demo monorepo

**Tandem** — stateful financial guidance that never acts alone. The name is the design
thesis: every write is propose-and-confirm with a human in the loop, and the repo itself
is two demos running in tandem off one shared core.

Two linked demos of a **stateful AI financial-guidance concept**, driven by one shared
source of truth: a scripted showcase that makes every design decision visible, and a live
agent that proves those same decisions run for real. One spec, two renderings — change a
rule once in `shared/` and both demos change.

> **Disclaimer:** concept exercise only. All data is fictional; no real accounts are
> connected. Every UI surface carries: *"Tandem provides educational guidance, not
> individualized investment advice."*

## The two demos

| | `lifecycle-demo/` | `agent-demo/` |
|---|---|---|
| What it is | The development-lifecycle showcase: a scripted two-session journey with a Build story (4D) view, live-updating Metrics, and 🔍 presenter mode | The same product **running for real**: Anthropic API, streaming, tools, RAG citations, persistent memory, live telemetry |
| Driven by | `shared/` rendered as scripted conversation + annotations | `shared/` compiled into a live system prompt + server-enforced rules |
| Model | None — fully scripted | Claude (default `claude-sonnet-5`, streaming) |

## Stack

Deliberately minimal — **zero runtime dependencies, no build step, no framework**.
`npm install` is never needed; there is no `node_modules`.

| Layer | Choice | Why |
|---|---|---|
| UI | Browser-native ES modules + one CSS file of custom properties | No build step means the demo a reviewer opens is the source they read |
| Server | Single-file Node ≥ 18, `node:` built-ins only | The whole agent loop fits in one readable file |
| Model | Anthropic Messages API over `fetch`, `stream: true` | Relayed to the browser as Server-Sent Events |
| Retrieval | Keyword-overlap scoring over Markdown chunks | Right-sized for a 4-doc corpus; no vector store to operate |
| State | JSON files (gitignored) | Delete to reset; no database to stand up |
| Accessibility | `shared/a11y.js` + tokens in `tokens.css` | WCAG 2.2 AA as a shared invariant, not per-demo polish |
| Tests | Plain Node runner, no framework | Spawns the real server and asserts against it |
| Language | JavaScript (ESM), no TypeScript, no transpiler | Nothing between the file on disk and the running code |

- **`shared/` + both UIs:** plain browser-native ES modules (`<script type="module">`)
  and one shared stylesheet of CSS custom properties. The lifecycle demo is served by any
  static file server; it stays dependency-free by design.
- **Accessibility (`shared/a11y.js` + `shared/tokens.css`):** the streamed-output live
  region and its clause-boundary buffering, the tab and disclosure patterns, the inline
  memory editor that replaces `prompt()`, and every accessible-name string — imported by
  both demos so neither can drift. Focus, motion and target-size tokens sit alongside the
  design tokens. Target: **WCAG 2.2 AA**.
- **`agent-demo/server.js`:** a single-file Node server (requires **Node ≥ 18**, uses only
  `node:` built-ins — `http`, `fs`, `path`). It talks to the
  [Anthropic Messages API](https://docs.anthropic.com) directly over `fetch` with
  `stream: true`, relays tokens to the browser as **Server-Sent Events**, and runs the
  agentic tool loop (up to 6 tool iterations per turn).
- **Retrieval (`agent/rag.js`):** keyword-overlap scoring over paragraph chunks of the
  four Markdown docs in `agent-demo/data/docs/` — no vector store, no embeddings; right-
  sized for a 4-document corpus and trivially swappable.
- **Storage:** JSON files, both gitignored — `agent-demo/data/memory-store.json` (memory +
  audit log) and `agent-demo/data/feedback-queue.json` (👎 feedback awaiting golden-set
  triage). Delete them to reset.
- **Evals (`evals/run-evals.js`):** plain Node test runner, no framework. It spawns the
  real server as a child process on a throwaway port and asserts against it.
- **Static serving for the lifecycle demo:** `python3 -m http.server` (any static server
  works — `npx serve`, `caddy file-server`… it just needs to serve files; module imports
  don't load from `file://`).

## How to run

Prerequisites: **Node ≥ 18** and **Python 3** (only for the static server; substitute any
file server you like). Nothing to install.

### 1. Lifecycle demo (scripted — no API key needed)

```bash
npm run dev:lifecycle
# → open http://localhost:8321/lifecycle-demo/
```

Serves the repo root on port 8321 so `../shared/` imports resolve. Click through the
journey chips, toggle **🔍 Presenter mode** for the design-rationale overlay, and watch
the **Metrics** tab count what you did.

### 2. Agent demo (live model)

```bash
cp .env.example .env        # then put your Anthropic API key in it
npm run dev:agent
# → open http://localhost:8787
```

`.env` (gitignored, never committed) supports:

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | enables the live model |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | model override |
| `PORT` | `8787` | server port |

**Without a key the agent demo still runs** — it degrades into an honest disabled state
instead of improvising, which is itself one of the design invariants on display. Try the
starter chips: the stock-tip probe, the distress message, and "set up the contribution
increase" exercise the refusal, escalation, and confirmation-gated-write paths.

### 3. Evals

```bash
npm run evals
```

- **Tier 1 — policy** (always runs, no key): deterministic checks of everything enforced
  server-side — guardrail detectors against all 25 golden cases, the write-confirmation
  gate + rollback, memory consent gating, scenario↔mock-data figure parity, single-source
  integrity, and the keyless server's refusal to fabricate numbers.
- **Tier 1b — accessibility** (always runs, no key): the mechanizable half of
  `.claude/rules/accessibility.md` — live-region attributes and clause-boundary buffering,
  accessible names on every icon-only control, the tab and disclosure patterns, a
  `:focus-visible` rule, reduced-motion handling, and a hard ban on
  `prompt`/`alert`/`confirm`. Necessary, not sufficient: keyboard, screen-reader and 400%
  zoom verification stay manual (see `.claude/skills/voiceover-audit/`).
- **Tier 2 — live agent** (runs when a key is present in `.env`): every golden case runs
  against the real agent — refusal on stock-tip probes, escalation on distress language,
  citation presence on every numeric claim, no write without confirmation. Each case runs
  in an isolated session with a wiped memory store.

Exit code is non-zero on any failure — wire it into CI as the release gate. Expect the
live tier to take a few minutes (20 real model conversations).

## The architecture: one shared core

```
shared/            ← single source of truth — BOTH demos import from here
  tokens.css         design tokens + every shared component style (incl. focus/motion/target-size)
  a11y.js            live region + clause-boundary buffering, tab & disclosure patterns,
                     inline memory editor, accessible-name copy
  states.js          conversation state machine (orientation → planning → action → escalation, + degraded)
  memory.js          memory types (explicit/derived/behavioral), decay, consent rules
  guardrails.js      advice-line refusal, escalation triggers, Sheridan L5 cap, degradation rules
  scenario.js        the scripted Jordan journey as structured data (+ FIGURES, citations)
  telemetry.js       event schema, trust-battery physics, the shared Metrics view renderer
  persona.md         voice, limitations statement, disclosure copy (machine-readable blocks)
  persona.js         the tiny loader both demos + the prompt compiler use

lifecycle-demo/    ← renders shared/ as a scripted showcase (presenter-mode annotations)
agent-demo/        ← COMPILES shared/ into a live agent:
  server.js                minimal Node server: streaming SSE, tool loop, server-side enforcement
  agent/system-prompt.js   persona.md + guardrails.js + states.js + memory.js → one prompt
  agent/tools.js           get_plan_record · contribution_calculator · search_guidance ·
                           plan_change_draft (write, gated) · escalate_to_human · save_memory
  agent/rag.js             retrieval over data/docs/* → structured {docId, title, snippet} citations
  agent/memory-store.js    JSON-file memory implementing shared/memory.js consent rules
  data/                    fictional Jordan data matching scenario.js figures (eval-checked)

evals/             ← golden set + runner; gates every prompt/rule change
```

**Nothing that appears in both demos is duplicated.** The refusal copy the scripted demo
displays is the same string the live agent's system prompt compiles in — change it once in
`shared/guardrails.js` and both demos change. Same for the disclaimer (`persona.md`), the
consent copy (`memory.js`), the metric definitions (`telemetry.js`), and the design tokens.
The eval suite asserts this integrity.

## Guardrails are enforced, not requested

The agent demo does not rely on the model obeying its prompt:

- **Writes are gated server-side.** `plan_change_draft` can only ever create a proposal.
  Execution requires an explicit user confirmation event (`POST /api/confirm` from the
  approve button); a tool call or forged event is refused. Every write has a rollback
  (`POST /api/rollback`).
- **Numbers come from tools, never model arithmetic.** The server extracts every numeric
  claim from each reply and checks it against that turn's tool/RAG outputs — that ratio
  *is* the faithfulness metric on the Metrics tab. Every cited figure renders as a
  tappable 📎 source chip.
- **Escalation triggers are detected server-side** (distress language, sell decisions,
  out-of-policy) — the human-handoff banner appears even if the model forgets.
- **Memory consent is enforced in the store.** Derived/behavioral memories are written as
  pending-consent and never surface to the agent until granted; deletes are immediate and
  audit-logged.
- **No key / API failure → honest degraded state.** A fabricated balance is an incident.

## Accessibility is an invariant, not polish

Target **WCAG 2.2 AA**, treated on the same footing as the guardrails — because a
conversational interface fails differently than a form. Output arrives token by token, and
a live region that re-announces on every token is worse for a screen-reader user than
silence.

- **Streamed replies buffer and flush on clause boundaries** into a polite, non-atomic live
  region, and the turn boundary is announced so the user knows the coach has settled.
- **Citations are real disclosures** — `aria-expanded`, with the panel emitted immediately
  after its trigger so it reads in place.
- **No blocking browser dialogs.** The memory editor is an inline labelled field that moves
  focus in, restores it to the trigger on exit, and announces the result.
- **State is never colour alone** — the trust battery, guardrail, escalation and metric
  health cues each carry a text or shape counterpart.
- **Reflows to 320px**, respects `prefers-reduced-motion`, 24px minimum target size.

Rules live in `.claude/rules/accessibility.md`; the mechanizable half is gated by Tier 1b
of the eval suite, and `.claude/skills/voiceover-audit/` captures what VoiceOver actually
speaks for the half that isn't.

## Telemetry parity

Both demos emit the identical event schema from `shared/telemetry.js` and render the
identical Metrics view. In the lifecycle demo the counters are driven by the script; in
the agent demo they are real (faithfulness = grounded claims ÷ total claims, verification
engagement, action conversion, appropriate escalations, trust battery — which drains ~3×
faster than it charges, by design).

## The eval loop

👎 feedback in the agent demo is queued to `agent-demo/data/feedback-queue.json`; eval
failures and queued feedback are promoted into new `evals/golden.json` cases (minimum 5
per conversation state: 1 happy path, 3 edges, 1 boundary) — and the suite re-runs
**before any prompt or rule change ships**.

## Docs

- [docs/BUILD_STORY.md](docs/BUILD_STORY.md) — the 4D narrative (Discover / Design /
  Develop / Deploy) with framework credits and sources
- `.claude/rules/accessibility.md` — the accessibility invariants and verification checklist
- `.claude/skills/voiceover-audit/` — VoiceOver + Safari capture and assertions for
  streamed output (macOS; needs Accessibility permissions)
- `CLAUDE_CODE_PROMPT.md` — the build spec this restructure was generated from

## Author

Alan Byers — Principal UX Developer → Product. Built to explore conversational UX & AI
experience design in regulated domains.
