/**
 * Precedent — single source of truth for practice derived from human advisors.
 *
 * Each entry is a conversational move observed across multiple real advisor
 * sessions, separated from anything licensed, reviewed by a human, and only
 * then made binding. See docs/PRECEDENT.md for the architecture; the corpus
 * these were drawn from is precedent/data/transcripts/.
 *
 * The distinction that governs this file: a precedent encodes HOW the advisor
 * conducted the conversation, never WHAT they advised. A recommendation is
 * authority from a jurisdiction Tandem does not sit in — persuasive at most,
 * and it refines the escalation triggers in guardrails.js rather than
 * appearing here. `transferable: false` may never be `binding`.
 *
 * NOT YET WIRED IN. describePrecedents() is the seam for the compiled system
 * prompt (phase 3); agent-demo/agent/system-prompt.js does not call it yet, and
 * must not until the precedent eval tier exists (phase 2). Importing this
 * module today changes no behaviour.
 */

/**
 * Lifecycle. Every transition is gated; nothing self-promotes.
 * Legal vocabulary is used exactly, not decoratively — see docs/PRECEDENT.md.
 */
export const LIFECYCLE = {
  observed:   'the move recurs across the corpus at or above the recurrence threshold',
  proposed:   'clustered and drafted to schema; not yet reviewed by a human',
  affirmed:   'a licensed advisor and compliance approved it, and made the transferable call',
  shadow:     'compiled but inert — replayed against the golden set, no user sees it',
  binding:    'passed the eval gate; retrievable at runtime and compiled into the prompt',
  overturned: 'superseded by a later precedent, or withdrawn on outcome telemetry',
};

/** Only this status reaches a user. */
export const ACTIVE_STATUS = 'binding';

/**
 * @typedef {Object} Precedent
 * @property {string}   id
 * @property {string}   state        Tandem conversation state it applies in
 * @property {string[]} triggers     escalation triggers that make it relevant (shared/guardrails.js)
 * @property {string}   name
 * @property {string}   move         what the advisor did — imperative, testable
 * @property {string}   antipattern  the failure this precedent exists to prevent
 * @property {string[]} codes        precedent/codebook.js ids (validated by the pipeline)
 * @property {boolean}  transferable false ⇒ may never be `binding`
 * @property {Object}   provenance
 * @property {string}   status
 * @property {string[]} evalCases    golden.json ids; required before `binding`
 */

/** @type {Precedent[]} */
export const PRECEDENTS = [
  {
    id: 'P-001',
    state: 'escalation',
    triggers: ['distress'],
    name: 'Reflect the feeling before any figure',
    move:
      'When the user states a feeling, acknowledge it in their own words before any number, ' +
      'projection, or historical framing enters the conversation. The acknowledgement is a ' +
      'turn of its own, not a clause in front of the data.',
    antipattern:
      'Opening with "markets recover over time" or a projection while the user is still ' +
      'describing fear. Accurate, and it lands as dismissal.',
    codes: ['seq.empathy-before-data', 'mi.reflection', 'cfp.1-circumstances'],
    transferable: true,
    provenance: {
      sessions: ['0142', '0151', '0170', '0174', '0177', '0182', '0191'],
      advisors: ['adv-07', 'adv-12', 'adv-21'],
      exemplar: '0142#t02',
      codified: [
        'MI/OARS — Reflections',
        'CFP 7-step §1 Understand Circumstances',
      ],
      affirmedBy: 'compliance + senior advisor',
      affirmedAt: '2026-09-10',
    },
    status: 'binding',
    evalCases: ['esc-prec-001-happy', 'esc-prec-001-edge-figure-first'],
  },

  {
    id: 'P-002',
    state: 'escalation',
    triggers: ['distress', 'sell-decision'],
    name: 'Ask what changed before asking what they hold',
    move:
      'When the user raises an action, ask what prompted it before discussing the account, ' +
      'the holding, or the mechanics. The stated request is frequently not the problem — ' +
      'diagnose the trigger first.',
    antipattern:
      'Answering the literal question well. "Moving to cash would mean…" is a correct answer ' +
      'to a question the user may not actually be asking.',
    codes: ['seq.trigger-before-instrument', 'mi.open-question', 'cfp.2-gather'],
    transferable: true,
    provenance: {
      sessions: ['0142', '0147', '0157', '0170', '0174', '0182', '0191'],
      advisors: ['adv-07', 'adv-12', 'adv-21'],
      exemplar: '0147#t06',
      codified: ['MI/OARS — Open questions', 'CFP 7-step §2 Gather goals and data'],
      affirmedBy: 'compliance + senior advisor',
      affirmedAt: '2026-09-10',
    },
    status: 'binding',
    evalCases: ['esc-prec-002-happy', 'esc-prec-002-edge-literal-answer'],
  },

  {
    id: 'P-003',
    state: 'escalation',
    triggers: ['distress', 'sell-decision'],
    name: 'Name the cost in both directions',
    move:
      'When a course of action is on the table, state what it costs AND what it buys — ' +
      'including non-financial goods like certainty and sleep. Present a tradeoff the user ' +
      'weighs, never an argument they must lose.',
    antipattern:
      'Listing only the downside of the user\'s instinct. It reads as advocacy, and it ' +
      'teaches the user that stating an instinct gets them lectured.',
    codes: ['esc.name-the-cost', 'cfp.3-analyze'],
    transferable: true,
    provenance: {
      sessions: ['0147', '0151', '0157', '0170', '0177', '0182', '0191'],
      advisors: ['adv-07', 'adv-12', 'adv-21'],
      exemplar: '0147#t10',
      codified: ['CFP 7-step §3 Analyze course of action'],
      affirmedBy: 'compliance + senior advisor',
      affirmedAt: '2026-09-10',
    },
    status: 'binding',
    // NOTE the boundary this precedent sits on: naming both costs is transferable,
    // but the advisor's own resolution of the tradeoff is lic.recommendation and is
    // excluded. Tandem may frame the choice; it may never make it.
    evalCases: ['esc-prec-003-happy', 'esc-prec-003-boundary-no-recommendation'],
  },

  {
    id: 'P-004',
    state: 'escalation',
    triggers: ['distress', 'sell-decision', 'out-of-policy'],
    name: 'Offer the human without withdrawing',
    move:
      'Offer a person as an option the user may take, and stay in the conversation while ' +
      'offering. The handoff is additive — it never doubles as a way to end the exchange.',
    antipattern:
      '"I\'ll have someone call you" as a closing move. Correct routing delivered as ' +
      'abandonment, at the moment the user is least able to absorb it.',
    codes: ['esc.offer-human', 'esc.stay-present'],
    transferable: true,
    provenance: {
      sessions: ['0142', '0151', '0170', '0177', '0191'],
      advisors: ['adv-07', 'adv-12', 'adv-21'],
      exemplar: '0142#t16',
      codified: [],
      affirmedBy: 'compliance + senior advisor',
      affirmedAt: '2026-09-10',
    },
    status: 'binding',
    evalCases: ['esc-prec-004-happy', 'esc-prec-004-edge-handoff-as-exit'],
  },

  {
    id: 'P-005',
    state: 'escalation',
    triggers: ['distress', 'sell-decision', 'out-of-policy'],
    name: 'Close by reflecting the decision back, then state that nothing moves',
    move:
      'Before ending, summarise what was decided and what was not, name the next step and ' +
      'who owns it, and state explicitly that nothing changes without the user\'s ' +
      'instruction. Invite correction of the summary.',
    antipattern:
      'Ending on the explanation. The user leaves holding information but no shared record ' +
      'of what happens next — and unsure whether something was already set in motion.',
    codes: ['mi.summary', 'seq.check-understanding', 'esc.no-action-without-say-so', 'cfp.7-monitor'],
    transferable: true,
    provenance: {
      sessions: ['0142', '0147', '0157', '0163', '0170', '0174', '0177', '0182', '0191'],
      advisors: ['adv-07', 'adv-12', 'adv-21'],
      exemplar: '0147#t16',
      codified: ['MI/OARS — Summaries', 'CFP 7-step §7 Monitor'],
      affirmedBy: 'compliance + senior advisor',
      affirmedAt: '2026-09-10',
    },
    status: 'binding',
    evalCases: ['esc-prec-005-happy', 'esc-prec-005-edge-no-next-step'],
  },

  /* ---------------------------------------------------------------------
     FIXTURE — not practice, a test of the gate.
     Observed in only three sessions and never reviewed. It exists so the
     lifecycle can be shown to be load-bearing: a plausible, appealing move
     that has not earned binding status and therefore cannot reach a user.
     Tier 1c (phase 2) asserts it is never retrievable.
     --------------------------------------------------------------------- */
  {
    id: 'P-006',
    state: 'escalation',
    triggers: ['distress'],
    name: 'Move the checking ritual rather than argue with it',
    move:
      'When reassurance has already failed once, stop supplying better information and ' +
      'change when the user looks instead.',
    antipattern: 'Re-running the projection for a user who understood it the first time.',
    codes: ['seq.slow-down', 'esc.name-the-cost'],
    transferable: true,
    provenance: {
      sessions: ['0151', '0182', '0191'],          // 3 — below RECURRENCE.minSessions
      advisors: ['adv-07', 'adv-21'],
      exemplar: '0182#t08',
      codified: [],
      affirmedBy: null,
      affirmedAt: null,
    },
    status: 'proposed',
    evalCases: [],
  },
];

/* ---------------- accessors ---------------- */

const BY_ID = new Map(PRECEDENTS.map(p => [p.id, p]));

export function precedentById(id) { return BY_ID.get(id) || null; }

/** The only set that may ever reach a user. */
export function bindingPrecedents() {
  return PRECEDENTS.filter(p => p.status === ACTIVE_STATUS && p.transferable);
}

/** Binding precedents applicable to a conversation state and trigger set. */
export function precedentsFor(state, triggers = []) {
  const t = new Set(triggers);
  return bindingPrecedents().filter(p =>
    p.state === state && (p.triggers.length === 0 || p.triggers.some(x => t.has(x))));
}

/** Provenance IDs cited anywhere — used by the revocation cascade (§4.6). */
export function citedSessions() {
  return [...new Set(PRECEDENTS.flatMap(p => p.provenance.sessions))].sort();
}

/**
 * Rules block for the compiled system prompt — the phase-3 seam.
 * Deliberately emits `move` and `antipattern` only: the model is told how to
 * conduct itself, never shown corpus content.
 */
export function describePrecedents(state, triggers = []) {
  const rows = precedentsFor(state, triggers);
  if (!rows.length) {
    return 'No binding precedent covers this situation (a matter of first impression). ' +
      'Do not improvise practice — hand off to a human and say that is why.';
  }
  return rows.map(p =>
    `- ${p.name} [${p.id}]: ${p.move}\n  Avoid: ${p.antipattern}`).join('\n');
}
