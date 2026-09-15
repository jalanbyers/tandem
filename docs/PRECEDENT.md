# Precedent — teaching Tandem from human advisor practice

> **Proposal.** Not built. Companion tool to Tandem; same fictional-data rule, same invariants.

Precedent is how a profession transmits judgment without re-deriving it every time: accumulated
decisions by qualified people, cited, revisable, and binding on what comes after. This tool builds
Tandem a body of precedent from what human advisors actually do.

The vocabulary is load-bearing, not decorative — every term below already means the right thing:

| Term | In law | Here |
|---|---|---|
| **set** | a decision establishes authority | a move recurs across ≥5 sessions and is affirmed |
| **binding** | governs later decisions | compiled into the prompt, retrievable at runtime |
| **persuasive** | authority from another jurisdiction — instructive, not binding | the licensed advisor's *recommendations*: they inform when to hand off, never what to say |
| **distinguished** | on point, but the facts differ — so it doesn't control | retrieved and deliberately *not* applied; logged |
| **first impression** | no governing authority exists | no binding precedent for this situation → escalate (§7) |
| **overturned** | superseded or vacated | outcome telemetry degrades, or a newer precedent supersedes |

---

## 1. The insight this is built on

Tandem already generates the dataset. Every escalation hands a package to a licensed human
(`ESCALATION_OFFER.handoffToast`: *"session summary + memory context travels with Jordan"*) —
and then **the trace dies.** We count the escalation as success and stop watching.

What happens on the other side of that handoff is the single most valuable signal the product
produces: **(a situation Tandem could not handle, how a licensed human actually handled it).**
Naturally labeled, pre-filtered to the hard cases, generated as a by-product of doing the right
thing. Precedent picks the trace back up.

We don't have to go find advisor conversations. Tandem's own escalation queue *is* the sampling
strategy.

---

## 2. The constraint that shapes everything

**Human advisors are licensed. Tandem is not.** Cloning advisor behaviour wholesale would train
Tandem to cross the advice line — the worst possible outcome for this product.

So the pipeline's first stage is a **separator**. Every advisor turn splits into:

| | The *how* — **transferable** | The *what* — **licensed-only** |
|---|---|---|
| Examples | sequencing, framing, empathy-before-data, question order, checking understanding, pacing, how tradeoffs get surfaced | the recommendation, suitability judgment, specific product or allocation |
| Authority | **binding** on Tandem | **persuasive only** — another jurisdiction's |
| Becomes | a **precedent** → `shared/precedents.js` → system prompt + evals | an **escalation-trigger refinement** → `shared/guardrails.js` → detectors + evals |

The licensing boundary is a **jurisdictional** one, and that is the precise reason this metaphor
earns its place. A licensed advisor's *recommendation* is authority from a jurisdiction Tandem does
not sit in. It is not discarded — persuasive authority still teaches you something real — but what
it teaches is **when to refer the matter out**, never what to say.

So nothing is wasted, and the two halves serve opposite purposes:

- What the advisor did **that Tandem can do** teaches it *how to behave*.
- What the advisor did **that Tandem can't do** teaches it *when to hand off*.

The advice line stops being a wall the pipeline works around and becomes the pipeline's
**sorting key**. That is the thesis of the whole design.

---

## 3. Two clocks

The architecture's load-bearing decision: separate *what changes behaviour* from *what selects
among approved behaviours*.

```
SLOW CLOCK — days to weeks, human-gated, changes behaviour
  advisor transcripts
    → separate (transferable | licensed-only)
    → cluster (n ≥ 5 sessions)
    → draft into precedent schema
    → HUMAN REVIEW (licensed advisor + compliance)
    → shared/precedents.js ─┬→ compiled system prompt
                             └→ evals/golden.json
                        [ EVAL GATE ]  ← nothing ships without passing

FAST CLOCK — per turn, milliseconds, introduces no new behaviour
  situation → retrieve binding precedent → inject as cited context → 📎 precedent:P-003
```

Why the split is the point: a precedent retrieved at runtime is subject to the **same grounding and
citation rules as any retrieved document** — it's context, not new licence. Anything that would
actually change how the coach behaves has to walk the slow clock and pass the gate.

This is `AUTONOMY.rule` applied to learning. No write executes without human confirmation;
**no practice enters the coach without human review.**

---

## 4. The ingest path — session → corpus → precedent

Most of the regulatory risk in this whole design sits in this one section, so it's specified
tightly. The governing principle: **raw client material never enters Precedent at all.**

```
  advisor + client meeting
        │
        ▼
  ┌─────────────────────┐
  │ CAPTURE  (firm-side)│  Jump / Zocks / Zeplyn webhook, or CRM-mediated
  └─────────┬───────────┘
            │  structured turns + metadata
            ▼
  ╔═════════════════════╗   ← the only door in. Rejects are 4xx; NOTHING persists.
  ║ INGEST GATE         ║      1. dual consent   2. de-identify   3. verify
  ╚═════════╤═══════════╝
            │  de-identified, typed session
            ▼
  ┌─────────────────────┐
  │ CODING (2-pass)     │  machine proposes → human disposes
  └─────────┬───────────┘
            │  coded moves
            ▼
  ┌─────────────────────┐
  │ CORPUS  (rolling)   │  de-identified only · 24-month window
  └─────────┬───────────┘
            │  clusters (n≥5)
            ▼
  ┌─────────────────────┐
  │ PRECEDENT LIBRARY   │  shared/precedents.js · git-versioned · ZERO client data
  └─────────────────────┘
```

### 4.1 Capture — how the session is recorded

Three modes, in increasing order of risk. **Recommended: mode A.**

| | Mode A — structured only | Mode B — transcript | Mode C — full recording |
|---|---|---|---|
| Retains | typed fields + coded moves | text transcript | audio + transcript |
| Audio | processed in flight, never stored | discarded | retained |
| Books-and-records exposure | lowest | transcript is a record under 17a-4 | heaviest |
| Note | the [Zocks posture](https://www.zocks.io/blog/why-financial-advisors-choose-ai-tools-that-dont-record) | | some firms retain anyway under [FINRA Rule 3170](https://www.advisor360.com/blog/before-you-hit-record-is-your-ai-notetaking-compliant) |

Precedent needs the *shape* of the conversation, not its audio. Mode A is sufficient, and it
means the highest-risk artifact is never created.

### 4.2 Dual consent — the gate that matters most

**Consent to record ≠ consent to secondary use.** Conflating them is exactly where the active
class-action exposure against AI transcription vendors sits. So they are two independent, logged,
revocable events:

```js
consent: {
  record:       { granted: true, at: '2026-08-02T14:01Z', basis: 'all-party verbal, logged' },
  secondaryUse: { granted: true, at: '2026-08-02T14:01Z', scope: 'practice-improvement' },
}
```

A session enters the corpus only if **both** are true. **Default deny** — absence of a consent
record is a rejection, never a pass. All-party consent is assumed as the design floor because the
strictest applicable state law governs a multi-state practice.

This is `MEMORY_RULES.consentBeforeUse` — Tandem's existing rule that derived memories need
consent before the coach relies on them — applied to a second population. Same invariant, new
domain. Both should read from one shared consent model.

### 4.3 De-identification — before storage, not before use

Two stages, both run **inside the ingest gate**, so unredacted text never touches a Precedent disk:

1. **Strip** — NPI/PII removal per Reg S-P: names, account numbers, SSN, DOB, employer, address,
   phone, email.
2. **Generalize** — replace specifics with *typed placeholders that preserve conversational shape*,
   because a precedent needs the situation, not the person:

```
"Karen, your 401(k) is at $48,200 and you're 34, so you've got about
 thirty years before you touch it."
        ↓
"{CLIENT}, your {ACCOUNT:dc-plan} is at {BALANCE:5-figure} and you're
 {AGE:30-39}, so you've got about {HORIZON:20-30y} before you touch it."
```

The shape survives — the advisor named the balance, then reframed to horizon. That sequencing is
the precedent. The identity is gone.

3. **Verify** — re-identification is *tested*, not assumed. A deterministic eval tier scans the
   corpus for surviving PII patterns and unreplaced numerics. A leak fails the build.

### 4.4 Coding — structured qualitative analysis, not ML

Worth naming plainly: this is **thematic analysis with an inter-rater reliability step** — a UX
research method, applied to advisor transcripts. That framing matters for who can own it.

- **Pass 1 · segment.** Session → turns → **moves**. The move is the unit of analysis.
- **Pass 2 · separate.** Each advisor move classified `transferable` vs `licensed-only` (§2).
  Model proposes, **human disposes** — this classification has a compliance consequence, so it is
  never fully automated.
- **Pass 3 · code.** Transferable moves get codes from a controlled vocabulary:

| Prefix | Vocabulary | Source |
|---|---|---|
| `mi.*` | `open-question`, `affirmation`, `reflection`, `summary` | MI / OARS |
| `cfp.*` | `1-circumstances` … `7-monitor` | CFP Board 7-step |
| `seq.*` | `empathy-before-data`, `check-understanding`, `slow-down` | observed sequencing |
| `esc.*` | `offer-human`, `stay-present`, `name-the-cost` | escalation handling |

**Inter-rater reliability is a gate.** Two coders (or model + human) code an overlap sample;
Cohen's κ is computed. If κ falls below threshold the **codebook** is refined — the taxonomy was
ambiguous — not the coders. This keeps the vocabulary honest and is itself a deterministic check.

### 4.5 Storage — three stores, deliberately unequal

| Store | Contains | Retention | Precedent access |
|---|---|---|---|
| **Vault** (firm-side) | raw audio/transcript, if retained at all | per 17a-4 / firm policy | **none — never reads it** |
| **Corpus** | de-identified, coded sessions | rolling 24 months | read/write |
| **Precedent library** | reviewed precedents + provenance **IDs only** | git-versioned, permanent | ships into Tandem |

The load-bearing property: **the precedent library contains no client data by construction** — only
session *identifiers* as provenance pointers plus the abstracted move. Delete the entire corpus
tomorrow and every precedent still stands and still cites its lineage.

### 4.6 Revocation cascade

Because provenance is a list of IDs, consent revocation is mechanical rather than heroic:

```
client revokes secondaryUse
  → session purged from corpus (immediate, audit-logged)
  → its ID removed from every precedent's provenance.sessions
  → any precedent now below n=5 auto-demotes: binding → proposed
  → eval gate re-runs; distinguished precedent stops being retrievable
```

That is `MEMORY_RULES.userControl` — *"deletions take effect immediately, are audit-logged, and
propagate"* — holding across an organisational boundary. A precedent can lose its evidence and the
system notices. Same invariant Tandem already ships, one level up.

### 4.7 How the demo proves it

`precedent/pipeline/ingest.js` reads `data/transcripts/*.md` and runs the **identical gates** —
dual consent, de-identify, verify, code. Synthetic sessions carry deliberately planted PII and
missing-consent flags so the rejection paths are exercised, not just described.

**The demo runs the real gates on fake data.** That is the only honest way to prove an ingest
path in a portfolio artifact.

---

## 5. Precedent schema

```js
{
  id: 'P-003',
  state: 'escalation',
  name: 'Name the feeling before the horizon',
  move: 'Acknowledge the specific emotion in the user\'s own words before introducing any
         time-horizon or recovery framing.',
  antipattern: 'Leading with "markets recover over time" while the user is still describing fear.',
  transferable: true,                    // false ⇒ may never reach status:'binding'
  provenance: {
    sessions: ['0142','0151','0163','0170','0177','0182','0191'],   // ≥5 required
    codified: ['MI/OARS — Reflections', 'CFP 7-step §1 Understand Circumstances'],
    affirmedBy: 'compliance + senior advisor',
    affirmedAt: '2026-08-11',
  },
  status: 'binding',                      // see lifecycle below
  evalCases: ['esc-prec-003-happy', 'esc-prec-003-edge-flat-affect'],
  outcome: { handoffRate: 0.31, trustDelta: +4 },
}
```

Grounded in two sources at once — observed practice *and* codified practice
([CFP Board's 7-step process](https://www.cfp.net/ethics/compliance-resources/2018/11/focus-on-ethics---the-7-step-financial-planning-process),
[MI/OARS](https://motivationalinterviewing.org/understanding-motivational-interviewing)) — so a
precedent is never just "what one advisor happened to do."

---

## 6. The dynamic part: precedent lifecycle

Six states, every transition gated. This is deliberately the same shape as Tandem's own
conversation state machine and its Sheridan ladder — **practice adoption earns promotion the way
autonomy does.**

| Status | Gate to enter |
|---|---|
| `observed` | the move recurs across **≥5** sessions (one session is idiosyncrasy, not practice) |
| `proposed` | clustered, drafted to schema, deduped against existing precedents |
| `affirmed` | a licensed human + compliance approve; **they** make the transferable call, not the model |
| `shadow` | compiled but inert — replayed against the golden set offline, influence measured, no user sees it |
| `binding` | passes the eval gate; retrievable at runtime, compiled into the prompt |
| `overturned` | outcome telemetry degrades, or a newer precedent supersedes it |

---

## 7. The new invariant this makes possible

Tandem already holds: **no verified data → honest disabled state, never improvise.**

Precedent adds the exact parallel — and law already has the name for it. A case with no governing
authority is **a matter of first impression**, and a court facing one doesn't invent a rule quietly;
it says so.

> **First impression → escalate. Never improvise practice.**

When the agent hits a situation with no `binding` precedent above threshold, it doesn't wing it — it
hands off, *and says that's why*. That escalation is the highest-value capture event in the system,
because it is precisely the gap in the library.

The loop closes on itself: **the system's ignorance is what feeds it.** Escalation-as-success stops
being a slogan and becomes literal — simultaneously the right user outcome and the training signal.

### Following vs distinguishing

The runtime has two legitimate outcomes when an on-point precedent is retrieved, and conflating
them would hide the more interesting one:

- **Follow** — the precedent controls; the reply is shaped by it and cites it.
- **Distinguish** — the precedent is on point but *these facts differ*, so it doesn't control.

Distinguishing is a normal, correct act, but it must be **logged with its reason**, never silent. A
precedent that keeps getting distinguished is telling you its scope is drafted too broadly — that's
a review trigger, and it's the earliest available signal that a precedent is going bad. Silent
non-application would throw that signal away.

---

## 8. What it lets us measure that we currently can't

`telemetry.js` already asserts escalations are *"measured on handoff-context quality, not
avoided"* — but nothing measures that today. Precedent can, by watching the other side:

- **`handoffReasks`** — how often the human re-asks something Tandem already knew and passed in
  the package. Every re-ask is a defect in the handoff, and it's directly fixable.
- **`firstImpressions`** — situations with no binding precedent. The roadmap, generated by usage.
- **`precedentsCited`** / **`precedentsSet`** — practice actually reaching users, and the loop's rate.
- **`distinguished`** — retrieved, on point, deliberately not applied. Read as a *ratio* against
  `precedentsCited`: a precedent distinguished more often than followed is drafted too broadly and
  goes back for review. This is the cheapest early warning the system has.

---

## 9. Where this lands in the eval suite

This gives the suite its **first tier that tests the *how*, not just the *what***. Every check
today is a prohibition (no ungrounded number, no execution claim, no security named). Precedents
enable *presence* assertions — closing the omission gap flagged in the SOUR accuracy review.

**Tier 1c — precedent integrity (deterministic, no API key):**
- every `binding` precedent has ≥1 golden case *(mirrors the existing min-5-per-state gate)*
- every precedent has ≥5 provenance sessions
- every precedent has `affirmedBy` + `affirmedAt` — no precedent becomes binding without a named human
- **no `transferable: false` precedent can be `binding`** — structural impossibility, not a prompt instruction
- precedent copy appears in neither demo's source *(extends the existing single-source check)*

**Tier 1d — corpus integrity (deterministic; the ingest path from §4):**
- **no surviving PII** in `data/corpus/` — name, SSN, account-number, email, phone patterns, and
  unreplaced raw currency. A leak fails the build, so de-identification is verified, not trusted.
- every corpus session carries **both** consent flags; a session missing either is absent
- planted-PII and missing-consent fixtures are **rejected** by `ingest.js` — the rejection paths
  are exercised, not merely documented
- inter-rater κ on the overlap sample is above threshold *(below ⇒ refine the codebook)*
- every code used in the corpus exists in `codebook.js` — no free-text coding drift
- revocation fixture: dropping a session ID demotes any precedent that falls below n=5

**Tier 2 additions:** `follows_precedent` (presence/order — e.g. empathy precedes any figure),
`no_licensed_advice_from_precedent` (a retrieved precedent never becomes a recommendation).

---

## 10. Honest about the learning clock

This directly extends the SOUR work. Spool's **computational learning** spectrum: sci-fi AI
learns continuously from the humans around it; today's models cannot, and *"I'll do better next
time"* is a lie. Precedent makes the learning **real but honest about its clock** — the system
genuinely improves from human demonstration, but each improvement is a reviewed, versioned,
attributable artifact, not an illusion of the model learning from your feedback.

It also answers the **observability** spectrum the right way. Don't ask the model to explain its
reasoning — it will confabulate. Show the *provenance of its behaviour*:

> *"This approach comes from 7 advisor sessions, reviewed 2026-08-11."*

A provenance claim, not an introspection claim. Verifiable, and true.

---

## 11. Repo shape

```
precedent/
  data/transcripts/*.md      synthetic advisor sessions (fictional advisor + client)
  data/corpus/               de-identified + coded output (gitignored, regenerable)
  codebook.js                controlled vocabulary: mi.* cfp.* seq.* esc.*
  pipeline/ingest.js         THE GATE — dual consent → de-identify → verify
  pipeline/deidentify.js     strip + generalize to typed placeholders
  pipeline/code.js           segment → separate → code (machine proposes)
  pipeline/separate.js       transferable vs licensed-only (human disposes)
  pipeline/cluster.js        n≥5 recurrence → proposed
  pipeline/draft.js          proposed → precedent schema
  pipeline/review.js         affirm gate (CLI; writes affirmedBy/affirmedAt)
  pipeline/promote.js        shadow → binding (runs evals, refuses on failure)
  pipeline/revoke.js         revocation cascade (§4.6)
shared/
  precedents.js              ← single source of truth; both demos import
  consent.js                 ← one consent model, used by memory AND corpus (§4.2)
evals/
  golden.json                + precedent-derived cases
  run-evals.js               + Tier 1c
```

`shared/precedents.js` is mandatory under CLAUDE.md's one rule — precedents appear in both
demos, so they live in `shared/` and are imported, never duplicated.

**Demo surfaces:** the agent demo cites a precedent through the **existing 📎 disclosure chip**
(`📎 precedent:P-003`) — same pattern, same DOM contract, so **no new accessibility surface and no new
eval scaffolding**. The lifecycle demo tells the slow-clock story as a build-story beat with a
presenter annotation naming the precedent, its session count, and its review date.

---

## 12. Phasing

| Phase | Deliverable | Proves |
|---|---|---|
| 0 | 12 synthetic transcripts + `codebook.js`, grounded in MI/OARS + CFP 7-step | the corpus exercises the pipeline |
| 1 | `shared/precedents.js`, 5 escalation precedents, hand-drafted, full provenance | the schema holds real content |
| 2 | Tier 1c + precedent-derived golden cases | the precedent gate is enforceable |
| 3 | runtime retrieval + 📎 citation in `agent-demo/` | the fast clock works |
| 4 | `ingest.js` + `deidentify.js` + Tier 1d, incl. planted-PII rejection fixtures | **the ingest gate holds** |
| 5 | coding pipeline (segment → separate → code) + κ check | the slow clock scales |
| 6 | coverage-miss → escalation; `handoffReasks`; `revoke.js` cascade | the loop closes |

Phases 1–3 are the demo-able core. Phase 4 is the one that makes it *credible to a risk partner* —
if you're showing this to anyone in financial services, do 4 before 5. Start at depth on
**escalation + distress**: the state where human practice most outclasses a model, and where
Tandem already escalates — so the capture point already exists.

---

## 13. Open questions

1. Does a precedent ever surface to the **end user** by name, or only in presenter mode + the chip?
   (Recommendation: presenter mode and the chip only — citing precedent at a distressed user is
   exactly the wrong register.)
2. Who takes the reviewer's part in the demo — is there a visible compliance/advisor persona, or is
   affirmation represented as metadata only?
3. Should 👎 feedback and declined nudges auto-**overturn** a precedent, or only flag it for review?
   (Recommendation: flag. Courts don't overturn themselves silently, and auto-overturning is an
   unreviewed behaviour change — which violates §3.)
4. Does `distinguished` need a user-visible consequence, or is it purely a telemetry signal?
   (Recommendation: telemetry only. The user should never be told which rule *didn't* apply.)

---

## Sources

**Tooling — the capture layer this would integrate with**
- [Three popular AI notetakers now integrated with AdvisorEngine](https://www.wealthmanagement.com/artificial-intelligence/three-popular-ai-notetakers-now-integrated-with-advisorengine) — Jump, Zeplyn, Zocks
- [AI Notetakers & Agentic OS for Financial Advisors: 2026 Strategic Buyer's Guide](https://wealthtechtoday.com/ai-notetakers-financial-advisors-2026/)
- [Why advisors choose AI tools that don't record](https://www.zocks.io/blog/why-financial-advisors-choose-ai-tools-that-dont-record) — structured extraction without retaining audio
- [What is Conversation Intelligence](https://pipeline.zoominfo.com/sales/conversation-intelligence) — "methodology adherence" scoring, the mechanism repurposed here

**Codified human practice — what precedents are grounded in**
- [CFP Board — The 7-Step Financial Planning Process](https://www.cfp.net/ethics/compliance-resources/2018/11/focus-on-ethics---the-7-step-financial-planning-process)
- [CFP Board — Practice Standards Reference Guide](https://www.cfp.net/ethics/compliance-resources/2020/11/practice-standards-reference-guide)
- [Understanding Motivational Interviewing (MINT)](https://motivationalinterviewing.org/understanding-motivational-interviewing)
- [Kitces — Motivational Interviewing for advice implementation](https://www.kitces.com/blog/motivational-interviewing-techniques-change-advice-implementation-financial-advisor/)

**Regulatory constraints on the capture layer**
- [FINRA 2026 Annual Regulatory Oversight Report — GenAI](https://www.finra.org/rules-guidance/guidance/reports/2026-finra-annual-regulatory-oversight-report/gen-ai) — testing, supervision, books-and-records capture of AI-enabled communications
- [FINRA's 2026 report: new focus on AI (McGuireWoods)](https://www.mcguirewoods.com/client-resources/alerts/2025/12/finras-2026-annual-regulatory-oversight-report-same-priorities-new-focus-on-ai-and-cybersecurity/)
- [Before you hit record — is your AI notetaking compliant?](https://www.advisor360.com/blog/before-you-hit-record-is-your-ai-notetaking-compliant) — state all-party consent; FINRA Rule 3170

**Method — extracting rubrics from expert demonstrations**
- [From Holistic Evaluation to Structured Criteria: Rubrics Across the Evolving LLM Landscape](https://arxiv.org/html/2606.08625v1)
- [A Rubric-Supervised Critic from Sparse Real-World Outcomes](https://arxiv.org/pdf/2603.03800) — behavioural rubric features from interaction trajectories
- [Anthropic — Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
