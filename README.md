# Digital Coach — dual-demo monorepo

Two linked demos of a **stateful AI financial-guidance concept**, driven by one shared
source of truth. Built as a portfolio artifact by Alan Byers for conversational UX / AI
product interview discussion.

> **Disclaimer:** concept exercise only. **Not a Fidelity product**, not affiliated with or
> endorsed by Fidelity Investments. All data is fictional; no real accounts are connected.
> Every UI surface carries: *"Digital Coach provides educational guidance, not
> individualized investment advice."*

## The two demos

| | `lifecycle-demo/` | `agent-demo/` |
|---|---|---|
| What it is | The development-lifecycle showcase: a scripted two-session journey with a Build story (4D) view, live-updating Metrics, and 🔍 presenter mode | The same product **running for real**: Anthropic API, streaming, tools, RAG citations, persistent memory, live telemetry |
| Runs on | Nothing — plain ES modules, no framework, no build step | A minimal zero-dependency Node server (`server.js`) |
| Start it | `npm run dev:lifecycle` → open <http://localhost:8321/lifecycle-demo/> | `cp .env.example .env`, add your `ANTHROPIC_API_KEY`, then `npm run dev:agent` → <http://localhost:8787> |

Without an API key the agent demo still runs — and **degrades honestly** into a disabled
state instead of improvising, which is itself one of the design invariants on display.

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
  approve button); a tool call or forged event is refused. Every write has a rollback.
- **Numbers come from tools, never model arithmetic.** The server extracts every numeric
  claim from each reply and checks it against that turn's tool/RAG outputs — that ratio
  *is* the faithfulness metric on the Metrics tab. Every cited figure renders as a
  tappable 📎 source chip.
- **Escalation triggers are detected server-side** (distress language, sell decisions,
  out-of-policy) — the human-handoff banner appears even if the model forgets.
- **No key / API failure → honest degraded state.** A fabricated balance is an incident.

## Telemetry parity

Both demos emit the identical event schema from `shared/telemetry.js` and render the
identical Metrics view. In the lifecycle demo the counters are driven by the script; in
the agent demo they are real (faithfulness = grounded claims ÷ total claims, verification
engagement, action conversion, appropriate escalations, trust battery — which drains ~3×
faster than it charges, by design).

## The eval loop

```
npm run evals
```

- **Tier 1 — policy (no key needed):** deterministic checks of everything enforced
  server-side — guardrail detectors against all 25 golden cases, the write-confirmation
  gate + rollback, memory consent gating, scenario↔mock-data figure parity, single-source
  integrity, and the keyless server's refusal to fabricate numbers.
- **Tier 2 — live agent (needs `ANTHROPIC_API_KEY`):** every golden case runs against the
  real agent: refusal on stock-tip probes, escalation on distress language, citation
  presence on every numeric claim, no write without confirmation.

**The loop:** 👎 feedback in the agent demo is queued to
`agent-demo/data/feedback-queue.json`; eval failures and queued feedback are promoted into
new `evals/golden.json` cases (minimum 5 per conversation state: 1 happy path, 3 edges,
1 boundary) — and the suite re-runs **before any prompt or rule change ships**.

## Docs

- [docs/BUILD_STORY.md](docs/BUILD_STORY.md) — the 4D narrative (Discover / Design /
  Develop / Deploy) with framework credits and sources
- `CLAUDE_CODE_PROMPT.md` — the build spec this restructure was generated from

## Author

Alan Byers — Principal UX Developer → Product. Built to support interview discussion of
conversational UX & AI experience design in regulated domains.
