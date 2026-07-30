# Prompt for Claude Code — Tandem dual-demo monorepo

Run Claude Code from the folder containing the existing demo (`index.html`, `docs/`, `README.md`), then paste everything below the line.

---

Restructure this project into a monorepo containing two linked demos of "Tandem," a stateful AI financial-guidance concept. The existing `index.html` is demo #1. Both demos must be driven by the same shared source of truth so a change in one is automatically reflected in the other.

## Target structure

```
tandem/
  shared/                      # single source of truth — both demos import from here
    tokens.css                 # design tokens (extract the :root CSS variables + component styles from index.html)
    states.js                  # conversation state machine: orientation | planning | action | escalation | degraded, allowed transitions, autonomy ceiling per state
    memory.js                  # memory model: types (explicit/derived/behavioral), decay rates, consent rules, view/edit/delete operations
    guardrails.js              # compliance rules: advice-line refusal (no specific securities), escalation triggers (distress language, sell decisions, low confidence, missing data, out-of-policy), Sheridan cap at level 5 (propose-and-confirm; L6+ prohibited), degradation behavior (disabled state, never improvisation)
    scenario.js                # the scripted Jordan journey (extract every message, citation, action card, and debug annotation from index.html into structured data)
    telemetry.js               # event schema + counters: faithfulness claims, citation opens, actions proposed/approved, appropriate escalations, refusals, feedback, memory ops, trust battery (charges slow, drains ~3x faster)
    persona.md                 # the coach's voice, tone, limitations statement, disclosure copy
  lifecycle-demo/              # demo #1: the development-lifecycle showcase (scripted)
    index.html                 # current demo refactored to import from shared/ via ES modules; keeps all three views (Live demo, Build story 4D, Metrics) and presenter mode
  agent-demo/                  # demo #2: real agent, end to end
    index.html                 # same chat UI (built from shared/tokens.css), memory panel, metrics — but driven by a live model
    server.js                  # minimal Node server: Anthropic API (key from .env, never committed), streaming responses
    agent/
      system-prompt.js         # COMPILED from shared/: persona.md + guardrails.js + states.js + memory rules → one system prompt. Do not hand-write duplicate rules here.
      tools.js                 # tool definitions: get_plan_record (read, auto-execute), contribution_calculator (read), plan_change_draft (write, propose-and-confirm w/ rollback), escalate_to_human, all against mock data
      rag.js                   # retrieval over data/docs/* with citations returned as structured {claim, source} pairs the UI renders as tappable 📎 chips
      memory-store.js          # session + persistent memory implementing shared/memory.js (JSON file storage is fine)
    data/
      accounts.json            # fictional Jordan data matching scenario.js figures ($48,200 balance, 6% contribution, 8% match, $93,000 salary, $3,900/mo expenses, $5,100 savings)
      docs/                    # small mock corpus: plan record, retirement guideline (10x by 67), brokerage-style volatility education page
  evals/
    golden.json                # golden set seeded from scenario.js: (question, expected behavior, expected sources) per conversation state — min 5 cases per state: 1 happy path, 3 edges, 1 boundary
    run-evals.js               # runs golden set against the live agent; checks: refusal on stock-tip probes, escalation on distress language, citation presence on every numeric claim, no write without confirmation
  docs/BUILD_STORY.md          # keep, update paths
  README.md                    # rewrite: explains the two demos and the shared-core architecture
  package.json                 # scripts: dev:lifecycle (static serve), dev:agent (server), evals
  .env.example                 # ANTHROPIC_API_KEY=
  .gitignore                   # .env, node_modules, memory-store data
```

## Hard requirements

1. **Single source of truth.** Any copy, rule, threshold, or design token that appears in both demos must live in `shared/` and be imported — never duplicated. The agent demo's system prompt is *compiled* from the same modules the lifecycle demo renders as presenter-mode annotations. Test this: change the refusal copy in `guardrails.js` once → both demos change.
2. **Lifecycle demo stays dependency-free** — plain ES modules, no framework, no build step beyond a static server (`npx serve` or similar for module loading).
3. **Agent demo enforces guardrails server-side**, not just in the prompt: the `plan_change_draft` tool must refuse to execute without an explicit user confirmation event; numeric claims must come from tool results (never model arithmetic); every cited figure carries its source.
4. **Telemetry parity.** Both demos emit the same event schema from `telemetry.js`; both render the same Metrics view. In the agent demo the counters are real (including faithfulness = grounded claims / total claims, computed by checking each numeric claim against tool/RAG outputs).
5. **Evals are runnable** (`npm run evals`) and the README documents the loop: 👎 feedback and eval failures → new golden.json cases → re-run before any prompt change ships.
6. **Safety framing preserved everywhere:** fictional data only, "educational guidance, not individualized investment advice" disclaimers in both UIs, no real account connections.
7. Verify both demos run, run the evals, then git init on branch main and commit everything with author "Alan Byers <jalanbyers@gmail.com>". Do not push anywhere.

Work incrementally: extract shared/ from the existing index.html first and confirm the lifecycle demo still works identically before building the agent demo.
