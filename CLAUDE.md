# Tandem — dual-demo monorepo

Portfolio artifact by Alan Byers exploring conversational UX / AI product design. Concept only: **not a Fidelity product, fictional data, no real accounts.** Every UI surface keeps the disclaimer "educational guidance, not individualized investment advice."

## What this is

Two demos of a stateful AI financial coach, driven by one shared core:

- `lifecycle-demo/` — scripted showcase of the full development lifecycle (4D build story, presenter-mode annotations, metrics instrumentation). Dependency-free ES modules; never add a framework or build step.
- `agent-demo/` — live end-to-end agent (Anthropic API, streaming) with real tools, RAG citations, memory store, and server-side guardrail enforcement.
- `shared/` — the single source of truth both import: states, memory model, guardrails, scenario content, telemetry schema, persona copy, design tokens.
- `evals/` — golden set + runner; gates every prompt/rule change.

## The one rule that matters most

**Nothing that appears in both demos may be duplicated.** Rules, copy, thresholds, tokens live in `shared/` and are imported. The agent's system prompt is *compiled* from `shared/` (see `agent-demo/agent/system-prompt.js`) — never hand-edit prompt text that has a source module. If you change behavior, change the shared module; both demos must reflect it.

## Design invariants (do not relax these)

- Autonomy caps at Sheridan level 5: propose-and-confirm. No write executes without an explicit user confirmation event, enforced server-side. Every write tool has a rollback.
- No model arithmetic: numeric claims come from tool results; every cited figure carries a tappable source.
- Refusals explain why, then redirect (advice-line: never recommend specific securities).
- Escalation triggers (distress language, sell decisions, low confidence, missing data, out-of-policy) hand off to a human with context; appropriate escalation is a success metric, not a failure.
- Degradation = honest disabled state, never improvisation. A fabricated balance is an incident.
- Memory: derived/behavioral memories require user consent before use; view/edit/delete honored immediately; deletes propagate to the agent memory store.
- Trust battery drains faster than it charges — telemetry must keep that asymmetry.

## Workflow

- `npm run dev:lifecycle` / `npm run dev:agent` / `npm run evals`
- Change flow: edit `shared/` → verify lifecycle demo renders it → verify agent behavior → **run evals before committing**. Eval failures and 👎 feedback become new `evals/golden.json` cases (min 5 per conversation state: 1 happy, 3 edges, 1 boundary).
- Commits: author "Alan Byers <jalanbyers@gmail.com>". Never commit `.env` or memory-store data. Do not push to any remote unless Alan explicitly asks.
- Update this file when architecture or invariants change; keep `docs/BUILD_STORY.md` in sync with any framework-level changes.

## Reference docs

- `docs/BUILD_STORY.md` — the 4D narrative (Discover/Design/Develop/Deploy) with sources
- `CLAUDE_CODE_PROMPT.md` — original build spec for the monorepo restructure
