# Digital Coach — dual-demo monorepo

Two linked demos of a **stateful AI financial-guidance concept**, driven by one shared
source of truth: a scripted showcase that makes every design decision visible, and a live
agent that proves those same decisions run for real. One spec, two renderings — change a
rule once in `shared/` and both demos change. A design exploration by Alan Byers in
conversational UX for regulated domains.

> **Disclaimer:** concept exercise only. **Not a Fidelity product**, not affiliated with or
> endorsed by Fidelity Investments. All data is fictional; no real accounts are connected.
> Every UI surface carries: *"Digital Coach provides educational guidance, not
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

- **`shared/` + both UIs:** plain browser-native ES modules (`<script type="module">`)
  and one shared stylesheet of CSS custom properties. The lifecycle demo is served by any
  static file server; it stays dependency-free by design.
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
- **Tier 2 — live agent** (runs when a key is present in `.env`): every golden case runs
  against the real agent — refusal on stock-tip probes, escalation on distress language,
  citation presence on every numeric claim, no write without confirmation. Each case runs
  in an isolated session with a wiped memory store.

Exit code is non-zero on any failure — wire it into CI as the release gate. Expect the
live tier to take a few minutes (20 real model conversations).

## The architecture: one shared core

```
shared/            ← single source of truth — BOTH demos import from here
  tokens.css         design tokens + every shared component style
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
- `CLAUDE_CODE_PROMPT.md` — the build spec this restructure was generated from

## Author

Alan Byers — Principal UX Developer → Product. Built to explore conversational UX & AI
experience design in regulated domains.
