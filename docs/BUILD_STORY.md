# Building Tandem — a 4D Product Story

*How a stateful, compliant, trust-first financial coaching experience gets built — and how analytics drive its evolution. Written as a portfolio artifact by Alan Byers. Concept exercise only; no real data, no affiliation with any financial institution implied.*

*This narrative is rendered live by both demos in the monorepo: the scripted showcase at `lifecycle-demo/` and the live agent at `agent-demo/`, both driven by the modules in `shared/` — the state machine (`shared/states.js`), guardrails (`shared/guardrails.js`), memory model (`shared/memory.js`), telemetry (`shared/telemetry.js`), and persona (`shared/persona.md`). The agent's system prompt is compiled from those same modules (`agent-demo/agent/system-prompt.js`).*

---

## The one-sentence frame

> Tandem's core product problem is earning the right to be **stateful**: every remembered fact, re-entry moment, and proactive nudge either compounds trust or destroys it — so run Discovery on where memory creates value, Design around verification and autonomy levels, Develop against faithfulness and compliance evals, and Deploy with escalation and abuse guardrails from day one.

---

## 1. Discover — find where conversational AI creates value

**Problem-first, not AI-first.** The problem statement never mentions AI: *millions of customers have limited access to personalized, end-to-end financial support.* The persona is the mass-affluent / workplace-plan customer without a human advisor — an access-expansion play, not a high-net-worth upsell.

**Jobs-to-be-done, with a non-AI baseline.** "When I worry about money (weekly), I want a plan that knows me, so I stop feeling behind." The explicit comparison is the current static planning tool — AI only earns its place if it measurably improves the outcome.

**Journey mapping exposed the defining insight.** Stages: Get Oriented → Plan → Act → Stay on Track. Listing activities per stage shows that financial guidance is *twenty conversations across months*, not one session. That's why "re-entry moments" are a first-class design object here — statefulness isn't a feature, it's the product.

**Pain sizing (magnitude / frequency / severity / competition / contrast):**

- Magnitude: millions of underserved customers.
- Frequency: financial worry is weekly; advisor contact is yearly.
- Severity: retirement adequacy is among the highest-severity consumer problems.
- Competition (2026): Schwab's AI Portfolio Insights and client-facing assistants, Robinhood Cortex Digests, BofA's Erica at 42M-user scale, Vanguard's advisor-facing Expert Insights, and ChatGPT's personal-finance account connections.
- Contrast — the wedge: robo-advisors act *for* you without explaining; chatbots explain without *knowing* you. Tandem owns the middle: guidance that remembers you, shows its sources, and knows when to hand you to a human.

**Expectation audit (SOUR).** Stakeholders arrive expecting sci-fi accuracy, observability, and contextual awareness. Today's reality: hallucination is real, models can't truthfully explain their reasoning, and context must be explicitly supplied. Managing that gap is a first-class design deliverable — it shows up in the demo as verification affordances and up-front limitation statements.

**Converge on impact × feasibility.** v1 = orientation + plan check-ins: read-only, verifiable, low blast radius. Not trade execution (high impact, catastrophic risk). In a regulated domain, feasibility means "can the intelligence do this *compliantly*."

---

## 2. Design — the heart of conversational UX work

**Stateful conversation design.** Four explicit states — orientation, planning, action, escalation — with designed transitions, visible in the demo's header pill. Not one open-ended chat. Each state has its own eval expectations and autonomy ceiling.

**Autonomy assigned per action (Sheridan's Levels of Automation).**

- Levels 1–4 (suggest / narrow options): guidance, education, scenario modeling.
- Level 5 (execute only on human approval): pre-filled contribution changes, transfer drafts.
- Level 6+ : prohibited. Never auto-execute financial actions.

The demo's action card is this decision rendered as UI: proposal → approval → system executes → reversible confirmation, with a rollback path defined before the write tool ships.

**Human-in-the-loop with verification access.** Every cited figure is tappable back to its source (the 📎 chips). Explainability for generative systems means *showing verifiable evidence* — never asking the model to narrate its reasoning, which it fabricates. Humans are in the loop twice: the customer approves actions; licensed representatives receive escalations.

**Memory strategy — the trust product.**

- Three types: explicit (user-stated, never decays), derived (inferred, slow decay), behavioral (usage patterns, fast decay).
- Consent before use: implicit extraction + explicit transparency. The demo asks permission before relying on a derived inference ("may I remember that retirement adequacy is your main concern?").
- Scope boundaries: the budgeting agent sees task context only; the user-visible profile is the shared layer.
- The uncanny-valley guard: a coach that misremembers your risk tolerance is worse than one that remembers nothing. Memory precision is evaluated like retrieval.
- View / edit / delete is table stakes in finance; deletions take effect immediately and are audit-logged.

**Re-entry moments (Fogg Behavior Model).** A nudge only produces action when motivation, ability, and prompt converge. The demo's session bridge fires at a user-initiated, high-motivation moment (a volatility login), makes the recommended action one tap, and — critically — logs a declined nudge as signal rather than re-prompting on the system's schedule.

**Compliance-to-UX translation.** FINRA applies existing communications rules to chatbots — supervision under Rule 3110, recordkeeping, retail-communication standards. So every coach message is designed as a supervisable retail communication. Refusals are designed as trust-builders: explain *why*, then redirect to what's in scope. Disclosures are conversational moments, not legal walls.

**Safety by design.** Limitations communicated up front (HAX "initially" guidelines); degradation cues — during an outage or low-confidence moment the coach degrades to an honest disabled state, never improvisation (the demo's peak-load simulation); constrained inputs (every open text field is jailbreak surface); moderated outputs; easy issue reporting.

---

## 3. Develop — evals are where UX earns trust with risk partners

Platform AI owns the model. The conversational UX lead owns what "good" means — and proves it.

- **Golden dataset first.** 50–200 human-verified (question, ideal answer, expected sources) triples, version-controlled alongside code (`evals/golden.json`, run with `npm run evals`), started before build. It gates every later change and becomes the shared language with risk and platform AI.
- **RAG for facts; never fine-tune facts.** Plan documents, fund data, and policy are retrieved with citations. The RAG Triad (context relevance / groundedness / answer relevance) surfaces in the UI as tappable sources — an eval metric converted into a user-facing trust affordance.
- **Faithfulness ≈ 1.0 on cited figures.** The common 0.9 threshold is a floor elsewhere, not in finance. Arithmetic runs through calc tools, not model math.
- **Model graders emit labels, not scores:** COMPLIANT_REFUSAL / NEEDS_REVIEW / VIOLATION — auditable by compliance, visible in the demo's presenter mode.
- **Eval-driven releases.** Minimum five cases per conversation state (one happy path, three edges, one boundary) written before build; expected pass rates per state gate each release; eval config always matches production config. In this repo: `evals/run-evals.js` runs a deterministic policy tier (server-enforced guardrails) plus a live-agent tier against `agent-demo/`.
- **Red teaming as first-class UX work.** Jailbreak-to-stock-tip, PII probes, out-of-scope advice (tax/legal/medical), competitor endorsements, and distressed-user scenarios — a user saying "I'm going to lose everything" is a UX design case, not just a safety case. Multi-turn attack suites and private adversarial datasets, with LLM judges calibrated against human-labeled sets before they gate anything.

---

## 4. Deploy — monitor, learn, evolve

**The build/don't-build honesty.** On the standard five-dimension matrix, Tandem scores *build* on task complexity and scale but *don't build* on environment constraints — financial guidance is the canonical "errors are extremely costly" domain. That tension is resolved, not ignored: autonomy caps at propose-and-confirm, and the winning architecture is a **deterministic workflow that delegates to agents only where reasoning is required** — preserving the audit trail compliance needs. A strategy agent proposes; an independent compliance-verifier agent cross-validates before anything reaches the customer.

**Operational failure design.**

- Wrong balance shown = incident, with an incident-response path.
- Market-crash day = peak load + peak anxiety — the worst possible time to fail. Degrade to disabled states with honest status.
- Abuse vectors closed: the coach is not free GPT access (rate limits, scoped prompts, moderation).
- Every tool call audit-logged; write tools carry defined rollbacks.

**Analytics drive evolution — the flywheel.**

Production traces → quality signals (👍/👎, corrections, escalations, citation-opens, declined nudges) → weekly triage promotes failures into the golden dataset → the eval suite gates every release → conversation states that sustain quality earn autonomy promotions on the Sheridan scale → a more capable coach generates richer traces.

Metrics stack, each tied to the decision it drives:

| Metric | Target / posture | Decision it drives |
|---|---|---|
| Faithfulness on cited figures | ≈ 1.0; weekly drift check vs frozen golden set | Release gating |
| Appropriate escalation | Counted as **success**; measured on handoff-context quality | Escalation design, not containment-chasing |
| Containment | Benchmarks: 35–50% at launch, 65–80% mature — but low CSAT + high containment = exhausting users, a red flag | Intent coverage roadmap |
| Action conversion | Declines logged as timing/framing signal | Fogg nudge placement, prominence |
| Trust battery proxies | Correction rate, override rate, re-verification, abandonment; drains ~3× faster than it charges | Churn early warning; prioritize preventing egregious failures over adding delights |
| Memory precision | Evaluated like retrieval | Memory decay/scope tuning; uncanny-valley guard |
| CSAT by topic | ≥ ~75–80% healthy; break down per intent | Which states need redesign |

Review cadence: **daily** (fallback spikes, guardrail triggers, degradation events) → **weekly** (👎 triage, faithfulness drift, escalation quality) → **monthly** (trust trend, CSAT by topic, conversion, return rate) → **quarterly** (Kano re-survey — AI delighters decay into must-bes; red-team engagement; memory audit).

---

## Framework credits

Sheridan & Verplank's Levels of Automation; Microsoft HAX Guidelines; Google PAIR Guidebook; Jared Spool's SOUR spectrums; the RAG Triad (TruEra/TruLens); Trust Battery (adapted from Tobi Lütke); Fogg Behavior Model; Kano Model; Cognitive Load Theory; the 4D method (Discover/Design/Develop/Deploy) as taught in the Product Faculty AI PM curriculum.

## Selected sources

- [FINRA — AI key topics](https://www.finra.org/rules-guidance/key-topics/artificial-intelligence) and [2026 Annual Regulatory Oversight Report, GenAI section](https://www.finra.org/rules-guidance/guidance/reports/2026-finra-annual-regulatory-oversight-report/gen-ai)
- [Debevoise — FINRA 2026 report: GenAI and agent-based risks](https://www.debevoisedatablog.com/2025/12/11/finras-2026-regulatory-oversight-report-continued-focus-on-generative-ai-and-emerging-agent-based-risks/)
- [Schwab — AI-powered portfolio insights launch](https://pressroom.aboutschwab.com/press-releases/press-release/2026/Charles-Schwab-Launches-AI-Powered-Capability-That-Helps-Investors-Understand-Portfolio-Performance-and-Market-Activity/default.aspx)
- [Robinhood — Cortex Digests](https://robinhood.com/us/en/support/articles/cortex-digests/)
- [BofA — Erica surpasses 3B interactions](https://newsroom.bankofamerica.com/content/newsroom/press-releases/2025/08/a-decade-of-ai-innovation--bofa-s-virtual-assistant-erica-surpas.html)
- [OpenAI — personal finance in ChatGPT](https://openai.com/index/personal-finance-chatgpt/)
- [Anthropic — Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) · [Building effective agents](https://www.anthropic.com/research/building-effective-agents) · [Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [Microsoft HAX Toolkit](https://www.microsoft.com/en-us/haxtoolkit/) · [Google PAIR Guidebook](https://pair.withgoogle.com/guidebook/)
- Chatbot analytics benchmarks: [OMQ chatbot KPIs](https://omq.ai/lexicon/chatbot-kpi/) · [Quickchat analytics guide](https://quickchat.ai/post/chatbot-analytics)
