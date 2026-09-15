/**
 * Precedent — controlled vocabulary for coding advisor sessions.
 *
 * Every coded move in the corpus must carry codes drawn from here. Free-text
 * coding is how a taxonomy rots: two coders invent two names for one move and
 * the n≥5 recurrence threshold silently stops working. The codebook is the
 * guard against that, and an eval checks the corpus against it (Tier 1d).
 *
 * Two families, and the split is the whole design (see docs/PRECEDENT.md §2):
 *   mi.* cfp.* seq.* esc.*  — TRANSFERABLE. How the advisor conducted the
 *                             conversation. Binding on Tandem; becomes precedent.
 *   lic.*                   — LICENSED-ONLY. What the advisor actually advised.
 *                             Persuasive authority from a jurisdiction Tandem does
 *                             not sit in. Never becomes precedent; refines the
 *                             escalation triggers in shared/guardrails.js instead.
 *
 * This file is a pipeline artifact, not shared state — the demos never render
 * codes, only precedent names. It deliberately does not import from shared/,
 * and shared/precedents.js deliberately does not import from here: codes are
 * validated as strings by the pipeline, so shared/ stays dependency-free.
 */

/** Grounded in published practice frameworks, cited per code where applicable. */
export const FRAMEWORKS = {
  mi: {
    label: 'Motivational Interviewing — OARS',
    source: 'https://motivationalinterviewing.org/understanding-motivational-interviewing',
    note: 'Spirit of MI: partnership, acceptance, empowerment, compassion.',
  },
  cfp: {
    label: 'CFP Board — 7-step financial planning process',
    source: 'https://www.cfp.net/ethics/compliance-resources/2018/11/focus-on-ethics---the-7-step-financial-planning-process',
    note: 'Steps are CGADPIM: Circumstances, Gather, Analyze, Develop, Present, Implement, Monitor.',
  },
  seq: {
    label: 'Observed sequencing',
    source: null,
    note: 'Not from a published framework — these emerged from the corpus. Held to a higher n.',
  },
  esc: {
    label: 'Escalation handling',
    source: null,
    note: 'How advisors route a matter to a human without abandoning the person mid-conversation.',
  },
  lic: {
    label: 'Licensed-only',
    source: null,
    note: 'Marks material Tandem may never reproduce. Feeds escalation triggers, never precedent.',
  },
};

/**
 * @typedef {Object} Code
 * @property {string} id           dotted code, family-prefixed
 * @property {string} label        short human name
 * @property {string} definition   what must be true of a turn for this code to apply
 * @property {boolean} transferable false ⇒ may never appear in a precedent
 */

/** @type {Code[]} */
export const CODES = [
  /* ---- MI / OARS ---- */
  { id: 'mi.open-question', label: 'Open question', transferable: true,
    definition: 'A question that cannot be answered yes/no or with a single number, inviting the client to describe their own situation.' },
  { id: 'mi.affirmation', label: 'Affirmation', transferable: true,
    definition: 'Names a specific strength or action the client has already taken. Not generic praise.' },
  { id: 'mi.reflection', label: 'Reflection', transferable: true,
    definition: 'Restates the client\'s meaning — especially feeling — in the advisor\'s words, without adding information.' },
  { id: 'mi.summary', label: 'Summary', transferable: true,
    definition: 'Collects several threads of the conversation into one recap, usually before a transition.' },

  /* ---- CFP Board 7-step ---- */
  { id: 'cfp.1-circumstances', label: 'Understand circumstances', transferable: true,
    definition: 'Establishes the client\'s personal and financial situation, including non-financial context.' },
  { id: 'cfp.2-gather', label: 'Gather goals and data', transferable: true,
    definition: 'Elicits goals, priorities, time horizon, or the data needed to analyse them.' },
  { id: 'cfp.3-analyze', label: 'Analyze course of action', transferable: true,
    definition: 'Examines the current course and reasonable alternatives against the client\'s goals.' },
  { id: 'cfp.4-develop', label: 'Develop recommendation', transferable: false,
    definition: 'Forms a recommendation. Licensed act — coded for completeness, never transferable.' },
  { id: 'cfp.5-present', label: 'Present recommendation', transferable: false,
    definition: 'Communicates a recommendation and its basis. Licensed act.' },
  { id: 'cfp.6-implement', label: 'Implement', transferable: false,
    definition: 'Executes or arranges execution. Licensed act.' },
  { id: 'cfp.7-monitor', label: 'Monitor and follow up', transferable: true,
    definition: 'Establishes what happens next, who does it, and when it will be revisited.' },

  /* ---- Observed sequencing ---- */
  { id: 'seq.empathy-before-data', label: 'Empathy before data', transferable: true,
    definition: 'The turn acknowledges the client\'s stated feeling BEFORE any figure, projection, or historical framing appears in the conversation.' },
  { id: 'seq.trigger-before-instrument', label: 'Trigger before instrument', transferable: true,
    definition: 'When the client raises an action, the advisor asks what prompted it before discussing the holding, account, or mechanics.' },
  { id: 'seq.check-understanding', label: 'Check understanding', transferable: true,
    definition: 'Explicitly asks whether the explanation landed, rather than assuming it did.' },
  { id: 'seq.slow-down', label: 'Slow it down', transferable: true,
    definition: 'Explicitly decouples the decision from the moment — names that it does not have to be resolved today.' },

  /* ---- Escalation handling ---- */
  { id: 'esc.offer-human', label: 'Offer a human', transferable: true,
    definition: 'Offers another person — colleague, specialist, second opinion — as an option the client may take.' },
  { id: 'esc.stay-present', label: 'Stay present', transferable: true,
    definition: 'The offer of escalation does not end the advisor\'s engagement; they remain in the conversation rather than deferring and closing.' },
  { id: 'esc.name-the-cost', label: 'Name the cost both ways', transferable: true,
    definition: 'Lays out what a course of action costs AND what it buys, so the client weighs a real tradeoff rather than receiving an argument.' },
  { id: 'esc.no-action-without-say-so', label: 'Nothing happens unless you say so', transferable: true,
    definition: 'States explicitly that no change occurs without the client\'s instruction.' },

  /* ---- Licensed-only ---- */
  { id: 'lic.recommendation', label: 'Specific recommendation', transferable: false,
    definition: 'Tells the client what to do with their money: buy, sell, hold, reallocate, contribute at a level.' },
  { id: 'lic.suitability', label: 'Suitability judgment', transferable: false,
    definition: 'Judges whether an instrument or allocation is appropriate for this client\'s circumstances.' },
  { id: 'lic.product-specific', label: 'Named product or security', transferable: false,
    definition: 'Names a specific fund, security, ticker, or product as a course of action.' },
  { id: 'lic.tax-position', label: 'Tax position', transferable: false,
    definition: 'Advises on tax treatment or strategy. Out-of-policy for Tandem regardless of licensure.' },
];

const BY_ID = new Map(CODES.map(c => [c.id, c]));

export function getCode(id) { return BY_ID.get(id) || null; }
export function isKnownCode(id) { return BY_ID.has(id); }

/** Codes that may appear in a precedent. Anything else is licensed-only. */
export function transferableCodes() { return CODES.filter(c => c.transferable).map(c => c.id); }
export function licensedCodes() { return CODES.filter(c => !c.transferable).map(c => c.id); }

/** Family prefix of a code, e.g. 'seq.empathy-before-data' → 'seq'. */
export function familyOf(id) { return String(id).split('.')[0]; }

/**
 * Inter-rater reliability gate (docs/PRECEDENT.md §4.4). Two coders code an
 * overlap sample; below threshold the CODEBOOK is refined, not the coders —
 * a low κ means the definitions above are ambiguous.
 */
export const IRR = {
  overlapSamplePct: 20,
  metric: "Cohen's kappa",
  threshold: 0.7,
  onFailure: 'Refine the code definition that disagreed. Never retrain the coder to match.',
};

/**
 * Recurrence thresholds for promoting an observed move to a proposed precedent.
 * Sessions guards against one-off idiosyncrasy; advisors guards against one
 * advisor's personal style being mistaken for the firm's practice.
 */
export const RECURRENCE = {
  minSessions: 5,
  minAdvisors: 2,
  // seq.* has no published framework behind it, so it carries its own burden
  minSessionsUnframeworked: 6,
};
