/**
 * Telemetry — single source of truth for the event schema, trust-battery
 * physics, and the Metrics view copy. Both demos emit this exact schema:
 * the lifecycle demo increments counters from scripted interactions, the
 * agent demo increments the same counters from real ones. Both render the
 * same Metrics view via renderMetricsView().
 */

/** Counter schema. Every event both demos may emit is named here. */
export const COUNTERS = {
  claimsGrounded: 'numeric claims grounded in a tool result or retrieved source',
  claimsTotal: 'numeric claims made',
  citesOpened: '📎 citation chips opened (verification engagement)',
  actionsProposed: 'write actions proposed (action cards shown)',
  actionsApproved: 'write actions explicitly approved by the user',
  escalations: 'appropriate escalations to a human (counted as SUCCESS)',
  refusals: 'compliant advice-line refusals (label: COMPLIANT_REFUSAL)',
  up: '👍 feedback',
  down: '👎 feedback (promoted to weekly eval triage)',
  memWrites: 'memory writes',
  memDeletes: 'memory deletes (honored immediately)',
  consentAsks: 'consent prompts shown before using derived/behavioral memory',
  consentGrants: 'consent grants',
  degradations: 'degradation events (honest disabled state)',
};

/**
 * Trust battery physics. Drains ~3× faster than it charges — the design
 * implication is asymmetric: preventing one egregious failure beats adding
 * several delights. Keep that asymmetry if you tune these numbers.
 */
export const TRUST_BATTERY = {
  initial: 30,
  drainMultiplier: 3,
  impact: {
    groundedClaims: +4, // per coach turn whose claims all verify
    citeOpen: +1,
    refusal: +2,
    consentGrant: +3,
    escalation: +3,
    actionApproved: +6,
    up: +2,
    down: -6,
    degradation: -2,
    ungroundedClaim: -12, // agent demo: a number that fails grounding drains hard
  },
};

export function createTelemetry() {
  const M = { battery: TRUST_BATTERY.initial };
  for (const k of Object.keys(COUNTERS)) M[k] = 0;
  return {
    counters: M,
    log(evt, delta) {
      if (evt in M) M[evt] += delta === undefined ? 1 : delta;
    },
    charge(n) { M.battery = Math.min(100, M.battery + n); },
    drain(n) { M.battery = Math.max(0, M.battery - n); },
    /** Apply a named trust-battery impact (sign encoded in TRUST_BATTERY.impact). */
    impact(name) {
      const n = TRUST_BATTERY.impact[name] || 0;
      if (n >= 0) this.charge(n); else this.drain(-n);
    },
    snapshot() { return { ...M }; },
    load(obj) { Object.assign(M, obj); },
  };
}

/** Feedback + regenerate UX copy — shared by both demos' chat UIs. */
export const FEEDBACK_COPY = {
  upToast: `👍 logged as a quality signal on this turn's trace.`,
  downToast: `👎 logged → this conversation is promoted to weekly eval triage as a golden-set candidate. Trust battery drains faster than it charges.`,
  regenToast: `In production: regenerates with the same grounding context, logs a quality signal, and never changes cited figures without re-retrieval.`,
};

/* ---------------- Metrics view (rendered identically by both demos) ---------------- */

export const METRICS_LEDE = {
  title: 'Instrumentation — what the demo is logging right now',
  lede:
    `Every interaction increments these counters, exactly as production telemetry would. The point: <b>metrics aren't a report, they're the steering wheel</b> — each one below names the design decision it drives.`,
};

export function metricCards(M) {
  const faith = M.claimsTotal ? M.claimsGrounded / M.claimsTotal : null;
  const conv = M.actionsProposed ? Math.round((100 * M.actionsApproved) / M.actionsProposed) : null;
  return [
    { label: 'Faithfulness (session)', value: faith === null ? '—' : faith.toFixed(2), target: 'target ≈ 1.0 on cited figures', cls: faith !== null && faith < 0.9 ? 'warn' : 'good',
      why: 'Claims grounded in retrieved sources ÷ total claims. Gates every release; drift vs frozen golden set reviewed weekly.' },
    { label: 'Verification engagement', value: M.citesOpened, target: '📎 citations opened', cls: 'good',
      why: 'Users checking sources = trust affordance working. A sudden rise can also flag doubt — read with CSAT.' },
    { label: 'Action conversion', value: conv === null ? '—' : conv + '%', target: `${M.actionsApproved} approved / ${M.actionsProposed} proposed`, cls: 'good',
      why: 'Fogg check: are nudges arriving at high-motivation moments with near-effortless acceptance? Low conversion = wrong moment or wrong prominence, not a pushier CTA.' },
    { label: 'Appropriate escalations', value: M.escalations, target: 'counted as SUCCESS', cls: 'good',
      why: 'In finance you want some escalations. Measured on handoff-context quality, not avoided. Containment that exhausts users is a red flag.' },
    { label: 'Compliant refusals', value: M.refusals, target: 'label: COMPLIANT_REFUSAL', cls: 'good',
      why: 'Advice-line guardrails triggered and explained. Model graders emit labels (compliant / needs-review / violation), not scores.' },
    { label: 'Feedback signals', value: `👍 ${M.up} · 👎 ${M.down}`, target: '👎 → weekly eval triage', cls: M.down > 0 ? 'warn' : 'good',
      why: 'Every 👎 is promoted into the golden dataset as a candidate regression test. Feedback is eval fuel, not a vanity metric.' },
    { label: 'Memory ops', value: `${M.memWrites}w / ${M.memDeletes}d`, target: `consent: ${M.consentGrants}/${M.consentAsks} granted`, cls: 'good',
      why: 'Memory precision is evaluated like retrieval: wrong memory erodes trust faster than no memory. Deletes are honored immediately and logged.' },
    { label: 'Degradation events', value: M.degradations, target: 'disabled state, not improvisation', cls: M.degradations > 0 ? 'warn' : 'good',
      why: 'Outage / low-confidence turns degrade to an honest disabled state. Market-crash day = peak load + peak anxiety — the worst time to improvise.' },
  ];
}

export const REVIEW_CADENCE = [
  { cadence: 'Daily', review: 'Fallback / refusal spikes, guardrail triggers, outage &amp; degradation events', decision: 'Incident response; hotfix prompts or disable affected intents (degrade, don\'t improvise)' },
  { cadence: 'Weekly', review: '👎 triage → failed conversations promoted into the golden dataset; faithfulness drift vs frozen golden set; escalation-context quality', decision: 'Eval-gated releases: no prompt/model/config change ships without passing the updated suite' },
  { cadence: 'Monthly', review: 'Trust battery trend, CSAT by topic, containment vs <i>appropriate</i> escalation mix, action conversion, session return rate', decision: 'Roadmap: which conversation states earn more autonomy (Sheridan level promotion), which need redesign' },
  { cadence: 'Quarterly', review: 'Kano re-survey (AI delighters decay into must-bes), red-team engagement, memory-precision audit', decision: 'Strategy: where statefulness is compounding trust — and where it\'s uncanny-valley risk' },
];

export const FLYWHEEL_HTML =
  `<b>The evolution flywheel:</b> production traces <span class="arrow">→</span> quality signals (👍/👎, corrections, escalations, citation-opens) <span class="arrow">→</span> weekly triage promotes failures into the <b>golden dataset</b> <span class="arrow">→</span> eval suite gates every release (faithfulness ≥ 0.9 in finance — practically 1.0 on cited figures) <span class="arrow">→</span> passing states earn autonomy promotions on the Sheridan scale <span class="arrow">→</span> more capable coach generates richer traces. <br>Trust charges slowly and drains fast — the battery below is the churn leading-indicator, reviewed monthly.`;

/** Full inner HTML for the .metrics-wrap container — used verbatim by both demos. */
export function renderMetricsView(M, { note = 'Counters reset on reload.' } = {}) {
  const cards = metricCards(M);
  const grid = cards.map(c =>
    `<div class="m-card ${c.cls}"><div class="m-label">${c.label}</div><div class="m-value">${c.value}</div><div class="m-target">${c.target}</div><div class="m-why">${c.why}</div></div>`
  ).join('') +
    `<div class="m-card ${M.battery < 30 ? 'warn' : 'good'}" style="grid-column:1/-1"><div class="m-label">Trust battery (churn leading-indicator)</div>
     <div class="battery"><i style="width:${M.battery}%"></i></div>
     <div class="m-target">${M.battery}% — charges with grounded answers &amp; kept promises; drains ~${TRUST_BATTERY.drainMultiplier}× faster on errors and misremembered facts</div>
     <div class="m-why">Proxies instrumented: correction rate, override rate, re-verification behavior, abandonment. Sustained drain = churn warning reviewed monthly. Design implication is asymmetric: preventing one egregious failure beats adding several delights.</div></div>`;
  const cadence = REVIEW_CADENCE.map(r =>
    `<tr><td><b>${r.cadence}</b></td><td>${r.review}</td><td>${r.decision}</td></tr>`).join('');
  return `
    <h2>${METRICS_LEDE.title}</h2>
    <div class="lede">${METRICS_LEDE.lede} ${note}</div>
    <div class="m-grid">${grid}</div>
    <div class="cadence">
      <h3>Review cadence — how signals become product changes</h3>
      <table><tr><th>Cadence</th><th>Review</th><th>Decision it feeds</th></tr>${cadence}</table>
    </div>
    <div class="flywheel">${FLYWHEEL_HTML}</div>`;
}
