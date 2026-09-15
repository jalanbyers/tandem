# Precedent — corpus and codebook

Companion tool to Tandem. Derives how the coach conducts a conversation from what human
advisors actually do. Architecture: [`docs/PRECEDENT.md`](../docs/PRECEDENT.md).

**Status: phases 0–1 only.** The corpus and the codebook exist, and five precedents are
drafted and affirmed in [`shared/precedents.js`](../shared/precedents.js). **Nothing is
wired into either demo and nothing runs at inference time.** `describePrecedents()` is
exported as the seam for phase 3 and is not yet called by anything.

```
precedent/
  codebook.js                controlled vocabulary — mi.* cfp.* seq.* esc.* lic.*
  data/transcripts/*.md      12 synthetic advisor sessions (RAW — pre-ingest)
  data/corpus/               de-identified output (gitignored; phase 4 writes it)
```

## The data is fictional, and raw on purpose

Every session, advisor, client, firm and account is invented. The transcripts are *raw*
fixtures — they sit on the **upstream** side of the ingest gate, so they deliberately
contain the things the gate is supposed to catch:

| Session | Fixture | What it exercises |
|---|---|---|
| `0155` | `reject:no-secondary-consent` | consent to record ≠ consent to secondary use |
| `0186` | `reject:no-consent-record` | **default deny** — absence is not "unknown" |
| `0174` | `strip:planted-pii` | de-identification, on a session that *is* eligible |

Planted identifiers use reserved/invalid formats so they can never collide with a real
person: `example.com` (RFC 2606), `555-01xx` phone numbers, `000-00-xxxx` SSNs.

`0155` is the fixture that matters most. It contains genuinely good transferable moves and
must still be rejected — because usefulness is exactly the pressure that erodes consent
handling in practice.

## Corpus composition

Twelve sessions, three advisors (`adv-07`, `adv-12`, `adv-21`). Ten are eligible; two are
rejected at the gate and appear in no precedent's provenance.

Deliberately **not** all crisis calls. `0163` is a routine review and `0191` is a windfall —
a precedent library built only from falling markets would teach a coach that anxiety and
losses are the same event, and that every interaction is an emergency.

## Recurrence thresholds

A move becomes a candidate precedent only if it clears both bars in `codebook.js`:

- **≥5 sessions** — one session is idiosyncrasy, not practice
- **≥2 advisors** — otherwise you have encoded one person's personal style as the firm's

`seq.*` codes carry a higher bar (**6 sessions**) because they have no published framework
behind them. `mi.*` and `cfp.*` are grounded in MI/OARS and the CFP Board 7-step process.

## What is *not* here

No recommendations. The advisors in these transcripts give plenty — "not all to cash",
"carve out the tuition", "thirds over eighteen months" — and every one is coded `lic.*` and
excluded from precedent. That material has a different job: it refines the escalation
triggers in `shared/guardrails.js`, teaching Tandem *when to hand off* rather than what to
say. See [`docs/PRECEDENT.md`](../docs/PRECEDENT.md) §2.

## Next

Phase 2 adds Tier 1c to `evals/run-evals.js` and turns the invariants below into gates.
Until then they are conventions held by hand:

- every `binding` precedent has ≥1 golden case, ≥5 sessions, ≥2 advisors, and a named affirmer
- no `transferable: false` precedent is ever `binding`
- no precedent cites a rejected session
- every code used exists in `codebook.js`
